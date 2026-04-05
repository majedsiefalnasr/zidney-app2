#!/bin/bash

# Log analysis utility for Session Logger hook
# Provides insights into Copilot session activity

set -euo pipefail

LOGS_DIR=\".copilot/logs\"
SESSION_LOG=\"${LOGS_DIR}/session.log\"
PROMPTS_LOG=\"${LOGS_DIR}/prompts.log\"

# Color codes
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

print_header() {
  echo -e \"${BLUE}=== $1 ===${NC}\"
}

check_files() {
  if [[ ! -f \"$SESSION_LOG\" ]]; then
    echo -e \"${YELLOW}⚠️  No session logs found at $SESSION_LOG${NC}\"
    return 1
  fi
  return 0
}

show_sessions() {
  print_header \"Session Activity\"
  
  if check_files; then
    local session_count=$(grep -c '\"event\":\"sessionStart\"' \"$SESSION_LOG\" || echo 0)
    local total_lines=$(wc -l < \"$SESSION_LOG\")
    
    echo -e \"${GREEN}✓ Total Sessions: $session_count${NC}\"
    echo -e \"${GREEN}✓ Total Events: $total_lines${NC}\"
    echo \"\"
    echo \"Recent 5 sessions:\"
    grep '\"event\":\"sessionStart\"' \"$SESSION_LOG\" | tail -5 | jq '.timestamp'
  fi
}

show_branches() {
  print_header \"Git Branch Distribution\"
  
  if check_files; then
    echo \"Branches used in sessions:\"
    jq -r '.git.branch // empty' \"$SESSION_LOG\" | sort | uniq -c | sort -rn
  fi
}

show_prompts() {
  print_header \"Prompt Activity\"
  
  if [[ ! -f \"$PROMPTS_LOG\" ]]; then
    echo -e \"${YELLOW}⚠️  No prompt logs found at $PROMPTS_LOG${NC}\"
    return 1
  fi
  
  local prompt_count=$(wc -l < \"$PROMPTS_LOG\")
  echo -e \"${GREEN}✓ Total Prompts: $prompt_count${NC}\"
  echo \"\"
  echo \"Prompts by hour:\"
  jq -r '.timestamp' \"$PROMPTS_LOG\" | cut -d'T' -f2 | cut -d':' -f1 | sort | uniq -c | sort -n
}

show_stats() {
  print_header \"Overall Statistics\"
  
  if check_files; then
    local start_events=$(grep -c '\"event\":\"sessionStart\"' \"$SESSION_LOG\" || echo 0)
    local stop_events=$(grep -c '\"event\":\"sessionStop\"' \"$SESSION_LOG\" || echo 0)
    
    echo -e \"${GREEN}✓ Session Starts: $start_events${NC}\"
    echo -e \"${GREEN}✓ Session Stops: $stop_events${NC}\"
    
    if [[ -f \"$PROMPTS_LOG\" ]]; then
      local prompt_count=$(wc -l < \"$PROMPTS_LOG\" || echo 0)
      echo -e \"${GREEN}✓ Total Prompts: $prompt_count${NC}\"
      
      if [[ $start_events -gt 0 ]]; then
        local avg_prompts=$(echo \"scale=2; $prompt_count / $start_events\" | bc 2>/dev/null || echo \"N/A\")
        echo -e \"${GREEN}✓ Avg Prompts per Session: $avg_prompts${NC}\"
      fi
    fi
  fi
}

show_help() {
  echo \"Session Logger Analysis Tool\"
  echo \"\"
  echo \"Usage: $(basename \"$0\") [COMMAND]\"
  echo \"\"
  echo \"Commands:\"
  echo \"  sessions      Show session activity\"
  echo \"  prompts       Show prompt activity\"
  echo \"  branches      Show git branch distribution\"
  echo \"  stats         Show overall statistics\"
  echo \"  all           Show all information (default)\"
  echo \"  tail          Tail the session log in real-time\"
  echo \"  help          Show this help message\"
}

# Main
COMMAND=\"${1:-all}\"

case \"$COMMAND\" in
  sessions)
    show_sessions
    ;;
  prompts)
    show_prompts
    ;;
  branches)
    show_branches
    ;;
  stats)
    show_stats
    ;;
  all)
    show_sessions
    echo \"\"
    show_prompts
    echo \"\"
    show_branches
    echo \"\"
    show_stats
    ;;
  tail)
    if check_files; then
      tail -f \"$SESSION_LOG\"
    fi
    ;;
  help)
    show_help
    ;;
  *)
    echo -e \"${RED}Error: Unknown command '$COMMAND'${NC}\"
    show_help
    exit 1
    ;;
esac
