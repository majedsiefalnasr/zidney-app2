#!/usr/bin/env python3
"""
Targeted fixer for TypeScript test files.
Applies specific patterns to fix the remaining ~430 TypeScript errors.
"""
import re
import os
import sys

ROOT = "/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2"


def fix_file(relpath: str, fixes: list) -> int:
    """Apply a list of fix functions to a file. Returns count of changes."""
    fullpath = os.path.join(ROOT, relpath)
    if not os.path.exists(fullpath):
        print(f"  NOT FOUND: {relpath}")
        return 0
    with open(fullpath) as f:
        content = f.read()
    original = content
    for fix_fn in fixes:
        content = fix_fn(content)
    if content != original:
        with open(fullpath, 'w') as f:
            f.write(content)
        print(f"  FIXED: {relpath}")
        return 1
    print(f"  NO CHANGE: {relpath}")
    return 0


def pool_nonnull(content: str) -> str:
    """Add ! after getTenantPool(...) to make type Pool instead of Pool|null."""
    # Match getTenantPool(anything) not already followed by !
    return re.sub(
        r'(get(?:Tenant|Master)Pool\([^)]*\))(?!\s*!)',
        r'\1!',
        content
    )


def array_index_nonnull(content: str) -> str:
    """Add ! after array[index] when followed by . access."""
    # Pattern: someExpr[index].property  ->  someExpr[index]!.property
    # Only where [index] is followed immediately by . (not already !)
    return re.sub(r'(\[\d+\])(?!!)(?=\.)', r'\1!', content)


def variable_index_nonnull(content: str) -> str:
    """Add ! after array[variable] when followed by . access."""
    return re.sub(
        r'(\[(?:i|j|k|idx|index|n|m|count|page|offset|limit|[a-z][a-zA-Z]*Index|[a-z][a-zA-Z]*Idx)\])(?!!)(?=\.)',
        r'\1!',
        content
    )


def result_questionresults_nonnull(content: str) -> str:
    """Add ! after result.questionResults[N] access patterns."""
    return re.sub(
        r'(result\.questionResults\[\d+\])(?!!)(?=\.)',
        r'\1!',
        content
    )


def rows_array_nonnull(content: str) -> str:
    """Add ! after .rows[N] access patterns."""
    return re.sub(r'(\.rows\[\d+\])(?!!)(?=[\s\n,;).])', r'\1!', content)


def products_array_nonnull(content: str) -> str:
    """Add ! after .products[N], .entries[N], .items[N], .results[N] etc."""
    return re.sub(
        r'(\.(?:products|entries|items|results|data|records|logs|list)\[\d+\])(?!!)(?=\.)',
        r'\1!',
        content
    )


def db_master_nonnull(content: str) -> str:
    """Add ! after db.master when it's possibly undefined."""
    # Only where db.master appears without already being asserted
    # Actually leave this one alone - it's a property access, more complex
    return content


def first_element_guard(content: str) -> str:
    """Replace patterns like const x = arr[0]; x.prop with const x = arr[0]!; x.prop."""
    return re.sub(
        r'((?:const|let)\s+\w+\s*=\s*\w+\[\d+\])(?!\s*!)',
        r'\1!',
        content
    )


