"""SQLite persistence for BopThere app data."""

import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
DB_PATH = DATA_DIR / "bopthere.db"
TICKETS_DIR = DATA_DIR / "tickets"
PHOTOS_DIR = DATA_DIR / "photos"


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
    # Add deleted_at column for tombstone deletes (idempotent)
    try:
        conn.execute("ALTER TABLE trips ADD COLUMN deleted_at TEXT")
    except sqlite3.OperationalError:
        pass  # column already exists
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trip_todos (
            trip_id    TEXT PRIMARY KEY,
            todos_json TEXT NOT NULL DEFAULT '[]',
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trip_journal (
            trip_id      TEXT PRIMARY KEY,
            journal_json TEXT NOT NULL DEFAULT '[]',
            updated_at   TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trip_photos (
            photo_id    TEXT PRIMARY KEY,
            trip_id     TEXT NOT NULL,
            filename    TEXT NOT NULL,
            size_bytes  INTEGER NOT NULL,
            uploaded_by TEXT NOT NULL,
            created_at  TEXT NOT NULL
        )
    """)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_trip_photos_trip ON trip_photos(trip_id)"
    )
    ensure_per_entry_tables(conn)
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


def get_trip(trip_id: str) -> tuple[dict, str] | None:
    """Return (trip_dict, updated_at) or None if no row or tombstoned."""
    conn = get_db()
    row = conn.execute(
        "SELECT trip_json, updated_at FROM trips WHERE trip_id = ? AND deleted_at IS NULL",
        (trip_id,),
    ).fetchone()
    if not row:
        return None
    return json.loads(row["trip_json"]), row["updated_at"]


def save_trip(trip_id: str, trip_json: str, updated_at: str) -> tuple[bool, str | None]:
    """LWW save — writes only if updated_at >= stored value.
    Clears any tombstone so re-created trips come back to life.

    Returns (True, updated_at) on success, (False, server_updated_at) if stale.
    """
    conn = get_db()
    existing = conn.execute(
        "SELECT updated_at, deleted_at FROM trips WHERE trip_id = ?", (trip_id,)
    ).fetchone()
    if existing and not existing["deleted_at"] and existing["updated_at"] > updated_at:
        return False, existing["updated_at"]
    conn.execute(
        "INSERT OR REPLACE INTO trips (trip_id, trip_json, updated_at, deleted_at) VALUES (?, ?, ?, NULL)",
        (trip_id, trip_json, updated_at),
    )
    conn.commit()
    return True, updated_at


def delete_trip(trip_id: str) -> bool:
    """Tombstone-delete a trip (set deleted_at). Associated data (bookings,
    todos, conversations) is preserved for manual recovery.

    Returns True if a live trip was tombstoned, False if it didn't exist.
    """
    conn = get_db()
    now = datetime.now().isoformat()
    cursor = conn.execute(
        "UPDATE trips SET deleted_at = ? WHERE trip_id = ? AND deleted_at IS NULL",
        (now, trip_id),
    )
    conn.commit()
    return cursor.rowcount > 0


# ── Trip members (access control) ────────────────────────────────


def get_trip_members(trip_id: str) -> list[dict]:
    """Return all members of a trip with their roles."""
    conn = get_db()
    rows = conn.execute(
        "SELECT username, role, added_at, added_by FROM trip_members WHERE trip_id = ?",
        (trip_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_user_trip_ids(username: str) -> list[str]:
    """Return all trip_ids a user has access to."""
    conn = get_db()
    rows = conn.execute(
        "SELECT trip_id FROM trip_members WHERE username = ?", (username,)
    ).fetchall()
    return [r["trip_id"] for r in rows]


def get_trip_member_role(trip_id: str, username: str) -> str | None:
    """Return the user's role for a trip, or None if not a member."""
    conn = get_db()
    row = conn.execute(
        "SELECT role FROM trip_members WHERE trip_id = ? AND username = ?",
        (trip_id, username),
    ).fetchone()
    return row["role"] if row else None


def add_trip_member(
    trip_id: str, username: str, role: str = "editor", added_by: str | None = None
) -> bool:
    """Add or update a trip member. Returns True on success."""
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO trip_members (trip_id, username, role, added_at, added_by) "
        "VALUES (?, ?, ?, datetime('now'), ?)",
        (trip_id, username, role, added_by),
    )
    conn.commit()
    return True


def remove_trip_member(trip_id: str, username: str) -> bool:
    """Remove a member from a trip. Returns True if a row was deleted."""
    conn = get_db()
    cursor = conn.execute(
        "DELETE FROM trip_members WHERE trip_id = ? AND username = ?",
        (trip_id, username),
    )
    conn.commit()
    return cursor.rowcount > 0


def update_trip_member_role(trip_id: str, username: str, role: str) -> bool:
    """Update a member's role. Returns True if the row existed."""
    conn = get_db()
    cursor = conn.execute(
        "UPDATE trip_members SET role = ? WHERE trip_id = ? AND username = ?",
        (role, trip_id, username),
    )
    conn.commit()
    return cursor.rowcount > 0


def list_trips(username: str | None = None, is_admin: bool = False) -> list[dict]:
    """Return [{tripId, updatedAt}] for trips visible to the user.

    Admin users see all trips. Regular users see only trips where they
    have a trip_members row.
    """
    conn = get_db()
    if is_admin or username is None:
        rows = conn.execute(
            "SELECT trip_id, updated_at FROM trips "
            "WHERE deleted_at IS NULL ORDER BY updated_at DESC"
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT t.trip_id, t.updated_at FROM trips t "
            "JOIN trip_members m ON m.trip_id = t.trip_id "
            "WHERE t.deleted_at IS NULL AND m.username = ? "
            "ORDER BY t.updated_at DESC",
            (username,),
        ).fetchall()
    return [{"tripId": r["trip_id"], "updatedAt": r["updated_at"]} for r in rows]


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


# ── Journal persistence ────────────────────────────────────────


def get_journal(trip_id: str) -> tuple[list, str] | None:
    """Return (journal_list, updated_at) or None if no row."""
    conn = get_db()
    row = conn.execute(
        "SELECT journal_json, updated_at FROM trip_journal WHERE trip_id = ?", (trip_id,)
    ).fetchone()
    if not row:
        return None
    return json.loads(row["journal_json"]), row["updated_at"]


def save_journal(trip_id: str, journal_json: str, updated_at: str) -> tuple[bool, str | None]:
    """LWW save for journal — same semantics as save_todos."""
    conn = get_db()
    existing = conn.execute(
        "SELECT updated_at FROM trip_journal WHERE trip_id = ?", (trip_id,)
    ).fetchone()
    if existing and existing["updated_at"] > updated_at:
        return False, existing["updated_at"]
    conn.execute(
        "INSERT OR REPLACE INTO trip_journal (trip_id, journal_json, updated_at) VALUES (?, ?, ?)",
        (trip_id, journal_json, updated_at),
    )
    conn.commit()
    return True, updated_at


# ── Photo storage ──────────────────────────────────────────────


def photo_path(trip_id: str, name: str) -> Path:
    """Resolve a photo path, rejecting anything outside the per-trip dir."""
    base = (PHOTOS_DIR / trip_id).resolve()
    target = (base / name).resolve()
    if not str(target).startswith(str(base) + "/") and target != base:
        raise ValueError("photo path escapes photos dir")
    return target


def save_photo_meta(
    photo_id: str, trip_id: str, filename: str, size_bytes: int, uploaded_by: str
) -> None:
    conn = get_db()
    conn.execute(
        "INSERT INTO trip_photos (photo_id, trip_id, filename, size_bytes, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (photo_id, trip_id, filename, size_bytes, uploaded_by, datetime.now().isoformat()),
    )
    conn.commit()


def get_trip_photo_usage(trip_id: str) -> int:
    """Return total bytes used by photos for a trip."""
    conn = get_db()
    row = conn.execute(
        "SELECT COALESCE(SUM(size_bytes), 0) AS total FROM trip_photos WHERE trip_id = ?",
        (trip_id,),
    ).fetchone()
    return row["total"]


def delete_photo_meta(photo_id: str) -> bool:
    conn = get_db()
    cursor = conn.execute("DELETE FROM trip_photos WHERE photo_id = ?", (photo_id,))
    conn.commit()
    return cursor.rowcount > 0


# ══════════════════════════════════════════════════════════════════
# Per-entry storage with versioning, tombstoning, and history
# ══════════════════════════════════════════════════════════════════


def ensure_per_entry_tables(conn: sqlite3.Connection) -> None:
    """Create all per-entry tables if they don't exist. Called from get_db()."""

    conn.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name       TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        )
    """)

    # ── Journal: per-entry ────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS journal_entries (
            trip_id    TEXT NOT NULL,
            day_index  INTEGER NOT NULL,
            entry_json TEXT NOT NULL,
            version    INTEGER NOT NULL DEFAULT 1,
            deleted    INTEGER NOT NULL DEFAULT 0,
            deleted_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (trip_id, day_index)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS journal_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id     TEXT NOT NULL,
            day_index   INTEGER NOT NULL,
            old_json    TEXT,
            new_json    TEXT,
            old_version INTEGER,
            new_version INTEGER,
            change_type TEXT NOT NULL,
            changed_at  TEXT NOT NULL
        )
    """)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_journal_history_trip_day "
        "ON journal_history(trip_id, day_index)"
    )

    # ── Trip days: per-entry ──────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trip_day_entries (
            trip_id    TEXT NOT NULL,
            day_index  INTEGER NOT NULL,
            entry_json TEXT NOT NULL,
            version    INTEGER NOT NULL DEFAULT 1,
            deleted    INTEGER NOT NULL DEFAULT 0,
            deleted_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (trip_id, day_index)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trip_day_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id     TEXT NOT NULL,
            day_index   INTEGER NOT NULL,
            old_json    TEXT,
            new_json    TEXT,
            old_version INTEGER,
            new_version INTEGER,
            change_type TEXT NOT NULL,
            changed_at  TEXT NOT NULL
        )
    """)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_trip_day_history_trip_day "
        "ON trip_day_history(trip_id, day_index)"
    )

    # ── Trip metadata ─────────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trip_meta (
            trip_id    TEXT PRIMARY KEY,
            entry_json TEXT NOT NULL,
            version    INTEGER NOT NULL DEFAULT 1,
            deleted    INTEGER NOT NULL DEFAULT 0,
            deleted_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trip_meta_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id     TEXT NOT NULL,
            old_json    TEXT,
            new_json    TEXT,
            old_version INTEGER,
            new_version INTEGER,
            change_type TEXT NOT NULL,
            changed_at  TEXT NOT NULL
        )
    """)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_trip_meta_history_trip "
        "ON trip_meta_history(trip_id)"
    )

    # ── Todos: per-entry ──────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS todo_entries (
            trip_id    TEXT NOT NULL,
            todo_id    TEXT NOT NULL,
            entry_json TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            version    INTEGER NOT NULL DEFAULT 1,
            deleted    INTEGER NOT NULL DEFAULT 0,
            deleted_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (trip_id, todo_id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS todo_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id     TEXT NOT NULL,
            todo_id     TEXT NOT NULL,
            old_json    TEXT,
            new_json    TEXT,
            old_version INTEGER,
            new_version INTEGER,
            change_type TEXT NOT NULL,
            changed_at  TEXT NOT NULL
        )
    """)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_todo_history_trip "
        "ON todo_history(trip_id, todo_id)"
    )

    # ── Bookings: per-entry ───────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS booking_entries (
            trip_id    TEXT NOT NULL,
            booking_id TEXT NOT NULL,
            entry_json TEXT NOT NULL,
            version    INTEGER NOT NULL DEFAULT 1,
            deleted    INTEGER NOT NULL DEFAULT 0,
            deleted_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (trip_id, booking_id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS booking_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id     TEXT NOT NULL,
            booking_id  TEXT NOT NULL,
            old_json    TEXT,
            new_json    TEXT,
            old_version INTEGER,
            new_version INTEGER,
            change_type TEXT NOT NULL,
            changed_at  TEXT NOT NULL
        )
    """)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_booking_history_trip "
        "ON booking_history(trip_id, booking_id)"
    )

    # ── Scripts: per-entry ────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS script_entries (
            trip_id    TEXT NOT NULL,
            script_id  TEXT NOT NULL,
            entry_json TEXT NOT NULL,
            version    INTEGER NOT NULL DEFAULT 1,
            deleted    INTEGER NOT NULL DEFAULT 0,
            deleted_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (trip_id, script_id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS script_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id     TEXT NOT NULL,
            script_id   TEXT NOT NULL,
            old_json    TEXT,
            new_json    TEXT,
            old_version INTEGER,
            new_version INTEGER NOT NULL,
            change_type TEXT NOT NULL,
            changed_at  TEXT NOT NULL
        )
    """)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_script_history_trip "
        "ON script_history(trip_id, script_id)"
    )

    # ── Trip members: access control ─────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trip_members (
            trip_id   TEXT NOT NULL,
            username  TEXT NOT NULL,
            role      TEXT NOT NULL DEFAULT 'editor',
            added_at  TEXT NOT NULL DEFAULT (datetime('now')),
            added_by  TEXT,
            PRIMARY KEY (trip_id, username)
        )
    """)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_trip_members_user "
        "ON trip_members(username)"
    )


