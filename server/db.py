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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trips (
            trip_id    TEXT PRIMARY KEY,
            trip_json  TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trip_todos (
            trip_id    TEXT PRIMARY KEY,
            todos_json TEXT NOT NULL DEFAULT '[]',
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


# ── Trip data persistence ────────────────────────────────────────


def list_trips() -> list[dict]:
    """Return [{tripId, updatedAt}] for every persisted trip, newest first."""
    conn = get_db()
    rows = conn.execute(
        "SELECT trip_id, updated_at FROM trips ORDER BY updated_at DESC"
    ).fetchall()
    return [{"tripId": r["trip_id"], "updatedAt": r["updated_at"]} for r in rows]


def get_trip(trip_id: str) -> tuple[dict, str] | None:
    """Return (trip_dict, updated_at) or None if no row."""
    conn = get_db()
    row = conn.execute(
        "SELECT trip_json, updated_at FROM trips WHERE trip_id = ?", (trip_id,)
    ).fetchone()
    if not row:
        return None
    return json.loads(row["trip_json"]), row["updated_at"]


def save_trip(trip_id: str, trip_json: str, updated_at: str) -> tuple[bool, str | None]:
    """LWW save — writes only if updated_at >= stored value.

    Returns (True, updated_at) on success, (False, server_updated_at) if stale.
    """
    conn = get_db()
    existing = conn.execute(
        "SELECT updated_at FROM trips WHERE trip_id = ?", (trip_id,)
    ).fetchone()
    if existing and existing["updated_at"] > updated_at:
        return False, existing["updated_at"]
    conn.execute(
        "INSERT OR REPLACE INTO trips (trip_id, trip_json, updated_at) VALUES (?, ?, ?)",
        (trip_id, trip_json, updated_at),
    )
    conn.commit()
    return True, updated_at


def delete_trip(trip_id: str) -> bool:
    """Delete a trip and all associated data (bookings, todos, conversations).

    Returns True if a trip row was actually deleted, False if it didn't exist.
    """
    conn = get_db()
    cursor = conn.execute("DELETE FROM trips WHERE trip_id = ?", (trip_id,))
    conn.execute("DELETE FROM trip_bookings WHERE trip_id = ?", (trip_id,))
    conn.execute("DELETE FROM trip_todos WHERE trip_id = ?", (trip_id,))
    conn.execute("DELETE FROM conversations WHERE trip_id = ?", (trip_id,))
    conn.commit()
    return cursor.rowcount > 0


def get_todos(trip_id: str) -> tuple[list, str] | None:
    """Return (todos_list, updated_at) or None if no row."""
    conn = get_db()
    row = conn.execute(
        "SELECT todos_json, updated_at FROM trip_todos WHERE trip_id = ?", (trip_id,)
    ).fetchone()
    if not row:
        return None
    return json.loads(row["todos_json"]), row["updated_at"]


def save_todos(trip_id: str, todos_json: str, updated_at: str) -> tuple[bool, str | None]:
    """LWW save for todos — same semantics as save_trip."""
    conn = get_db()
    existing = conn.execute(
        "SELECT updated_at FROM trip_todos WHERE trip_id = ?", (trip_id,)
    ).fetchone()
    if existing and existing["updated_at"] > updated_at:
        return False, existing["updated_at"]
    conn.execute(
        "INSERT OR REPLACE INTO trip_todos (trip_id, todos_json, updated_at) VALUES (?, ?, ?)",
        (trip_id, todos_json, updated_at),
    )
    conn.commit()
    return True, updated_at
