# Research: MCQ Baskets (Stage 033)

**Stage**: `STAGE_33_MCQ_BASKETS`
**Generated**: 2026-03-23
**Branch**: `spec/033-mcq-baskets`

---

## 1. Existing Related Implementations

### 1.1 Tags + Tag-Relations (Stage 032) — Primary Reference

The `STAGE_32_TAGS` implementation is the closest structural analog to MCQ Baskets. Key patterns:

| Concern                | Tags pattern                                                | Baskets adaptation                                       |
| ---------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| Schema file location   | `apps/api/src/db/tenant/schemas/tags.schema.ts`             | `baskets.schema.ts` + `basket-questions.schema.ts`       |
| Migration file         | `20260323_010_tags.ts` → schema `1.15.0 → 1.16.0`           | `20260323_011_mcq_baskets.ts` → schema `1.16.0 → 1.17.0` |
| CONCURRENT index phase | Two-phase pattern (DDL inside TX + CONCURRENT outside)      | Same two-phase approach                                  |
| FK guards              | `DO $$ BEGIN IF NOT EXISTS ... END $$` idempotent blocks    | Same                                                     |
| Domain package layout  | `tags/` with errors.ts, types.ts, repository.ts, service.ts | `baskets/` same layout                                   |
| Route handler layout   | Individual files per operation under `backoffice/tags/`     | `backoffice/baskets/`                                    |
| Validation schemas     | `packages/validation/src/backoffice/tags.schemas.ts`        | `baskets.schemas.ts`                                     |

**Key difference**: Tags have a simple `ENABLED/DISABLED` status (not workflow-managed). Baskets use the full workflow lifecycle. This adds the workflow engine integration layer.

### 1.2 Subjects (Stage 020 area) — Workflow Engine Reference

`subjects` is the reference entity for full workflow lifecycle integration. It uses the shared workflow engine with entity type `subject`. The workflow engine reads from `ENTITY_TABLE_MAP: { subject: 'subjects' }` and `WORKFLOW_ENTITY_TYPES` set.

Subjects start at `COMPLETED` after creation — the current engine has no `DRAFT` state. Baskets introduce `DRAFT` as the initial status.

### 1.3 Categories/Category-Values (Stage 031) — Lean CRUD Reference

`STAGE_31_CATEGORIES` shows the CRUD-only pattern (no workflow) for backoffice content entities. The pattern for pagination, filtering, error codes, and response shapes applies directly.

---

## 2. Workflow Engine Analysis

### 2.1 Current State Machine

File: `packages/domain-core/src/workflow/workflow.states.ts`

```
WorkflowState = { COMPLETED | UNDER_REVIEW | APPROVED | ENABLED }
WORKFLOW_STATE_ORDER = [COMPLETED=0, UNDER_REVIEW=1, APPROVED=2, ENABLED=3]
```

Forward edges: `COMPLETED→UNDER_REVIEW`, `UNDER_REVIEW→APPROVED`, `APPROVED→ENABLED`
Backward edges: `UNDER_REVIEW→COMPLETED`, `APPROVED→UNDER_REVIEW`

**Baskets require**: `DRAFT → COMPLETED → UNDER_REVIEW → APPROVED → ENABLED`

The `DRAFT` state is NOT present in the current engine.

### 2.2 Required Workflow Engine Extension

**Extend (do not replace) — additive change only**:

1. Add `DRAFT = 'DRAFT'` to `WorkflowState` enum.
2. Prepend `DRAFT` to `WORKFLOW_STATE_ORDER` array (index 0; COMPLETED becomes index 1).
3. Add one new forward transition edge: `{ from: DRAFT, to: COMPLETED, forward: true, actionKey: 'complete' }`.
4. Add `'mcq_basket'` to `WORKFLOW_ENTITY_TYPES` set.
5. Add `mcq_basket: 'mcq_baskets'` to `ENTITY_TABLE_MAP` in `workflow.engine.ts`.

**Backward compatibility**: Existing entities (subjects, mcq_questions, etc.) are created at `COMPLETED` status — they never enter `DRAFT`. Adding `DRAFT` to the enum is safe; no existing transitions include `DRAFT` as `from/to`, so no existing edge is broken.

### 2.3 Permission Bridging Pattern

The workflow engine uses `{entityType}.{actionKey}` format for permission checks (e.g., `mcq_basket.complete`, `mcq_basket.review`). The backoffice RBAC stores coarse-grained permission codes (`question_manage`, `content_manage`, `content_review`) in `backoffice_role_module_permissions`.

**Resolution**: the basket workflow route handler maps the actor's RBAC permissions to engine-compatible permission strings at call time, then passes the derived list into `WorkflowContext.permissions`:

```ts
function buildBasketWorkflowPermissions(rbacPermissions: string[]): string[] {
  const has = (p: string) => rbacPermissions.includes(p);
  const derived: string[] = [];
  if (has("question_manage") || has("content_manage")) {
    derived.push("mcq_basket.complete", "mcq_basket.review");
  }
  if (has("question_manage") || has("content_review")) {
    derived.push("mcq_basket.approve", "mcq_basket.enable");
  }
  return derived;
}
```

This adapter lives in the basket workflow transition handler, not in the engine. The engine remains generic.

### 2.4 DRAFT State — Additional Table Column Requirement

The workflow engine's `SELECT … FOR UPDATE` fetches `status, status_updated_at, status_updated_by`. The `mcq_baskets` table migration MUST include `status_updated_at TIMESTAMPTZ` and `status_updated_by UUID` columns so the engine's row lock query succeeds.

---

## 3. Deletion Guard — Table Existence Problem

### 3.1 Problem

