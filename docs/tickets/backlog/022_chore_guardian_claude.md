# Ticket 022: Chore - Guardian Claude Automated Testing & Protection System

## Metadata
- **Status**: Not Started
- **Priority**: High
- **Effort**: 13 points (Phase 1: 2pt, Phase 2: 5pt, Phase 3: 2pt, Phase 4: 2pt, Phase 5: 2pt)
- **Created**: 2026-04-09
- **Type**: chore
- **Depends on**: Existing Playwright tests (chat-e2e, auth-flash), chat server on wabbazzar-ice. Phase 3 DB audits become meaningful once ticket 021 lands.

## Problem Statement

The H&W travel app has no automated regression protection. Playwright tests exist (chat E2E, auth flash prevention) but are only run manually. There is no post-push gate, no daily health check, and no mechanism for an AI agent to autonomously detect and fix regressions. Interactive elements — Add/Copy/Delete buttons in day view, chat drawer, suggest popover, undo/export — can break silently without anyone noticing until the next manual test run.

The shredly2 project has a proven Guardian Claude pattern: an autonomous headless Claude agent that runs tests after every push and daily at 7am, attempts to fix failures (up to 3 tries), audits the production database, and sends Signal notifications. This ticket adapts that pattern for H&W with three key differences:

1. **Vitest + Playwright** — H&W currently has no unit tests; this ticket adds vitest for fast store/service logic tests alongside existing Playwright E2E
2. **Split backend** — health checks must cover both FastAPI (wabbazzar-ice) and AWS Lambda (auth API Gateway)
3. **Ad-hoc GUI exploration** — beyond scripted Playwright assertions, guardian should explore the app visually in daily mode, clicking through pages and reporting anomalies

## User Stories

### Primary
As the developer, I want an autonomous Guardian Claude that runs tests after every push and daily at 7am, fixes regressions up to 3 times, and notifies me via Signal so I catch breakage immediately.

### Secondary
- As the developer, I want lightweight script-based health checks on push (fast, no browser) and heavy Playwright + ad-hoc GUI exploration reserved for the daily run.
- As the developer, I want a `tests/guardian-checklist.md` that the dev agent appends to as features are built, so guardian coverage grows automatically.
- As the developer, I want the guardian to perform ad-hoc GUI exploration in daily mode — navigating pages, clicking interactive elements, checking for console errors — not just scripted Playwright assertions.

## Design: Four-Tier Test Strategy

### Tier A — Script Checks + Vitest (hook + daily)
Fast, no browser needed. Run on every push. Under 60 seconds total.
- `npm run check` (svelte-check + TypeScript)
- `npm run build` (Vite build must succeed)
- `npx vitest run` — unit tests for store logic, service helpers, and pure functions
- `curl` health checks against live endpoints:
  - FastAPI: `https://api.heatherandwesley.com/health`
  - Auth: `POST https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod/auth/login` with empty body (expect 400, proves endpoint is up)
  - Chat: `https://api.heatherandwesley.com/api/chat/conversations/test` with invalid auth (expect 401)

**Vitest unit test targets (initial):**
- **`src/lib/stores/trips.ts`** — the core of the app. Test:
  - `updateDayField` auto-calculates dayOfWeek from date
  - `updateDayField` auto-updates trip startDate/endDate from day dates
  - `updateDayField` auto-updates destinations from unique day locations
  - `addDay` increments date from previous day, inherits location
  - `duplicateDay` creates copy with date +1
  - `deleteDay` prevents deletion of last day
  - `moveDay` boundary conditions (first up, last down = no-op)
  - Undo stack: push/pop/limit at 50
  - `resetTrip` restores defaults
  - `exportTrip` returns valid JSON matching Trip type
- **`src/lib/services/auth.ts`** — test token storage/retrieval helpers (getToken, getStoredUser, logout clears storage)
- **`src/lib/services/chat.ts`** — test `buildSystemPrompt` and `buildSuggestionMessage` produce correct strings from trip data (pure functions, no network)