# ══════════════════════════════════════════════════════════════════
# Generic per-entry CRUD helpers
# ══════════════════════════════════════════════════════════════════


def _save_entry(
    conn: sqlite3.Connection,
    table: str,
    history_table: str,
    pk_cols: tuple[str, ...],
    pk_vals: tuple,
    entry_json: str,
    client_version: int | None,
    extra_cols: dict[str, object] | None = None,
) -> tuple[bool, int, str | None]:
    """Generic version-checked save with history logging.

    pk_cols:        tuple of column names for the primary key
    pk_vals:        tuple of values for the primary key
    entry_json:     JSON string of the entry data
    client_version: None for new entries, integer for updates
    extra_cols:     optional dict of additional columns to set (e.g. sort_order)

    Returns (ok, version, current_entry_json):
        ok=True  -> saved successfully, version=new version, current_entry_json=None
        ok=False -> version conflict, version=server version, current_entry_json=server data
    """
    now = datetime.now().isoformat()
    where = " AND ".join(f"{c} = ?" for c in pk_cols)

    # Check for existing row
    row = conn.execute(
        f"SELECT entry_json, version, deleted FROM {table} WHERE {where}",
        pk_vals,
    ).fetchone()

    # History-log helper columns (match pk order)
    history_pk_cols = pk_cols
    history_pk_vals = pk_vals

    if row is None:
        # New entry — INSERT
        extra = extra_cols or {}
        all_cols = list(pk_cols) + ["entry_json", "version", "deleted", "created_at", "updated_at"]
        all_vals = list(pk_vals) + [entry_json, 1, 0, now, now]
        for col, val in extra.items():
            all_cols.append(col)
            all_vals.append(val)
        placeholders = ", ".join("?" for _ in all_cols)
        col_names = ", ".join(all_cols)
        conn.execute(f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})", all_vals)

        # Log creation
        hist_cols = list(history_pk_cols) + ["old_json", "new_json", "old_version", "new_version", "change_type", "changed_at"]
        hist_vals = list(history_pk_vals) + [None, entry_json, None, 1, "create", now]
        hist_placeholders = ", ".join("?" for _ in hist_cols)
        hist_col_names = ", ".join(hist_cols)
        conn.execute(f"INSERT INTO {history_table} ({hist_col_names}) VALUES ({hist_placeholders})", hist_vals)

        return (True, 1, None)

    existing_json = row["entry_json"]
    existing_version = row["version"]
    is_deleted = row["deleted"]

    if is_deleted:
        # Restore tombstoned entry
        new_version = existing_version + 1
        set_parts = ["deleted = 0", "deleted_at = NULL", "entry_json = ?", "version = ?", "updated_at = ?"]
        set_vals: list = [entry_json, new_version, now]
        if extra_cols:
            for col, val in extra_cols.items():
                set_parts.append(f"{col} = ?")
                set_vals.append(val)
        set_clause = ", ".join(set_parts)
        conn.execute(
            f"UPDATE {table} SET {set_clause} WHERE {where}",
            set_vals + list(pk_vals),
        )

        hist_cols = list(history_pk_cols) + ["old_json", "new_json", "old_version", "new_version", "change_type", "changed_at"]
        hist_vals = list(history_pk_vals) + [existing_json, entry_json, existing_version, new_version, "restore", now]
        hist_placeholders = ", ".join("?" for _ in hist_cols)
        hist_col_names = ", ".join(hist_cols)
        conn.execute(f"INSERT INTO {history_table} ({hist_col_names}) VALUES ({hist_placeholders})", hist_vals)

        return (True, new_version, None)

    # Version conflict check
    if client_version is None or client_version != existing_version:
        return (False, existing_version, existing_json)

    # Normal update
    new_version = existing_version + 1
    set_parts = ["entry_json = ?", "version = ?", "updated_at = ?"]
    set_vals = [entry_json, new_version, now]
    if extra_cols:
        for col, val in extra_cols.items():
            set_parts.append(f"{col} = ?")
            set_vals.append(val)
    set_clause = ", ".join(set_parts)
    conn.execute(
        f"UPDATE {table} SET {set_clause} WHERE {where}",
        set_vals + list(pk_vals),
    )

    hist_cols = list(history_pk_cols) + ["old_json", "new_json", "old_version", "new_version", "change_type", "changed_at"]
    hist_vals = list(history_pk_vals) + [existing_json, entry_json, existing_version, new_version, "update", now]
    hist_placeholders = ", ".join("?" for _ in hist_cols)
    hist_col_names = ", ".join(hist_cols)
    conn.execute(f"INSERT INTO {history_table} ({hist_col_names}) VALUES ({hist_placeholders})", hist_vals)

    return (True, new_version, None)


