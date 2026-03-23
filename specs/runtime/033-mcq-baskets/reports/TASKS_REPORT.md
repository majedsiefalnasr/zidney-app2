# Tasks Report — MCQ Baskets

**Step:** 4 — Tasks
**Stage:** STAGE_33_MCQ_BASKETS
**Phase:** 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION
**Timestamp:** 2026-03-23T01:00:00.000Z
**Status:** COMPLETE

---

## Summary

35 atomic, independently-testable tasks generated from `spec.md` + `plan.md` spanning 5
implementation phases: Foundation (infrastructure), Domain Package, Validation Schema, API Route
Layer, and Tests. All write paths are transactional, idempotency constraints are enforced via DB
UNIQUE indexes and application pre-checks, and the task set is fully compliant with the Zidney
Constitution v1.2.0.

---

## Inputs Reviewed

- `specs/runtime/033-mcq-baskets/spec.md`
- `specs/runtime/033-mcq-baskets/plan.md`
- `specs/runtime/033-mcq-baskets/data-model.md`
- `specs/runtime/033-mcq-baskets/tasks.md`

---

## Task Breakdown

| Category       | Count  | Notes                                                                      |
| -------------- | ------ | -------------------------------------------------------------------------- |
| Infrastructure | 7      | T001–T007: workflow engine, migration, Drizzle schemas, boot registry      |
| Domain         | 6      | T008–T013: types, errors, repository, service, dependency registry, barrel |
| Validation     | 2      | T014–T015: Zod schemas + export                                            |
| API Routes     | 12     | T016–T027: helpers, 9 route handlers, router assembly, app.ts mount        |
| Testing        | 8      | T028–T034: 2 unit test files + 5 integration test files (all parallel)     |
| **Total**      | **35** |                                                                            |

---

## Transactional Tasks

| Task | Operation         | Transaction Boundary                                                                  |
| ---- | ----------------- | ------------------------------------------------------------------------------------- |
| T011 | `createBasket`    | BEGIN → code uniqueness check → INSERT basket → COMMIT                                |
| T011 | `updateBasket`    | BEGIN → SELECT FOR UPDATE → code check (if changing) → UPDATE → COMMIT                |
| T011 | `deleteBasket`    | BEGIN → SELECT FOR UPDATE → deletion guard checks → DELETE (CASCADE) → COMMIT         |
| T011 | `linkQuestion`    | BEGIN → check basket → check question → check duplicate → check max → INSERT → COMMIT |
| T011 | `unlinkQuestion`  | BEGIN → check basket → find link → DELETE → COMMIT                                    |
| T003 | Migration Phase 1 | Entire DDL (CREATE TABLE, FKs, B-tree indexes, version bump) inside single TX         |

`transitionStatus` does NOT use an outer transaction at the service layer — the workflow engine manages its own `BEGIN/FOR UPDATE/COMMIT` via `executeTransition()`. Pre-guards (count, max_questions) are read-only checks applied before the engine TX is opened (per AD-003 note in plan.md).

---

## Idempotency Tasks

| Task | Mechanism                                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------- |
| T003 | Migration: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `IF NOT EXISTS` FK guards         |
| T007 | Boot registry: migration checked against `migration_history` before applying                             |
| T011 | `linkQuestion`: `UNIQUE (basket_id, question_id)` DB constraint + application pre-check; duplicate → 409 |

---

## Risk-Ranked Task Summary

| Task ID   | Risk      | Description                                                                     |
| --------- | --------- | ------------------------------------------------------------------------------- |
| T001      | 🔴 HIGH   | Extend `WorkflowState` enum — additive change to shared workflow engine         |
| T003      | 🔴 HIGH   | DB migration creating 2 new tables with FK constraints (schema change)          |
| T007      | 🔴 HIGH   | Boot registry update: incorrect migration version ordering breaks boot sequence |
| T011      | 🔴 HIGH   | Service layer with multi-tenant TX boundaries and workflow engine integration   |
| T008      | 🟡 MEDIUM | New domain types package (new package sub-module)                               |
| T009      | 🟡 MEDIUM | Domain error definitions with HTTP status mapping                               |
| T010      | 🟡 MEDIUM | Repository layer — SQL queries accessing tenant DB tables                       |
| T016      | 🟡 MEDIUM | Route helpers including permission bridge (AD-002 RBAC→WorkflowEngine adapter)  |
| T022      | 🟡 MEDIUM | Transition handler with permission bridging                                     |
| T027      | 🟡 MEDIUM | `app.ts` mount — modifying shared application entrypoint                        |
| T002      | 🟢 LOW    | `ENTITY_TABLE_MAP` entry in workflow engine (single constant addition)          |
| T004      | 🟢 LOW    | New Drizzle schema file (no existing code modified)                             |
| T005      | 🟢 LOW    | New Drizzle schema file (no existing code modified)                             |
| T006      | 🟢 LOW    | Index.ts barrel export addition                                                 |
| T012      | 🟢 LOW    | Dependency registry entry                                                       |
| T013      | 🟢 LOW    | Barrel exports                                                                  |
| T014      | 🟢 LOW    | New Zod schema file                                                             |
| T015      | 🟢 LOW    | Validation package index export addition                                        |
| T017–T025 | 🟢 LOW    | Individual route handlers (isolated files, no shared state)                     |
| T026      | 🟢 LOW    | Router assembly (only imports route handlers)                                   |
| T028–T034 | 🟢 LOW    | Test files (no production code modified)                                        |

