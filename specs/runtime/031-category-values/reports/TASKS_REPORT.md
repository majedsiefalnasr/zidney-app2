# Tasks Report — Category Values

**Step:** 4 — Tasks  
**Timestamp:** 2026-03-22T14:40:00.000Z  
**Status:** COMPLETE

---

## Summary

25 atomic tasks generated across 9 phases for the Category Values feature. Covers the full vertical slice: database migration, Drizzle ORM schema, domain-core module (types + errors + repository + service + dependency registry), Zod validation schemas, Hono handler layer, router factory with write guard, backoffice route registration, unit tests, and integration tests.

Tasks follow the domain-core DDD pattern established by Stage 030 (Categories, PRODUCTION READY). The router uses `requireAnyPermission(['question_manage', 'classification_manage'])` on mutating routes and gates `include_deleted=true` behind `classification_manage` in the service layer.

---

## Inputs Reviewed

- `specs/runtime/031-category-values/spec.md`
- `specs/runtime/031-category-values/plan.md`
- `specs/runtime/031-category-values/data-model.md`
- `specs/runtime/031-category-values/contracts/api-contracts.md`
- `specs/runtime/031-category-values/research.md`

---

## Task Breakdown

| Phase                           | Tasks         | Notes                                                                            |
| ------------------------------- | ------------- | -------------------------------------------------------------------------------- |
| Phase 0 — DB Migration          | T001 (1)      | Forward-only; schema_version → 1.15.0; CONCURRENTLY index outside TX             |
| Phase 1 — Drizzle Schema        | T002–T005 (4) | 3 new table schemas + barrel update; T002/T003/T004 [P]                          |
| Phase 2 — Error Catalog         | T006–T007 (2) | Types file + error codes + HTTP status map                                       |
| Phase 3 — Repository            | T008 (1)      | 22 pure SQL functions; all parameterized; no transactions                        |
| Phase 4 — Service               | T009–T012 (4) | Dependency registry + service (6 fns) + module barrel + index.ts                 |
| Phase 5 — Validation Schemas    | T013 (1)      | 5 Zod schemas (list/create/get/update/delete)                                    |
| Phase 6 — Handler Layer         | T014–T019 (6) | Helpers + 5 handlers; T015–T019 [P]                                              |
| Phase 7 — Router + Registration | T020–T021 (2) | Router factory with writeGuard + backoffice barrel mount                         |
| Phase 8 — Unit Tests            | T022–T023 (2) | Service tests (37+ cases) + Repository tests (5 SQL shape checks); T022/T023 [P] |
| Phase 9 — Integration Tests     | T024 (1)      | 5 endpoints + multi-tenant isolation (35+ scenarios)                             |
| **Total**                       | **25**        |                                                                                  |

---

## Parallel Task Groups

| Group ID | Tasks                        | Parallelizable Condition                                                           |
| -------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| G1       | T002, T003, T004             | All 3 Drizzle schemas are independent of each other                                |
| G2       | T015, T016, T017, T018, T019 | All 5 handlers are independent of each other (all depend on T014 being done first) |
| G3       | T022, T023                   | Service tests and repository tests are independent                                 |

---

## Transactional Tasks

- **T010** — `createCategoryValue`: TX wraps INSERT category_value + upsert translations + insert scope rows; PG 23505 caught and re-raised as `CATEGORY_VALUE_CODE_DUPLICATE`
- **T010** — `updateCategoryValue`: TX wraps SELECT FOR UPDATE NOWAIT + UPDATE + upsert translations + full-replace scope; PG 55P03 caught as `CATEGORY_VALUE_LOCK_CONFLICT`
- **T010** — `deleteCategoryValue`: TX wraps SELECT FOR UPDATE NOWAIT + dependency check + soft-delete; idempotent (already-deleted → `{ deleted: true }` early return outside TX)

---

## Idempotency Tasks

- **T010** — `deleteCategoryValue`: already-soft-deleted record → early return `{ deleted: true }` (200 OK); no error raised
- **T001** — Migration DDL uses `CREATE TABLE IF NOT EXISTS` and `IF NOT EXISTS` guards on all constraints and indexes
- **T008** — `upsertTranslations`: `ON CONFLICT translations_composite_unique DO UPDATE` ensures idempotent translation writes

---

## Risk-Ranked Task Summary