def _delete_entry(
    conn: sqlite3.Connection,
    table: str,
    history_table: str,
    pk_cols: tuple[str, ...],
    pk_vals: tuple,
    client_version: int,
) -> tuple[bool, int]:
    """Tombstone delete with version check.

    Returns (ok, version):
        ok=True  -> deleted, version=new version
        ok=False -> conflict or not found, version=server version (0 if not found)
    """
    now = datetime.now().isoformat()
    where = " AND ".join(f"{c} = ?" for c in pk_cols)

    row = conn.execute(
        f"SELECT entry_json, version, deleted FROM {table} WHERE {where}",
        pk_vals,
    ).fetchone()

    if row is None or row["deleted"]:
        return (False, 0)

    existing_version = row["version"]
    if client_version != existing_version:
        return (False, existing_version)

    new_version = existing_version + 1
    conn.execute(
        f"UPDATE {table} SET deleted = 1, deleted_at = ?, version = ?, updated_at = ? WHERE {where}",
        [now, new_version, now] + list(pk_vals),
    )

    hist_cols = list(pk_cols) + ["old_json", "new_json", "old_version", "new_version", "change_type", "changed_at"]
    hist_vals = list(pk_vals) + [row["entry_json"], None, existing_version, new_version, "delete", now]
    hist_placeholders = ", ".join("?" for _ in hist_cols)
    hist_col_names = ", ".join(hist_cols)
    conn.execute(f"INSERT INTO {history_table} ({hist_col_names}) VALUES ({hist_placeholders})", hist_vals)

    return (True, new_version)


