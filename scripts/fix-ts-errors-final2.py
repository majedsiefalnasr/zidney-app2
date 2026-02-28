#!/usr/bin/env python3
"""
Comprehensive TypeScript error fixer - Round 2
Fixes remaining ~224 errors across test files.
"""

import re
import os

ROOT = '/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2'

def read(path):
    full = os.path.join(ROOT, path)
    with open(full, 'r') as f:
        return f.read()

def write(path, content):
    full = os.path.join(ROOT, path)
    with open(full, 'w') as f:
        f.write(content)

def fix(path, fn, description=''):
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        print(f'  SKIP (not found): {path}')
        return
    content = read(path)
    new_content = fn(content)
    if new_content != content:
        write(path, new_content)
        print(f'  FIXED: {path} {description}')
    else:
        print(f'  NO CHANGE: {path} {description}')

def replace_exact(content, old, new):
    if old in content:
        return content.replace(old, new, 1)
    return content

def replace_all(content, old, new):
    return content.replace(old, new)

# ===========================================================================
# 1. ADD MasterDatabase TYPE EXPORT TO apps/api/src/db/index.ts
# ===========================================================================
def fix_db_index(content):
    if 'export type MasterDatabase' not in content:
        # Add at end of file
        content = content.rstrip() + '\n\n/**\n * Master database type for use in tests/other modules\n */\nexport type MasterDatabase = typeof db\n'
    return content

fix('apps/api/src/db/index.ts', fix_db_index, '- added MasterDatabase type')

# ===========================================================================
# 2. FIX `Any` → `any` IN MMC TEST FILES
# ===========================================================================
mmc_any_files = [
    'tests/integration/mmc/audit.test.ts',
    'tests/integration/mmc/concurrency.test.ts',
    'tests/unit/mmc/auth.service.test.ts',
    'tests/unit/mmc/invitation.service.test.ts',
    'tests/unit/mmc/member.service.test.ts',
    'tests/unit/mmc/permissions.test.ts',
]
for f in mmc_any_files:
    fix(f, lambda c: c.replace(': Any', ': any'), '- Any→any')

# ===========================================================================
# 3. FIX lifecycle.test.ts - MockDatabaseClient as unknown as Pool
# ===========================================================================
def fix_lifecycle(content):
    # Replace mockDb in function calls with cast
    # createLicense(mockDb, -> createLicense(mockDb as unknown as Pool,
    content = re.sub(
        r'\b(createLicense|transitionLicenseState|getLicenseById|checkLicenseLimits|validateLicenseForStudent)\(mockDb,',
        r'\1(mockDb as unknown as Pool,',
        content
    )
    return content

fix('packages/domain-core/tests/license/lifecycle.test.ts', fix_lifecycle, '- MockDatabaseClient cast')

# ===========================================================================
# 4. FIX fixtures.ts - entry destructure undefined
# ===========================================================================
def fix_fixtures(content):
    # Change `const [entry] = this.mockedResults.splice(matchIndex, 1)`
    # to `const entry = this.mockedResults.splice(matchIndex, 1)[0]!`
    content = content.replace(
        'const [entry] = this.mockedResults.splice(matchIndex, 1)',
        'const entry = this.mockedResults.splice(matchIndex, 1)[0]!'
    )
    return content

fix('packages/domain-core/tests/license/fixtures.ts', fix_fixtures, '- entry undefined fix')

# ===========================================================================
# 5. FIX audit-logging.test.ts - getTenantPool null check
# ===========================================================================
def fix_audit_logging(content):
    # `const pool = getTenantPool(workspace.id)` then `await pool.query(` fails
    # Fix: add ! after getTenantPool call
    content = re.sub(
        r'const pool = getTenantPool\(([^)]+)\)\n(\s+)const ',
        r'const pool = getTenantPool(\1)!\n\2const ',
        content
    )
    content = re.sub(
        r'const pool = getTenantPool\(([^)]+)\)\n(\s+)await pool',
        r'const pool = getTenantPool(\1)!\n\2await pool',
        content
    )
    return content