**Post-021 vitest additions:**
- Trip service: API response parsing, version conflict detection
- Sync store: debounce logic, offline queue, merge resolution
- Optimistic locking: version mismatch handling

### Tier B — Playwright Deterministic E2E (daily only)
Require dev server + headless Chromium. Run the full Playwright suite.
- Existing: `chat-e2e.spec.ts` (7 tests), `auth-flash.spec.ts` (2 tests)
- Future tests added via guardian-checklist.md: dashboard render, trip day view, mobile viewport
- Pass/fail counts reported in results JSON

### Tier C — Ad-hoc GUI Exploration (daily only)
Guardian Claude itself navigates the app exploratorily. NOT scripted assertions — the AI clicks through pages, checks for console errors, verifies visual correctness, and reports anomalies in prose.
- Navigate to `/dashboard` — verify trip cards render
- Navigate to `/trip/china-2026` — verify week view, toggle day view, try navigation
- Open chat FAB — verify drawer opens/closes
- Check browser console for JavaScript errors on every page
- Repeat key pages at mobile viewport (390x844)
- Results are descriptive ("Dashboard: 1 trip card rendered, no console errors") and included in results JSON under `adHocReport`
- Anomalies are warnings, not hard failures (since these are exploratory)

### Tier D — DB Audit (daily only, post-021)
See "DB Audits" section below.

### Hook vs Daily Split

| Aspect | Hook (on push) | Daily (7:15am) |
|--------|---------------|-------------|
| Trigger | PostToolUse hook on `git push` | systemd timer |
| Budget | $0.50 | $2.00 |
| Model | Sonnet | Sonnet (Opus for fixes) |
| Tier A (scripts + vitest) | Yes | Yes |
| Tier B (Playwright) | No | Yes |
| Tier C (ad-hoc GUI) | No | Yes |
| Tier D (DB audit) | No | Yes (post-021) |
| Fix attempts | Up to 3 | Up to 3 |
| Runtime | ~60s | ~3-5min |

## Technical Requirements

### Phase 1: Launcher Script & Prompt (2pt)

**Create: `scripts/guardian-claude.sh`**

Modeled on `/home/wabbazzar/code/shredly2/scripts/guardian-claude.sh`:

```bash
#!/bin/bash
# guardian-claude.sh — Headless test+fix agent for H&W travel app.
# Usage: guardian-claude.sh [hook|daily]

set -euo pipefail

MODE="${1:-hook}"
HW_DIR="/home/wabbazzar/code/heatherandwesley"
NOTIFY="/home/wabbazzar/code/wabbazzar-ice/scripts/notify.sh"
PROMPT_FILE="$HW_DIR/scripts/guardian-claude-prompt.md"
RESULT_FILE="$HW_DIR/tmp/guardian-result.json"
LOG_FILE="$HW_DIR/tmp/guardian-last-run.log"

cd "$HW_DIR"
mkdir -p tmp

# For daily mode: ensure dev server is running (needed for Playwright)
if [ "$MODE" = "daily" ]; then
  if ! curl -s -o /dev/null -w "" http://localhost:5174 2>/dev/null; then
    npm run dev -- --port 5174 &
    sleep 5
  fi
fi

PROMPT="$(cat "$PROMPT_FILE")

MODE=$MODE
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

MODEL="sonnet"

if [ "$MODE" = "daily" ]; then
  BUDGET="2.00"
else
  BUDGET="0.50"
fi

echo "[guardian-claude] Starting $MODE run at $(date)" > "$LOG_FILE"

claude -p \
  --model "$MODEL" \
  --dangerously-skip-permissions \
  --max-budget-usd "$BUDGET" \
  --output-format text \
  "$PROMPT" \
  >> "$LOG_FILE" 2>&1

EXIT=$?

echo "[guardian-claude] Claude exited with code $EXIT" >> "$LOG_FILE"

# Extract result
if [ -f "$RESULT_FILE" ]; then
  PASS=$(python3 -c "import json; print(json.load(open('$RESULT_FILE')).get('pass', False))" 2>/dev/null || echo "False")
else
  PASS="False"
fi

SUMMARY=$(tail -30 "$LOG_FILE" | grep -A20 "GUARDIAN RESULT" | head -10)
if [ -z "$SUMMARY" ]; then
  SUMMARY="Guardian completed (mode=$MODE, exit=$EXIT). Check $LOG_FILE for details."
fi

if [ "$PASS" = "True" ]; then
  "$NOTIFY" "H&W Guardian ($MODE)" "$SUMMARY"
else
  "$NOTIFY" "H&W Guardian FAILED ($MODE)" "$SUMMARY"
fi

echo "[guardian-claude] Done. Pass=$PASS" >> "$LOG_FILE"
```