def _get_entries(
    conn: sqlite3.Connection,
    table: str,
    trip_id: str,
    include_deleted: bool = False,
) -> list[dict]:
    """Get all entries for a trip. Returns list of dicts with parsed entry_json + version."""
    if include_deleted:
        rows = conn.execute(
            f"SELECT * FROM {table} WHERE trip_id = ?", (trip_id,)
        ).fetchall()
    else:
        rows = conn.execute(
            f"SELECT * FROM {table} WHERE trip_id = ? AND deleted = 0", (trip_id,)
        ).fetchall()

    results = []
    for row in rows:
        entry = json.loads(row["entry_json"])
        entry["_version"] = row["version"]
        entry["_deleted"] = bool(row["deleted"])
        results.append(entry)
    return results


def _get_entry(
    conn: sqlite3.Connection,
    table: str,
    pk_cols: tuple[str, ...],
    pk_vals: tuple,
    include_deleted: bool = False,
) -> dict | None:
    """Get a single entry. Returns dict with parsed entry_json + version, or None.
    Returns None for tombstoned entries unless include_deleted=True."""
    where = " AND ".join(f"{c} = ?" for c in pk_cols)
    if not include_deleted:
        where += " AND deleted = 0"
    row = conn.execute(
        f"SELECT * FROM {table} WHERE {where}", pk_vals
    ).fetchone()
    if row is None:
        return None
    entry = json.loads(row["entry_json"])
    entry["_version"] = row["version"]
    entry["_deleted"] = bool(row["deleted"])
    return entry


