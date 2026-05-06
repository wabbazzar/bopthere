#!/usr/bin/env python3
"""
Backend API test for /api/trips/{trip_id}/todos endpoints.

Verifies per-trip isolation against the live local FastAPI service —
guarding against the regression where China's todos polluted Europe's row.

Runs against http://127.0.0.1:8089 (the locally bound `hw-chat` service).
The dev/prod JWT secret is the same default value, so we sign our own
short-lived bearer token with PyJWT.

Usage:
    cd server && python3 -m pytest ../tests/integration/backend/test_todos_api.py -v
"""

import os
import time
import uuid
from datetime import datetime, timezone

import jwt
import pytest
import requests

API_BASE = os.environ.get("HW_CHAT_BASE", "http://127.0.0.1:8089")
JWT_SECRET = os.environ.get("JWT_SECRET", "your-secret-key-change-in-production")


def _token() -> str:
    payload = {
        "username": "wesley",
        "role": "admin",
        "exp": int(time.time()) + 300,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_token()}",
        "Content-Type": "application/json",
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{int(time.time() * 1000) % 1000:03d}Z"


@pytest.fixture(scope="module")
def api_alive():
    """Skip the suite if the local hw-chat service isn't running."""
    try:
        r = requests.get(f"{API_BASE}/health", timeout=2)
    except Exception as e:
        pytest.skip(f"hw-chat not reachable at {API_BASE}: {e}")
    if r.status_code != 200:
        pytest.skip(f"hw-chat unhealthy at {API_BASE}: {r.status_code}")
    return True


def _get(trip_id: str):
    return requests.get(f"{API_BASE}/api/trips/{trip_id}/todos", headers=_headers(), timeout=5)


def _put(trip_id: str, todos: list, updated_at: str | None = None):
    body = {"todos": todos, "updatedAt": updated_at or _now_iso()}
    return requests.put(f"{API_BASE}/api/trips/{trip_id}/todos", json=body, headers=_headers(), timeout=5)


def _delete_via_db(trip_id: str):
    """Backdoor cleanup — these tests own their trip_ids end-to-end."""
    import sqlite3
    from pathlib import Path
    db = Path(__file__).resolve().parents[3] / "server" / "data" / "bopthere.db"
    if not db.exists():
        return
    conn = sqlite3.connect(str(db))
    conn.execute("DELETE FROM trip_todos WHERE trip_id = ?", (trip_id,))
    conn.commit()
    conn.close()


# ── Auth gate ─────────────────────────────────────────────────────


def test_get_todos_requires_auth(api_alive):
    r = requests.get(f"{API_BASE}/api/trips/anything/todos", timeout=5)
    assert r.status_code == 401


def test_put_todos_requires_auth(api_alive):
    r = requests.put(
        f"{API_BASE}/api/trips/anything/todos",
        json={"todos": [], "updatedAt": _now_iso()},
        timeout=5,
    )
    assert r.status_code == 401


# ── Per-trip isolation ────────────────────────────────────────────


def test_unknown_trip_returns_empty_with_null_updated_at(api_alive):
    """A trip with no row in trip_todos must return [] / null — never the
    contents of some other trip's row."""
    trip_id = f"isolation-test-{uuid.uuid4().hex[:8]}"
    try:
        r = _get(trip_id)
        assert r.status_code == 200
        body = r.json()
        assert body["tripId"] == trip_id
        assert body["todos"] == []
        assert body["updatedAt"] is None
    finally:
        _delete_via_db(trip_id)


def test_writes_to_one_trip_do_not_appear_in_another(api_alive):
    """The core regression guard: write a unique todo to trip A, verify
    trip B is untouched."""
    trip_a = f"isolation-A-{uuid.uuid4().hex[:8]}"
    trip_b = f"isolation-B-{uuid.uuid4().hex[:8]}"
    sentinel = f"sentinel-{uuid.uuid4().hex}"

    try:
        # Write to A
        r = _put(trip_a, [{"text": sentinel, "done": False}])
        assert r.status_code == 200, r.text

        # B must remain empty
        r = _get(trip_b)
        assert r.status_code == 200
        body = r.json()
        assert body["todos"] == [], f"Trip B leaked data from trip A: {body}"
        assert body["updatedAt"] is None

        # A must have exactly what we wrote
        r = _get(trip_a)
        assert r.status_code == 200
        body = r.json()
        assert len(body["todos"]) == 1
        assert body["todos"][0]["text"] == sentinel
    finally:
        _delete_via_db(trip_a)
        _delete_via_db(trip_b)


def test_concurrent_writes_to_distinct_trips_remain_distinct(api_alive):
    """Several trips edited in sequence each keep their own todo list."""
    trips = {f"isolation-multi-{i}-{uuid.uuid4().hex[:6]}": f"todo-{i}" for i in range(3)}
    try:
        for tid, text in trips.items():
            r = _put(tid, [{"text": text, "done": False}])
            assert r.status_code == 200, r.text

        for tid, text in trips.items():
            r = _get(tid)
            assert r.status_code == 200
            body = r.json()
            assert len(body["todos"]) == 1
            assert body["todos"][0]["text"] == text, (
                f"Trip {tid} got the wrong list back: {body['todos']}"
            )
    finally:
        for tid in trips:
            _delete_via_db(tid)


# ── Real-data regression: Europe must not contain China's defaults ────


def test_real_europe_trip_has_no_china_defaults(api_alive):
    """Hits the actual europe-2026-2026 row used in production. Verifies the
    cleanup migration succeeded and stays clean."""
    r = _get("europe-2026-2026")
    assert r.status_code == 200
    body = r.json()
    polluted_terms = ("Wulingyuan", "intra-China")
    text_blob = " ".join(t.get("text", "") for t in body.get("todos", []))
    for term in polluted_terms:
        assert term not in text_blob, (
            f"Europe todos contain China-specific text '{term}': {body['todos']}"
        )


# ── LWW (last-writer-wins) semantics ──────────────────────────────


def test_stale_updated_at_returns_409_with_server_state(api_alive):
    """If the client sends an older updatedAt than what's on disk, the
    server must reject with 409 and return the canonical row — not silently
    overwrite (which is how cross-trip pollution could otherwise re-occur
    via a slow client)."""
    trip_id = f"isolation-lww-{uuid.uuid4().hex[:8]}"
    try:
        # Initial save with a future timestamp so subsequent saves with
        # "now" are guaranteed to be older.
        future = "2099-01-01T00:00:00.000Z"
        r = _put(trip_id, [{"text": "future-server", "done": False}], updated_at=future)
        assert r.status_code == 200

        # Stale write: client thinks they have a newer version, but they don't
        r = _put(trip_id, [{"text": "stale-client", "done": False}], updated_at=_now_iso())
        assert r.status_code == 409
        detail = r.json().get("detail") or r.json()
        assert detail["todos"][0]["text"] == "future-server"
    finally:
        _delete_via_db(trip_id)
