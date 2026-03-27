#!/bin/sh
# START: Script execution

# Wrapper to run actionlint if available; skip if not installed.
# Usage: scripts/ci/actionlint_wrapper.sh <file1> <file2> ...

if command -v actionlint >/dev/null 2>&1; then
  exec actionlint "$@"
fi

echo "⚠️  actionlint not installed — skipping. Install: brew install actionlint"
echo ""
echo "─────────────────────────────────────────────────────────────────────────────"
echo "RESULT"
echo "Status: Script execution successful"
echo "─────────────────────────────────────────────────────────────────────────────"
exit 0
