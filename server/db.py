"""SQLite persistence for chat conversations and trip bookings."""

import json
import sqlite3
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
DB_PATH = DATA_DIR / "chat.db"
TICKETS_DIR = DATA_DIR / "tickets"


def get_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            trip_id TEXT PRIMARY KEY,
            messages_json TEXT NOT NULL DEFAULT '[]',
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trip_bookings (
            trip_id TEXT PRIMARY KEY,
            bookings_json TEXT NOT NULL DEFAULT '[]',
            updated_at TEXT NOT NULL
        )
    """)
    conn.commit()
    return conn


def get_conversation(trip_id: str) -> list[dict]:
    conn = get_db()
    row = conn.execute(
        "SELECT messages_json FROM conversations WHERE trip_id = ?", (trip_id,)
    ).fetchone()
    return json.loads(row["messages_json"]) if row else []


def save_conversation(trip_id: str, messages: list[dict]):
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO conversations (trip_id, messages_json, updated_at) VALUES (?, ?, ?)",
        (trip_id, json.dumps(messages), datetime.now().isoformat()),
    )
    conn.commit()


def delete_conversation(trip_id: str):
    conn = get_db()
    conn.execute("DELETE FROM conversations WHERE trip_id = ?", (trip_id,))
    conn.commit()


def get_bookings(trip_id: str) -> list[dict]:
    conn = get_db()
    row = conn.execute(
        "SELECT bookings_json FROM trip_bookings WHERE trip_id = ?", (trip_id,)
    ).fetchone()
    return json.loads(row["bookings_json"]) if row else []


def save_bookings(trip_id: str, bookings: list[dict]):
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO trip_bookings (trip_id, bookings_json, updated_at) VALUES (?, ?, ?)",
        (trip_id, json.dumps(bookings), datetime.now().isoformat()),
    )
    conn.commit()


def ticket_path(trip_id: str, name: str) -> Path:
    """Resolve an attachment path, rejecting anything outside the per-trip dir."""
    base = (TICKETS_DIR / trip_id).resolve()
    target = (base / name).resolve()
    if not str(target).startswith(str(base) + "/") and target != base:
        raise ValueError("attachment path escapes tickets dir")
    return target
