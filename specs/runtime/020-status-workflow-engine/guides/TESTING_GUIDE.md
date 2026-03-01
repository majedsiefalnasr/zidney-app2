# Testing Guide — STAGE_20_STATUS_WORKFLOW_ENGINE

**Stage:** STAGE_20_STATUS_WORKFLOW_ENGINE  
**Phase:** 03_BACKOFFICE_CORE/01_FOUNDATION  
**Stage Directory:** 020-status-workflow-engine  
**Generated On:** 2026-03-01

---

## Purpose

This guide explains how to validate the implementation of the Status Workflow Engine end-to-end.

The workflow engine is a reusable, deterministic state machine that manages entity lifecycle states (COMPLETED → UNDER_REVIEW → APPROVED → ENABLED) with audit immutability, granular permissions, and concurrency safety.

---

## Summary of Delivered Behavior

The Status Workflow Engine provides:

- **Deterministic state transitions** — COMPLETED is the default initial state; transitions follow a strict state graph with forward (COMPLETED→UNDER_REVIEW→APPROVED→ENABLED) and backward (UNDER_REVIEW→COMPLETED, APPROVED→UNDER_REVIEW→COMPLETED) paths
- **Granular permission enforcement** — Each transition requires a specific permission key (e.g., `subject.review`, `subject.approve`, `subject.return`)
- **Backward transition justification** — Backward transitions (reversals) require a non-empty reason field to document the reversion
- **Atomic transactions** — Five-step SELECT FOR UPDATE protocol ensures no concurrent state corruption
- **Audit immutability** — All transitions are logged in an immutable audit table, protected by database trigger
- **Multi-entity support** — Works with 7 entity types (subject, mcq_question, traditional_question, exam, topic, library_file, template)
- **Rate limiting** — 20 transitions per user per entity type per minute
- **Observability** — Full structured logging with correlation IDs, workspace slugs, and actor tracking

---

## Prerequisites

| Requirement            | Validation Command / Check                      |
| ---------------------- | ----------------------------------------------- |
| Node.js installed      | `node --version` (v20+)                         |
| Bun installed          | `bun --version` (v1+)                           |
| Docker running         | `docker ps` (PostgreSQL container visible)      |
| PostgreSQL connected   | `bun run db:migrate` runs successfully          |
| `.env` configured      | `AUTH_JWT_SECRET`, `DB_*` vars present          |
| Correct branch         | `git branch` shows `020-status-workflow-engine` |
| Dependencies installed | `bun install` completed without errors          |

---

## Files in Scope

**Domain Package:**

- `packages/domain-core/src/workflow/workflow.types.ts`
- `packages/domain-core/src/workflow/workflow.errors.ts`
- `packages/domain-core/src/workflow/workflow.states.ts`
- `packages/domain-core/src/workflow/workflow.engine.ts`

**API Layer:**

- `apps/api/src/modules/workflow/workflow.validation.ts`
- `apps/api/src/modules/workflow/workflow.context.ts`
- `apps/api/src/routes/backoffice/workflow/post-transition.ts`
- `apps/api/src/routes/backoffice/workflow/index.ts`

**Database:**

- `apps/api/src/db/tenant/migrations/20260301_002_workflow_engine.ts`

**Tests:**

- `tests/unit/workflow/workflow.engine.test.ts` (32 unit tests)
- `tests/unit/workflow/workflow.states.test.ts` (9 unit tests)
- `tests/integration/workflow/workflow.transition.test.ts` (16 integration tests)

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Apply all migrations (including workflow migration)
bun run db:migrate

# Start API server
bun run dev:api

# In another terminal: run tests
bun test

# Run only workflow tests
bun test tests/unit/workflow/ tests/integration/workflow/

# Run with coverage
bun test --coverage
```

---

## Automated Validation Commands

```bash
# Run all workflow unit tests
bun test tests/unit/workflow/workflow.engine.test.ts tests/unit/workflow/workflow.states.test.ts

# Expected output:
#  Test Files  2 passed (2)
#       Tests  41 passed (41)
#     Start at  ...
#   Duration  514ms

# Run all workflow integration tests
bun test tests/integration/workflow/workflow.transition.test.ts

# Expected output:
#  Test Files  1 passed (1)
#       Tests  16 passed (16)
#     Start at  ...
#   Duration  673ms

# Type check
bun run typecheck 2>&1 | grep "workflow" | grep "error TS"
# Expected output: (no lines — zero workflow-specific errors)

