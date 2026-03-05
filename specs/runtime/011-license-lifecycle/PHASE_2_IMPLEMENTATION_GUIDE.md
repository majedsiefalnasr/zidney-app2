# Phase 2 Implementation Guide

**Status:** Ready to Start  
**Tasks:** T006-T015 (License Domain Service Logic)  
**Files to Create:** `packages/domain-core/src/license/service.ts`

---

## Quick Reference

### Core Service Methods (T006-T010)

Each method must:

- Accept tenant resolver context + license ID + required parameters
- Return transaction result with audit entry
- Throw structured errors (ISO-8601 timestamps, error codes)
- Log via structured logger (correlation_id, workspace_slug, license_id required)

```typescript
// Service signature pattern (all methods follow this)
async transitionToSoftLock(
  tenantCtx: TenantContext,      // Resolver context (validated multi-tenant)
  licenseId: string,
  params: SoftLockRequest
): Promise<LicenseTransitionResult> {
  // 1. Validate current state + schema compatibility + version
  // 2. BEGIN TRANSACTION
  // 3. SELECT FOR UPDATE licenses WHERE id = licenseId (lock row)
  // 4. Execute state transition logic
  // 5. INSERT INTO license_audit_logs (immutable by trigger)
  // 6. UPDATE tenants_registry (auto-sync trigger fires)
  // 7. COMMIT TRANSACTION
  // 8. Log result (no secrets, correlation_id in all logs)
  // 9. Return success with audit trail
}
```

### Validation Helpers (T011-T015)

Each helper validates critical invariants:

- **validateStateTransition**: Checks if new_status is valid from current_status
- **validateSoftLockExpiry**: Ensures soft_lock_until > now() and respects schema
- **validateSchemaCompatibility**: Confirms schema_version in license matches master
- **validateConcurrentModification**: Detects stale reads (optimistic locking via updated_at)
- **validateAdminAuthority**: Checks RBAC: only MMC Admin can perform lifecycle transitions

### Test Requirements (T006-T015)

For every method + validator:

```bash
# Unit test (mocked DB, pure function logic)
npm test -- --testPathPattern=license.service.unit.test.ts

# Integration test (real DB transactions, state assertions)
npm test -- --testPathPattern=license.service.integration.test.ts

# Both must pass 100% of assertions
# No partial credits: all or nothing
```

---

## Implementation Checklist

### Pre-Implementation (Verify All ✅)

- [ ] Migrations created (001_A001 - 005_A005) ✅
- [ ] Migration files exist: `apps/api/src/db/master/migrations/00*.sql` ✅
- [ ] Schema file updated in git ✅
- [ ] Service test framework initialized ✅
- [ ] Logger package available (`packages/logger`) ✅
- [ ] Validation package available (`packages/validation`) ✅

### Implementation Steps

1. **Create Service File**: `packages/domain-core/src/license/service.ts`
   - Import tenant context, DB pool, logger, types
   - Implement 5 core methods (T006-T010)
   - Implement 5 validators (T011-T015)
   - Export service singleton

2. **Write Unit Tests**: `packages/domain-core/src/license/service.unit.test.ts`
   - Mock DB pool + logger
   - Test each method with valid + invalid inputs
   - Test error conditions (invalid state, schema mismatch, concurrent mod)
   - Verify audit entries generated
   - **Target:** 95%+ coverage

3. **Write Integration Tests**: `packages/domain-core/src/license/service.integration.test.ts`
   - Use test database
   - Create real license records
   - Execute actual state transitions
   - Verify audit log immutability (test that UPDATE/DELETE trigger fails)
   - Verify tenants_registry sync trigger fires
   - **Target:** 100% test scenarios pass

4. **Lint + Type Check**

   ```bash
   npx eslint packages/domain-core/src/license/
   npx tsc --noEmit
   ```

5. **Commit When All Pass**
   ```bash
   # Only after: unit tests pass + integration tests pass + lint clean + types clean
   git add packages/domain-core/src/license/
   git commit -m "T006-T015: License Domain Service implementation"
   ```

---

## Key Constraints by Task

