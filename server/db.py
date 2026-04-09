"""SQLite persistence for chat conversations."""

import json
import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "chat.db"


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
