#!/bin/bash
# Claude Code PostToolUse hook: trigger Guardian Claude after git push.
# Only fires on Bash commands containing "git push".

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

if ! echo "$COMMAND" | grep -q 'git push'; then
  exit 0
fi

# Script path — repo dir is still heatherandwesley on disk, domain is bopthere.com
SCRIPT="/home/wabbazzar/code/heatherandwesley/scripts/guardian-claude.sh"
if [ -x "$SCRIPT" ]; then
  nohup bash "$SCRIPT" hook > /dev/null 2>&1 &
fi

exit 0
