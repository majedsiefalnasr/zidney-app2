# Pull Request: Status Workflow Engine Implementation

**Type:** Backend Feature | **Stage:** 020-status-workflow-engine | **Phase:**
03_BACKOFFICE_CORE/01_FOUNDATION

---

## Executive Summary

This PR implements the **Status Workflow Engine** — a reusable, deterministic state machine for
managing entity lifecycles with audit immutability, granular permission enforcement, and concurrency
safety.

**Scope:** 39 tasks across domain package, API layer, database migrations, and comprehensive test
coverage.  
**Tests:** 41 unit + 16 integration tests, all passing.  
**Quality:** ESLint 0 errors, TypeScript 0 new errors, lint warnings resolved.  
**Risk Level:** 🟢 **LOW** (additive only, no breaking changes, no schema modifications to existing
tables)

---

## Problem Statement

Before this implementation, there was no standardized mechanism for managing entity state
transitions (e.g., COMPLETED → UNDER_REVIEW → APPROVED → ENABLED) across different entity types in
the Zidney backoffice.

- State transitions required custom logic in each module
- No audit trail protection (logs could be modified post-hoc)
- Concurrent edge cases possible (race conditions on state updates)
- Permissions not consistently validated
- Backward transitions (reversals) not justifiable
- Rate limiting not applied

**This PR solves all of these.**

---

## Solution Overview

### Delivered Artifacts

| Component          | Files                                                               | Behavior                                                                                                 |
| ------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Domain Package** | `packages/domain-core/src/workflow/` (4 files)                      | Pure TypeScript state machine engine with atomic transition logic (SELECT FOR UPDATE)                    |
| **API Routes**     | `apps/api/src/routes/backoffice/workflow/` (2 files)                | Hono route handlers + router with rate-limit middleware (20 req/min per user per entity type)            |
| **Modules**        | `apps/api/src/modules/workflow/` (2 files)                          | Validation (Zod schema) + context extraction from Hono context                                           |
| **Database**       | `apps/api/src/db/tenant/migrations/20260301_002_workflow_engine.ts` | workflow_logs table + 3 performance indexes + immutability trigger + schema_version bump (1.2.0 → 1.3.0) |
| **Tests**          | `tests/unit/workflow/` + `tests/integration/workflow/`              | 41 unit (2 files) + 16 integration (1 file)                                                              |

### Key Features

✅ **Deterministic State Graph** — 5 edges (3 forward: COMPLETED→UNDER_REVIEW→APPROVED→ENABLED; 2
backward: UNDER_REVIEW↔COMPLETED, APPROVED→UNDER_REVIEW)

✅ **Granular RBAC** — Each transition requires a specific permission (e.g., `subject.review`,
`subject.approve`, `subject.return`)

✅ **Backward Transition Justification** — Reversals require a non-empty reason field for
auditability

✅ **Atomic Transactions** — Five-step SELECT FOR UPDATE protocol prevents concurrent state
corruption

✅ **Audit Immutability** — All transitions logged in immutable workflow_logs table (trigger
prevents post-hoc modification)

✅ **Multi-Entity Support** — Works with 7 entity types (subject, mcq_question,
traditional_question, exam, topic, library_file, template)

✅ **Rate Limiting** — 20 transitions per user per entity type per minute

✅ **Observability** — Structured logging with correlation IDs, workspace slugs, actor tracking,
entity IDs

✅ **Soft-Lock Enforcement** — Returns 423 if workspace license is soft-locked (before engine
invoked)

---

## Technical Implementation

### Domain Engine (Pure TypeScript)

**File:** `packages/domain-core/src/workflow/workflow.engine.ts`

```typescript
/**
 * Executes a workflow state transition atomically using SELECT FOR UPDATE.
 *
 * Five-step protocol:
 * 1. Validate target state is in WORKFLOW_ENTITY_TYPES set
 * 2. Query current entity state using SELECT FOR UPDATE (row-level lock)
 * 3. Validate transition exists in WORKFLOW_TRANSITIONS map
 * 4. Extract permission requirement for this transition
 * 5. Verify actor has permission; execute transition; log audit entry
 *
 * Returns: { success: true, data: WorkflowTransitionResult } or { success: false, error: WorkflowError }
 */
export async function executeTransition(
  db: DbClient,
  context: WorkflowContext,
): Promise<TransitionResultPayload>;
```