**Create: `scripts/guardian-claude-prompt.md`**

```markdown
You are Guardian Claude. You protect the H&W travel app main branch by running
tests, checking backend health, and fixing regressions autonomously.
You do NOT interact with a human.

Your scope: testing, health checks, and fixing failures. You do not build
features or refactor code.

## Your job

1. Read `tests/guardian-checklist.md` for the full list of checks.
2. Run script checks. If they fail, attempt fixes (up to 3 tries).
3. If MODE=daily: run Playwright tests, ad-hoc GUI exploration, DB audit.
4. Write results to tmp/guardian-result.json.
5. Print summary and exit.

## Mode

The MODE variable is either "hook" (fast, script checks only) or
"daily" (comprehensive, includes Playwright + GUI exploration + DB audit).

## Step 1: Script checks + vitest (both modes)

Run these and capture output:

npm run check 2>&1
npm run build 2>&1
npx vitest run 2>&1

Then run health checks:

curl -sf https://api.heatherandwesley.com/health
curl -s -o /dev/null -w "%{http_code}" -X POST \
  https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" -d '{}'
# Expect 400 (proves endpoint is up)

curl -s -o /dev/null -w "%{http_code}" \
  https://api.heatherandwesley.com/api/chat/conversations/test \
  -H "Authorization: Bearer invalid"
# Expect 401

If MODE=hook and all pass, skip to Step 5 (write results).

## Step 2: Playwright tests (daily only)

Ensure dev server is running at localhost:5174. Then:

npx playwright test 2>&1

Report total/passed/failed counts.

## Step 3: Ad-hoc GUI exploration (daily only)

Use Playwright to navigate the app exploratorily. This is NOT about running
existing test files — you are the test. Navigate to these pages and report
what you see:

1. http://localhost:5174/ — should redirect to login or dashboard
2. Inject auth via localStorage, navigate to /dashboard — count trip cards
3. Navigate to /trip/china-2026 — verify week view loads, toggle to day view
4. Open chat FAB — verify drawer opens, close it
5. Check for JavaScript console errors on every page
6. Repeat dashboard + trip at mobile viewport (390x844)

Write a prose summary of your exploration. Flag anything unexpected as a
warning. This is exploratory — anomalies are warnings, not hard failures.

## Step 4: Fix failures (if any)

If any check in Steps 1-3 failed:
- Read the failing output carefully
- Read the relevant source files
- Fix the source code (not the test, unless the test is clearly wrong)
- Re-run the failed check
- You have 3 attempts total across all failures
- Make minimal changes — do not refactor surrounding code

## Step 5: Write results

Write JSON to tmp/guardian-result.json:

{
  "pass": true,
  "mode": "hook",
  "timestamp": "2026-04-09T12:00:00Z",
  "scriptChecks": {
    "svelteCheck": true,
    "viteBuild": true,
    "fastApiHealth": true,
    "authEndpoint": true,
    "chatEndpoint": true
  },
  "vitest": {
    "total": 0,
    "passed": 0,
    "failed": 0
  },
  "playwright": {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "skipped": 0
  },
  "adHocReport": "",
  "dbIssues": [],
  "fixAttempts": 0,
  "fixesApplied": [],
  "errors": []
}

Set "pass" to false if any script checks fail, any Playwright tests fail
after fix attempts, or DB integrity issues were found.

## Step 6: Output summary

Print a summary block for the Signal notification:

GUARDIAN RESULT: PASS (or FAIL)
Script checks: all passed (or list failures)
Vitest: X passed, Y failed
Playwright: X passed, Y failed (daily only)
GUI: clean (or list anomalies) (daily only)
DB: clean (or list issues) (daily only)
Fixes: N applied

That's it. Do your job and exit.
```