| Task | Method                         | Constraints                                                  | Accept Criteria                              |
| ---- | ------------------------------ | ------------------------------------------------------------ | -------------------------------------------- |
| T006 | transitionToSoftLock           | Must set soft_lock_until, log reason, Q6 dual-mode           | Tests pass: normal + expiry + concurrent     |
| T007 | transitionToActive             | Must clear soft_lock_until, validate Q6 window               | Tests pass: recovery scenario                |
| T008 | transitionToArchived           | Must snapshot before archive (Q3), no restore during archive | Tests pass: archive + timeout validation     |
| T009 | restoreFromArchive             | Must reverse archive state, must NOT restore if deleted      | Tests pass: recovery + deletion guard        |
| T010 | transitionToDeleted            | Grace period enforcement (deleted_at + 30 days)              | Tests pass: grace period + double-confirm    |
| T011 | validateStateTransition        | State machine: ACTIVE ↔ SOFT_LOCKED, ACTIVE → ARCHIVED, etc. | Unit tests: all valid + invalid paths        |
| T012 | validateSoftLockExpiry         | Check soft_lock_until > NOW(), prevent past expiry           | Unit tests: edge cases, boundary times       |
| T013 | validateSchemaCompatibility    | Confirm license.schema_version ≤ master schema version       | Unit tests: version matrix                   |
| T014 | validateConcurrentModification | Detect stale reads, raise OptimisticLockError                | Integration: race condition simulation       |
| T015 | validateAdminAuthority         | RBAC only: actor.role = 'MMC_ADMIN' or raise 403             | Integration: unauthorized + authorized paths |

---

## Error Codes (Immutable by Spec)

**T006-T010 Errors:**

- `LIC_STATE_INVALID: "Cannot transition from {current} to {target}"` (422)
- `LIC_SOFT_LOCK_EXPIRED: "Soft lock window closed"` (410)
- `LIC_SCHEMA_VERSION_MISMATCH: "Cannot transition: schema version incompatible"` (409)
- `LIC_CONCURRENT_MODIFICATION: "License modified by another request"` (409)
- `LIC_ADMIN_REQUIRED: "Lifecycle transitions require MMC Admin authority"` (403)
- `LIC_NOT_FOUND: "License {id} not found"` (404)

All errors include: timestamp, error_code, message, correlation_id

---

## Logging Template

Every method must log completion:

```typescript
logger.info({
  service: 'license-service',
  method: 'transitionToSoftLock',
  license_id: licenseId,
  workspace_slug: tenantCtx.slug,
  workspace_id: tenantCtx.id,
  actor_id: params.actor_id,
  actor_type: params.actor_type,
  new_status: 'SOFT_LOCKED',
  soft_lock_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  correlation_id: params.correlation_id,
  transition_metadata: params.metadata,
  execution_time_ms: Date.now() - startTime,
  timestamp: new Date().toISOString(),
})
```

---

## Testing Evidence Required

Before marking [X], verify:

```bash
# 1. All test files exist
ls -la packages/domain-core/src/license/service*.test.ts

# 2. Unit tests pass
npm test -- packages/domain-core/src/license/service.unit.test.ts --coverage

# 3. Integration tests pass
npm test -- packages/domain-core/src/license/service.integration.test.ts

# 4. Combined coverage
# Output must show:
#   ✓ All tests passed
#   ✓ Statements: >95%
#   ✓ Branches: >90%
#   ✓ Functions: 100%
#   ✓ Lines: >95%

# 5. Lint clean
npx eslint packages/domain-core/src/license/

# 6. Type check passes
npx tsc --noEmit

# 7. Git diff shows only intended changes
git diff --cached packages/domain-core/src/license/
```

---

## File Creation Order

```
1. ✅ Migrations (T001-T005) - DONE
2. → Service file (T006-T015) - NEXT
3. → API routes (T016-T024)
4. → Middleware / Guards (T025-T035)
5. → Worker jobs (T036-T045)
6. → UI Components (T046-T050)
7. → Tests + Integration (T051-T055)
8. → CI/CD + Deployment (T056-T059)
```

---

## Success Criteria for Phase 2

- [ ] Service file created with all 5 methods + 5 validators
- [ ] 50+ unit test cases written and passing
- [ ] 25+ integration test cases written and passing
- [ ] Coverage: >95% statements, >90% branches, 100% functions
- [ ] Lint: 0 errors
- [ ] Type check: 0 errors
- [ ] Git: Commit with all file diffs showing real code

---

## Next: Phase 3 (T016-T024)

After Phase 2 passes testing:

- Create `apps/api/src/routes/licenses.ts`
- Implement 9 REST endpoints
- Each endpoint calls service methods from Phase 2
- Wire up authentication + tenant resolver
- Test all endpoint flows

---

**Ready to proceed? → Mark Phase 2 START and create the service file.**
