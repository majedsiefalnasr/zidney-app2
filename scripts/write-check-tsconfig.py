import os

script_path = '/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2/scripts/check-tsconfig-strict.sh'

content = r"""#!/usr/bin/env bash
# check-tsconfig-strict.sh
# Validates that tsconfig.base.json enforces all required strict TypeScript flags.
# Exit code 0 = all flags present, exit code 1 = missing flags detected.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TSCONFIG="$ROOT/tsconfig.base.json"

echo "=== Zidney tsconfig Strict Flag Validator ==="
echo "Checking: $TSCONFIG"
echo ""

if [ ! -f "$TSCONFIG" ]; then
  echo "ERROR: $TSCONFIG not found"
  exit 1
fi

FAILURES=0

check_flag() {
  FLAG="$1"
  EXPECTED="$2"
  if grep -q "\"$FLAG\"" "$TSCONFIG" && grep -A1 "\"$FLAG\"" "$TSCONFIG" | grep -q "$EXPECTED"; then
    echo "  ok: $FLAG = $EXPECTED"
  elif grep -q "\"$FLAG\".*$EXPECTED" "$TSCONFIG"; then
    echo "  ok: $FLAG = $EXPECTED"
  else
    echo "  MISSING: $FLAG should be $EXPECTED"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "Checking required strict compiler flags:"
check_flag "strict" "true"
check_flag "noImplicitAny" "true"
check_flag "strictNullChecks" "true"
check_flag "noUncheckedIndexedAccess" "true"
check_flag "noUnusedLocals" "true"
check_flag "noUnusedParameters" "true"
check_flag "forceConsistentCasingInFileNames" "true"
echo ""

if [ "$FAILURES" -gt 0 ]; then
  echo "FAILED: $FAILURES required strict flag(s) missing from $TSCONFIG"
  exit 1
fi

echo "PASSED: All required strict flags are enforced in $TSCONFIG"
exit 0
"""

with open(script_path, 'w') as f:
    f.write(content)
os.chmod(script_path, 0o755)
print(f'Written: {script_path}')
