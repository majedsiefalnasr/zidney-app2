#!/usr/bin/env bash
# Fix MODULE_* string literals to Module enum values across product test files
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
  if [[ -f "$f" ]]; then
    sed -i '' "s/'MODULE_ATTEMPT'/Module.MCQ/g" "$f"
    sed -i '' "s/'MODULE_REPORTING'/Module.TRADITIONAL_EXAMS/g" "$f"
    sed -i '' "s/'MODULE_ASSESSMENT'/Module.EXERCISES/g" "$f"
    sed -i '' "s/'MODULE_PROCTOR'/Module.LIBRARY/g" "$f"
    sed -i '' "s/'MODULE_CONTENT'/Module.LIVES/g" "$f"
    sed -i '' "s/'MODULE_ANALYTICS'/Module.FORUM/g" "$f"
    sed -i '' "s/'MODULE_SURVEY'/Module.MCQ/g" "$f"
    echo "Processed: $f"
  else
    echo "SKIPPED (not found): $f"
  fi
done

echo "Done."
