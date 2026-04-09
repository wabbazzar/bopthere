#!/bin/bash
# Claude Code PreToolUse hook: run vitest before git commit
#
# Intercepts Bash tool calls containing "git commit".
# Runs vitest and blocks the commit if tests fail.
# Passes through all non-commit commands without delay.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only intercept git commit commands
if ! echo "$COMMAND" | grep -q 'git commit'; then
  exit 0
fi

# Run vitest from the project directory
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')
TEST_OUTPUT=$(cd "$CWD" && npx vitest run 2>&1) || true
TEST_EXIT=$?

# Check if vitest reported failures
if echo "$TEST_OUTPUT" | grep -q 'Tests.*failed'; then
  TEST_EXIT=1
fi

if [ $TEST_EXIT -ne 0 ]; then
  FAILURES=$(echo "$TEST_OUTPUT" | grep -E '(FAIL|Tests|Test Files)' | tail -5)
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Tests failed. Fix before committing.\n${FAILURES}"
  }
}
EOF
  exit 0
fi

# Tests passed — allow the commit
exit 0