# Lint
npx eslint packages/domain-core/src/workflow/ apps/api/src/modules/workflow/ apps/api/src/routes/backoffice/workflow/
# Expected output: Exit code 0 (no errors)
```

---

## Manual Test Scenarios

### Scenario 1: Basic Forward Transition (COMPLETED → UNDER_REVIEW)

**Objective:** Verify a user with `subject.review` permission can transition a subject from COMPLETED to UNDER_REVIEW.

```bash
# 1. Authenticate (get JWT token)
curl -X POST http://localhost:3000/auth/backoffice/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff@institution.test",
    "password": "test-password"
  }'
# Expected: 200 response with JWT token

# 2. Store token
TOKEN="<jwt_token_from_step_1>"

# 3. Call workflow transition
curl -X POST "http://localhost:3000/api/v1/backoffice/workspace/workflow/subject/abc-123/transition" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_state": "UNDER_REVIEW"
  }'

# Expected: 200 response
# {
#   "success": true,
#   "data": {
#     "entityType": "subject",
#     "entityId": "abc-123",
#     "previousState": "COMPLETED",
#     "newState": "UNDER_REVIEW",
#     "logId": "uuid-of-audit-log-entry",
#     "changedBy": "user-id",
#     "changedAt": "2026-03-01T12:34:56.000Z"
#   },
#   "error": null
# }
```

### Scenario 2: Backward Transition with Justification (UNDER_REVIEW → COMPLETED)

**Objective:** Verify a user with `subject.return` permission can reverse a subject from UNDER_REVIEW to COMPLETED, but only with a reason.

```bash
# 1. Call workflow transition with NO reason
curl -X POST "http://localhost:3000/api/v1/backoffice/workspace/workflow/subject/abc-123/transition" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_state": "COMPLETED"
  }'

# Expected: 400 response
# {
#   "success": false,
#   "data": null,
#   "error": {
#     "code": "justification_required",
#     "message": "Backward transitions require a non-empty reason field",
#     "details": null,
#     "correlationId": "..."
#   }
# }

# 2. Call workflow transition WITH reason
curl -X POST "http://localhost:3000/api/v1/backoffice/workspace/workflow/subject/abc-123/transition" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_state": "COMPLETED",
    "reason": "Returned for minor revisions requested by department head"
  }'

# Expected: 200 response with reason stored in workflow_logs.reason field
```

### Scenario 3: Permission Denied (403)

**Objective:** Verify a user WITHOUT a required permission gets a 403 error.

```bash
# 1. Get JWT for a user WITHOUT subject.review permission (e.g., internal admin)
TOKEN_ADMIN="<jwt_from_admin_account>"

# 2. Attempt transition without permission
curl -X POST "http://localhost:3000/api/v1/backoffice/workspace/workflow/subject/abc-123/transition" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_state": "UNDER_REVIEW"
  }'

# Expected: 403 response
# {
#   "success": false,
#   "data": null,
#   "error": {
#     "code": "workflow_permission_denied",
#     "message": "User lacks required permission: subject.review",
#     "details": null,
#     "correlationId": "..."
#   }
# }
```

### Scenario 4: Invalid State Transition (400)

**Objective:** Verify invalid state transitions (e.g., COMPLETED → APPROVED, skipping UNDER_REVIEW) return 400.

```bash
# 1. Attempt to skip a state
curl -X POST "http://localhost:3000/api/v1/backoffice/workspace/workflow/subject/abc-123/transition" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_state": "APPROVED"
  }'

# Expected: 400 response
# {
#   "success": false,
#   "data": null,
#   "error": {
#     "code": "invalid_state_transition",
#     "message": "No valid transition from COMPLETED to APPROVED",
#     "details": null,
#     "correlationId": "..."
#   }
# }
```

### Scenario 5: Rate Limiting (429)

**Objective:** Verify rate limiting is enforced at 20 requests per user per entity type per minute.

```bash
# 1. Send 20 valid transitions rapidly (script or loop)
for i in {1..20}; do
  ENTITY_ID="entity-$i"
  curl -X POST "http://localhost:3000/api/v1/backoffice/workspace/workflow/subject/$ENTITY_ID/transition" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"target_state": "UNDER_REVIEW"}' \
    --silent -o /dev/null
done

# 2. Send 21st request
curl -X POST "http://localhost:3000/api/v1/backoffice/workspace/workflow/subject/entity-21/transition" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_state": "UNDER_REVIEW"
  }'