# ── Journal entry CRUD ─────────────────────────────────────────


def get_journal_entries(trip_id: str, include_deleted: bool = False) -> list[dict]:
    conn = get_db()
    return _get_entries(conn, "journal_entries", trip_id, include_deleted)


def get_journal_entry(trip_id: str, day_index: int) -> dict | None:
    conn = get_db()
    return _get_entry(conn, "journal_entries", ("trip_id", "day_index"), (trip_id, day_index))


def save_journal_entry(
    trip_id: str, day_index: int, entry_json: str, client_version: int | None
) -> tuple[bool, int, str | None]:
    conn = get_db()
    result = _save_entry(
        conn, "journal_entries", "journal_history",
        ("trip_id", "day_index"), (trip_id, day_index),
        entry_json, client_version,
    )
    conn.commit()
    return result


def delete_journal_entry(
    trip_id: str, day_index: int, client_version: int
) -> tuple[bool, int]:
    conn = get_db()
    result = _delete_entry(
        conn, "journal_entries", "journal_history",
        ("trip_id", "day_index"), (trip_id, day_index),
        client_version,
    )
    conn.commit()
    return result


# ── Trip day CRUD ──────────────────────────────────────────────


def get_trip_day_entries(trip_id: str, include_deleted: bool = False) -> list[dict]:
    conn = get_db()
    return _get_entries(conn, "trip_day_entries", trip_id, include_deleted)