---

## Tasks with External Dependencies

| Task ID   | Package       | Version Note                                                                              |
| --------- | ------------- | ----------------------------------------------------------------------------------------- |
| T003      | `drizzle-orm` | Uses `sql` tagged template for raw SQL in migration                                       |
| T004–T005 | `drizzle-orm` | Uses `pgTable`, `uuid`, `varchar`, `integer`, `text`, `timestamp`, `boolean` column types |
| T011      | `drizzle-orm` | `db.transaction()` for TX management; `eq`, `ilike`, `and`, `count` for queries           |
| T014      | `zod`         | `z.object`, `z.string`, `z.enum`, `z.number().int().positive()`, `z.optional`             |
| T016–T026 | `hono`        | `Context`, `Hono`, `c.req.param()`, `c.json()`, `c.req.json()`                            |

---

## High-Downstream-Impact Tasks

| Task ID | Module                               | Impact | Description                                              |
| ------- | ------------------------------------ | ------ | -------------------------------------------------------- |
| T001    | `packages/domain-core/src/workflow/` | HIGH   | Adds DRAFT state to shared engine used by 7 entity types |
| T002    | `packages/domain-core/src/workflow/` | HIGH   | Registers new entity in ENTITY_TABLE_MAP                 |
| T027    | `apps/api/src/app.ts`                | MEDIUM | Modifies application entry point to mount new router     |

All other tasks create new files — zero blast radius on existing modules.

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                                |
| -------------------------------------------- | ------ | -------------------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | T011 service TX boundaries cover all 5 write operations              |
| Idempotency tasks are defined where required | ✅     | T003 (migration), T007 (boot registry), T011 (link)                  |
| Layer boundary rules are respected           | ✅     | UI→DB violation absent; domain package has no HTTP imports           |
| No unrelated file modifications planned      | ✅     | Only workflow engine constants, schemas/index, app.ts mount (scoped) |
| Migration tasks included when required       | ✅     | T003 (migration), T007 (boot registry), both present                 |
| Tenant isolation enforced per task           | ✅     | T010 repository uses tenant DB only; T033 isolation test verifies    |
| License middleware applied                   | ✅     | T016 helpers + T026 router enforce middleware chain                  |
| Server-authoritative timestamps              | ✅     | T011 service sets `created_at`/`updated_at` server-side              |
| Structured logging with required fields      | ✅     | T016 helpers include `correlation_id`, `workspace_id`, `actor_id`    |

**Overall:** COMPLIANT

---

## Open Risks

1. **Workflow engine additive change (T001):** `DRAFT` is prepended to `WORKFLOW_STATE_ORDER`. This changes the index position of all existing states. Verify that no engine code uses hardcoded index positions — `WORKFLOW_STATE_ORDER.indexOf()` comparisons must continue to work correctly. All existing entities start at `COMPLETED` (index was 0; after T001 it will be 1). Review usages in `workflow.engine.ts` before implementing T001.

2. **information_schema guard (T010):** The `checkExamConfigReference` and `checkAutoSelectionReference` functions use AD-004's `information_schema.tables` check to soft-fail when target tables don't exist. Verify that this pattern is correctly imported from the tags repository precedent to ensure exact SQL match.

3. **app.ts mount ordering (T027):** Ensure `basketsRouter` is mounted after authentication middleware and before any catch-all handlers. Follow the exact `tagsRouter` mount pattern.

---

## Next Step

Proceed to Step 5 — Analyze (Drift Detector).
