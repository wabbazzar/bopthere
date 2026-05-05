"""Auth database — separate SQLite file for bopthere user credentials."""

import hashlib
import os
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "auth.db"


def get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.row_factory = sqlite3.Row
    return conn


def init_auth_db():
    """Create users table and seed default accounts."""
    conn = get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            username      TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            full_name     TEXT,
            role          TEXT NOT NULL DEFAULT 'user',
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    for username, full_name, role in [
        ("wesley", "Wesley", "admin"),
        ("heather", "Heather", "admin"),
    ]:
        _seed_user(conn, username, full_name, role)
    conn.close()


def _seed_user(conn, username: str, full_name: str, role: str):
    if conn.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone():
        return
    password_hash = hash_password(f"changeme-{username}")
    conn.execute(
        "INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)",
        (username, password_hash, full_name, role),
    )
    conn.commit()


def hash_password(password: str) -> str:
    """Hash password with random salt. Returns 'salt:hash' string."""
    salt = os.urandom(32).hex()
    pw_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}:{pw_hash}"


def verify_password(username: str, password: str) -> dict | None:
    """Verify credentials. Returns user dict on success, None on failure."""
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    conn.close()
    if not row:
        return None
    stored = row["password_hash"]
    if ":" not in stored:
        return None
    salt, expected_hash = stored.split(":", 1)
    actual_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    if actual_hash != expected_hash:
        return None
    return {"username": row["username"], "full_name": row["full_name"], "role": row["role"]}


def get_user(username: str) -> dict | None:
    """Look up user by username. Returns user dict without password."""
    conn = get_conn()
    row = conn.execute(
        "SELECT username, full_name, role FROM users WHERE username=?", (username,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None