fix('apps/api/tests/integration/audit-logging.test.ts', fix_audit_logging, '- getTenantPool null')
fix('apps/api/tests/integration/license-enforcement.test.ts', fix_audit_logging, '- getTenantPool null')

# ===========================================================================
# 6. FIX audit-trail.integration.test.ts
# ===========================================================================
def fix_audit_trail(content):
    # Line 193-194: submitEvents[0] and [1]
    content = content.replace(
        'expect(submitEvents[0].event_payload.question_id)',
        'expect(submitEvents[0]!.event_payload.question_id)'
    )
    content = content.replace(
        'expect(submitEvents[1].event_payload.question_id)',
        'expect(submitEvents[1]!.event_payload.question_id)'
    )
    # Line 267: const firstEvent = history[0]
    content = content.replace(
        'const firstEvent = history[0]',
        'const firstEvent = history[0]!'
    )
    return content

fix('apps/api/tests/integration/audit-trail.integration.test.ts', fix_audit_trail)

# ===========================================================================
# 7. FIX phase5-snapshots - results[N]!
# ===========================================================================
def fix_phase5(content):
    content = content.replace(
        'const firstSnapshot = results[0].rows[0].configuration_snapshot',
        'const firstSnapshot = results[0]!.rows[0]!.configuration_snapshot'
    )
    content = re.sub(
        r'expect\(results\[i\]\.rows\[0\]\.configuration_snapshot\)',
        r'expect(results[i]!.rows[0]!.configuration_snapshot)',
        content
    )
    return content

fix('apps/api/tests/integration/phase5-snapshots.integration.test.ts', fix_phase5)

# ===========================================================================
# 8. FIX phase7-versioning - [major, minor, patch] destructure
# ===========================================================================
def fix_phase7(content):
    content = content.replace(
        "const [major, minor, patch] = currentVersion.split('.').map(Number)",
        "const [major, minor, patch] = currentVersion.split('.').map(Number) as [number, number, number]"
    )
    return content

fix('apps/api/tests/integration/phase7-versioning.integration.test.ts', fix_phase7)

# ===========================================================================
# 9. FIX poll-result.test.ts
# ===========================================================================
def fix_poll_result(content):
    content = content.replace(
        'retries[index - 1].retryAfter',
        'retries[index - 1]!.retryAfter'
    )
    return content

fix('apps/api/tests/integration/poll-result.test.ts', fix_poll_result)

# ===========================================================================
# 10. FIX submit-with-locking.test.ts
# ===========================================================================
def fix_submit_locking(content):
    content = content.replace(
        'expect(responses[0].status).toBe(202)',
        'expect(responses[0]!.status).toBe(202)'
    )
    content = content.replace(
        'expect(responses[1].status).toBe(409)',
        'expect(responses[1]!.status).toBe(409)'
    )
    return content

fix('apps/api/tests/integration/submit-with-locking.test.ts', fix_submit_locking)

# ===========================================================================
# 11. FIX timing-attack-prevention.test.ts
# ===========================================================================
def fix_timing(content):
    content = content.replace(
        'expect(passwordCheckLog[0].checked)',
        'expect(passwordCheckLog[0]!.checked)'
    )
    content = content.replace(
        'expect(passwordCheckLog[1].checked)',
        'expect(passwordCheckLog[1]!.checked)'
    )
    return content

fix('apps/api/tests/integration/timing-attack-prevention.test.ts', fix_timing)

# ===========================================================================
# 12. FIX version-compatibility.test.ts - parts[N]!
# ===========================================================================
def fix_version_compat(content):
    content = content.replace(
        "const parts = versionString.split('.')\n      return {\n        major: parseInt(parts[0]),\n        minor: parseInt(parts[1]),\n        patch: parseInt(parts[2]),\n      }",
        "const parts = versionString.split('.')\n      return {\n        major: parseInt(parts[0]!),\n        minor: parseInt(parts[1]!),\n        patch: parseInt(parts[2]!),\n      }"
    )
    return content