### Phase 2: Vitest Setup, Guardian Checklist & Playwright Config (5pt)

#### 2a: Vitest Infrastructure

**Install dependencies:**
```bash
npm install -D vitest @testing-library/svelte jsdom
```

**Create: `vitest.config.ts`**
```typescript
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/unit/setup.ts']
  },
  resolve: {
    alias: {
      '$lib': '/src/lib',
      '$app': '/src/app',
      '$env/static/public': '/tests/unit/mocks/env.ts'
    }
  }
});
```

**Create: `tests/unit/setup.ts`** — Mock localStorage for store tests:
```typescript
import { vi } from 'vitest';

// Mock localStorage
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
});
```

**Create: `tests/unit/mocks/env.ts`** — Mock SvelteKit env module:
```typescript
export const PUBLIC_API_GATEWAY_URL = 'https://test.example.com';
export const PUBLIC_CHAT_API_URL = 'https://test.example.com';
```

#### 2b: Vitest Unit Tests

**Create: `tests/unit/stores/trips.test.ts`** — Core store logic tests:
- `updateDayField('date')` auto-calculates dayOfWeek (e.g., '2026-04-18' → 'Sat')
- `updateDayField('date')` auto-updates trip startDate/endDate from day dates
- `updateDayField('location')` auto-updates destinations from unique day locations
- `addDay` increments date from previous day by +1
- `addDay` inherits location from previous day
- `addDay(afterIndex)` inserts at correct position
- `duplicateDay` creates copy with date +1 and correct dayOfWeek
- `deleteDay` prevents deletion when only 1 day remains
- `deleteDay` recalculates trip dates and destinations
- `moveDay('up')` on first day is no-op
- `moveDay('down')` on last day is no-op
- `moveDay` swaps correctly in middle
- Undo stack: action pushes snapshot, undo restores it
- Undo stack: limit at 50 (51st push drops oldest)
- `resetTrip` restores to default data
- `exportTrip` returns valid JSON that matches Trip structure
- `addLink`/`updateLink`/`deleteLink` work correctly

**Create: `tests/unit/services/chat.test.ts`** — Pure function tests:
- `buildSystemPrompt(trip)` includes trip name, destinations, day activities
- `buildSuggestionMessage(dayIndex, slot, energy, interest)` formats correctly
- Both functions handle empty/missing data gracefully

**Create: `tests/unit/services/auth.test.ts`** — Storage helper tests:
- `getToken()` returns stored token or null
- `getStoredUser()` returns parsed user object or null
- `logout()` clears both token and user from localStorage