def get_trip_day_entry(trip_id: str, day_index: int) -> dict | None:
    conn = get_db()
    return _get_entry(conn, "trip_day_entries", ("trip_id", "day_index"), (trip_id, day_index))


def save_trip_day_entry(
    trip_id: str, day_index: int, entry_json: str, client_version: int | None
) -> tuple[bool, int, str | None]:
    conn = get_db()
    result = _save_entry(
        conn, "trip_day_entries", "trip_day_history",
        ("trip_id", "day_index"), (trip_id, day_index),
        entry_json, client_version,
    )
    conn.commit()
    return result


def delete_trip_day_entry(
    trip_id: str, day_index: int, client_version: int
) -> tuple[bool, int]:
    conn = get_db()
    result = _delete_entry(
        conn, "trip_day_entries", "trip_day_history",
        ("trip_id", "day_index"), (trip_id, day_index),
        client_version,
    )
    conn.commit()
    return result


# ── Trip meta CRUD ─────────────────────────────────────────────


def get_trip_meta(trip_id: str) -> dict | None:
    conn = get_db()
    return _get_entry(conn, "trip_meta", ("trip_id",), (trip_id,))


def save_trip_meta(
    trip_id: str, meta_json: str, client_version: int | None
) -> tuple[bool, int, str | None]:
    conn = get_db()
    result = _save_entry(
        conn, "trip_meta", "trip_meta_history",
        ("trip_id",), (trip_id,),
        meta_json, client_version,
    )
    conn.commit()
    return result


# ── Todo CRUD ──────────────────────────────────────────────────


def get_todo_entries(trip_id: str, include_deleted: bool = False) -> list[dict]:
    conn = get_db()
    return _get_entries(conn, "todo_entries", trip_id, include_deleted)


def get_todo_entry(trip_id: str, todo_id: str) -> dict | None:
    conn = get_db()
    return _get_entry(conn, "todo_entries", ("trip_id", "todo_id"), (trip_id, todo_id))


def save_todo_entry(
    trip_id: str, todo_id: str, entry_json: str, sort_order: int, client_version: int | None
) -> tuple[bool, int, str | None]:
    conn = get_db()
    result = _save_entry(
        conn, "todo_entries", "todo_history",
        ("trip_id", "todo_id"), (trip_id, todo_id),
        entry_json, client_version,
        extra_cols={"sort_order": sort_order},
    )
    conn.commit()
    return result


def delete_todo_entry(
    trip_id: str, todo_id: str, client_version: int
) -> tuple[bool, int]:
    conn = get_db()
    result = _delete_entry(
        conn, "todo_entries", "todo_history",
        ("trip_id", "todo_id"), (trip_id, todo_id),
        client_version,
    )
    conn.commit()
    return result


# ── Booking CRUD ───────────────────────────────────────────────


def get_booking_entries(trip_id: str, include_deleted: bool = False) -> list[dict]:
    conn = get_db()
    return _get_entries(conn, "booking_entries", trip_id, include_deleted)


def get_booking_entry(trip_id: str, booking_id: str) -> dict | None:
    conn = get_db()
    return _get_entry(conn, "booking_entries", ("trip_id", "booking_id"), (trip_id, booking_id))


def save_booking_entry(
    trip_id: str, booking_id: str, entry_json: str, client_version: int | None
) -> tuple[bool, int, str | None]:
    conn = get_db()
    result = _save_entry(
        conn, "booking_entries", "booking_history",
        ("trip_id", "booking_id"), (trip_id, booking_id),
        entry_json, client_version,
    )
    conn.commit()
    return result


