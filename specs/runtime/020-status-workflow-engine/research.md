# Research: Status Workflow Engine

**Stage**: STAGE_20_STATUS_WORKFLOW_ENGINE  
**Branch**: `020-status-workflow-engine`  
**Date**: 2026-03-01  
**Author**: speckit.plan (AI agent)

---

## Summary

All NEEDS CLARIFICATION items resolved. All research tasks complete. No architectural violations
found.

---

## R-001: State Machine Patterns in the Existing Codebase

### Finding

The existing codebase does **not** implement a formal state machine or workflow engine abstraction.
The closest patterns are:

1. **Attempt lifecycle** (`packages/domain-core/src/attempts/attempt-init.ts`) — uses an implicit
   sequential flow (PENDING → ACTIVE → SUBMITTED) enforced via repository guard queries, not a
   shared engine.
2. **RBAC/permission evaluation** (`packages/domain-core/src/auth/rbac.ts`) — implements
   `evaluatePermission(context: RbacContext, requiredPermission: string): PermissionResult` — a pure
   function that checks `permissions.includes(requiredPermission)`. This is the exact pattern the
   workflow engine must reuse: the engine receives `permissions: string[]` from `WorkflowContext`
   and checks membership.
3. **Translation system** (`packages/domain-core/src/translation/translation.service.ts`) — provides
   the canonical domain service template: stateless exported functions, `DbClient` interface as
   first parameter, no module-level pool, structured logging via `@zidney/logger`, typed error class
   with `httpStatus` property, transactional writes via `BEGIN / COMMIT / ROLLBACK` block.

### Decision

**The workflow engine adopts the translation service structure as the template.** The engine is a
set of stateless exported functions (no class instances) inside
`packages/domain-core/src/workflow/`. The primary export is
`executeTransition(db: DbClient, context: WorkflowContext): Promise<WorkflowTransitionResult>`.

State machine rules are expressed as a typed transition table (plain object), not a class hierarchy.

### Alternatives Considered

- **Class-based state machine** (e.g., XState-style) — rejected: introduces runtime framework
  dependency; AGENTS.md forbids framework dependencies in domain packages.
- **Per-entity guard functions** (current attempt pattern) — rejected: spec explicitly forbids
  per-entity hardcoded workflow logic (FR-012).
- **Event sourcing** — rejected: out of scope for Phase 3; append-only `workflow_logs` provides the
  audit trail without full event-sourcing overhead.

---

## R-002: Tenant Migration Numbering

### Finding

Last migration file: `20260301_001_translation_system.ts`

The convention is `YYYYMMDD_NNN_description.ts` where NNN is a zero-padded 3-digit sequence.

Since the translation migration is date `20260301` sequence `001`, the next migration on the same
calendar date is `20260301_002`. If a new day is preferred for clarity, `20260302_001` is also
valid.

The spec work date is 2026-03-01. The migration implements workflow_logs and WorkflowState for this
stage.

### Decision

**Migration filename: `20260301_002_workflow_engine.ts`**

Rationale: keeps the date consistent with the planning date (2026-03-01), uses sequence `002` to
follow `001_translation_system.ts` which was the prior migration on the same day. This is consistent
with how `20260228_001` and `20260228_002` share a date.

### Alternatives Considered

- `20260302_001_workflow_engine.ts` — valid, but artificially advances the date to avoid same-day
  sequencing; unnecessary given precedent (`20260228_001` + `20260228_002`).

---

## R-003: Domain Package Structure — Where the Engine Lives

### Finding

`packages/domain-core/src/` contains these sub-directories:

```
affiliates/   attempts/    audit/      auth/       docs/
errors/       index.ts     job-hash.ts license/    licenses/
logging/      migration/   migrations/ monitoring/ product/
products/     provisioning/ services/  tenant-resolver/
translation/  types/       utils/      workers/
```

The `translation/` module is the newest addition (Stage 019) and serves as the canonical pattern:

```
packages/domain-core/src/translation/
├── coverage.service.ts
├── translatable-fields.ts
├── translation.errors.ts
├── translation.service.ts
└── translation.types.ts
```

