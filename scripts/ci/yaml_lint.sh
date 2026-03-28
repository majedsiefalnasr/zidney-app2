#!/bin/bash
# START: Script execution

# Wrapper to run yaml-lint (node) or yamllint (python) if available.
# Usage: scripts/ci/yaml_lint.sh <file1> <file2> ...

SHELL_HELPER_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SHELL_HELPER_DIR/../utils/shell-ai.sh"
shell_ai_parse_args "$@"
shell_ai_init "scripts/ci/yaml_lint.sh"

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

if command -v bunx >/dev/null 2>&1 && bunx --version >/dev/null 2>&1; then
  bunx yaml-lint "${FILTERED_ARGS[@]}"
  exit $?
fi

if command -v yamllint >/dev/null 2>&1; then
  yamllint "${FILTERED_ARGS[@]}"
  exit $?
fi

shell_ai_set_status warning
shell_ai_set_message "yaml-lint not available; skipping"
echo "⚠️  yaml-lint not available — skipping. Install: bun add -D yaml-lint or pip install yamllint"
echo ""
echo "─────────────────────────────────────────────────────────────────────────────"
echo "RESULT"
echo "Status: Script execution successful"
echo "─────────────────────────────────────────────────────────────────────────────"
exit 0