def delete_booking_entry(
    trip_id: str, booking_id: str, client_version: int
) -> tuple[bool, int]:
    conn = get_db()
    result = _delete_entry(
        conn, "booking_entries", "booking_history",
        ("trip_id", "booking_id"), (trip_id, booking_id),
        client_version,
    )
    conn.commit()
    return result


# ══════════════════════════════════════════════════════════════════
# Data migration functions (call manually via run_migrations())
# ══════════════════════════════════════════════════════════════════


def _migration_applied(conn: sqlite3.Connection, name: str) -> bool:
    """Check if a named migration has already been applied."""
    row = conn.execute(
        "SELECT 1 FROM schema_migrations WHERE name = ?", (name,)
    ).fetchone()
    return row is not None


def _record_migration(conn: sqlite3.Connection, name: str) -> None:
    """Record a migration as applied."""
    conn.execute(
        "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
        (name, datetime.now().isoformat()),
    )


def _migrate_journal_to_entries(conn: sqlite3.Connection) -> None:
    """Migrate trip_journal blob rows into per-entry journal_entries rows."""
    migration_name = "journal_entries_v1"
    if _migration_applied(conn, migration_name):
        return

    now = datetime.now().isoformat()
    rows = conn.execute("SELECT trip_id, journal_json FROM trip_journal").fetchall()

    for row in rows:
        trip_id = row["trip_id"]
        entries = json.loads(row["journal_json"])
        for entry in entries:
            day_index = entry.get("dayIndex", 0)
            entry_str = json.dumps(entry)
            created = entry.get("createdAt", now)
            updated = entry.get("updatedAt", now)

            conn.execute(
                "INSERT OR IGNORE INTO journal_entries "
                "(trip_id, day_index, entry_json, version, deleted, created_at, updated_at) "
                "VALUES (?, ?, ?, 1, 0, ?, ?)",
                (trip_id, day_index, entry_str, created, updated),
            )
            conn.execute(
                "INSERT INTO journal_history "
                "(trip_id, day_index, old_json, new_json, old_version, new_version, change_type, changed_at) "
                "VALUES (?, ?, NULL, ?, NULL, 1, 'migrate', ?)",
                (trip_id, day_index, entry_str, now),
            )

    _record_migration(conn, migration_name)
    conn.commit()


def _migrate_trips_to_entries(conn: sqlite3.Connection) -> None:
    """Migrate trips blob rows into trip_meta + trip_day_entries."""
    migration_name = "trip_entries_v1"
    if _migration_applied(conn, migration_name):
        return

    now = datetime.now().isoformat()
    # Include tombstoned trips too
    rows = conn.execute("SELECT trip_id, trip_json, deleted_at FROM trips").fetchall()

    for row in rows:
        trip_id = row["trip_id"]
        trip = json.loads(row["trip_json"])
        is_deleted = row["deleted_at"] is not None
        deleted_flag = 1 if is_deleted else 0
        deleted_at = row["deleted_at"]

        # Extract metadata
        meta = {
            "id": trip.get("id", trip_id),
            "name": trip.get("name", ""),
            "startDate": trip.get("startDate", ""),
            "endDate": trip.get("endDate", ""),
            "destinations": trip.get("destinations", []),
            "links": trip.get("links", []),
        }
        meta_str = json.dumps(meta)
        conn.execute(
            "INSERT OR IGNORE INTO trip_meta "
            "(trip_id, entry_json, version, deleted, deleted_at, created_at, updated_at) "
            "VALUES (?, ?, 1, ?, ?, ?, ?)",
            (trip_id, meta_str, deleted_flag, deleted_at, now, now),
        )
        conn.execute(
            "INSERT INTO trip_meta_history "
            "(trip_id, old_json, new_json, old_version, new_version, change_type, changed_at) "
            "VALUES (?, NULL, ?, NULL, 1, 'migrate', ?)",
            (trip_id, meta_str, now),
        )

        # Extract days
        days = trip.get("days", [])
        for i, day in enumerate(days):
            day_str = json.dumps(day)
            conn.execute(
                "INSERT OR IGNORE INTO trip_day_entries "
                "(trip_id, day_index, entry_json, version, deleted, deleted_at, created_at, updated_at) "
                "VALUES (?, ?, ?, 1, ?, ?, ?, ?)",
                (trip_id, i, day_str, deleted_flag, deleted_at, now, now),
            )
            conn.execute(
                "INSERT INTO trip_day_history "
                "(trip_id, day_index, old_json, new_json, old_version, new_version, change_type, changed_at) "
                "VALUES (?, ?, NULL, ?, NULL, 1, 'migrate', ?)",
                (trip_id, i, day_str, now),
            )

    _record_migration(conn, migration_name)
    conn.commit()