**Why SELECT FOR UPDATE?**

- Locks the row in the database until transaction completes
- Prevents concurrent readers/writers from racing
- If another transaction is mid-update, this transaction waits
- Guarantees no "dirty reads" or "lost updates"

### Database Migration

**File:** `apps/api/src/db/tenant/migrations/20260301_002_workflow_engine.ts`

- Creates `workflow_logs` table with (entity_type, entity_id + created_at DESC + id DESC) composite
  index
- Uses VARCHAR(50)+CHECK for state columns (migration-safe, not PG ENUM)
- Applies immutability trigger: `prevent_audit_modification()` function blocks UPDATE/DELETE on
  workflow_logs
- Increments schema_version from 1.2.0 to 1.3.0 (triggers license middleware compatibility check)

**Index Strategy:**

- Primary: `(entity_type, entity_id, changed_at DESC, id DESC)` — for entity audit retrieval
- Secondary: `(changed_by, changed_at DESC)` — for "who changed what" queries
- Tertiary: `(entity_type, changed_at DESC)` — for entity-type-wide audit trails

### API Route Handler

**File:** `apps/api/src/routes/backoffice/workflow/post-transition.ts`  
**Endpoint:** `POST /api/v1/backoffice/workspace/:entityType/:entityId/transition`

Handler sequence:

1. Extract context (entityType, entityId, targetState, actorId, workspaceId, correlationId)
2. Validate request with Zod schema
3. Call `executeTransition(db, context)` from domain package
4. Return standardized error envelope on failure (code, message, details, correlationId)
5. Return transition result on success

**Rate Limit Middleware Key:** `workflow-transition:{actorId}:{entityType}` at 20 req/min

---

## Test Coverage

### Unit Tests (41 total)

**workflow.engine.test.ts (32 tests)**

- ✅ Valid forward transitions (COMPLETED → UNDER_REVIEW → APPROVED → ENABLED)
- ✅ Valid backward transitions (UNDER_REVIEW ↔ COMPLETED, APPROVED → UNDER_REVIEW)
- ✅ Invalid transitions (e.g., COMPLETED → APPROVED, skips intermediate state)
- ✅ Permission checks (3 cases: has permission, lacks permission, N/A)
- ✅ Backward transition requires non-empty reason field
- ✅ Audit log entry created with correct snapshot

**workflow.states.test.ts (9 tests)**

- ✅ WorkflowState enum contains 5 states (COMPLETED, UNDER_REVIEW, APPROVED, ENABLED, + 1 reserved)
- ✅ WORKFLOW_STATE_ORDER array is defined correctly
- ✅ WORKFLOW_TRANSITIONS map has exactly 5 edges
- ✅ WORKFLOW_ENTITY_TYPES contains exactly 7 types
- ✅ isValidTransition() validates all 5 edges + rejects invalid paths

### Integration Tests (16 total)

**workflow.transition.test.ts**

- ✅ US1 Forward Transition: COMPLETED → UNDER_REVIEW with permission
- ✅ US2 Forward Approval: UNDER_REVIEW → APPROVED with permission
- ✅ US3 Forward Enable: APPROVED → ENABLED with permission
- ✅ US4 Backward Return (No Reason): Returns 400 validation error
- ✅ US4 Backward Return (With Reason): UNDER_REVIEW → COMPLETED + audit logged
- ✅ US5 Permission Denied: 403 when lacking required permission
- ✅ US6 Invalid Transition: 400 when COMPLETED → APPROVED (skips state)
- ✅ US6 Rate Limiting: 429 after 20 requests in same minute
- ✅ Concurrent Transitions: Both attempts wait for lock; second aborts with optimistic lock error
- ✅ Audit Trail Integrity: workflow_logs entry immutable (trigger prevents UPDATE/DELETE)
- ✅ Soft-Locked License: 423 returned by licenseEnforcementMiddleware (engine never invoked)
- ✅ All Supported Entity Types: Transitions work for all 7 types
- ✅ Structured Logging: All 6 required fields present (workspace_slug, workspace_id,
  correlation_id, entity_type, entity_id, actor_id)
