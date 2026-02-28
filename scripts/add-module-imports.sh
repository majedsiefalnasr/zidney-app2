#!/usr/bin/env bash
# Add Module import to files that reference Module.* enum values
set -euo pipefail

ROOT="/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2"

FILES=(
  "$ROOT/tests/integration/products/test_create.ts"
  "$ROOT/tests/integration/products/test_delete.ts"
  "$ROOT/tests/integration/products/test_get.ts"
  "$ROOT/tests/integration/products/test_list.ts"
  "$ROOT/tests/integration/products/test_status_change.ts"
  "$ROOT/tests/integration/products/test_audit_log.ts"
  "$ROOT/tests/integration/products/test_transactions.ts"
  "$ROOT/tests/integration/products/test_update.ts"
  "$ROOT/tests/integration/products/test_errors.ts"
  "$ROOT/tests/load/products/test_performance.ts"
  "$ROOT/tests/contract/products/test_contract.ts"
  "$ROOT/apps/api/tests/integration/products/test_audit_log.ts"
  "$ROOT/apps/api/tests/integration/products/test_create.ts"
  "$ROOT/apps/api/tests/integration/products/test_list.ts"
  "$ROOT/apps/api/tests/unit/products/test_service_logic.ts"
  "$ROOT/apps/api/tests/load/products/test_concurrent_updates.ts"
  "$ROOT/apps/api/tests/load/products/test_concurrent_operations.ts"
  "$ROOT/apps/api/tests/load/products/test_list_performance.ts"
  "$ROOT/apps/api/tests/load/products/test_audit_performance.ts"
  "$ROOT/tests/unit/products/test_service_logic.ts"
)

for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "SKIPPED (not found): $f"
    continue
  fi

  # Check if file uses Module.* enum values
  if ! grep -q "Module\." "$f"; then
    echo "NO MODULE REFS: $f"
    continue
  fi

  # Check if Module import already exists
  if grep -q "from '@zidney/types/enums/Module'" "$f"; then
    echo "ALREADY HAS IMPORT: $f"
    continue
  fi

  # Add import. Insert after the last 'import' statement from @zidney/types block or at top
  # Find first import line and insert before or after existing @zidney imports
  # Strategy: find the line with "from '@zidney/types" or first import line number, add after
  FIRST_IMPORT_LINE=$(grep -n "^import " "$f" | head -1 | cut -d: -f1)
  
  if [[ -z "$FIRST_IMPORT_LINE" ]]; then
    # No imports yet - prepend
    echo "import { Module } from '@zidney/types/enums/Module'" | cat - "$f" > /tmp/_tmp_fix.ts && mv /tmp/_tmp_fix.ts "$f"
  else
    # Find the last @zidney/types import line
    LAST_TYPES_LINE=$(grep -n "from '@zidney/types" "$f" | tail -1 | cut -d: -f1)
    if [[ -n "$LAST_TYPES_LINE" ]]; then
      # Insert after last @zidney/types import
      sed -i '' "${LAST_TYPES_LINE}a\\
import { Module } from '@zidney/types/enums/Module'" "$f"
    else
      # Insert after first import line
      sed -i '' "${FIRST_IMPORT_LINE}a\\
import { Module } from '@zidney/types/enums/Module'" "$f"
    fi
  fi
  
  echo "Added import: $f"
done

echo "Done."
