"""Chat proxy — routes browser requests through Claude Code CLI (uses Max plan)."""

import asyncio
import hashlib
import hmac
import json
import os
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path

import jwt
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Fire-and-forget event logging into wabbazzar-ice/data/events/. Falls back
# to a no-op if the shared lib isn't on disk.
sys.path.insert(0, "/home/wabbazzar/code/wabbazzar-ice/lib")
try:
    from events import log_event  # type: ignore
except Exception:  # pragma: no cover
    def log_event(*_a, **_k):  # type: ignore[no-redef]
        pass

from db import (
    delete_conversation,
    delete_trip,
    get_bookings,
    get_conversation,
    get_todos,
    get_trip,
    list_trips,
    save_conversation,
    save_todos,
    save_trip,
    ticket_path,
)

app = FastAPI(title="H&W Chat Proxy", docs_url=None, redoc_url=None)

JWT_SECRET = os.environ.get("JWT_SECRET", "your-secret-key-change-in-production")
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "/home/wabbazzar/.local/bin/claude")

ALLOWED_ORIGINS = [
    "https://heatherandwesley.com",
    "https://www.heatherandwesley.com",
    "https://wabbazzar.github.io",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5178",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


def _is_known_ip(ip: str) -> bool:
    return (
        ip.startswith("192.168.")
        or ip.startswith("100.64.")
        or ip.startswith("100.77.")
        or ip in ("127.0.0.1", "::1")
    )


def _resolve_identity(auth: str | None, client_ip: str) -> tuple[str, str]:
    """Return (actor, source). Three-way: user / user-unauth / external."""
    if auth and auth.startswith("Bearer "):
        try:
            payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
            return payload.get("username") or payload.get("sub") or "anonymous", "user"
        except jwt.ExpiredSignatureError:
            return "unauth_failed", "unauth_failed"
        except jwt.InvalidTokenError:
            return "unauth_failed", "unauth_failed"
        except Exception:
            return "unauth_failed", "unauth_failed"
    if _is_known_ip(client_ip):
        return "pre-auth", "user-unauth"
    return "external", "external"


@app.middleware("http")
async def _log_request(request: Request, call_next):
    """Emit one http.request event per response. Fire-and-forget."""
    t0 = time.monotonic()
    xff = request.headers.get("x-forwarded-for", "")
    client_ip = xff.split(",")[0].strip() if xff else (request.client.host if request.client else "127.0.0.1")
    actor, source = _resolve_identity(request.headers.get("authorization"), client_ip)
    extra = {"client_ip": client_ip} if source == "external" else {}
    try:
        response = await call_next(request)
    except Exception:
        log_event(
            "hw-chat",
            "http.request",
            source=source,
            actor=actor,
            method=request.method,
            path=request.url.path,
            status=500,
            latency_ms=int((time.monotonic() - t0) * 1000),
            **extra,
        )
        raise
    log_event(
        "hw-chat",
        "http.request",
        source=source,
        actor=actor,
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        latency_ms=int((time.monotonic() - t0) * 1000),
        **extra,
    )
    return response


def verify_token(authorization: str | None) -> dict:
    """Validate JWT Bearer token, return user payload."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization[7:]
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def ask_claude(system_prompt: str, conversation_text: str) -> str:
    """Call Claude Code CLI in print mode, using the Max plan OAuth."""
    proc = await asyncio.create_subprocess_exec(
        CLAUDE_BIN, "-p",
        "--system-prompt", system_prompt,
        "--output-format", "text",
        "--no-session-persistence",
        "--model", "sonnet",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=conversation_text.encode()),
            timeout=120,
        )
    except asyncio.TimeoutError:
        # Don't leave an orphan claude subprocess eating CPU/RAM
        try:
            proc.kill()
            await proc.wait()
        except ProcessLookupError:
            pass
        raise
    if proc.returncode != 0:
        err = stderr.decode().strip()
        raise RuntimeError(f"claude exited {proc.returncode}: {err}")
    return stdout.decode().strip()


class SendMessageRequest(BaseModel):
    tripId: str
    message: str
    systemPrompt: str


@app.get("/api/chat/conversations/{trip_id}")
async def get_conv(trip_id: str, authorization: str | None = Header(None)):
    verify_token(authorization)
    messages = get_conversation(trip_id)
    return {"tripId": trip_id, "messages": messages}


@app.post("/api/chat/messages")
async def send_message(req: SendMessageRequest, authorization: str | None = Header(None)):
    user = verify_token(authorization)

    messages = get_conversation(req.tripId)

    # Add user message
    user_msg = {
        "id": str(uuid.uuid4()),
        "role": "user",
        "content": req.message,
        "timestamp": datetime.now().isoformat(),
        "user": user.get("username", "unknown"),
    }
    messages.append(user_msg)

    # Build conversation text for claude CLI (it takes a single prompt via stdin)
    # Include recent conversation history in the prompt so Claude has context
    history_lines = []
    for m in messages[-10:]:  # last 10 messages for context window
        role = "User" if m["role"] == "user" else "Assistant"
        history_lines.append(f"{role}: {m['content']}")
    conversation_text = "\n\n".join(history_lines)

    try:
        assistant_content = await ask_claude(req.systemPrompt, conversation_text)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Claude response timed out")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Claude error: {e}")

    assistant_msg = {
        "id": str(uuid.uuid4()),
        "role": "assistant",
        "content": assistant_content,
        "timestamp": datetime.now().isoformat(),
    }
    messages.append(assistant_msg)

    save_conversation(req.tripId, messages)
    return assistant_msg


@app.delete("/api/chat/conversations/{trip_id}")
async def clear_conv(trip_id: str, authorization: str | None = Header(None)):
    verify_token(authorization)
    delete_conversation(trip_id)
    return {"ok": True}


# ── Bookings ──────────────────────────────────────────────────────


@app.get("/api/trips/{trip_id}/bookings")
async def list_bookings(trip_id: str, authorization: str | None = Header(None)):
    verify_token(authorization)
    return {"tripId": trip_id, "bookings": get_bookings(trip_id)}


class SignAttachmentRequest(BaseModel):
    name: str


def _attachment_sig(trip_id: str, name: str, expires_at: int) -> str:
    msg = f"{trip_id}|{name}|{expires_at}".encode()
    return hmac.new(JWT_SECRET.encode(), msg, hashlib.sha256).hexdigest()


@app.post("/api/trips/{trip_id}/attachments/sign")
async def sign_attachment(
    trip_id: str,
    req: SignAttachmentRequest,
    authorization: str | None = Header(None),
):
    """Return a short-lived signed URL for an attachment.

    Clients call this before opening a PDF so the open can be a plain GET
    without an Authorization header (browsers can't attach headers to
    <a>-style navigations or window.open calls).
    """
    verify_token(authorization)
    try:
        path = ticket_path(trip_id, req.name)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid attachment name")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Attachment not found")
    expires_at = int(time.time()) + 120  # 120s window
    sig = _attachment_sig(trip_id, req.name, expires_at)
    return {
        "url": f"/api/trips/{trip_id}/attachments/{req.name}?exp={expires_at}&sig={sig}"
    }


@app.get("/api/trips/{trip_id}/attachments/{name}")
async def get_attachment(trip_id: str, name: str, exp: int, sig: str):
    """Serve a PDF given a valid short-lived signature. No Bearer required."""
    now = int(time.time())
    if now > exp:
        raise HTTPException(status_code=401, detail="Signature expired")
    expected = _attachment_sig(trip_id, name, exp)
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=401, detail="Invalid signature")
    try:
        path = ticket_path(trip_id, name)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid attachment name")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Attachment not found")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=name,
        headers={"Content-Disposition": f'inline; filename="{name}"'},
    )


# ── Trip data (server-authoritative, shared across devices) ───────


import re

# Slug format for trip ids: lowercase letters/digits/hyphens, 1–48 chars,
# must start with alphanumeric. Prevents path traversal, overlong keys,
# accidental collisions from mixed-case ids.
_TRIP_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,47}$")


def _validate_trip_id(trip_id: str) -> None:
    if not _TRIP_ID_RE.fullmatch(trip_id):
        raise HTTPException(status_code=400, detail="Invalid trip id")


def _validate_trip_payload(trip: dict, path_trip_id: str) -> None:
    """Reject malformed trip bodies before they hit the DB."""
    if not isinstance(trip, dict):
        raise HTTPException(status_code=400, detail="trip must be an object")
    body_id = trip.get("id")
    if body_id != path_trip_id:
        raise HTTPException(
            status_code=400,
            detail=f"trip.id ({body_id!r}) must match path id ({path_trip_id!r})",
        )
    for field in ("name", "startDate", "endDate"):
        v = trip.get(field)
        if not isinstance(v, str) or not v:
            raise HTTPException(status_code=400, detail=f"trip.{field} required")
    days = trip.get("days")
    if not isinstance(days, list):
        raise HTTPException(status_code=400, detail="trip.days must be a list")


@app.get("/api/trips")
async def list_all_trips(authorization: str | None = Header(None)):
    """Catalog of every server-persisted trip so clients can discover
    trips created on other devices. Returns ids + updatedAt only — full
    data is fetched per-trip via GET /api/trips/{trip_id}."""
    verify_token(authorization)
    return {"trips": list_trips()}


@app.get("/api/trips/{trip_id}")
async def get_trip_data(trip_id: str, authorization: str | None = Header(None)):
    verify_token(authorization)
    _validate_trip_id(trip_id)
    result = get_trip(trip_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    trip_data, updated_at = result
    return {"tripId": trip_id, "trip": trip_data, "updatedAt": updated_at}


class SaveTripRequest(BaseModel):
    trip: dict
    updatedAt: str


@app.put("/api/trips/{trip_id}")
async def put_trip(trip_id: str, req: SaveTripRequest, authorization: str | None = Header(None)):
    verify_token(authorization)
    _validate_trip_id(trip_id)
    _validate_trip_payload(req.trip, trip_id)
    ok, server_ts = save_trip(trip_id, json.dumps(req.trip), req.updatedAt)
    if not ok:
        # LWW rejected — return the server's current state so the client
        # can reconcile without a second round-trip.
        server_result = get_trip(trip_id)
        server_trip, server_updated = server_result if server_result else ({}, "")
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Server has newer data",
                "trip": server_trip,
                "updatedAt": server_updated,
            },
        )
    return {"ok": True, "updatedAt": server_ts}


@app.delete("/api/trips/{trip_id}")
async def remove_trip(trip_id: str, authorization: str | None = Header(None)):
    verify_token(authorization)
    _validate_trip_id(trip_id)
    deleted = delete_trip(trip_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"ok": True}


@app.get("/api/trips/{trip_id}/todos")
async def get_trip_todos(trip_id: str, authorization: str | None = Header(None)):
    verify_token(authorization)
    result = get_todos(trip_id)
    if result is None:
        return {"tripId": trip_id, "todos": [], "updatedAt": None}
    todos_data, updated_at = result
    return {"tripId": trip_id, "todos": todos_data, "updatedAt": updated_at}


class SaveTodosRequest(BaseModel):
    todos: list
    updatedAt: str


@app.put("/api/trips/{trip_id}/todos")
async def put_trip_todos(trip_id: str, req: SaveTodosRequest, authorization: str | None = Header(None)):
    verify_token(authorization)
    ok, server_ts = save_todos(trip_id, json.dumps(req.todos), req.updatedAt)
    if not ok:
        server_result = get_todos(trip_id)
        server_todos, server_updated = server_result if server_result else ([], "")
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Server has newer data",
                "todos": server_todos,
                "updatedAt": server_updated,
            },
        )
    return {"ok": True, "updatedAt": server_ts}


@app.get("/health")
async def health():
    return {"status": "ok"}