- ✅ Error Response Envelope: All errors include (code, message, details: null, correlationId)
- ✅ Backward Transition Reason Stored: reason field in workflow_logs contains justification text
- ✅ Schema Version Check: Migration increments version to 1.3.0; license middleware validates

---

## Quality Metrics

| Metric                | Status                 | Evidence                                                                                                                                                     |
| --------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Unit Tests**        | ✅ 41/41 passing       | `tests/unit/workflow/workflow.engine.test.ts` + `tests/unit/workflow/workflow.states.test.ts`                                                                |
| **Integration Tests** | ✅ 16/16 passing       | `tests/integration/workflow/workflow.transition.test.ts`                                                                                                     |
| **ESLint**            | ✅ 0 errors            | No unused variables, no linting errors in `packages/domain-core/src/workflow/`, `apps/api/src/modules/workflow/`, `apps/api/src/routes/backoffice/workflow/` |
| **TypeScript**        | ✅ 0 new errors        | All workflow files pass strict typecheck                                                                                                                     |
| **Database**          | ✅ Migration validated | Schema_version incremented (1.2.0 → 1.3.0), immutability trigger verified                                                                                    |
| **Concurrency**       | ✅ SELECT FOR UPDATE   | Row-level locking prevents UPDATE races                                                                                                                      |
| **Audit Trail**       | ✅ Immutable logs      | Trigger blocks modification of audit entries                                                                                                                 |

---

## Constitutional Compliance

**Zidney Constitution v1.2.0 Enforcement:**

| ADR                         | Requirement                                                   | Implementation                                                                            | Status  |
| --------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------- |
| **ADR-0001**                | Database-per-tenant isolation                                 | All tenant context from resolver middleware, parameterized queries                        | ✅ PASS |
| **ADR-0002**                | Snapshot immutability (if applicable)                         | Not applicable — workflow state machine, not attempt-related                              | ✅ N/A  |
| **ADR-0006**                | Server-authoritative time                                     | All timestamps from server (db NOW(), structured logging uses server time)                | ✅ PASS |
| **ADR-0007**                | Version compatibility on schema changes                       | Schema_version incremented 1.2.0 → 1.3.0; license middleware validates                    | ✅ PASS |
| **ADR-0008**                | Semantic versioning                                           | Stage: 020 (semantic); Feature token: 020 (backend additive)                              | ✅ PASS |
| **License Middleware**      | Mandatory before workspace access                             | POST handler calls licenseEnforcementMiddleware before executeTransition                  | ✅ PASS |
| **Error Response Contract** | {success, data, error} envelope                               | All endpoint responses follow contract; error has (code, message, details, correlationId) | ✅ PASS |
| **Structured Logging**      | All logs include correlation_id, workspace_slug, service name | Pino logger integration in app.ts logs all 6 required fields                              | ✅ PASS |

**Full Compliance Verdict:** ✅ **FULLY COMPLIANT**

---

## Risk Assessment

**Risk Level: 🟢 LOW**

### Change Scope Analysis

- **Additive only** — No modifications to existing tables or migrations
- **New table** — workflow_logs table addition does not affect existing queries
- **New routes** — Isolated to `/api/v1/backoffice/workspace/workflow/*` — no changes to existing
  endpoints
- **New middleware** — Rate limiter scoped to workflow routes only
- **No breaking changes** — Existing API / worker / UI behavior unchanged

### Potential Issues & Mitigations

| Risk                                 | Likelihood | Mitigation                                                          |
| ------------------------------------ | ---------- | ------------------------------------------------------------------- |
| Concurrent transition race condition | LOW        | SELECT FOR UPDATE row-level lock + unit/integration tests           |
| Audit log modification exploit       | LOW        | PostgreSQL trigger prevents UPDATE/DELETE                           |
| Rate limit bypass                    | LOW        | Redis-based rate limiter enforced at middleware layer               |
| Permission bypass                    | LOW        | RBAC context enforced in domain engine before state change          |
| Cross-tenant data leak               | LOW        | Tenant context from resolver middleware; no hardcoded workspace IDs |

### Test Coverage Risk

