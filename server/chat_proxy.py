"""Chat proxy — routes browser requests through Claude Code CLI (uses Max plan)."""

import asyncio
import json
import os
import uuid
from datetime import datetime

import jwt
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db import get_conversation, save_conversation, delete_conversation

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
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


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
    stdout, stderr = await asyncio.wait_for(
        proc.communicate(input=conversation_text.encode()),
        timeout=60,
    )
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


@app.get("/health")
async def health():
    return {"status": "ok"}