**Add to `package.json` scripts:**
```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

#### 2c: Guardian Checklist

**Create: `tests/guardian-checklist.md`**

See Tier A/B/C/D descriptions above. Initial checklist covers:
- Script checks (npm run check, npm run build, curl health)
- Vitest unit tests (npx vitest run)
- Existing Playwright tests
- Ad-hoc GUI exploration targets (dashboard, trip, chat, mobile)
- DB integrity placeholders for post-021

#### 2d: Playwright Config Update

**Modify: `playwright.config.ts`**

Current state has hardcoded `testMatch: ['chat-e2e.spec.ts', 'auth-flash.spec.ts']`.

Change to:
```typescript
// Remove testMatch — auto-discover all *.spec.ts in tests/
testIgnore: ['**/e2e/**', '**/unit/**'],  // Ignore legacy nested e2e tests and vitest unit tests
```

This ensures new Playwright test files are automatically picked up by both manual runs and guardian, while vitest files stay separate.

#### 2e: New Playwright Test Files (outline, implement during this phase)

`tests/dashboard.spec.ts`:
- Dashboard renders at least 1 trip card
- Trip card links navigate to `/trip/china-2026`
- Countdown badge shows correct text

`tests/trip-day-view.spec.ts`:
- Week/day view toggle works
- Day navigation (arrows/buttons) works
- Add Day button creates a new day
- Delete Day button removes a day (with confirm)
- Copy Day duplicates current day
- OOO toggle works
- ExpandableField renders and is editable
- No console errors during navigation

`tests/trip-actions.spec.ts`:
- Undo reverts last change
- Export downloads JSON
- Reset restores defaults (with confirm)

### Phase 3: Hook Integration (2pt)

**Create: `.claude/hooks/post-push-guardian.sh`**

```bash
#!/bin/bash
# PostToolUse hook: trigger Guardian Claude after git push.
set -euo pipefail
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
if ! echo "$COMMAND" | grep -q 'git push'; then
  exit 0
fi
SCRIPT="/home/wabbazzar/code/heatherandwesley/scripts/guardian-claude.sh"
if [ -x "$SCRIPT" ]; then
  nohup bash "$SCRIPT" hook > /dev/null 2>&1 &
fi
exit 0
```

**Create: `.claude/settings.json`**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/post-push-guardian.sh"
          }
        ]
      }
    ]
  }
}
```

Note: `.claude/settings.local.json` (permissions) remains separate and unchanged.

### Phase 4: Systemd Timer for Daily Run (2pt)

**Create: `scripts/guardian-claude-hw.service`**

```ini
[Unit]
Description=Guardian Claude daily run for H&W travel app

[Service]
Type=oneshot
WorkingDirectory=/home/wabbazzar/code/heatherandwesley
ExecStart=/bin/bash /home/wabbazzar/code/heatherandwesley/scripts/guardian-claude.sh daily
Environment=HOME=/home/wabbazzar
Environment=PATH=/home/wabbazzar/.local/bin:/usr/local/bin:/usr/bin:/bin
```

**Create: `scripts/guardian-claude-hw.timer`**

```ini
[Unit]
Description=Guardian Claude daily 7:15am timer for H&W

[Timer]
OnCalendar=*-*-* 07:15:00
Persistent=true

[Install]
WantedBy=timers.target
```

Timer at 7:15am to avoid collision with shredly2's guardian at 7:00am.

**Deployment (manual):**
```bash
cp scripts/guardian-claude-hw.service ~/.config/systemd/user/
cp scripts/guardian-claude-hw.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now guardian-claude-hw.timer
```

### Phase 5: Results & Documentation (2pt)

**Results JSON schema** (`tmp/guardian-result.json`):

```json
{
  "pass": true,
  "mode": "daily",
  "timestamp": "2026-04-09T07:15:00Z",
  "scriptChecks": {
    "svelteCheck": true,
    "viteBuild": true,
    "fastApiHealth": true,
    "authEndpoint": true,
    "chatEndpoint": true
  },
  "vitest": {
    "total": 25,
    "passed": 25,
    "failed": 0
  },
  "playwright": {
    "total": 9,
    "passed": 9,
    "failed": 0,
    "skipped": 0
  },
  "adHocReport": "Dashboard: 1 trip card (China 2026). Trip page: week view loaded, 4 weeks. Day view: toggled, 7 days visible. Chat: FAB visible, drawer opens/closes. Console: 0 errors. Mobile: all pages render.",
  "dbIssues": [],
  "fixAttempts": 0,
  "fixesApplied": [],
  "errors": []
}
```

