#!/bin/bash
# guardian-claude.sh — Headless test+fix agent for H&W travel app.
# Usage: guardian-claude.sh [hook|daily]
#
# hook  = fast: vitest + script checks only (Sonnet)
# daily = comprehensive: vitest + scripts + Playwright + GUI exploration + DB audit (Sonnet -> Opus for fixes)

set -euo pipefail

export WABBAZZAR_SOURCE="${WABBAZZAR_SOURCE:-system}"

MODE="${1:-hook}"
HW_DIR="/home/wabbazzar/code/heatherandwesley"
NOTIFY="/home/wabbazzar/code/wabbazzar-ice/scripts/notify.sh"
LOG_EVENT="/home/wabbazzar/code/wabbazzar-ice/scripts/log_event.sh"
PROMPT_FILE="$HW_DIR/scripts/guardian-claude-prompt.md"
RESULT_FILE="$HW_DIR/tmp/guardian-result.json"
LOG_FILE="$HW_DIR/tmp/guardian-last-run.log"

cd "$HW_DIR"
mkdir -p tmp

JOB_START=$(date +%s)
[ -x "$LOG_EVENT" ] && "$LOG_EVENT" hw-guardian job.start mode="$MODE" || true

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

# Stay in non-strict mode for the rest of the script. A transient claude API
# error, a grep that finds no match in SUMMARY, or a notify.sh failure must
# NOT prevent job.end from being emitted — otherwise the dashboard gets
# stuck in "pending".
set +e
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

JOB_DUR=$(( $(date +%s) - JOB_START ))
if [ "$PASS" = "True" ]; then JOB_STATUS="ok"; else JOB_STATUS="fail"; fi
CATEGORY=$(python3 - "$RESULT_FILE" <<'PY' 2>/dev/null || echo unknown
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
cats = []
if d.get("testsFailed", 0) > 0:
    cats.append("tests")
v = d.get("vitest", {})
if isinstance(v, dict) and v.get("failed", 0) > 0:
    cats.append("vitest")
p = d.get("playwright", {})
if isinstance(p, dict) and p.get("failed", 0) > 0:
    cats.append("playwright")
if d.get("dbIssues"):
    cats.append("db")
if d.get("errors"):
    cats.append("error")
sc = d.get("scriptChecks", {})
if isinstance(sc, dict) and any(v is False for v in sc.values()):
    cats.append("scripts")
print(",".join(cats) or ("ok" if d.get("pass") else "unknown"))
PY
)
[ -x "$LOG_EVENT" ] && "$LOG_EVENT" hw-guardian job.end \
  mode="$MODE" status="$JOB_STATUS" exit_code="$EXIT" duration_s="$JOB_DUR" \
  category="$CATEGORY" || true
