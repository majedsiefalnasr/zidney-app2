#!/bin/bash

# Log session start event with enhanced metadata

set -euo pipefail

# Skip if logging disabled
if [[ "${SKIP_LOGGING:-}" == "true" ]]; then
  exit 0
fi

# Read input from Copilot (JSON on stdin)
INPUT=$(cat 2>/dev/null || echo '{}')

# Create logs directory if it doesn't exist
mkdir -p .copilot/logs

# Extract timestamp and environment info
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
CWD=$(pwd)
USER_HOME=${HOME:-/unknown}
SHELL=${SHELL:-/unknown}
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Log session start with metadata (use jq for proper JSON encoding)
echo "$INPUT" | jq -Rn --arg timestamp "$TIMESTAMP" --arg cwd "$CWD" --arg branch "$BRANCH" --arg commit "$COMMIT" '{
  "timestamp": $timestamp,
  "event": "sessionStart",
  "cwd": $cwd,
  "git": {
    "branch": $branch,
    "commit": $commit
  },
  "level": "INFO"
}' >> .copilot/logs/session.log 2>/dev/null || true

exit 0