def _migrate_todos_to_entries(conn: sqlite3.Connection) -> None:
    """Migrate trip_todos blob rows into per-entry todo_entries rows."""
    migration_name = "todo_entries_v1"
    if _migration_applied(conn, migration_name):
        return

    now = datetime.now().isoformat()
    rows = conn.execute("SELECT trip_id, todos_json FROM trip_todos").fetchall()

    for row in rows:
        trip_id = row["trip_id"]
        todos = json.loads(row["todos_json"])
        for i, todo in enumerate(todos):
            todo_id = str(uuid.uuid4())
            todo_with_id = dict(todo, _migrated_id=todo_id)
            entry_str = json.dumps(todo_with_id)

            conn.execute(
                "INSERT OR IGNORE INTO todo_entries "
                "(trip_id, todo_id, entry_json, sort_order, version, deleted, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, 1, 0, ?, ?)",
                (trip_id, todo_id, entry_str, i, now, now),
            )
            conn.execute(
                "INSERT INTO todo_history "
                "(trip_id, todo_id, old_json, new_json, old_version, new_version, change_type, changed_at) "
                "VALUES (?, ?, NULL, ?, NULL, 1, 'migrate', ?)",
                (trip_id, todo_id, entry_str, now),
            )

    _record_migration(conn, migration_name)
    conn.commit()


def _migrate_bookings_to_entries(conn: sqlite3.Connection) -> None:
    """Migrate trip_bookings blob rows into per-entry booking_entries rows."""
    migration_name = "booking_entries_v1"
    if _migration_applied(conn, migration_name):
        return

    now = datetime.now().isoformat()
    rows = conn.execute("SELECT trip_id, bookings_json FROM trip_bookings").fetchall()

    for row in rows:
        trip_id = row["trip_id"]
        bookings = json.loads(row["bookings_json"])
        for booking in bookings:
            booking_id = booking.get("label") or booking.get("id") or str(uuid.uuid4())
            entry_str = json.dumps(booking)

            conn.execute(
                "INSERT OR IGNORE INTO booking_entries "
                "(trip_id, booking_id, entry_json, version, deleted, created_at, updated_at) "
                "VALUES (?, ?, ?, 1, 0, ?, ?)",
                (trip_id, booking_id, entry_str, now, now),
            )
            conn.execute(
                "INSERT INTO booking_history "
                "(trip_id, booking_id, old_json, new_json, old_version, new_version, change_type, changed_at) "
                "VALUES (?, ?, NULL, ?, NULL, 1, 'migrate', ?)",
                (trip_id, booking_id, entry_str, now),
            )

    _record_migration(conn, migration_name)
    conn.commit()


# ── Script CRUD ───────────────────────────────────────────────


def get_script_entries(trip_id: str, include_deleted: bool = False) -> list[dict]:
    conn = get_db()
    return _get_entries(conn, "script_entries", trip_id, include_deleted)


def get_script_entry(trip_id: str, script_id: str) -> dict | None:
    conn = get_db()
    return _get_entry(conn, "script_entries", ("trip_id", "script_id"), (trip_id, script_id))


def save_script_entry(
    trip_id: str, script_id: str, entry_json: str, client_version: int | None
) -> tuple[bool, int, str | None]:
    conn = get_db()
    result = _save_entry(
        conn, "script_entries", "script_history",
        ("trip_id", "script_id"), (trip_id, script_id),
        entry_json, client_version,
    )
    conn.commit()
    return result


def delete_script_entry(
    trip_id: str, script_id: str, client_version: int
) -> tuple[bool, int]:
    conn = get_db()
    result = _delete_entry(
        conn, "script_entries", "script_history",
        ("trip_id", "script_id"), (trip_id, script_id),
        client_version,
    )
    conn.commit()
    return result


def run_migrations() -> None:
    """Run all pending data migrations. Safe to call multiple times (idempotent)."""
    conn = get_db()
    _migrate_journal_to_entries(conn)
    _migrate_trips_to_entries(conn)
    _migrate_todos_to_entries(conn)
    _migrate_bookings_to_entries(conn)