fix('apps/api/tests/integration/version-compatibility.test.ts', fix_version_compat)

# ===========================================================================
# 13. FIX schema-version.test.ts - parts[N]! and compatibilityMatrix[key]!
# ===========================================================================
def fix_schema_version(content):
    # Fix match[1], match[2], match[3] for version parsing
    content = re.sub(
        r'major: parseInt\(match\[1\]\)',
        r'major: parseInt(match[1]!)',
        content
    )
    content = re.sub(
        r'minor: parseInt\(match\[2\]\)',
        r'minor: parseInt(match[2]!)',
        content
    )
    content = re.sub(
        r'patch: parseInt\(match\[3\]\)',
        r'patch: parseInt(match[3]!)',
        content
    )
    # Fix compatibilityMatrix[key] undefined
    content = content.replace(
        'return this.compatibilityMatrix[key]',
        'return this.compatibilityMatrix[key]!'
    )
    return content

fix('apps/api/tests/unit/schema-version.test.ts', fix_schema_version)

# ===========================================================================
# 14. FIX jwt-validation.test.ts - parts[N]!
# ===========================================================================
def fix_jwt(content):
    content = content.replace(
        "Buffer.from(parts[0], 'base64')",
        "Buffer.from(parts[0]!, 'base64')"
    )
    content = content.replace(
        "Buffer.from(parts[1], 'base64')",
        "Buffer.from(parts[1]!, 'base64')"
    )
    content = content.replace(
        'const signature = parts[2]',
        'const signature = parts[2]!'
    )
    return content

fix('apps/api/tests/unit/jwt-validation.test.ts', fix_jwt)

# ===========================================================================
# 15. FIX correlation-id.test.ts - parts[2]!
# ===========================================================================
def fix_correlation(content):
    content = content.replace(
        "expect(parts[2][0]).toBe('4')",
        "expect(parts[2]![0]).toBe('4')"
    )
    return content

fix('apps/api/tests/unit/correlation-id.test.ts', fix_correlation)

# ===========================================================================
# 16. FIX load-1000.test.ts - responses never[] and errors string[]
# ===========================================================================
def fix_load_1000(content):
    content = content.replace(
        'responses: [],',
        'responses: [] as { status: number; body: { id: string } }[],'
    )
    content = content.replace(
        'const errors = [\n      // No timeout errors expected\n    ]',
        'const errors: string[] = [\n      // No timeout errors expected\n    ]'
    )
    return content

fix('apps/api/tests/load/load-1000.test.ts', fix_load_1000)

# ===========================================================================
# 17. FIX test_audit_performance.ts - sorted[0]! and sorted[999]!
# ===========================================================================
def fix_audit_perf(content):
    content = content.replace(
        'expect(sorted[0].timestamp > sorted[999].timestamp)',
        'expect(sorted[0]!.timestamp > sorted[999]!.timestamp)'
    )
    return content

fix('apps/api/tests/load/products/test_audit_performance.ts', fix_audit_perf)

# ===========================================================================
# 18. FIX test_concurrent_updates.ts - versions[N]!
# ===========================================================================
def fix_concurrent_updates(content):
    content = content.replace(
        'expect(versions[concurrentUpdates - 1].version_number)',
        'expect(versions[concurrentUpdates - 1]!.version_number)'
    )
    content = re.sub(
        r'expect\(versions\[i \+ 1\]\.version_number\)',
        r'expect(versions[i + 1]!.version_number)',
        content
    )
    content = re.sub(
        r'versions\[i\]\.version_number \+ 1\)',
        r'versions[i]!.version_number + 1)',
        content
    )
    return content