The spec requires checking references in `exam_configurations` and `auto_selection_rules` tables before deletion. Neither table exists in the current migration chain (Stage 033 is content classification; exam configuration and auto-selection are future stages).

### 3.2 Resolution: Graceful Table-Existence Check

The `BasketService.checkDeletionGuard()` MUST query `information_schema.tables` before attempting the reference check query:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('exam_configurations', 'auto_selection_rules')
```

If either table does not exist, treat as zero references (no block). If a table exists, execute the reference count query against it. This allows the deletion guard to be safely deployed now, with automatic enforcement activated when those tables are created in future stages.

This pattern is documented in `packages/domain-core/src/tags/tags.repository.ts` for `checkEntityExists` (PostgreSQL error 42P01 — undefined_table — caught gracefully).

---

## 4. mcq_questions FK Reference

### 4.1 Baseline vs. Current Schema

- `v1.0.0/baseline-schema.sql`: `mcq_questions` had a `basket_id` column (old design).
- `004-create-core-application-tables.sql` (current baseline): `mcq_questions` has `exam_id FK`, no `basket_id` column. The table exists with `id UUID PK`.

**Conclusion**: `mcq_questions.id` exists in the tenant DB. The FK from `mcq_basket_questions.question_id → mcq_questions.id` is valid and should be created using the standard idempotent `DO $$ BEGIN ... END $$` guard.

### 4.2 Old Baseline Conflict

The old `v1.0.0/baseline-schema.sql` also created `mcq_baskets` table with a different schema (no `type`, no `max_questions`, simple `code`). For tenants provisioned from this baseline, the migration at stage 033 MUST use `CREATE TABLE IF NOT EXISTS` — if the old `mcq_baskets` table happens to exist, it will be skipped. However, since the current active system uses `004-create-core-application-tables.sql` + the `20260*` chain which did not create `mcq_baskets`, this is a theoretical concern. Document in migration header.

---

## 5. Schema Version Numbering

| Migration file                | From version | To version | Stage                    |
| ----------------------------- | ------------ | ---------- | ------------------------ |
| `20260323_010_tags.ts`        | `1.15.0`     | `1.16.0`   | STAGE_32_TAGS            |
| `20260323_011_mcq_baskets.ts` | `1.16.0`     | `1.17.0`   | **STAGE_33_MCQ_BASKETS** |

---

## 6. questionCount Strategy

`questionCount` is NOT stored as a column on `mcq_baskets`. It is computed at read time:

- For **single get**: `(SELECT COUNT(*) FROM mcq_basket_questions WHERE basket_id = mcq_baskets.id)` as a scalar subquery.
- For **list**: `LEFT JOIN (SELECT basket_id, COUNT(*) AS question_count FROM mcq_basket_questions GROUP BY basket_id) q ON q.basket_id = mcq_baskets.id`.

This avoids counter drift and is consistent with the cascade-deletion requirement (deleted questions auto-remove rows from the join table; the count is always live).

---

## 7. Rate Limiting Parameters

Per spec constitutional compliance declaration:

- **Write routes** (`POST`, `PATCH`, `DELETE`, `POST .../questions`, `DELETE .../questions/:id`, `POST .../workflow/transition`): ≤ 30 req/min per workspace.
- **Read routes** (`GET /baskets`, `GET /baskets/:id`, `GET /baskets/:id/questions`): ≤ 120 req/min per workspace.

These match the platform-level rate limiter configuration. No custom per-basket rate limiter needed — the workspace-scoped middleware covers this.

---

## 8. Boot Registry Integration

The migration must be registered in `apps/api/src/boot/migration-registry.ts` following the same pattern as `TENANT_MIGRATIONS_1_4_0_NAME`. A new constant `TENANT_MIGRATIONS_1_17_0_NAME = '20260323_011_mcq_baskets'` is added, along with the version gate check (`currentVersion < '1.17.0'`).

---

## 9. Drizzle Index Ownership Convention

Per existing patterns (tags, tag-relations schemas):

- **Drizzle-owned**: Single B-tree indexes using `index()` — declared in `pgTable` table config callback.
- **Migration-owned**: UNIQUE constraints, FK constraints, CONCURRENT indexes, partial functional indexes.

For basket schemas:

- `idx_mcq_baskets_type` — Drizzle-owned (simple B-tree)
- `idx_mcq_baskets_status` — Drizzle-owned (simple B-tree)
- `idx_mcq_basket_questions_basket_id` — Drizzle-owned (simple B-tree)
- `idx_mcq_basket_questions_question_id` — Drizzle-owned (simple B-tree)
- `unique_mcq_basket_code` — migration-owned CONCURRENT UNIQUE index
- `unique_mcq_basket_question` — migration-owned CONCURRENT UNIQUE index
- All FK constraints — migration-owned

---

## 10. Decisions Resolved

| Decision                           | Resolution                                                               | Source                      |
| ---------------------------------- | ------------------------------------------------------------------------ | --------------------------- |
| Add DRAFT to workflow engine?      | YES — additive extension                                                 | spec mandate: shared engine |
| Permission bridging method?        | Adapter in basket route handler                                          | Code research               |
| Deletion guard with absent tables? | Graceful existence check via `information_schema`                        | tags.repository pattern     |
| questionCount as stored column?    | NO — computed at read time                                               | spec + cascade correctness  |
| CONCURRENT indexes needed?         | YES — for `unique_mcq_basket_code` + `unique_mcq_basket_question`        | tags pattern                |
| mcq_questions FK viable?           | YES — `id UUID PK` confirmed in `004-create-core-application-tables.sql` | baseline inspection         |
| Soft-delete?                       | NO — hard delete with guard (spec explicit)                              | spec                        |
| `type` field updateable via PATCH? | NO — immutable after creation (spec FR-010)                              | spec                        |
