#!/bin/bash
# START: Script execution
# T100: Pre-commit enforcement for SKILL.md files
# Validates that all SKILL.md files are <500 lines (Q4 requirement)
# Usage: bash scripts/ci/validate-skill-sizes.sh [files...]

set -e

SHELL_HELPER_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SHELL_HELPER_DIR/../utils/shell-ai.sh"
shell_ai_parse_args "$@"
shell_ai_init "scripts/ci/validate-skill-sizes.sh"

MAX_LINES=500
FAILED=0

# Get all SKILL.md files from arguments or git staged
SKILL_FILES=()
if [[ $# -gt 0 ]]; then
  # Files provided as arguments (from lint-staged)
  for file in "$@"; do
    if [[ "$file" == *"SKILL.md" ]]; then
      SKILL_FILES+=("$file")
    fi
  done
else
  # Auto-detect all SKILL.md files in repo
  while IFS= read -r file; do
    SKILL_FILES+=("$file")
  done < <(find . -name "SKILL.md" -type f 2>/dev/null)
fi

# Validate each file
for file in "${SKILL_FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    continue
  fi

  line_count=$(wc -l < "$file")
  status="✓"

  if [[ $line_count -gt $MAX_LINES ]]; then
    status="✗"
    echo "❌ SKILL.md exceeds limit: $file ($line_count > $MAX_LINES lines)"
    FAILED=$((FAILED + 1))
  elif [[ $line_count -gt $((MAX_LINES - 50)) ]]; then
    status="⚠️"
    echo "⚠️  SKILL.md approaching limit: $file ($line_count lines, margin: $((MAX_LINES - line_count)))"
  fi
done

# Report summary
echo "---"
if [[ $FAILED -eq 0 ]]; then
  echo "✅ All SKILL.md files within limits (<$MAX_LINES lines)"
  echo ""
  echo "RESULT: All SKILL.md files within size limits"
  exit 0
else
  echo "❌ $FAILED SKILL.md file(s) exceed limit. Please refactor to <$MAX_LINES lines."
  echo ""
  echo "RESULT: SKILL.md size validation failed"
  exit 1
fi