fix('apps/api/tests/load/products/test_concurrent_updates.ts', fix_concurrent_updates)

# ===========================================================================
# 19. FIX dashboard-query-plans.test.ts - executionMatch[1]! and planningMatch[1]!
# ===========================================================================
def fix_dashboard_query(content):
    content = content.replace(
        'parseFloat(executionMatch[1])',
        'parseFloat(executionMatch[1]!)'
    )
    content = content.replace(
        'parseFloat(planningMatch[1])',
        'parseFloat(planningMatch[1]!)'
    )
    return content

fix('apps/api/tests/performance/dashboard-query-plans.test.ts', fix_dashboard_query)

# ===========================================================================
# 20. FIX dashboard-errors.test.ts - `results: number[]` type
# ===========================================================================
def fix_dashboard_errors(content):
    # Find `const results = []` that's used as number array and fix
    # More targeted: find the one in `rate limited` test
    content = content.replace(
        'const results = []\n\n      // Rapid fire requests',
        'const results: number[] = []\n\n      // Rapid fire requests'
    )
    return content

fix('apps/mmc/tests/e2e/dashboard-errors.test.ts', fix_dashboard_errors)

# ===========================================================================
# 21. FIX dashboard-perf.test.ts line 264 - latencyData[key]!
# ===========================================================================
def fix_dashboard_perf(content):
    content = content.replace(
        'latencyData[key].push(result.duration)',
        'latencyData[key]!.push(result.duration)'
    )
    return content

fix('apps/mmc/tests/performance/dashboard-perf.test.ts', fix_dashboard_perf)

# ===========================================================================
# 22. FIX worker-grading.test.ts - jobStates[N]!
# ===========================================================================
def fix_worker_grading(content):
    content = content.replace(
        "expect(jobStates[0].status).toBe('PENDING')",
        "expect(jobStates[0]!.status).toBe('PENDING')"
    )
    content = content.replace(
        "expect(jobStates[1].status).toBe('PROCESSING')",
        "expect(jobStates[1]!.status).toBe('PROCESSING')"
    )
    content = content.replace(
        "expect(jobStates[2].status).toBe('COMPLETED')",
        "expect(jobStates[2]!.status).toBe('COMPLETED')"
    )
    return content

fix('apps/worker/tests/integration/worker-grading.test.ts', fix_worker_grading)

# ===========================================================================
# 23. FIX distributed-lock-service.test.ts - wrong import path
# ===========================================================================
def fix_distributed_lock(content):
    content = content.replace(
        "from '../src/services/distributed-lock-service'",
        "from '../../src/services/distributed-lock-service'"
    )
    return content

fix('apps/worker/tests/unit/distributed-lock-service.test.ts', fix_distributed_lock)

# ===========================================================================
# 24. FIX domain-core service.test.ts - validPairs destructure
# ===========================================================================
def fix_service_test(content):
    # forEach(([current, target]) => validateStateTransition(current, target)
    content = content.replace(
        'const result = validateStateTransition(current, target)',
        'const result = validateStateTransition(current!, target!)'
    )
    return content

fix('packages/domain-core/src/license/__tests__/service.test.ts', fix_service_test)

# ===========================================================================
# 25. FIX integration.spec.ts - ref<> type and errors.en!
# ===========================================================================
def fix_integration_spec(content):
    content = content.replace(
        'const filters = ref([])',
        'const filters = ref<{fieldId: string; value: string}[]>([])'
    )
    content = content.replace(
        'expect(wrapper.vm.errors.en.length)',
        'expect(wrapper.vm.errors.en!.length)'
    )
    return content

fix('packages/ui-system/tests/integration/integration.spec.ts', fix_integration_spec)

# ===========================================================================
# 26. FIX DataTable.spec.ts - _eventListeners cast
# ===========================================================================
def fix_datatable(content):
    content = content.replace(
        'const listenersBefore = el._eventListeners?.length || 0',
        'const listenersBefore = (el as any)._eventListeners?.length || 0'
    )
    return content

