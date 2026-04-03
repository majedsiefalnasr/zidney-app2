#!/bin/bash
# ───────────────────────────────────────────────────────────────────────────
# START: Smoke Test Husky Hooks
# Validates commit-msg, pre-commit, and pre-push hooks locally with mocked tools
# ───────────────────────────────────────────────────────────────────────────

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

SHELL_HELPER_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SHELL_HELPER_DIR/utils/shell-ai.sh"
shell_ai_parse_args "$@"
shell_ai_init "scripts/hooks-smoke-test.sh"

TMP_BIN="$(mktemp -d)"
cleanup() { rm -rf "$TMP_BIN"; rm -f "$MSGFILE"; rm -f "$TESTFILE"; }
trap cleanup EXIT

# Mocked executables to avoid running heavy tooling during smoke tests
cat > "$TMP_BIN/bun" <<'BUN'
#!/bin/sh
echo "MOCK BUN: $@"
exit 0
BUN
chmod +x "$TMP_BIN/bun"

cat > "$TMP_BIN/bunx" <<'BUNX'
#!/bin/sh
echo "MOCK BUNX: $@"
exit 0
BUNX
chmod +x "$TMP_BIN/bunx"

cat > "$TMP_BIN/actionlint" <<'ACT'
#!/bin/sh
echo "MOCK ACTIONLINT: $@"
exit 0
ACT
chmod +x "$TMP_BIN/actionlint"

cat > "$TMP_BIN/trivy" <<'TRV'
#!/bin/sh
echo "MOCK TRIVY: $@"
exit 0
TRV
chmod +x "$TMP_BIN/trivy"

export PATH="$TMP_BIN:$PATH"

# Prepare a staged test file (will be unstaged by cleanup)
TESTFILE="hooks-smoke-test.tmp"
echo "smoke test" > "$TESTFILE"
# Force-add in case the filename matches .gitignore patterns used in this repo
git add -f "$TESTFILE"

# Build a commit message file that matches the current spec branch scope
MSGFILE="$(mktemp)"
printf "%s\n" "feat(040-grading-core): smoke test commit" > "$MSGFILE"

echo "=== Running commit-msg hook ==="
./.husky/commit-msg "$MSGFILE" && echo "commit-msg: OK" || { echo "commit-msg: FAILED"; exit 1; }

echo "=== Running pre-commit hook ==="
./.husky/pre-commit && echo "pre-commit: OK" || { echo "pre-commit: FAILED"; exit 1; }

echo "=== Running pre-push hook (dry-run via mocked tools) ==="
./.husky/pre-push && echo "pre-push: OK" || { echo "pre-push: FAILED"; exit 1; }

echo ""
echo "───────────────────────────────────────────────────────────────────────────"
echo "RESULT"
echo "Status: All Husky hooks passed (commit-msg, pre-commit, pre-push)"
echo "───────────────────────────────────────────────────────────────────────────"
exit 0
