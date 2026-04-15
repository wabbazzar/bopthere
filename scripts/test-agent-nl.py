#!/usr/bin/env python3
"""
Natural-language robustness probe for the H&W chat agent.

For each scenario (user message + expected tool-call block), POSTs to the live
hw-chat service, measures latency, and verifies the assistant emitted the
expected fenced block. Reports a pass/fail table with latencies.

Run from repo root on wabbazzar-ice:
    python3 scripts/test-agent-nl.py
Or specify a different backend:
    API=http://127.0.0.1:8089 python3 scripts/test-agent-nl.py

When a case fails, the script prints the full response so you can adjust the
system prompt in src/lib/services/chat.ts and re-run.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass

import jwt

API = os.environ.get("API", "http://127.0.0.1:8089")
JWT_SECRET = os.environ.get("JWT_SECRET", "your-secret-key-change-in-production")
TIMEOUT = float(os.environ.get("TIMEOUT", "150"))


def make_token() -> str:
    """HS256 JWT matching what the frontend uses — role admin, 1h TTL."""
    import datetime
    exp = int(datetime.datetime.now().timestamp()) + 3600
    return jwt.encode(
        {"username": "wesley", "role": "admin", "exp": exp},
        JWT_SECRET,
        algorithm="HS256",
    )


# A faithful condensation of the system prompt in src/lib/services/chat.ts —
# same block rules the real frontend sends. We keep the trip/bookings summary
# short so the probe is fast; the agent should still emit blocks correctly
# because the rules are what matter for block selection.
SYSTEM_PROMPT = r"""You are a travel planning assistant for Wesley and Heather.
Home base: Austin, TX (AUS) — all trips originate from Austin unless they say otherwise.
Today: 2026-04-15
Current trip in view: China 2026 (2026-04-22 to 2026-05-02)
Destinations: Shanghai, Chongqing, Zhangjiajie

ITINERARY:
Day 1: Wed 2026-04-22 — Shanghai
Day 2: Thu 2026-04-23 — Shanghai
Day 3: Fri 2026-04-24 — Shanghai
Day 4: Sat 2026-04-25 — Chongqing
Day 5: Sun 2026-04-26 — Zhangjiajie
Day 6: Mon 2026-04-27 — Zhangjiajie
Day 7: Tue 2026-04-28 — Zhangjiajie
Day 8: Wed 2026-04-29 — Zhangjiajie
Day 9: Thu 2026-04-30 — Shanghai
Day 10: Fri 2026-05-01 — Shanghai
Day 11: Sat 2026-05-02 — Shanghai

Guidelines:
- Suggest specific places with names, not generic advice.
- Keep suggestions concise and actionable.

UPDATING THE TRIP:
When the user asks to add, change, or fill in trip details (e.g. "put Din Tai Fung in the evening for day 3"), include a TRIP_UPDATE block at the END of your response:

```TRIP_UPDATE
[{"dayIndex": 2, "field": "evening", "value": "Din Tai Fung — soup dumplings"}]
```

Rules:
- dayIndex is 0-based (Day 1 = index 0).
- field is one of: morning, afternoon, evening, travel, accommodation, notes, location.
- Never emit a TRIP_UPDATE unless the user explicitly asks to change the itinerary.

ADDING MAP LINKS:
When the user asks for directions or a route for a day, include a MAP_LINKS block:

```MAP_LINKS
{"dayIndex": 0, "mapLinks": [{"label": "Hotel to Bund", "from": "Kimpton Shanghai", "to": "The Bund"}]}
```

Rules:
- dayIndex is 0-based.
- Use specific place names.
- Never emit MAP_LINKS unless the user explicitly asks for directions or a route.

CREATING A NEW TRIP:
When the user asks to plan or create a new trip, emit a TRIP_CREATE block once you have name + startDate + endDate:

```TRIP_CREATE
{"id": "japan-2026-10", "name": "Japan Oct 2026", "startDate": "2026-10-10", "endDate": "2026-10-20", "destinations": ["Tokyo", "Kyoto"]}
```

Rules:
- id is URL-safe slug (lowercase letters, digits, hyphens).
- Omit days by default — the app seeds them.
- Emit immediately when you have name + dates; don't ask follow-ups first.

RESHAPING THE DAYS ARRAY:
When the user asks to add, remove, duplicate, or reorder days, emit a TRIP_DAYS block:

```TRIP_DAYS
[{"op": "add", "afterIndex": 5}, {"op": "duplicate", "dayIndex": 2}, {"op": "delete", "dayIndex": 9}, {"op": "move", "dayIndex": 3, "direction": "down"}]
```