fix('packages/ui-system/tests/unit/DataTable.spec.ts', fix_datatable)

# ===========================================================================
# 27. FIX test_delete.ts - deleteProduct 3rd arg (missed instances)
# ===========================================================================
def fix_test_delete(content):
    # Remove ctx.userId from deleteProduct calls
    content = re.sub(
        r'await productService\.deleteProduct\(dbClient,\s*([^\s,]+),\s*ctx\.userId\)',
        r'await productService.deleteProduct(dbClient, \1)',
        content
    )
    return content

fix('tests/integration/products/test_delete.ts', fix_test_delete)
fix('tests/integration/products/test_errors.ts', fix_test_delete)

# ===========================================================================
# 28. FIX test_contract.ts - Date issues and deleteProduct
# ===========================================================================
def fix_test_contract(content):
    content = content.replace(
        'created_at: new Date().toISOString(),',
        'created_at: new Date(),'
    )
    content = content.replace(
        'updated_at: new Date().toISOString(),',
        'updated_at: new Date(),'
    )
    # Also fix deleteProduct 3rd arg
    content = re.sub(
        r'await productService\.deleteProduct\(dbClient,\s*([^\s,]+),\s*ctx\.userId\)',
        r'await productService.deleteProduct(dbClient, \1)',
        content
    )
    return content

fix('tests/contract/products/test_contract.ts', fix_test_contract)

# ===========================================================================
# 29. FIX test_status_change.ts - `r` implicit any
# ===========================================================================
def fix_test_status_change(content):
    content = content.replace(
        "expect(audits.rows.every((r) => r.action === 'STATUS_CHANGE')).toBe(true)",
        "expect(audits.rows.every((r: any) => r.action === 'STATUS_CHANGE')).toBe(true)"
    )
    return content

fix('tests/integration/products/test_status_change.ts', fix_test_status_change)

# ===========================================================================
# 30. FIX test_update.ts - `r` implicit any
# ===========================================================================
def fix_test_update(content):
    content = content.replace(
        "expect(versions.rows.map((r) => r.version_number)).toEqual([1, 2, 3, 4])",
        "expect(versions.rows.map((r: any) => r.version_number)).toEqual([1, 2, 3, 4])"
    )
    return content

fix('tests/integration/products/test_update.ts', fix_test_update)

# ===========================================================================
# 31. FIX test_performance.ts (load) - r:any and items[i]!
# ===========================================================================
def fix_test_perf_load(content):
    content = content.replace(
        "results.filter((r) => !r.error) as any[]",
        "(results as any[]).filter((r) => !r.error) as any[]"
    )
    content = content.replace(
        "const versionNumbers = versions.rows.map((r) => r.version_number)",
        "const versionNumbers = versions.rows.map((r: any) => r.version_number)"
    )
    content = content.replace(
        "const succeeded = results.filter((r) => !r.error && r.id).length",
        "const succeeded = (results as any[]).filter((r) => !r.error && r.id).length"
    )
    content = content.replace(
        "const failed = results.filter((r) => r.code === 'DUPLICATE_SLUG').length",
        "const failed = (results as any[]).filter((r) => r.code === 'DUPLICATE_SLUG').length"
    )
    content = re.sub(
        r'products\.items\[i\]\.id',
        r'products.items[i]!.id',
        content
    )
    return content

fix('tests/load/products/test_performance.ts', fix_test_perf_load)

# ===========================================================================
# 32. FIX 08-performance-baseline.test.ts - calculatePercentile return
# ===========================================================================
def fix_perf_baseline(content):
    content = content.replace(
        'return sorted[Math.max(0, index)]',
        'return sorted[Math.max(0, index)]!'
    )
    return content

fix('tests/performance/08-performance-baseline.test.ts', fix_perf_baseline)

