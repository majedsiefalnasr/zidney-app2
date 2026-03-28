#!/bin/bash
# START: Script execution

# Wrapper to run actionlint if available; skip if not installed.
# Usage: scripts/ci/actionlint_wrapper.sh <file1> <file2> ...

SHELL_HELPER_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SHELL_HELPER_DIR/../utils/shell-ai.sh"
shell_ai_parse_args "$@"
shell_ai_init "scripts/ci/actionlint_wrapper.sh"

FILTERED_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --ai|--pretty)
      ;;
    *)
      FILTERED_ARGS+=("$arg")
      ;;
  esac
done

if command -v actionlint >/dev/null 2>&1; then
  actionlint "${FILTERED_ARGS[@]}"
  exit $?
fi

shell_ai_set_status warning
shell_ai_set_message "actionlint not installed; skipping"
echo "⚠️  actionlint not installed — skipping. Install: brew install actionlint"
echo ""
echo "─────────────────────────────────────────────────────────────────────────────"
echo "RESULT"
echo "Status: Script execution successful"
echo "─────────────────────────────────────────────────────────────────────────────"
exit 0
