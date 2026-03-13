#!/bin/sh

# Wrapper to run actionlint if available; skip if not installed.
# Usage: scripts/ci/actionlint_wrapper.sh <file1> <file2> ...

if command -v actionlint >/dev/null 2>&1; then
  exec actionlint "$@"
fi

echo "⚠️  actionlint not installed — skipping. Install: brew install actionlint"
exit 0
