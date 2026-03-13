#!/bin/sh

# Wrapper to run yaml-lint (node) or yamllint (python) if available.
# Usage: scripts/ci/yaml_lint.sh <file1> <file2> ...

if command -v bunx >/dev/null 2>&1 && bunx --version >/dev/null 2>&1; then
  exec bunx yaml-lint "$@"
fi

if command -v yamllint >/dev/null 2>&1; then
  exec yamllint "$@"
fi

echo "⚠️  yaml-lint not available — skipping. Install: bun add -D yaml-lint or pip install yamllint"
exit 0