# ===========================================================================
# 33. FIX licenses.benchmark.test.ts - queryLog[0]!
# ===========================================================================
def fix_licenses_benchmark(content):
    content = content.replace(
        'const shouldUseCache = dupeTimestamp - queryLog[0].timestamp < cacheWindow',
        'const shouldUseCache = dupeTimestamp - queryLog[0]!.timestamp < cacheWindow'
    )
    return content

fix('tests/performance/licenses.benchmark.test.ts', fix_licenses_benchmark)

# ===========================================================================
# 34. FIX affiliates-security.test.ts - requests[10]!
# ===========================================================================
def fix_affiliates_security(content):
    content = content.replace(
        'expect(requests[10].httpStatus).toBe(429)',
        'expect(requests[10]!.httpStatus).toBe(429)'
    )
    return content

fix('tests/security/affiliates-security.test.ts', fix_affiliates_security)

# ===========================================================================
# 35. FIX 04-migration-discipline.test.ts - upMatch[1]!
# ===========================================================================
def fix_migration_discipline(content):
    content = content.replace(
        'const upSection = upMatch ? upMatch[1] : \'\'',
        "const upSection = upMatch ? upMatch[1]! : ''"
    )
    return content

fix('tests/static/04-migration-discipline.test.ts', fix_migration_discipline)

# ===========================================================================
# 36. FIX provisioning.retry.test.ts - mockLogger[N]!
# ===========================================================================
def fix_provisioning_retry(content):
    content = content.replace(
        "expect(mockLogger[0].attempt).toBe(1)",
        "expect(mockLogger[0]!.attempt).toBe(1)"
    )
    content = content.replace(
        "expect(mockLogger[5].attempt).toBe(6)",
        "expect(mockLogger[5]!.attempt).toBe(6)"
    )
    return content

fix('tests/integration/worker/provisioning.retry.test.ts', fix_provisioning_retry)

# ===========================================================================
# 37. FIX concurrency-safety.test.ts - purchaseResults[10]!
# ===========================================================================
def fix_concurrency_safety(content):
    content = content.replace(
        "expect(purchaseResults[10].errorCode).toBe(",
        "expect(purchaseResults[10]!.errorCode).toBe("
    )
    content = content.replace(
        "expect(purchaseResults[11].errorCode).toBe(",
        "expect(purchaseResults[11]!.errorCode).toBe("
    )
    return content

fix('tests/integration/affiliates/concurrency-safety.test.ts', fix_concurrency_safety)

# ===========================================================================
# 38. FIX geographic-aggregator.test.ts - top_country!
# ===========================================================================
def fix_geo_aggregator(content):
    content = content.replace(
        "expect(stats.top_country.code).toBe('US')",
        "expect(stats.top_country!.code).toBe('US')"
    )
    return content

fix('tests/unit/mmc/geographic-aggregator.test.ts', fix_geo_aggregator)

# ===========================================================================
# 39. FIX response-formatter.test.ts - parts[1]!
# ===========================================================================
def fix_response_formatter(content):
    content = content.replace(
        'expect(parts[1].length).toBe(2)',
        'expect(parts[1]!.length).toBe(2)'
    )
    return content

fix('tests/unit/mmc/response-formatter.test.ts', fix_response_formatter)

# ===========================================================================
# 40. FIX revenue-aggregator.test.ts - result[0]!
# ===========================================================================
def fix_revenue_aggregator(content):
    content = content.replace(
        "expect(result[0].amount_cents).toBe(200)",
        "expect(result[0]!.amount_cents).toBe(200)"
    )
    return content

fix('tests/unit/mmc/revenue-aggregator.test.ts', fix_revenue_aggregator)

