#!/bin/bash

# Log session end event with timing information

set -euo pipefail

# Skip if logging disabled
if [[ "${SKIP_LOGGING:-}" == "true" ]]; then
  exit 0
fi

# Read input from Copilot (JSON on stdin)
INPUT=$(cat 2>/dev/null || echo '{}')

# Create logs directory if it doesn't exist
mkdir -p .copilot/logs

# Extract timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Log session end with status information
jq -Rn --arg timestamp "$TIMESTAMP" '{
  "timestamp": $timestamp,
  "event": "sessionStop",
  "level": "INFO"
}' >> .copilot/logs/session.log 2>/dev/null || true

exit 0