Rules:
- op is one of: "add", "delete", "duplicate", "move".
- "add" inserts after afterIndex (omit to append). "move" direction is "up" or "down".
- Indices are 0-based against the current days array.
- Never emit TRIP_DAYS unless the user explicitly asks to add, remove, duplicate, or reorder days.

EDITING TRIP-LEVEL FIELDS:
For trip name, startDate, endDate, or the destinations array, emit a TRIP_META block with only the fields being changed:

```TRIP_META
{"name": "Europe Summer 2026", "destinations": ["Barcelona", "Cannes", "Lisbon"]}
```

Rules:
- Omit any field you aren't changing. Dates are YYYY-MM-DD.
- destinations replaces the whole array.
- Never emit TRIP_META unless the user explicitly asks to rename, shift dates, or change the destinations list.

TRIP LINKS (external reference URLs):
trip.links is a flat array of URL strings. To add/change/remove one, emit a TRIP_LINKS block:

```TRIP_LINKS
[{"op": "add", "url": "https://www.booking.com/..."}, {"op": "delete", "linkIndex": 2}]
```

Rules:
- linkIndex is 0-based.
- Never emit TRIP_LINKS unless the user explicitly asks to add, change, or remove a reference URL.

TODOS:
The trip's todo list is separate. To modify it, emit a TODOS block:

```TODOS
[{"op": "add", "text": "Book visa appointment"}, {"op": "toggle", "todoIndex": 0}]
```

Rules:
- todoIndex is 0-based.
- "toggle" flips done/undone.
- Never emit TODOS unless the user explicitly asks to add, change, complete, or remove a task.
"""


BLOCK_RE_FMT = r"```{name}\s*[\r\n]+([\s\S]*?)```"


def block_present(content: str, block_name: str) -> tuple[bool, str | None]:
    m = re.search(BLOCK_RE_FMT.format(name=block_name), content)
    if not m:
        return False, None
    # Validate it parses as JSON (the frontend parsers require valid JSON)
    try:
        json.loads(m.group(1))
        return True, m.group(1)
    except json.JSONDecodeError:
        return False, m.group(1)


def send_message(token: str, user_msg: str) -> tuple[str, float]:
    """POST to /api/chat/messages. Returns (assistant_content, elapsed_seconds)."""
    body = json.dumps(
        {
            "tripId": "__nl_probe__",
            "message": user_msg,
            "systemPrompt": SYSTEM_PROMPT,
        }
    ).encode()
    req = urllib.request.Request(
        f"{API}/api/chat/messages",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        elapsed = time.monotonic() - t0
        return f"[HTTP {e.code}] {e.read().decode(errors='replace')}", elapsed
    except Exception as e:
        elapsed = time.monotonic() - t0
        return f"[ERR] {e}", elapsed
    return data.get("content", ""), time.monotonic() - t0


def clear_probe_conversation() -> None:
    """Delete the probe's accumulated history so each run starts fresh."""
    try:
        req = urllib.request.Request(
            f"{API}/api/chat/conversations/__nl_probe__",
            method="DELETE",
            headers={"Authorization": f"Bearer {make_token()}"},
        )
        urllib.request.urlopen(req, timeout=10).read()
    except Exception:
        pass


@dataclass
class Case:
    label: str
    user_msg: str
    # None means no block should be emitted (negative cases).
    # A tuple means ANY of the listed blocks is acceptable.
    # A string means that specific block is expected.
    expected_block: str | tuple[str, ...] | None
    # If set, these blocks must ALSO appear (for combined requests).
    also_expected: tuple[str, ...] = ()