| Task ID   | Risk      | Description                                                                                           |
| --------- | --------- | ----------------------------------------------------------------------------------------------------- |
| T001      | 🔴 HIGH   | Forward-only tenant DB migration (schema_version 1.15.0)                                              |
| T008      | 🔴 HIGH   | Repository with FOR UPDATE NOWAIT + PG 55P03 catch paths                                              |
| T010      | 🔴 HIGH   | Service layer — full transaction discipline; status transitions; scope validation; dependency fan-out |
| T024      | 🔴 HIGH   | Integration tests including multi-tenant isolation                                                    |
| T020      | 🟡 MEDIUM | Router with writeGuard (permission-gated mutating routes)                                             |
| T021      | 🟡 MEDIUM | Backoffice barrel update (modifies shared route registration)                                         |
| T009      | 🟡 MEDIUM | Dependency registry — downstream stages (MCQ/TQ) push check functions at startup                      |
| T013      | 🟡 MEDIUM | Zod schemas with at-least-one-field refinement on update body                                         |
| T022      | 🟡 MEDIUM | Unit tests with 37+ service coverage cases including concurrency scenarios                            |
| T002–T004 | 🟢 LOW    | Drizzle ORM schema definitions (declarative, no runtime side-effects)                                 |
| T005      | 🟢 LOW    | Schema barrel update                                                                                  |
| T006      | 🟢 LOW    | TypeScript types file                                                                                 |
| T007      | 🟢 LOW    | Error catalog — union type + class definition                                                         |
| T011      | 🟢 LOW    | Module barrel                                                                                         |
| T012      | 🟢 LOW    | Package index update                                                                                  |
| T014      | 🟢 LOW    | Handler utilities                                                                                     |
| T015–T019 | 🟢 LOW    | Individual handler files (thin delegation layer)                                                      |
| T023      | 🟢 LOW    | Repository unit tests (SQL shape verification)                                                        |

---

## Tasks with External Dependencies

| Task ID   | Packages                              | Version Note                                                                              |
| --------- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| T001      | `postgres` (raw SQL migration runner) | Uses `BEGIN/COMMIT`; CONCURRENTLY index must be outside transaction block                 |
| T002–T004 | `drizzle-orm`                         | `pgTable`, `uuid`, `varchar`, `timestamp`, `foreignKey`, `unique` — verified against plan |
| T008      | `drizzle-orm`                         | Uses `db.execute(sql)` for raw parameterized SQL functions; no ORM query builder reliance |
| T010      | `drizzle-orm`                         | `db.transaction()` for TX blocks                                                          |
| T013      | `zod`                                 | `z.string().uuid()`, `z.coerce.number()`, `z.boolean()` — standard patterns               |

---

## High-Downstream-Impact Tasks

These tasks modify architectural hotspots:

| Task ID | Module                                      | Impact Area         | Description                                                                                                      |
| ------- | ------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| T009    | `packages/domain-core/src/category-values/` | Dependency Registry | Registers `categoryValueDependencyRegistry` — downstream MCQ/TQ stages must push check functions here at startup |
| T012    | `packages/domain-core/src/index.ts`         | Package root barrel | Adding `category-values` export — affects all consumers of domain-core                                           |
| T021    | `apps/api/src/routes/backoffice/index.ts`   | Shared route barrel | Mounting new router — any misconfigured import breaks all backoffice routes                                      |

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                                                |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| All write paths include transaction tasks    | ✅     | T010 covers create/update/delete with explicit TX discipline                         |
| Idempotency tasks are defined where required | ✅     | Delete idempotency (T010); migration IF NOT EXISTS (T001); translation upsert (T008) |
| Layer boundary rules are respected           | ✅     | UI → domain-core; API handlers → service; no direct DB in handlers                   |
| No unrelated file modifications planned      | ✅     | Only category-values module files + 2 shared barrels (T005, T012, T021)              |
| Migration tasks included when required       | ✅     | T001 — forward-only migration targeting schema_version 1.15.0                        |
| Tenant isolation preserved                   | ✅     | All queries use `db` passed from tenant pool; no global singleton                    |
| Permission guard on mutating routes          | ✅     | T020 applies `writeGuard = requireAnyPermission([...])` on POST/PATCH/DELETE         |
| Structured logging with correlation ID       | ✅     | T014 — `buildAuditCtx(c)` propagates correlation_id to all handlers                  |

**Overall:** COMPLIANT

---

## Open Risks

- **T009 — Dependency Registry**: The registry starts empty. Downstream stages (MCQ, TQ) must push their check functions during app startup. If a downstream stage is implemented without registering, `CATEGORY_VALUE_IN_USE` will never trigger. Risk is acceptable: the feature works correctly in isolation; downstream enforcement is a cross-stage responsibility.
- **T001 — Migration timestamp**: Migration file name uses `20260322` date prefix. If another migration is merged between PR creation and merge, the numerical ordering may need to be adjusted. Forward-only constraint prevents retroactive fixes — ensure sequential ordering at merge time.

---

## Next Step

Proceed to Step 5 — Analyze.
