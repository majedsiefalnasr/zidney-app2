# Implementation Plan: Status Workflow Engine

**Branch**: `020-status-workflow-engine` | **Date**: 2026-03-01 | **Spec**: [spec.md](spec.md)  
**Input**: `specs/runtime/020-status-workflow-engine/spec.md`  
**Research**: [research.md](research.md) | **Data Model**: [data-model.md](data-model.md)

---

## Summary

Implement a reusable, deterministic, permission-gated workflow engine for all Backoffice content entity lifecycle management. The engine enforces the four-state sequence `COMPLETED → UNDER_REVIEW → APPROVED → ENABLED`, serialises concurrent transitions via `SELECT FOR UPDATE`, records every transition in an immutable `workflow_logs` audit table, and is callable via a single stateless function `executeTransition(db, context)` from any API route handler.

**Technical approach**: Stateless exported functions in `packages/domain-core/src/workflow/` (domain package layer), one new tenant migration (`20260301_002_workflow_engine.ts`), and a generic API module in `apps/api/src/modules/workflow/`.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), running on Bun  
**Primary Dependencies**: `pg` (PoolClient for transactions), `@zidney/logger` (structured logging), `@zidney/domain-core` (workflow engine export), Hono (route handler framework at API layer)  
**Storage**: PostgreSQL — tenant database per workspace; `workflow_logs` table + entity status columns  
**Testing**: Vitest — unit tests for engine pure logic, integration tests for full transition flow via API  
**Target Platform**: Bun server (Linux/Docker)  
**Project Type**: Domain package (library) + web service (API routes)  
**Performance Goals**: Transition p95 < 50ms under normal load (one DB round-trip per transition); `SELECT FOR UPDATE` serialises concurrent writes without retry overhead  
**Constraints**: No cross-tenant DB access; no client-side timestamps; no business logic in route handlers; all writes atomic; server-authoritative time only  
**Scale/Scope**: 7 entity types × N entities per tenant; 20 transitions/user/entity-type/minute rate limit

---

## Constitution Check

_Evaluated against `.specify/memory/constitution.md` v1.2.0_

| Gate                          | Status  | Notes                                                                                                              |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| Database-per-tenant isolation | ✅ PASS | `TenantDb` injected as first param; no global singleton; no cross-tenant joins                                     |
| Middleware authority          | ✅ PASS | Tenant resolver + license middleware execute before route handler; engine called after auth context is established |
| License enforcement           | ✅ PASS | Existing license middleware on all Backoffice routes; workflow routes are Backoffice routes                        |
| Attempt integrity             | ✅ PASS | Not applicable (workflow engine is for content entities, not exam attempts)                                        |
| Versioned evolution           | ✅ PASS | Migration bumps schema_version `1.2.0 → 1.3.0`; forward-only                                                       |
| Server-authoritative time     | ✅ PASS | All timestamps use `NOW()` in SQL; no client timestamp accepted                                                    |
| Import boundary               | ✅ PASS | `apps/api` → `packages/domain-core`; no reverse imports                                                            |
| UI system                     | ✅ PASS | No UI components in this stage                                                                                     |
| Rate limiting                 | ✅ PASS | 20 transitions/user/entity-type/minute at API layer via existing middleware                                        |

**Constitution Check result: ALL GATES PASS. No ADR required. No architectural review escalation.**

---

## Project Structure

### Documentation (this feature)

```text
specs/runtime/020-status-workflow-engine/
├── plan.md              ← this file
├── research.md          ← Phase 0 complete
├── data-model.md        ← Phase 1 complete
├── contracts/
│   └── workflow-transition-api.md   ← Phase 1 (API contract)
└── tasks.md             ← Phase 2 (/speckit.tasks — NOT generated here)
```

### Source Code Layout