- ✅ 41 unit tests on core engine logic
- ✅ 16 integration tests on API layer
- ✅ Concurrency scenarios verified (SELECT FOR UPDATE behavior)
- ✅ Audit immutability trigger tested
- ✅ All permission violations caught
- ✅ All invalid state transitions rejected

---

## Deployment Notes

### Pre-Deployment Checklist

- [ ] Branch: `020-status-workflow-engine` merged to `develop`
- [ ] `bun run typecheck` passes on `develop`
- [ ] `bun test` passes on `develop` (all 41+16 workflow tests included)
- [ ] `bun run lint` passes (no ESLint errors)
- [ ] Database migration: `bun run db:migrate` verified in staging
- [ ] Schema: schema_version 1.3.0 confirmed in staging database
- [ ] Smoke test: POST /api/v1/backoffice/workspace/workflow/subject/:id/transition works with valid
      token

### Database Migration Safety

- No data loss — new table only
- Immutability trigger uses existing `prevent_audit_modification()` function (created in v1.0.0)
- Indexes do not lock table (PostgreSQL CONCURRENTLY supported)
- Rollback: Drop workflow_logs and indexes; set schema_version back to 1.2.0

### Monitoring

- Monitor Redis keys: `workflow-transition:*` for rate limit hits
- Monitor PostgreSQL logs for trigger invocations (audit modifications attempt)
- Monitor structured logs for `correlation_id` + `entity_type` combinations
- Alert on `workflow_permission_denied` errors (may indicate permission model drift)

---

## Files Changed

### New Files (12)

```
packages/domain-core/src/workflow/workflow.types.ts
packages/domain-core/src/workflow/workflow.errors.ts
packages/domain-core/src/workflow/workflow.states.ts
packages/domain-core/src/workflow/workflow.engine.ts
apps/api/src/modules/workflow/workflow.validation.ts
apps/api/src/modules/workflow/workflow.context.ts
apps/api/src/routes/backoffice/workflow/post-transition.ts
apps/api/src/routes/backoffice/workflow/index.ts
apps/api/src/db/tenant/migrations/20260301_002_workflow_engine.ts
tests/unit/workflow/workflow.engine.test.ts
tests/unit/workflow/workflow.states.test.ts
tests/integration/workflow/workflow.transition.test.ts
```

### Modified Files (2)

```
packages/domain-core/src/index.ts                           [+4 export lines for workflow module]
apps/api/src/app.ts                                         [+1 line to register workflowRouter]
```

---

## Workflow Evidence

**All Stages Complete:**

| Step      | Completion | Artifact                                        | Commit            |
| --------- | ---------- | ----------------------------------------------- | ----------------- |
| Pre-Step  | ✅         | Branch & directories initialized                | 485eeed           |
| Specify   | ✅         | 18 FRs, 6 user stories, 8 success criteria      | 826693d           |
| Clarify   | ✅         | 5 clarifications resolved in-place              | ee52cbb           |
| Plan      | ✅         | Technical design, API contracts, migration plan | bbeceb2           |
| Tasks     | ✅         | 39 real implementation tasks                    | cc55701           |
| Analyze   | ✅         | 9 drift criteria (8 PASS + 1 N/A)               | 4240734           |
| Implement | ✅         | 39 tasks executed, tests passing                | 0cca720           |
| Closure   | ✅         | Reports, guide, PR summary                      | **(this commit)** |

---

## Next Steps

After merge to `develop`:

1. **Staging Deployment** — Deploy to staging environment; verify rate limiting and audit logs
2. **QA Validation** — Run manual test scenarios from `guides/TESTING_GUIDE.md`
3. **Monitor** — Watch for workflow permission errors and transition patterns
4. **Stage 21+** — Future stages can depend on this workflow engine for other entity types and
   workflow extensions

---

## Questions / Support

- **Specification & Implementation:** See `specs/runtime/020-status-workflow-engine/spec.md`
- **Technical Design:** See `specs/runtime/020-status-workflow-engine/plan.md`
- **Testing Guide:** See `guides/TESTING_GUIDE.md`
- **Implementation Details:** See `reports/IMPLEMENT_REPORT.md`
- **Affected Files Detail:** See `reports/TASKS_REPORT.md`

---

✅ **This implementation is PRODUCTION READY.**  
**Status Workflow Engine** — ready for staging deployment and QA validation.
