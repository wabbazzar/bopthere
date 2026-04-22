#!/usr/bin/env python3
"""Database integrity audit for Guardian Claude.

Reads server/data/chat.db (read-only) and checks for data invariants.
Exits 0 if clean, 1 if issues found. Prints JSON array of issues.

Usage:
    python3 scripts/db-audit.py
"""

import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "server" / "data" / "chat.db"

issues: list[str] = []


def check(label: str, ok: bool, detail: str = ""):
    if not ok:
        msg = f"FAIL: {label}" + (f" — {detail}" if detail else "")
        issues.append(msg)
        print(f"  ✗ {msg}", file=sys.stderr)
    else:
        print(f"  ✓ {label}", file=sys.stderr)


def main():
    if not DB_PATH.exists():
        print(json.dumps(["FAIL: database file not found at server/data/chat.db"]))
        sys.exit(1)

    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    # Use UTC + Z suffix so comparisons work against JS-generated ISO timestamps
    now = datetime.utcnow().isoformat() + "Z"

    # ── trips table ──────────────────────────────────────────────
    print("trips table:", file=sys.stderr)

    row = conn.execute("SELECT trip_json, updated_at FROM trips WHERE trip_id = 'china-2026'").fetchone()
    check("china-2026 row exists", row is not None)

    if row:
        try:
            trip = json.loads(row["trip_json"])
            check("trip_json is valid JSON", True)
        except json.JSONDecodeError as e:
            check("trip_json is valid JSON", False, str(e))
            trip = None

        if trip:
            days = trip.get("days", [])
            check("trip has ≥10 days", len(days) >= 10, f"found {len(days)}")
            check("trip has name", bool(trip.get("name")))
            check("trip has startDate", bool(trip.get("startDate")))
            check("trip has destinations", len(trip.get("destinations", [])) >= 1)

            # Days 7-9 (indexes 6-8) should have populated activities
            for idx, label in [(6, "Day 7"), (7, "Day 8"), (8, "Day 9")]:
                if idx < len(days):
                    d = days[idx]
                    has_am = bool(d.get("morning"))
                    has_pm = bool(d.get("afternoon"))
                    check(f"{label} morning populated", has_am, d.get("morning", "")[:60])
                    check(f"{label} afternoon populated", has_pm, d.get("afternoon", "")[:60])

        check("updated_at not in future", row["updated_at"] <= now, row["updated_at"])

    # ── trip_bookings table ──────────────────────────────────────
    print("\ntrip_bookings table:", file=sys.stderr)

    row = conn.execute("SELECT bookings_json, updated_at FROM trip_bookings WHERE trip_id = 'china-2026'").fetchone()
    check("china-2026 bookings exist", row is not None)

    if row:
        try:
            bookings = json.loads(row["bookings_json"])
            check("bookings_json is valid JSON", True)
            check("≥5 bookings", len(bookings) >= 5, f"found {len(bookings)}")
            for b in bookings:
                check(f"booking '{b.get('label','')}' has type", b.get("type") in ("flight", "hotel", "train", "bus", "ferry", "car", "other"))
                check(f"booking '{b.get('label','')}' has details", len(b.get("details", [])) >= 1)
        except json.JSONDecodeError as e:
            check("bookings_json is valid JSON", False, str(e))

        check("updated_at not in future", row["updated_at"] <= now, row["updated_at"])

    # ── trip_todos table ─────────────────────────────────────────
    print("\ntrip_todos table:", file=sys.stderr)

    row = conn.execute("SELECT todos_json, updated_at FROM trip_todos WHERE trip_id = 'china-2026'").fetchone()
    if row:
        try:
            todos = json.loads(row["todos_json"])
            check("todos_json is valid JSON", True)
            check("todos is a list", isinstance(todos, list))
            for t in todos:
                check(f"todo has text field", bool(t.get("text")), str(t))
        except json.JSONDecodeError as e:
            check("todos_json is valid JSON", False, str(e))
        check("updated_at not in future", row["updated_at"] <= now, row["updated_at"])
    else:
        check("china-2026 todos row exists (optional)", True, "no row yet — will populate on first edit")

    # ── conversations table ──────────────────────────────────────
    print("\nconversations table:", file=sys.stderr)

    rows = conn.execute("SELECT trip_id, messages_json, updated_at FROM conversations").fetchall()
    check(f"conversations: {len(rows)} row(s)", len(rows) >= 0)

    for r in rows:
        try:
            msgs = json.loads(r["messages_json"])
            check(f"conversation '{r['trip_id']}' valid JSON", True)
            check(f"conversation '{r['trip_id']}' is a list", isinstance(msgs, list))
        except json.JSONDecodeError as e:
            check(f"conversation '{r['trip_id']}' valid JSON", False, str(e))
        check(f"conversation '{r['trip_id']}' updated_at not future", r["updated_at"] <= now)

    # ── ticket file integrity ──────────────────────────────────────
    print("\nticket file integrity:", file=sys.stderr)

    TICKETS_DIR = Path(__file__).parent.parent / "server" / "data" / "tickets"

    all_bookings_rows = conn.execute(
        "SELECT trip_id, bookings_json FROM trip_bookings"
    ).fetchall()

    for brow in all_bookings_rows:
        trip_id = brow["trip_id"]
        try:
            bookings = json.loads(brow["bookings_json"])
        except json.JSONDecodeError:
            continue  # already caught by earlier check
        for b in bookings:
            ticket_url = b.get("ticketUrl")
            if not ticket_url:
                continue
            names = ticket_url if isinstance(ticket_url, list) else [ticket_url]
            for name in names:
                if not name or ".." in name or "/" in name:
                    check(f"ticket filename safe: {name}", False, f"booking '{b.get('label', '?')}'")
                    continue
                path = TICKETS_DIR / trip_id / name
                check(
                    f"ticket file exists: {trip_id}/{name}",
                    path.is_file(),
                    f"referenced by booking '{b.get('label', '?')}'",
                )

    # ── summary ──────────────────────────────────────────────────
    conn.close()
    print(json.dumps(issues))
    sys.exit(1 if issues else 0)


if __name__ == "__main__":
    main()