```text
packages/domain-core/src/workflow/
├── workflow.states.ts        # WorkflowState enum, WORKFLOW_STATE_ORDER, WORKFLOW_TRANSITIONS, WORKFLOW_ENTITY_TYPES
├── workflow.types.ts         # WorkflowContext, WorkflowTransitionResult, WorkflowEnabledEntityRow, DbClient interface
├── workflow.errors.ts        # WorkflowError class, WORKFLOW_ERROR_CODES, WORKFLOW_ERROR_HTTP_STATUS
└── workflow.engine.ts        # executeTransition() — main public function

apps/api/src/db/tenant/migrations/
└── 20260301_002_workflow_engine.ts          # workflow_logs table + indexes + trigger + schema bump

apps/api/src/modules/workflow/
├── workflow.context.ts        # extract WorkflowContext from Hono request context + auth middleware
├── workflow.routes.ts         # POST /:entityType/:entityId/transition route handler
└── workflow.validation.ts     # Zod schema for transition request body

tests/unit/workflow/
├── workflow.engine.test.ts    # Unit tests — transition table logic, permission check, error codes
└── workflow.states.test.ts    # Unit tests — state ordering, entity type registry

tests/integration/workflow/
└── workflow.transition.test.ts  # Integration tests — full API call through middleware stack
```

---

## Phase 1: Domain Package — `packages/domain-core/src/workflow/`

### 1.1 `workflow.states.ts`

Exports:

- `WorkflowState` enum with members `COMPLETED | UNDER_REVIEW | APPROVED | ENABLED`
- `WORKFLOW_STATE_ORDER: WorkflowState[]` — index = sequence position
- `WorkflowTransitionDefinition` interface
- `WORKFLOW_TRANSITIONS: WorkflowTransitionDefinition[]` — the complete transition table
- `WORKFLOW_ENTITY_TYPES: Set<string>` — registry of accepted entity type strings

No imports from `pg` or any framework.

### 1.2 `workflow.types.ts`

Exports:

- `WorkflowContext` — plain value object (entityType, entityId, targetState, actorId, permissions[], reason?, correlationId, workspaceSlug, workspaceId)
- `WorkflowTransitionResult` — return type of `executeTransition()`
- `WorkflowEnabledEntityRow` — minimal shape the engine reads/writes per entity row
- `DbClient` interface — `{ query, connect? }` compatible with `pg.Pool`

### 1.3 `workflow.errors.ts`

Exports:

- `WORKFLOW_ERROR_CODES` — typed constant object
- `WORKFLOW_ERROR_HTTP_STATUS` — Record mapping code → HTTP status
- `WorkflowError extends Error` — with `.code` and `.httpStatus` properties; identical pattern to `TranslationError`

Pattern mirrors `translation.errors.ts` exactly for consistency.

### 1.4 `workflow.engine.ts` — Core Implementation

**Signature**:

```typescript
export async function executeTransition(
  db: DbClient,
  context: WorkflowContext
): Promise<WorkflowTransitionResult>
```

**5-step transaction sequence** (FR-009):

```
Step 1: Validate context.entityType ∈ WORKFLOW_ENTITY_TYPES → WorkflowError(UNKNOWN_ENTITY_TYPE) if not
Step 2: client = await db.connect()
Step 3: BEGIN
Step 4: SELECT id, status, status_updated_at, status_updated_by
          FROM <entity_table(entityType)>
          WHERE id = $entityId
          FOR UPDATE
        → WorkflowError(ENTITY_NOT_FOUND) if no row
Step 5: Find transition: WORKFLOW_TRANSITIONS where from=currentStatus AND to=targetState
        → WorkflowError(INVALID_STATE_TRANSITION) if no matching transition
Step 6: Construct requiredPermission = `${entityType}.${transition.actionKey}`
        → WorkflowError(WORKFLOW_PERMISSION_DENIED) if requiredPermission ∉ context.permissions
Step 7: If !transition.forward → validate context.reason non-empty
        → WorkflowError(JUSTIFICATION_REQUIRED) if missing/empty
Step 8: UPDATE <entity_table> SET status=$targetState, status_updated_at=NOW(), status_updated_by=$actorId WHERE id=$entityId
Step 9: INSERT INTO workflow_logs (entity_type, entity_id, previous_state, new_state, changed_by, reason)
          VALUES ($entityType, $entityId, $currentStatus, $targetState, $actorId, $reason)
          RETURNING id, changed_at
Step 10: COMMIT
Step 11: Return WorkflowTransitionResult
On any error in steps 4–10: ROLLBACK → rethrow
```