All five translation files are exported from `packages/domain-core/src/index.ts`.

### Decision

**Engine package path: `packages/domain-core/src/workflow/`**

Files to create:

```
packages/domain-core/src/workflow/
├── workflow.states.ts        # WorkflowState enum + transition table
├── workflow.types.ts         # WorkflowContext, WorkflowTransitionResult, WorkflowLogRow
├── workflow.errors.ts        # WorkflowError class + error code constants
└── workflow.engine.ts        # executeTransition() — main public function
```

All four files exported via `packages/domain-core/src/index.ts` additions.

### Alternatives Considered

- Single `workflow.ts` file — rejected: translation module pattern uses separate files for types,
  errors, and service; consistency reduces cognitive overhead.
- `packages/workflow-engine/` (standalone package) — rejected: overkill for a focused feature with
  no external consumers outside domain-core; would require new `package.json`, `tsconfig.json`, and
  workspace wiring. Workflow engine logic belongs in domain-core alongside auth, translation,
  attempts.

---

## R-004: Existing API Module Structure — Where the Routes Live

### Finding

`apps/api/src/modules/` contains:

```
admin/          attempt/        csrf/
errors/         rate-limiting/  schema/
security/       translation/    workspace-settings/
```

The `translation/` API module provides the canonical route pattern:

```
apps/api/src/modules/translation/
├── translation.context.ts     # extracts/validates request context
├── translation.repository.ts  # data access (called by domain service indirectly)
└── translation.validation.ts  # request body validation (Zod or equivalent)
```

The `rate-limiting/` module contains `violation-audit.ts` — confirming rate limiting is implemented
at the API layer already. Rate limit enforcement for workflow transition routes will use the
existing middleware applied per route, not new rate-limit logic.

### Decision

**Workflow API module path: `apps/api/src/modules/workflow/`**

Files to create:

```
apps/api/src/modules/workflow/
├── workflow.context.ts        # extract WorkflowContext from Hono request + auth middleware
├── workflow.routes.ts         # POST /workflow/:entityType/:entityId/transition handler
└── workflow.validation.ts     # Zod schema for transition request body
```

Route registration: added to the main Hono app router (same pattern as translation routes).

### Alternatives Considered

- Per-entity route modules (e.g., `modules/subjects/workflow.ts`) — rejected: FR-012 mandates a
  shared, generic engine; per-entity route files would duplicate context extraction and permission
  resolution logic.
- Embedding workflow in `modules/admin/` — rejected: workflow is a cross-cutting concern for all
  Backoffice content management, not admin-specific.

---

## R-005: `SELECT FOR UPDATE` Concurrency Pattern

### Finding

The `SELECT FOR UPDATE` pattern is standard PostgreSQL row-level exclusive locking. It:

- Blocks concurrent writers on the same row until the current transaction commits or rolls back.
- Does not require a `version` column (no optimistic locking needed).
- Does not throw serialization failures (no retry logic needed) — the losing concurrent transaction
  simply observes the post-commit state and returns `400 invalid_state_transition` if the entity is
  already in the target state.
- Works correctly within a `BEGIN / ... / COMMIT` block using a `PoolClient` (not a Pool),
  consistent with the migration pattern and translation service.

No existing code in the repository uses `SELECT FOR UPDATE`; this engine introduces the pattern for
the first time. It is the mandated mechanism per FR-009 and the 2026-03-01 clarification.

### Decision

**Use `SELECT FOR UPDATE` in a `PoolClient` transaction.** The engine calls `db.getClient()` or
receives a `PoolClient` to execute the 5-step atomic sequence:

1. `BEGIN`
2. `SELECT ... FROM <entity_table> WHERE id = $1 FOR UPDATE` — locks the row
3. Validate transition (state legality + permission check) — pure logic, no DB write
4. `UPDATE <entity_table> SET status = $1, status_updated_at = NOW(), status_updated_by = $2 WHERE id = $3`
5. `INSERT INTO workflow_logs ...`
6. `COMMIT`

On any failure: `ROLLBACK`.