# Expected: 429 response
# {
#   "success": false,
#   "data": null,
#   "error": {
#     "code": "rate_limit_exceeded",
#     "message": "Too many requests. Limit: 20 per minute",
#     "details": null,
#     "correlationId": "..."
#   }
# }
```

### Scenario 6: Audit Immutability

**Objective:** Verify `workflow_logs` table cannot be modified after insertion.

```bash
# 1. Check workflow_logs entry was created (via Step 1 transition)
psql -U $DB_USER -d $DB_NAME -c "SELECT * FROM workflow_logs WHERE entity_id = 'abc-123' ORDER BY changed_at DESC LIMIT 1;"

# 2. Attempt to modify the audit log (this should FAIL due to trigger)
psql -U $DB_USER -d $DB_NAME -c "UPDATE workflow_logs SET reason = 'tampered' WHERE entity_id = 'abc-123';"

# Expected: ERROR from PostgreSQL trigger
# ERROR: Modification of audit_logs tables is prohibited

# 3. Attempt to delete the audit log (this should also FAIL)
psql -U $DB_USER -d $DB_NAME -c "DELETE FROM workflow_logs WHERE entity_id = 'abc-123';"

# Expected: ERROR from PostgreSQL trigger
# ERROR: Modification of audit_logs tables is prohibited
```

### Scenario 7: Multi-Entity Type Support

**Objective:** Verify workflow transitions work for all 7 supported entity types.

```bash
# Test each entity type
for entity_type in subject mcq_question traditional_question exam topic library_file template; do
  curl -X POST "http://localhost:3000/api/v1/backoffice/workspace/workflow/$entity_type/test-entity-id/transition" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"target_state": "UNDER_REVIEW"}' \
    | jq '.data.entityType'
    # Expected: prints the entity type (e.g., "subject", "mcq_question", etc.)
done
```

### Scenario 8: Soft-Locked License Enforcement

**Objective:** Verify API returns 423 when workspace license is soft-locked, BEFORE the workflow engine is invoked.

```bash
# 1. Configure test tenant with SOFT_LOCKED license (via admin tools)

# 2. Attempt workflow transition
curl -X POST "http://localhost:3000/api/v1/backoffice/workspace/workflow/subject/abc-123/transition" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_state": "UNDER_REVIEW"
  }'

# Expected: 423 response (Locked — from licenseEnforcementMiddleware)
# Note: No workflow_logs row should be created (engine not invoked)
```

---

## Verification Checklist

After running all tests and scenarios:

- [ ] All 41 unit tests pass
- [ ] All 16 integration tests pass
- [ ] ESLint check returns exit code 0
- [ ] TypeScript check shows no new workflow errors
- [ ] Manual Scenario 1 succeeds (forward transition)
- [ ] Manual Scenario 2 succeeds (backward with justification)
- [ ] Manual Scenario 3 returns 403 (permission denied)
- [ ] Manual Scenario 4 returns 400 (invalid transition)
- [ ] Manual Scenario 5 returns 429 (rate limit at 21st request)
- [ ] Manual Scenario 6 confirms audit immutability (trigger prevents modification)
- [ ] Manual Scenario 7 works for all 7 entity types
- [ ] Manual Scenario 8 returns 423 (soft-locked license)
- [ ] Structured logs contain all 6 required fields (workspace_slug, workspace_id, correlation_id, entity_type, entity_id, actor_id)
- [ ] No `console.log` statements in engine logs

---

## Debugging Tips

### Issue: "Unknown entity type" (400)

**Cause:** Entity type not in WORKFLOW_ENTITY_TYPES set.  
**Fix:** Check entity type spelling matches one of: subject, mcq_question, traditional_question, exam, topic, library_file, template

### Issue: "Modification of audit_logs tables is prohibited" (UPDATE/DELETE fails)

**Cause:** PostgreSQL trigger is working correctly — audit logs are immutable.  
**Expected:** This is the correct behavior.

### Issue: Rate limit returns 429 on first request

**Cause:** Rate limit key may be cached from previous test run.  
**Fix:** Wait 60 seconds or use a different user/entity-type combination.

### Issue: "Cannot find module @zidney/domain-core"

**Cause:** Dependencies not installed or build failed.  
**Fix:** Run `bun install && bun run build:packages`

---

## Support

For questions or issues:

1. Check `guides/TESTING_GUIDE.md` (this file)
2. Review `reports/IMPLEMENT_REPORT.md` for implementation details
3. Check `spec.md` for feature intent
4. Review unit/integration test files for usage examples

---

**Testing Guide Complete** ✅
