#!/usr/bin/env bash
# START: Script execution
# check-tsconfig-strict.sh
# Validates that tsconfig.base.json enforces all required strict TypeScript flags.
# Adds `--ai` for machine-readable JSON output and a consistent summary.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TSCONFIG="$ROOT/tsconfig.base.json"
SCRIPT_NAME="check-tsconfig-strict"

AI_MODE=false
for a in "$@"; do
  case "$a" in
    --ai) AI_MODE=true ;;
    -h|--help)
      echo "Usage: $0 [--ai]"
      echo "  --ai    Emit JSON + summary for CI/agents"
      exit 0
      ;;
  esac
done

now_ms() {
  if command -v node >/dev/null 2>&1; then
    node -e "log.info(Date.now())"
  elif command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import time
print(int(time.time()*1000))
PY
  else
    echo $(( $(date +%s) * 1000 ))
  fi
}

START_TIME=$(now_ms)

# Color helpers (ignored in --ai)
if [ "$AI_MODE" = false ]; then
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  RESET='\033[0m'
fi

MISSING_FLAGS=()
VIOLATION_FILES=()
ERRORS=()
WARNINGS=()

ai_output() {
  local status="$1"; local message="$2"; local duration_ms="$3"; local result_json="$4"
  if [ -z "$result_json" ]; then result_json='{}'; fi
  printf '{"status":"%s","script":"%s","duration_ms":%s,"result":%s}\n' "$status" "$SCRIPT_NAME" "$duration_ms" "$result_json"
  if [ -n "$message" ]; then
    printf '%s: %s\n' "$(echo "$status" | tr '[:lower:]' '[:upper:]')" "$message"
  fi
}

log_start() {
  if [ "$AI_MODE" = true ]; then return; fi
  echo "=== Zidney tsconfig Strict Flag Validator ==="
  echo "Checking: $TSCONFIG"
  echo ""
}

log_info() {
  if [ "$AI_MODE" = true ]; then return; fi
  echo -e "${BLUE}ℹ${RESET} $1"
}

log_warn() {
  if [ "$AI_MODE" = true ]; then WARNINGS+=("$1"); return; fi
  echo -e "${YELLOW}⚠${RESET} $1"
}

log_error() {
  if [ "$AI_MODE" = true ]; then ERRORS+=("$1"); return; fi
  echo -e "${RED}ERROR${RESET}: $1"
}

log_success() {
  if [ "$AI_MODE" = true ]; then return; fi
  echo -e "${GREEN}PASSED${RESET}: $1"
}

join_json_array() {
  arr_name="$1"
  out=''
  # load array by name (compatible with older bash on macOS)
  eval "arr=(\"\${${arr_name}[@]}\")"
  for v in "${arr[@]}"; do
    v_esc=$(printf '%s' "$v" | sed 's/"/\\"/g')
    if [ -z "$out" ]; then
      out="\"$v_esc\""
    else
      out="$out, \"$v_esc\""
    fi
  done
  echo "[${out}]"
}

finalize_exit() {
  local code=$1
  local end_ts=$(now_ms)
  local duration=$((end_ts - START_TIME))
  local status message
  if [ "$code" -eq 0 ]; then
    status="success"
    message="All checks passed"
  else
    status="error"
    message="One or more checks failed"
  fi

  local result_json
  result_json=$(printf '{"missing_count":%d,"violation_count":%d,"missing_flags":%s,"violation_files":%s,"errors":%s,"warnings":%s}' \
    "$(( ${#MISSING_FLAGS[@]} ))" "$(( ${#VIOLATION_FILES[@]} ))" \
    "$(join_json_array MISSING_FLAGS)" "$(join_json_array VIOLATION_FILES)" "$(join_json_array ERRORS)" "$(join_json_array WARNINGS)"
  )

  if [ "$AI_MODE" = true ]; then
    ai_output "$status" "$message" "$duration" "$result_json"
  else
    if [ "$code" -eq 0 ]; then
      echo ""
      log_success "$message ($duration ms)"
    else
      echo ""
      log_error "$message ($duration ms)"
      for e in "${ERRORS[@]}"; do
        echo "  - $e"
      done
      for w in "${WARNINGS[@]}"; do
        echo "  - WARNING: $w"
      done
    fi
  fi

  exit "$code"
}

log_start

if [ ! -f "$TSCONFIG" ]; then
  log_error "$TSCONFIG not found"
  finalize_exit 1
fi

FAILURES=0

check_flag() {
  FLAG="$1"
  EXPECTED="$2"
  if grep -q "\"$FLAG\"" "$TSCONFIG" && grep -A1 "\"$FLAG\"" "$TSCONFIG" | grep -q "$EXPECTED"; then
    log_info "ok: $FLAG = $EXPECTED"
  elif grep -q "\"$FLAG\".*$EXPECTED" "$TSCONFIG"; then
    log_info "ok: $FLAG = $EXPECTED"
  else
    log_error "MISSING: $FLAG should be $EXPECTED"
    MISSING_FLAGS+=("$FLAG")
    ERRORS+=("Missing flag: $FLAG")
    FAILURES=$((FAILURES + 1))
  fi
}

log_info "Checking required strict compiler flags:"
check_flag "strict" "true"
check_flag "noImplicitAny" "true"
check_flag "strictNullChecks" "true"
check_flag "noUncheckedIndexedAccess" "true"
check_flag "noUnusedLocals" "true"
check_flag "noUnusedParameters" "true"
check_flag "forceConsistentCasingInFileNames" "true"

if [ "$FAILURES" -gt 0 ]; then
  finalize_exit 1
fi

log_success "All required strict flags are enforced in $TSCONFIG"

# --- Phase 2: Check package tsconfigs for weakening overrides ---
log_info "Checking package/app tsconfigs for weakening overrides:"
VIOLATIONS=0
while IFS= read -r tsconfig; do
  for opt in '"strict": false' '"noImplicitAny": false' '"strictNullChecks": false' '"noUncheckedIndexedAccess": false'; do
    if grep -q "$opt" "$tsconfig"; then
      log_warn "VIOLATION: $tsconfig contains: $opt"
      VIOLATION_FILES+=("$tsconfig")
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done
done < <(find "$ROOT/apps" "$ROOT/packages" \( -name 'tsconfig.json' -o -name 'tsconfig.app.json' \) 2>/dev/null)

if [ "$VIOLATIONS" -gt 0 ]; then
  finalize_exit 1
fi

log_success "No weakening overrides found in package tsconfigs."
echo ""
echo "RESULT: Validation successful"
finalize_exit 0