**Entity table name resolution**:

```typescript
const ENTITY_TABLE_MAP: Record<string, string> = {
  subject: 'subjects',
  mcq_question: 'mcq_questions',
  traditional_question: 'traditional_questions',
  exam: 'exams',
  topic: 'topics',
  library_file: 'library_files',
  template: 'templates',
}
```

**Structured logging** (every transition attempt, success or failure):

```typescript
logger.info('workflow.transition.attempt', {
  workspace_slug: context.workspaceSlug, // from tenant resolver middleware — AGENTS.md required
  workspace_id: context.workspaceId, // from tenant resolver middleware — AGENTS.md required
  correlation_id: context.correlationId,
  entity_type: context.entityType,
  entity_id: context.entityId,
  target_state: context.targetState,
  actor_id: context.actorId,
})
// On success:
logger.info('workflow.transition.success', {
  ...previousState,
  newState,
  logId,
})
// On failure:
logger.warn('workflow.transition.rejected', { ...error.code })
```

---

## Phase 1: Tenant Migration — `20260301_002_workflow_engine.ts`

**File**: `apps/api/src/db/tenant/migrations/20260301_002_workflow_engine.ts`

**Schema version bump**: `1.2.0 → 1.3.0`

**DDL sequence** (single transactional block):

1. `CREATE TABLE IF NOT EXISTS workflow_logs` with CHECK constraints on `previous_state` and `new_state`
2. `CREATE INDEX IF NOT EXISTS idx_wfl_entity_created` on `(entity_type, entity_id, changed_at DESC, id DESC)`
3. `CREATE INDEX IF NOT EXISTS idx_wfl_actor_created` on `(changed_by, changed_at DESC)`
4. `CREATE INDEX IF NOT EXISTS idx_wfl_entity_type_created` on `(entity_type, changed_at DESC)`
5. `DROP TRIGGER IF EXISTS prevent_workflow_log_modification ON workflow_logs`
6. `CREATE TRIGGER prevent_workflow_log_modification BEFORE UPDATE OR DELETE ON workflow_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification()`
7. `UPDATE schema_version SET version = '1.3.0', applied_at = NOW() WHERE id = '...'`

**`down()` function**: throws `Error('Workflow engine migration is not reversible. Restore from snapshot.')` per ADR-0008.

**Note**: This migration creates `workflow_logs` only. Entity table status columns (`status`, `status_updated_at`, `status_updated_by`) are added via per-entity migrations in Stage 21+ when those entities are first created. They are not added here to avoid coupling the workflow engine migration to entity tables that do not yet exist.

---

## Phase 1: API Module — `apps/api/src/modules/workflow/`

### Route

```
POST /api/backoffice/:workspaceSlug/workflow/:entityType/:entityId/transition
```

**Middleware stack** (applied before handler — existing middleware, no changes needed):

1. Tenant resolver (resolves `workspaceSlug` → tenant DB connection)
2. License validation middleware (403/423/404 on invalid license)
3. Authentication middleware (JWT validation → sets `actorId`, `permissions[]` in context)
4. Rate limiting middleware: `workflow-transition` key, 20 req/user/entity-type/minute → 429 on breach

### `workflow.validation.ts`

```typescript
// Zod schema for POST body
const TransitionRequestSchema = z.object({
  target_state: z.enum(['COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED']),
  reason: z.string().optional(),
})
```

### `workflow.context.ts`

Extracts from Hono context:

