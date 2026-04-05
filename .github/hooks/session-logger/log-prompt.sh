#!/bin/bash

# Log user prompt submission with optional content logging

set -euo pipefail

# Skip if logging disabled
if [[ "${SKIP_LOGGING:-}" == "true" ]]; then
  exit 0
fi

# Read input from Copilot (contains prompt info as JSON)
INPUT=$(cat 2>/dev/null || echo '{}')

# Create logs directory if it doesn't exist
mkdir -p .copilot/logs

# Extract timestamp and log level
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_LEVEL="${LOG_LEVEL:-INFO}"
CAPTURE_PROMPT_TEXT="${CAPTURE_PROMPT_TEXT:-false}"

# Only log if level is appropriate
if [[ "$LOG_LEVEL" != "DEBUG" && "$LOG_LEVEL" != "INFO" ]] && [[ "$LOG_LEVEL" != "TRACE" ]]; then
  exit 0
fi

# Log prompt submission
if [[ "$CAPTURE_PROMPT_TEXT" == "true" ]]; then
  # Include prompt content (privacy implications - use with caution)
  echo "$INPUT" | jq -R --arg timestamp "$TIMESTAMP" --arg level "$LOG_LEVEL" '{
    "timestamp": $timestamp,
    "event": "userPromptSubmit",
    "level": $level,
    "hasContent": (. | length > 0)
  }' >> .copilot/logs/prompts.log 2>/dev/null || true
else
  # Log without prompt content (privacy-respecting default)
  jq -Rn --arg timestamp "$TIMESTAMP" --arg level "$LOG_LEVEL" '{
    "timestamp": $timestamp,
    "event": "userPromptSubmit",
    "level": $level
  }' >> .copilot/logs/prompts.log 2>/dev/null || true
fi

exit 0