**Modify: `CLAUDE.md`** — Add section 10:

```markdown
## 10. Guardian Claude

Automated regression protection. Runs after every `git push` (hook mode) and daily at 7:15am (daily mode).

| File | Purpose |
|------|---------|
| `scripts/guardian-claude.sh` | Launcher (modes, budget, notifications) |
| `scripts/guardian-claude-prompt.md` | Autonomous agent instructions |
| `tests/guardian-checklist.md` | Permanent regression guards (dev agent appends here) |
| `.claude/hooks/post-push-guardian.sh` | PostToolUse hook (git push trigger) |
| `tmp/guardian-result.json` | Last run results |
| `tmp/guardian-last-run.log` | Last run full output |

### Running manually
bash scripts/guardian-claude.sh hook   # Fast: script checks + vitest
bash scripts/guardian-claude.sh daily  # Full: scripts + vitest + Playwright + GUI + DB
```

## Files to Create
- `scripts/guardian-claude.sh` — launcher script
- `scripts/guardian-claude-prompt.md` — autonomous agent instructions
- `vitest.config.ts` — vitest configuration
- `tests/unit/setup.ts` — localStorage mock for store tests
- `tests/unit/mocks/env.ts` — SvelteKit env module mock
- `tests/unit/stores/trips.test.ts` — trips store unit tests
- `tests/unit/services/chat.test.ts` — chat service pure function tests
- `tests/unit/services/auth.test.ts` — auth service helper tests
- `tests/guardian-checklist.md` — permanent regression guards
- `.claude/hooks/post-push-guardian.sh` — PostToolUse hook
- `.claude/settings.json` — hook registration
- `scripts/guardian-claude-hw.service` — systemd service unit
- `scripts/guardian-claude-hw.timer` — systemd timer unit

## Files to Modify
- `package.json` — add vitest, @testing-library/svelte, jsdom as devDependencies; add test scripts
- `playwright.config.ts` — remove hardcoded testMatch, add testIgnore for e2e/ and unit/
- `CLAUDE.md` — add Guardian Claude section (section 10)

## Out of Scope
- Pre-commit hook (guardian runs post-push, not pre-commit)
- Visual regression testing / screenshot diffing
- Guardian fixing Playwright infrastructure issues (flaky browser launch)
- Real-time WebSocket notifications (Signal is sufficient)
- Component-level Svelte rendering tests (vitest covers pure logic, Playwright covers UI)

## DB Audits (Post-021 Placeholder)

Once ticket 021 (Trip Data Persistence) lands, add these to the daily guardian:
- Verify `trips` table has `china-2026` with `version >= 1`
- Verify all `trip_json` values parse as valid JSON
- Verify no `updated_at` timestamps are in the future
- Verify `conversations` table rows have valid `messages_json`
- Check trip row count stability (should not drop unexpectedly)

These checks will be added to `tests/guardian-checklist.md` and the prompt's DB audit section when 021 is implemented.

## Testing Strategy

1. **Manual hook test:** `bash scripts/guardian-claude.sh hook` — verify results JSON, Signal notification
2. **Manual daily test:** Start dev server, `bash scripts/guardian-claude.sh daily` — verify Playwright runs, ad-hoc report populated
3. **Push trigger test:** `git push` from Claude Code — verify guardian fires (check `tmp/guardian-last-run.log` timestamp)
4. **Timer test:** `systemctl --user start guardian-claude-hw.service` — verify one-shot run
5. **Failure recovery:** Introduce TypeScript error, run guardian, verify detection + fix attempt + failure report

## Rollout Plan

1. **Phase 1** — Launcher + prompt, test manually
2. **Phase 2** — Checklist + Playwright config, verify tests auto-discover
3. **Phase 3** — Hook wiring, verify push triggers guardian
4. **Phase 4** — Systemd timer, verify daily schedule
5. **Phase 5** — Documentation, CLAUDE.md update