CASES: list[Case] = [
    # Existing block types — baseline sanity.
    Case("TRIP_UPDATE (activity)", "Put Din Tai Fung in the evening for day 3", "TRIP_UPDATE"),
    Case("TRIP_UPDATE (morning)", "On day 2, morning activity is the Shanghai Museum", "TRIP_UPDATE"),
    Case("MAP_LINKS (day 1)", "Give me map directions for day 1: from our hotel to the Bund", "MAP_LINKS"),
    Case("TRIP_CREATE (with dates)", "Plan a new trip to Japan October 10 to 20, 2026", "TRIP_CREATE"),

    # New block types — plain phrasings.
    Case("TRIP_DAYS (add)", "Add two more days to the end of this trip", "TRIP_DAYS"),
    Case("TRIP_DAYS (duplicate)", "Duplicate day 4 please", "TRIP_DAYS"),
    Case("TRIP_META (rename)", "Rename this trip to Panda Quest 2026", "TRIP_META"),
    Case("TRIP_META (destinations)", "Change the destinations list to just Shanghai and Zhangjiajie", "TRIP_META"),
    Case("TRIP_LINKS (add)", "Add a reference link: https://www.booking.com/hotel/cn/kimpton-qiantan-shanghai", "TRIP_LINKS"),
    Case("TRIP_LINKS (delete)", "Remove the first reference link from the trip", "TRIP_LINKS"),
    Case("TODOS (add)", "Add a todo: book a visa appointment", "TODOS"),
    Case("TODOS (toggle)", "Mark the first todo as done", "TODOS"),

    # Phrasing variations — same intent, different wording.
    Case("TRIP_DAYS (delete, casual)", "Actually let's drop day 7 from the plan", "TRIP_DAYS"),
    Case("TRIP_DAYS (reorder)", "Swap day 5 with day 6 — move day 5 down please", "TRIP_DAYS"),
    Case("TRIP_META (shift end)", "Push the trip end date back by one day, to May 3rd", "TRIP_META"),
    Case("TODOS (complete)", "I finished booking the hotel — check off that todo", "TODOS"),
    Case("TODOS (delete)", "Remove the second item from the todo list", "TODOS"),
    Case("TRIP_UPDATE (free-form)", "For day 1 evening I want to go to Lost Heaven — set that please", "TRIP_UPDATE"),

    # Negative cases — should NOT emit a block (informational/question intent).
    Case("Q&A no block (weather)", "What's the weather usually like in Shanghai in late April?", None),
    Case("Q&A no block (restaurant sugg)", "What are 2 good dinner spots near our Shanghai hotel?", None),
    Case("Q&A no block (day-of-week)", "What day of the week is April 24?", None),
    Case("Q&A no block (travel time)", "How long is the flight from Shanghai to Chongqing?", None),

    # Ambiguous — either interpretation is acceptable.
    Case("Ambiguous Barcelona", "Add Barcelona to our trip", ("TRIP_META", "TRIP_UPDATE")),

    # Combined request — should emit multiple blocks in one response.
    Case("Combined: rename + add day", "Rename the trip to China Adventure 2026 and add one more day at the end",
         "TRIP_META", also_expected=("TRIP_DAYS",)),
]


def main() -> int:
    token = make_token()

    # Dummy round-trip so the service warms up (subprocess startup, etc.)
    print(f"warming up {API}/health …", flush=True)
    try:
        with urllib.request.urlopen(f"{API}/health", timeout=5) as r:
            r.read()
    except Exception as e:
        print(f"!! server unreachable at {API}: {e}")
        return 2

    clear_probe_conversation()

    results: list[tuple[Case, bool, float, str]] = []
    for i, c in enumerate(CASES, 1):
        # Clear conversation between cases so earlier turns don't bias the agent
        clear_probe_conversation()
        print(f"[{i:2}/{len(CASES)}] {c.label:32} → ", end="", flush=True)
        content, elapsed = send_message(token, c.user_msg)

        if c.expected_block is None:
            # Negative case — verify NO block at all was emitted.
            any_block = any(
                block_present(content, b)[0]
                for b in ("TRIP_UPDATE", "MAP_LINKS", "TRIP_CREATE", "TRIP_DAYS", "TRIP_META", "TRIP_LINKS", "TODOS")
            )
            ok = not any_block
        elif isinstance(c.expected_block, tuple):
            ok = any(block_present(content, b)[0] for b in c.expected_block)
        else:
            ok = block_present(content, c.expected_block)[0]
            # Check any required "also" blocks
            for extra in c.also_expected:
                ok = ok and block_present(content, extra)[0]

        results.append((c, ok, elapsed, content))
        status = "PASS" if ok else "FAIL"
        print(f"{status}  ({elapsed:5.1f}s)")

    print()
    print("=" * 78)
    passed = sum(1 for _, ok, _, _ in results if ok)
    failed = len(results) - passed
    total_time = sum(e for _, _, e, _ in results)
    avg = total_time / len(results) if results else 0.0
    print(f"Result: {passed}/{len(results)} passed · {failed} failed · "
          f"avg {avg:4.1f}s · total {total_time:5.1f}s")

    if failed:
        print()
        print("Failing responses (first 800 chars each):")
        print("-" * 78)
        for c, ok, elapsed, content in results:
            if ok:
                continue
            print(f"\n◼ {c.label}  ({elapsed:4.1f}s)")
            print(f"  USER: {c.user_msg}")
            print(f"  ASSISTANT:\n{content[:800]}")
            print("-" * 78)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
