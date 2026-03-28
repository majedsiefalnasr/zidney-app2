#!/bin/sh
# @library-module shared shell AI summary helpers

shell_ai_now_ms() {
  if command -v node >/dev/null 2>&1; then
    node -p 'Date.now()' 2>/dev/null
    return
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
    return
  fi

  echo $(( $(date +%s) * 1000 ))
}

shell_ai_json_escape() {
  printf '%s' "$1" | sed ':a;N;$!ba;s/\\/\\\\/g;s/"/\\"/g;s/\r/\\r/g;s/\n/\\n/g'
}

shell_ai_json_scalar() {
  value=${1-}

  case "$value" in
    true|false|null)
      printf '%s' "$value"
      return
      ;;
  esac

  if printf '%s' "$value" | grep -Eq '^-?[0-9]+([.][0-9]+)?$'; then
    printf '%s' "$value"
    return
  fi

  printf '"%s"' "$(shell_ai_json_escape "$value")"
}

shell_ai_add_detail() {
  key=$1
  value=${2-}

  if [ -n "${SHELL_AI_DETAILS:-}" ]; then
    SHELL_AI_DETAILS=$(printf '%s\n%s=%s' "$SHELL_AI_DETAILS" "$key" "$value")
  else
    SHELL_AI_DETAILS=$(printf '%s=%s' "$key" "$value")
  fi

  export SHELL_AI_DETAILS
}

shell_ai_render_details() {
  details=$(printf 'exit_code=%s' "${SHELL_AI_EXIT_CODE:-0}")

  if [ -n "${SHELL_AI_DETAILS:-}" ]; then
    details=$(printf '%s\n%s' "$details" "$SHELL_AI_DETAILS")
  fi

  output=''
  old_ifs=$IFS
  IFS='
'
  for entry in $details; do
    key=${entry%%=*}
    value=${entry#*=}

    if [ "$entry" = "$key" ] || [ -z "$key" ]; then
      continue
    fi

    item=$(printf '"%s":%s' "$(shell_ai_json_escape "$key")" "$(shell_ai_json_scalar "$value")")
    if [ -n "$output" ]; then
      output=$(printf '%s,%s' "$output" "$item")
    else
      output=$item
    fi
  done
  IFS=$old_ifs

  printf '{%s}' "$output"
}

shell_ai_write_payload() {
  payload=$1

  if [ "${SHELL_AI_MODE:-0}" != "1" ]; then
    return
  fi

  if [ "${SHELL_AI_PRETTY:-0}" = "1" ] && command -v python3 >/dev/null 2>&1; then
    printf '%s' "$payload" | python3 -m json.tool >&3
    printf '\n' >&3
    return
  fi

  printf '%s\n' "$payload" >&3
}

shell_ai_set_status() {
  SHELL_AI_STATUS_OVERRIDE=$1
  export SHELL_AI_STATUS_OVERRIDE
}

shell_ai_set_message() {
  SHELL_AI_MESSAGE_OVERRIDE=$1
  export SHELL_AI_MESSAGE_OVERRIDE
}

shell_ai_parse_args() {
  SHELL_AI_MODE=0
  SHELL_AI_PRETTY=0

  case "${AI_MODE:-0}" in
    1|true|TRUE|yes|YES)
      SHELL_AI_MODE=1
      ;;
  esac

  for arg in "$@"; do
    case "$arg" in
      --ai)
        SHELL_AI_MODE=1
        ;;
      --pretty)
        SHELL_AI_PRETTY=1
        ;;
    esac
  done

  AI_MODE=$SHELL_AI_MODE
  export AI_MODE SHELL_AI_MODE SHELL_AI_PRETTY

  if [ "$SHELL_AI_MODE" = "1" ] && [ -z "${SHELL_AI_STDOUT_CAPTURED:-}" ]; then
    exec 3>&1
    SHELL_AI_STDOUT_CAPTURED=1
    export SHELL_AI_STDOUT_CAPTURED
    exec 1>&2
  fi
}

shell_ai_finish() {
  exit_code=$1

  if [ "${SHELL_AI_MODE:-0}" != "1" ] || [ "${SHELL_AI_EMITTED:-0}" = "1" ]; then
    return
  fi

  SHELL_AI_EMITTED=1
  SHELL_AI_EXIT_CODE=$exit_code
  export SHELL_AI_EMITTED SHELL_AI_EXIT_CODE

  end_ms=$(shell_ai_now_ms)
  duration_ms=$((end_ms - ${SHELL_AI_START_MS:-end_ms}))

  if [ -n "${SHELL_AI_STATUS_OVERRIDE:-}" ]; then
    status=$SHELL_AI_STATUS_OVERRIDE
  elif [ "$exit_code" -eq 0 ]; then
    status='success'
  else
    status='error'
  fi

  if [ -n "${SHELL_AI_MESSAGE_OVERRIDE:-}" ]; then
    message=$SHELL_AI_MESSAGE_OVERRIDE
  else
    case "$status" in
      success)
        message='Script completed successfully'
        ;;
      warning)
        message='Script completed with warnings'
        ;;
      *)
        message='Script failed'
        ;;
    esac
  fi

  details_json=$(shell_ai_render_details)
  entry=$(printf '{"status":"%s","script":"%s","message":"%s","duration_ms":%s,"data":%s}' \
    "$status" \
    "$(shell_ai_json_escape "${SHELL_AI_SCRIPT:-$(basename "$0")}")" \
    "$(shell_ai_json_escape "$message")" \
    "$duration_ms" \
    "$details_json")

  case "$status" in
    success)
      errors='[]'
      warnings='[]'
      successes=$(printf '[%s]' "$entry")
      summary=$(printf '{"total":1,"errors":0,"warnings":0,"success":1,"duration_ms":%s}' "$duration_ms")
      ;;
    warning)
      errors='[]'
      warnings=$(printf '[%s]' "$entry")
      successes='[]'
      summary=$(printf '{"total":1,"errors":0,"warnings":1,"success":0,"duration_ms":%s}' "$duration_ms")
      ;;
    *)
      errors=$(printf '[%s]' "$entry")
      warnings='[]'
      successes='[]'
      summary=$(printf '{"total":1,"errors":1,"warnings":0,"success":0,"duration_ms":%s}' "$duration_ms")
      ;;
  esac

  payload=$(printf '{"status":"%s","summary":%s,"errors":%s,"warnings":%s,"successes":%s}' \
    "$status" "$summary" "$errors" "$warnings" "$successes")
  shell_ai_write_payload "$payload"
}

shell_ai_init() {
  SHELL_AI_SCRIPT=$1
  SHELL_AI_START_MS=$(shell_ai_now_ms)
  SHELL_AI_STATUS_OVERRIDE=''
  SHELL_AI_MESSAGE_OVERRIDE=''
  SHELL_AI_DETAILS=''
  SHELL_AI_EMITTED=0
  export SHELL_AI_SCRIPT SHELL_AI_START_MS SHELL_AI_STATUS_OVERRIDE SHELL_AI_MESSAGE_OVERRIDE SHELL_AI_DETAILS SHELL_AI_EMITTED
  trap 'shell_ai_finish "$?"' EXIT
}