- `entityType` from `:entityType` path param
- `entityId` from `:entityId` path param
- `targetState` from validated body
- `actorId` from JWT payload (`user_id`)
- `permissions` from JWT payload or RBAC lookup (resolves `string[]`)
- `correlationId` from `x-correlation-id` header or generated UUID
- `workspaceSlug` from tenant resolver context (`c.get('tenantSlug')`)
- `workspaceId` from tenant resolver context (`c.get('tenantId')`)
- Returns `WorkflowContext`

### `workflow.routes.ts`

```typescript
// Route handler skeleton — no business logic
app.post('/workflow/:entityType/:entityId/transition', async (c) => {
  const db = c.get('tenantDb') // from tenant resolver middleware
  const body = await parseBody(c, TransitionRequestSchema)
  const ctx = buildWorkflowContext(c, body) // workflow.context.ts

  try {
    const result = await executeTransition(db, ctx)
    return c.json({ success: true, data: result, error: null }, 200)
  } catch (err) {
    if (err instanceof WorkflowError) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: err.code,
            message: err.message,
            details: null,
            correlationId: ctx.correlationId,
          },
        },
        err.httpStatus
      )
    }
    throw err // unhandled — bubble to global error handler
  }
})
```

**Handler contract**: the route handler has zero business logic. It only: parses + validates input, builds `WorkflowContext`, calls `executeTransition`, maps result to response envelope.

---

## Phase 1: `packages/domain-core/src/index.ts` Additions

```typescript
// Workflow engine (Stage 020)
export * from './workflow/workflow.states'
export * from './workflow/workflow.types'
export * from './workflow/workflow.errors'
export * from './workflow/workflow.engine'
```

---

## Transaction Strategy Detail (FR-009)

```
Route handler:
  db = c.get('tenantDb')           // pg.Pool from tenant resolver
  ↓
executeTransition(db, context):
  client = await db.connect()      // acquire PoolClient
  try {
    await client.query('BEGIN')
    row = await client.query('SELECT ... FOR UPDATE', [entityId])
    // validate → throw WorkflowError on failure (triggers ROLLBACK in catch)
    await client.query('UPDATE ...', [...])
    log = await client.query('INSERT INTO workflow_logs ...', [...])
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
```

**Concurrency guarantee**: Two simultaneous transitions on the same entity row:

- First transaction acquires exclusive lock via `SELECT FOR UPDATE`.
- Second transaction blocks on the lock.
- First commits: entity is now in new state.
- Second unblocks: re-reads entity row — if entity is now in its-expected source state? No → `INVALID_STATE_TRANSITION`. If the second transition had a different target (e.g., both tried to go from COMPLETED to UNDER_REVIEW)? The second sees UNDER_REVIEW → returns `400 invalid_state_transition`.

No retry logic needed. No version column needed. No serialization failure errors.

---

## Rate Limiting (FR-018)

Rate limiting is **not** implemented inside the engine. It is enforced by the existing rate-limit middleware at the API route layer.

Key: `workflow-transition:{actorId}:{entityType}` — 20 tokens/minute.

The route handler applies the middleware before the handler is invoked. The engine is never reached if the rate limit is exceeded. Error response is `429 rate_limit_exceeded` from the middleware, not the engine.

---

## Error Handling (Full Error Contract)

