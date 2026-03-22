# Tasks Report — Categories (Classification Dimensions)

**Step:** 4 — Tasks
**Timestamp:** 2026-03-22T00:04:00.000Z
**Status:** COMPLETE
**Tasks Total:** 35

---

## Summary

35 atomic, dependency-ordered tasks generated across 9 phases. 17 tasks marked with `[P]` for parallel execution. All tasks traceable to spec user stories (US-01 → US-07) or foundational setup.

---

## Phase Breakdown

| Phase                 | Task Range | Tasks | Description                                                                        |
| --------------------- | ---------- | ----- | ---------------------------------------------------------------------------------- |
| 1 — Foundation        | T001–T003  | 3     | Module registration, arch setup, prerequisite verification                         |
| 2 — Migration         | T004       | 1     | Tenant DB migration 008 (two-phase: DDL + CONCURRENT indexes)                      |
| 3 — Drizzle Schema    | T005–T006  | 2     | 3 tables, inferred types, barrel export                                            |
| 4 — Domain Package    | T007–T018  | 12    | Types, errors, repository, service (6 functions), tree, dependency-registry, index |
| 5 — Validation        | T019–T020  | 2     | 5 Zod schemas in packages/validation                                               |
| 6 — API Routes        | T021–T028  | 8     | Helpers + 6 handlers + router factory                                              |
| 7 — Tests             | T029–T030  | 2     | Unit (31 cases) + Integration (22 cases)                                           |
| 8 — Registration      | T031       | 1     | Mount categoriesRouter in apps/api/src/app.ts                                      |
| 9 — Seed + Validation | T032–T035  | 4     | classification_manage seed, ai-guard, infra-audit, lint/typecheck                  |

---

## Risk-Ranked Task Summary

| Task ID | Risk      | Description                                                                       |
| ------- | --------- | --------------------------------------------------------------------------------- |
| T004    | 🔴 HIGH   | Tenant DB migration 008: categories, category_subjects, category_divisions tables |
| T007    | 🟡 MEDIUM | categories.types.ts — core TypeScript interfaces                                  |
| T008    | 🟡 MEDIUM | categories.errors.ts — 13 domain error codes                                      |
| T009    | 🟡 MEDIUM | categories.repository.ts — pure SQL functions with SELECT FOR UPDATE              |
| T010    | 🔴 HIGH   | categories.service.ts createCategory — transactions + circular ref detection      |
| T011    | 🔴 HIGH   | categories.service.ts updateCategory — SELECT FOR UPDATE locking                  |
| T012    | 🔴 HIGH   | categories.service.ts deleteCategory — ENABLED children guard                     |
| T013    | 🟡 MEDIUM | categories.service.ts listCategories + getCategory                                |
| T015    | 🟡 MEDIUM | categories.tree.ts — flat bulk SELECT + in-memory O(N) assembly                   |
| T021    | 🔴 HIGH   | create-category.ts handler — write with tenant isolation + RBAC                   |
| T022    | 🔴 HIGH   | update-category.ts handler — write with SELECT FOR UPDATE locking                 |
| T023    | 🔴 HIGH   | delete-category.ts handler — soft-delete with children guard                      |
| T028    | 🔴 HIGH   | Router factory — middleware stack + static-before-parameterized route order       |
| T029    | 🟡 MEDIUM | Unit tests — 31 cases for CategoryService                                         |
| T030    | 🔴 HIGH   | Integration tests — 22 cases with multi-tenant isolation + RBAC assertions        |
| T031    | 🟡 MEDIUM | Router registration in apps/api/src/app.ts                                        |
| T032    | 🟡 MEDIUM | Seed classification_manage permission                                             |

---

## Tasks with External Dependencies

| Task ID   | Package     | Version Note                                                                       |
| --------- | ----------- | ---------------------------------------------------------------------------------- |
| T004      | pg          | Uses `client.query()` for DDL + CONCURRENT index outside transaction               |
| T009      | pg          | Uses `SELECT FOR UPDATE` pattern with pg client                                    |
| T005–T006 | drizzle-orm | Schema definition with `pgTable`, `uuid`, `varchar`, `text`, `timestamp`, `pgEnum` |
| T019–T020 | zod         | Schemas with `.refine()`, `.transform()`, `z.literal('null')` discriminator        |

---

## High-Downstream-Impact Tasks

| Task ID | Module                               | Description                                                     |
| ------- | ------------------------------------ | --------------------------------------------------------------- |
| T004    | apps/api/src/db/tenant/migrations/   | Adds 3 tenant DB tables — affects all downstream content stages |
| T009    | packages/domain-core/src/categories/ | Repository patterns reused by category values (STAGE_31)        |
| T028    | apps/api/src/app.ts                  | Router registration touches global app routing                  |
| T031    | apps/api/src/routes/backoffice/      | Routing index modification                                      |

---

## Parallel Task Groups

| Group          | Task IDs               | Description                                                          |
| -------------- | ---------------------- | -------------------------------------------------------------------- |
| Schema files   | T005, T006             | Parallel Drizzle schema creation                                     |
| Domain shared  | T007, T008, T015, T016 | Types, errors, tree, dependency-registry (parallel, no dependencies) |
| Read handlers  | T024, T025, T026       | list, get-single, get-tree handlers (parallel)                       |
| Write handlers | T021, T022, T023       | create, update, delete handlers (parallel)                           |
| Tests          | T029, T030             | Unit and integration tests (parallel)                                |

---

## Next Step

Proceed to Step 5 — Analyze.
