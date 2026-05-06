"""SQLite persistence for deals, feedback, preferences, and alert settings.

Uses the same bopthere.db as the main app.
"""

import json
import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "bopthere.db"


def get_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    _init_tables(conn)
    return conn


def _init_tables(conn: sqlite3.Connection):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS sent_deals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sent_at TEXT NOT NULL,
            destination TEXT NOT NULL,
            country TEXT NOT NULL,
            depart_date TEXT NOT NULL,
            total_cost REAL NOT NULL,
            summary TEXT NOT NULL,
            deal_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deal_id INTEGER REFERENCES sent_deals(id),
            timestamp TEXT NOT NULL,
            reaction TEXT NOT NULL,
            note TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS preferences (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS deal_alerts (
            username TEXT PRIMARY KEY,
            enabled INTEGER NOT NULL DEFAULT 0,
            signal_number TEXT NOT NULL DEFAULT '',
            home_airport TEXT NOT NULL DEFAULT 'AUS',
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)
    conn.commit()


def save_sent_deal(conn: sqlite3.Connection, destination: str, country: str,
                   depart_date: str, total_cost: float, summary: str,
                   deal_json: str) -> int:
    cur = conn.execute(
        "INSERT INTO sent_deals (sent_at, destination, country, depart_date, total_cost, summary, deal_json) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (datetime.now().isoformat(), destination, country, depart_date, total_cost, summary, deal_json),
    )
    conn.commit()
    return cur.lastrowid


def save_feedback(conn: sqlite3.Connection, deal_id: int, reaction: str, note: str = ""):
    conn.execute(
        "INSERT INTO feedback (deal_id, timestamp, reaction, note) VALUES (?, ?, ?, ?)",
        (deal_id, datetime.now().isoformat(), reaction, note),
    )
    conn.commit()


def get_latest_deal(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM sent_deals ORDER BY id DESC LIMIT 1"
    ).fetchone()


def get_feedback_summary(conn: sqlite3.Connection) -> dict:
    rows = conn.execute("""
        SELECT sd.destination, sd.country, f.reaction, f.note
        FROM feedback f
        JOIN sent_deals sd ON f.deal_id = sd.id
        ORDER BY f.timestamp DESC
        LIMIT 50
    """).fetchall()

    liked = []
    disliked = []
    for r in rows:
        dest = f"{r['destination']}, {r['country']}"
        if r["reaction"] in ("like", "love"):
            liked.append({"destination": dest, "note": r["note"]})
        elif r["reaction"] == "dislike":
            disliked.append({"destination": dest, "note": r["note"]})

    return {"liked": liked, "disliked": disliked}


def get_sent_destinations(conn: sqlite3.Connection, days: int = 30) -> list[str]:
    rows = conn.execute(
        "SELECT DISTINCT destination FROM sent_deals WHERE sent_at > datetime('now', ?)",
        (f"-{days} days",),
    ).fetchall()
    return [r["destination"] for r in rows]


def set_preference(conn: sqlite3.Connection, key: str, value: str):
    conn.execute(
        "INSERT OR REPLACE INTO preferences (key, value, updated_at) VALUES (?, ?, ?)",
        (key, value, datetime.now().isoformat()),
    )
    conn.commit()


def get_preference(conn: sqlite3.Connection, key: str, default: str = "") -> str:
    row = conn.execute("SELECT value FROM preferences WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


# --- Deal alert settings ---

def get_enabled_alerts(conn: sqlite3.Connection) -> list[dict]:
    """Get all users with alerts enabled."""
    rows = conn.execute(
        "SELECT username, signal_number, home_airport FROM deal_alerts WHERE enabled = 1"
    ).fetchall()
    return [dict(r) for r in rows]


def get_alert_settings(conn: sqlite3.Connection, username: str) -> dict:
    row = conn.execute(
        "SELECT enabled, signal_number, home_airport FROM deal_alerts WHERE username = ?",
        (username,),
    ).fetchone()
    if row:
        return {"enabled": bool(row["enabled"]), "signal_number": row["signal_number"], "home_airport": row["home_airport"]}
    return {"enabled": False, "signal_number": "", "home_airport": "AUS"}


def set_alert_settings(conn: sqlite3.Connection, username: str, enabled: bool,
                       signal_number: str, home_airport: str):
    conn.execute(
        "INSERT OR REPLACE INTO deal_alerts (username, enabled, signal_number, home_airport, updated_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (username, int(enabled), signal_number, home_airport, datetime.now().isoformat()),
    )
    conn.commit()