All workflow routes return the Zidney standard envelope:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "...",
    "message": "...",
    "details": null,
    "correlationId": "uuid"
  }
}
```

| Condition                             | HTTP | `error.code`                 | Where enforced                       |
| ------------------------------------- | ---- | ---------------------------- | ------------------------------------ |
| State-skip or same-state re-attempt   | 400  | `invalid_state_transition`   | Engine                               |
| Backward transition, no justification | 400  | `justification_required`     | Engine                               |
| Unknown entity type                   | 400  | `unknown_entity_type`        | Engine (before DB)                   |
| Actor lacks permission                | 403  | `workflow_permission_denied` | Engine                               |
| Entity row not found                  | 404  | `entity_not_found`           | Engine (after SELECT FOR UPDATE)     |
| Concurrent transition conflict        | 409  | `workflow_conflict`          | Engine (caught pg error on ROLLBACK) |
| Rate limit exceeded                   | 429  | `rate_limit_exceeded`        | API middleware                       |

Note: `401 Unauthorized` never returned by workflow engine — authentication middleware handles it upstream.

---

## Logging Requirements

All structured log entries must include (per AGENTS.md):

```typescript
{
  timestamp:      string,   // ISO 8601 — set by @zidney/logger
  level:          string,
  service:        'workflow-engine',
  workspace_slug: string,   // propagated from route context via correlationId
  workspace_id:   string,   // from tenant resolver context
  user_id:        string,   // context.actorId
  correlation_id: string,   // context.correlationId
  entity_type:    string,
  entity_id:      string,
  transition:     string,   // e.g. 'COMPLETED→UNDER_REVIEW'
  attempt_id:     undefined // n/a for workflow transitions
}
```

`console.log` is forbidden. All logs via `createLogger('workflow-engine')` from `@zidney/logger`.

---

## Testing Requirements (per AGENTS.md)

### Unit Tests (`tests/unit/workflow/`)

- `workflow.engine.test.ts`:
  - All valid forward transitions succeed and return correct result shape
  - All invalid forward transitions (state-skipping) throw `WorkflowError(INVALID_STATE_TRANSITION)`
  - All backward transitions without reason throw `WorkflowError(JUSTIFICATION_REQUIRED)`
  - All transitions with missing permission throw `WorkflowError(WORKFLOW_PERMISSION_DENIED)`
  - Unknown entity type throws `WorkflowError(UNKNOWN_ENTITY_TYPE)` before DB access
  - Entity not found throws `WorkflowError(ENTITY_NOT_FOUND)`
  - Same-state re-attempt throws `WorkflowError(INVALID_STATE_TRANSITION)`
  - Transaction rollback on DB failure
- `workflow.states.test.ts`:
  - `WORKFLOW_STATE_ORDER` is correctly ordered
  - `WORKFLOW_ENTITY_TYPES` contains all Phase 3 entity types
  - `WORKFLOW_TRANSITIONS` covers all valid edges (7 transitions: 3 forward + 2×2 backward)

### Integration Tests (`tests/integration/workflow/`)

- `workflow.transition.test.ts`:
  - Full POST request through middleware stack → engine → DB → response
  - Concurrent transition on same entity via two parallel requests → one 200, one 400
  - Rate limit: 21st request → 429
  - License middleware blocks before engine on soft-locked workspace
  - Two different entity types both use same engine code path (SC-007)

---

## Architectural Decisions Made During Planning

| Decision                                                | Rationale                                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stateless functions (not class)                         | Matches translation service pattern; no framework dependency; pure testable functions                                                                   |
| `db.connect()` inside engine                            | Engine handles its own transaction lifecycle; caller passes Pool (not PoolClient); avoids leaked connections                                            |
| VARCHAR(50) + CHECK (not PG ENUM)                       | Migration-safe; avoids ALTER TYPE complexity for future state additions; consistent with research R-007                                                 |
| `WORKFLOW_ENTITY_TYPES` set in domain package           | Centralises registry; reusable across API and domain layers without duplication                                                                         |
| Entity status columns NOT in this migration             | Decouple workflow engine migration from per-entity table migrations; entity tables created in Stage 21+                                                 |
| Trigger immutability via `prevent_audit_modification()` | Reuses existing DB function; no new trigger function needed; consistent with translation_audit_logs                                                     |
| `workspace_id` NOT in `workflow_logs`                   | In a database-per-tenant model, the tenant identity is the database itself; adding `workspace_id` would be redundant and introduce unnecessary coupling |

---

## Complexity Tracking

No constitution violations detected. No ADR required for this feature. All gates pass.

**Risk flags**: None. Engine introduces `SELECT FOR UPDATE` as a new pattern in the codebase (no prior usage found) — this is documented in research.md R-005 and is the mandated mechanism per FR-009 clarification.

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