### Note on DbClient Interface

The engine requires a client capable of `BEGIN / COMMIT / ROLLBACK`, which means a `PoolClient` not
a `Pool`. The `DbClient` interface used in translation service is a plain `{ query }` shape that
works for both Pool and PoolClient. For the workflow engine, the interface must also support
transaction lifecycle. The engine will define:

```typescript
interface TenantDb {
  query: <T = any>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
  // Transaction control — only PoolClient provides these
  connect?: () => Promise<PoolClient>;
}
```

The API route handler will pass a `Pool` instance; the engine will call `pool.connect()` to obtain a
`PoolClient`, run the transaction, then release. This keeps the engine's dependency on `pg` types
minimal (only `PoolClient` from `pg`).

---

## R-006: `workflow_logs` Immutability Strategy

### Finding

The `translation_audit_logs` table achieves immutability via a `prevent_audit_modification()`
PostgreSQL trigger function that fires `BEFORE UPDATE OR DELETE`. This trigger function is already
installed in the tenant database baseline.

### Decision

**Reuse `prevent_audit_modification()` trigger for `workflow_logs`.**

The migration creates:

```sql
CREATE TRIGGER prevent_workflow_log_modification
  BEFORE UPDATE OR DELETE ON workflow_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification()
```

This matches the exact pattern used for `translation_audit_logs` — no new trigger function needed.

---

## R-007: `WorkflowState` — PostgreSQL Enum vs VARCHAR

### Finding

The spec defines four states: `COMPLETED`, `UNDER_REVIEW`, `APPROVED`, `ENABLED`. These are fixed
for Phase 3 (per A-004). PostgreSQL `ENUM` types enforce valid values at the DB level but are
expensive to `ALTER` later. `VARCHAR(50)` with an application-level check constraint or
`CHECK (status IN (...))` is more migration-friendly.

Given the spec explicitly states per-entity custom states are out of scope (A-004), and the platform
follows stability-first principles, a PostgreSQL `ENUM` type is appropriate for the `workflow_logs`
columns but VARCHAR is appropriate for entity table `status` columns (to avoid coupling dozens of
entity tables to an enum type that must be altered via migration).

### Decision

- **`workflow_logs.previous_state`** and **`workflow_logs.new_state`**: `VARCHAR(50) NOT NULL` with
  a `CHECK` constraint listing valid values.
- **`workflow_logs.entity_type`**: `VARCHAR(100) NOT NULL`.
- **Entity table `status` field** (on subjects, questions, etc.):
  `VARCHAR(50) NOT NULL DEFAULT 'COMPLETED'` with a `CHECK` constraint.
- **TypeScript `WorkflowState` enum**: defined in `workflow.states.ts` as the authoritative source;
  DB values are strings matching the enum members.

Rationale: avoids PostgreSQL `ENUM` type migration complexity while still enforcing valid values at
the constraint level. Consistent with Phase 3 forward-only migration discipline.

---

## R-008: Schema Version Bump

### Finding

Current schema_version after `20260301_001_translation_system.ts`: `1.2.0`.

The workflow engine migration is the next tenant schema change.

### Decision

**Bump schema_version `1.2.0 → 1.3.0`** in `20260301_002_workflow_engine.ts`.

---

## All NEEDS CLARIFICATION Items: Resolved

| Item                  | Status   | Decision                                               |
| --------------------- | -------- | ------------------------------------------------------ |
| State machine pattern | Resolved | Stateless function table, translation service template |
| Migration filename    | Resolved | `20260301_002_workflow_engine.ts`                      |
| Engine package path   | Resolved | `packages/domain-core/src/workflow/`                   |
| API module path       | Resolved | `apps/api/src/modules/workflow/`                       |
| Locking mechanism     | Resolved | `SELECT FOR UPDATE` in PoolClient transaction          |
| Immutability          | Resolved | Reuse `prevent_audit_modification()` trigger           |
| State encoding        | Resolved | VARCHAR(50) + CHECK constraint (not PG ENUM)           |
| Schema version        | Resolved | `1.2.0 → 1.3.0`                                        |