# ===========================================================================
# 41. FIX license.middleware.test.ts - Mock type cast
# ===========================================================================
def fix_license_middleware(content):
    content = content.replace(
        'let mockDb: { query: ReturnType<typeof vi.fn> }',
        'let mockDb: { query: (...args: any[]) => Promise<any> }'
    )
    # Also fix the vi.fn cast - the fn itself should be okay now
    return content

fix('tests/unit/middleware/license.middleware.test.ts', fix_license_middleware)

# ===========================================================================
# 42. FIX licenses-lifecycle.test.ts - `this` implicit any
# ===========================================================================
def fix_licenses_lifecycle(content):
    content = content.replace(
        'status: vi.fn(function () {\n      return this\n    })',
        'status: vi.fn(function (this: any) {\n      return this\n    })'
    )
    return content

fix('apps/api/src/routes/__tests__/licenses-lifecycle.test.ts', fix_licenses_lifecycle)

# ===========================================================================
# 43. FIX schema-provisioning-flow - TaskQueueProcessor optional config
# ===========================================================================
def fix_schema_provisioning(content):
    content = content.replace(
        'declare const TaskQueueProcessor: new (config: any) => any',
        'declare const TaskQueueProcessor: new (config?: any) => any'
    )
    return content

fix('apps/api/tests/integration/schema-provisioning-flow.integration.test.ts', fix_schema_provisioning)

# ===========================================================================
# 44. FIX provisioning-e2e-setup.ts
# ===========================================================================
def fix_provisioning_e2e(content):
    # Fix ProvisioningLogger constructor call (2 args required)
    content = content.replace(
        'this.logger = new ProvisioningLogger({})',
        'this.logger = new ProvisioningLogger({} as any, {} as any)'
    )
    # Fix rowCount possibly null
    content = content.replace(
        'return result.rowCount > 0',
        'return (result.rowCount ?? 0) > 0'
    )
    # Fix missing module imports - replace with any types
    content = content.replace(
        "import { ProvisioningJobConsumer } from '../consumers/provisioning-consumer'",
        "// eslint-disable-next-line @typescript-eslint/no-explicit-any\ntype ProvisioningJobConsumer = any"
    )
    content = content.replace(
        "import { ProvisionWorkspaceHandler } from '../handlers/provision-workspace-handler'",
        "// eslint-disable-next-line @typescript-eslint/no-explicit-any\ntype ProvisionWorkspaceHandler = any"
    )
    return content

fix('tests/integration/provisioning-e2e-setup.ts', fix_provisioning_e2e)

# ===========================================================================
# 45. FIX test_service_logic.ts - remaining diff issues
# ===========================================================================
def fix_service_logic(content):
    # Check for any remaining diff.X patterns that are not yet cast
    content = re.sub(
        r'\b(diff\.[a-zA-Z_]+)\.(old|new)\b(?!\s*as)',
        r'(\1 as any).\2',
        content
    )
    return content

fix('tests/unit/products/test_service_logic.ts', fix_service_logic)

# ===========================================================================
# 46. FIX test_service_edge_cases.ts - likely array index issues
# ===========================================================================
def fix_edge_cases(content):
    # Generic fix for items[0]
    content = re.sub(
        r'\.items\[0\](?!!)',
        r'.items[0]!',
        content
    )
    content = re.sub(
        r'\.results\[0\](?!!)',
        r'.results[0]!',
        content
    )
    return content

fix('tests/unit/products/test_service_edge_cases.ts', fix_edge_cases)

# ===========================================================================
# 47. FIX test_errors.ts - `r` implicit any parameters  
# ===========================================================================
def fix_test_errors(content):
    # Generic fix for `.map((r) =>` and `.filter((r) =>`
    content = re.sub(
        r'\.(map|filter)\(\(r\) =>',
        r'.\1((r: any) =>',
        content  
    )
    return content

fix('tests/integration/products/test_errors.ts', fix_test_errors)

print('\n=== Done fixing files ===')
print('Now run: bun run typecheck:tests 2>&1 | grep "error TS" | wc -l')