# File groups with their applicable fixes
FILE_FIXES = {
    # Pool null check files
    'apps/api/tests/integration/account-lockout.test.ts': [pool_nonnull, rows_array_nonnull, first_element_guard],
    'apps/api/tests/integration/concurrent-logins.test.ts': [pool_nonnull, rows_array_nonnull, first_element_guard],
    'apps/api/tests/integration/token-versioning.test.ts': [pool_nonnull, rows_array_nonnull, first_element_guard],
    'apps/api/tests/integration/workspace-isolation.test.ts': [pool_nonnull, rows_array_nonnull, first_element_guard],
    'apps/api/tests/unit/isolation.test.ts': [pool_nonnull, rows_array_nonnull, first_element_guard],
    'apps/api/tests/integration/rbac-enforcement.test.ts': [pool_nonnull, rows_array_nonnull, first_element_guard],
    'apps/api/tests/integration/create-attempt.test.ts': [pool_nonnull, rows_array_nonnull, first_element_guard],
    # Products tests with array access
    'tests/integration/products/test_audit_log.ts': [array_index_nonnull, products_array_nonnull],
    'tests/integration/products/test_list.ts': [array_index_nonnull, products_array_nonnull],
    'tests/integration/products/test_delete.ts': [array_index_nonnull, products_array_nonnull],
    'tests/integration/products/test_create.ts': [array_index_nonnull, products_array_nonnull],
    'tests/integration/products/test_get.ts': [array_index_nonnull, products_array_nonnull],
    'tests/integration/products/test_update.ts': [array_index_nonnull, products_array_nonnull],
    'tests/integration/products/test_status_change.ts': [array_index_nonnull, products_array_nonnull],
    'tests/integration/products/test_errors.ts': [array_index_nonnull, products_array_nonnull],
    'tests/load/products/test_performance.ts': [array_index_nonnull, products_array_nonnull],
    'tests/contract/products/test_contract.ts': [array_index_nonnull, products_array_nonnull],
    # API products tests
    'apps/api/tests/integration/products/test_audit_log.ts': [array_index_nonnull, products_array_nonnull],
    'apps/api/tests/integration/products/test_list.ts': [array_index_nonnull, products_array_nonnull],
    'apps/api/tests/load/products/test_list_performance.ts': [array_index_nonnull, products_array_nonnull],
    'apps/api/tests/unit/products/test_service_logic.ts': [array_index_nonnull, products_array_nonnull],
    # Grading test
    'apps/api/tests/unit/grading-algorithm.test.ts': [result_questionresults_nonnull, array_index_nonnull],
    # Worker/grading
    'apps/worker/tests/grading/snapshot-immutability.test.ts': [array_index_nonnull, products_array_nonnull],
    # MMC tests
    'tests/unit/mmc/geographic-aggregator.test.ts': [array_index_nonnull],
    'tests/unit/mmc/affiliate-aggregator.test.ts': [array_index_nonnull],
    # Unit product service
    'tests/unit/products/test_service_logic.ts': [array_index_nonnull, result_questionresults_nonnull],
    # License domain tests
    'packages/domain-core/tests/license/concurrency.test.ts': [array_index_nonnull, pool_nonnull],
    'packages/domain-core/tests/license/lifecycle.test.ts': [array_index_nonnull, pool_nonnull],
    'packages/domain-core/tests/license/fixtures.ts': [array_index_nonnull, pool_nonnull],
    # Performance tests
    'tests/performance/08-performance-baseline.test.ts': [array_index_nonnull, pool_nonnull],
    # Other
    'apps/api/tests/unit/rbac.test.ts': [array_index_nonnull, pool_nonnull, rows_array_nonnull],
    'apps/api/tests/unit/correlation-id.test.ts': [array_index_nonnull],
    'apps/api/tests/unit/schema-version.test.ts': [array_index_nonnull],
    'apps/api/tests/load/products/test_concurrent_updates.ts': [array_index_nonnull],
    'apps/api/tests/load/products/test_concurrent_operations.ts': [array_index_nonnull],
    'apps/mmc/tests/performance/dashboard-perf.test.ts': [array_index_nonnull],
    'tests/test-helpers.ts': [array_index_nonnull, rows_array_nonnull],
    'tests/integration/provisioning-e2e-setup.ts': [array_index_nonnull],
    'packages/ui-system/tests/integration/integration.spec.ts': [array_index_nonnull],
}


if __name__ == '__main__':
    total = 0
    for relpath, fixes in FILE_FIXES.items():
        total += fix_file(relpath, fixes)
    print(f"\nTotal files modified: {total}")
