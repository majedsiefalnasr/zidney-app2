# Tasks Report — STAGE_UI_03_ROUTER_AND_GUARDS

**Step:** 4 — Tasks **Timestamp:** 2026-03-02T00:00:00.000Z **Status:** COMPLETE

---

## Summary

63 atomic tasks generated across 14 phases covering the full router/guard implementation for MMC,
Backoffice, and Frontoffice. Tasks are dependency-ordered: RouteMeta foundation first, then guards,
then routers, then views, then migrations, then tests, then validation. 45 tasks are
parallel-eligible across per-app groups.

---

## Inputs Reviewed

- `specs/runtime/ui-03-router-and-guards/spec.md`
- `specs/runtime/ui-03-router-and-guards/plan.md`
- `specs/runtime/ui-03-router-and-guards/tasks.md`

---

## Task Breakdown

| Category               | Count  | Notes                                                                                     |
| ---------------------- | ------ | ----------------------------------------------------------------------------------------- |
| Infrastructure / Setup | 2      | T001–T002: dependency audit, type location decision                                       |
| RouteMeta Schema       | 3      | T003–T005: type definitions per app                                                       |
| Guard Implementation   | 13     | T006–T018: AuthGuard, WorkspaceGuard, RoleGuard, FeatureFlagGuard, registerGuards barrels |
| Router Factory         | 3      | T019–T021: createAppRouter() factory per app                                              |
| Fallback Views         | 9      | T022–T030: NotFoundView, UnauthorizedView, GlobalErrorView per app                        |
| Route Meta Migrations  | 5      | T031–T035: guestOnly→public, requiredRole→roles[], requiredModule removal                 |
| STAGE_17 Migration     | 4      | T036–T039: Backoffice license guard removal, contextStore relocation                      |
| Singleton Removal      | 6      | T040–T045: singleton export removal + main.ts updates                                     |
| Unit Tests             | 10     | T046–T055: guard tests per app                                                            |
| Integration Tests      | 3      | T056–T058: router factory integration tests                                               |
| Validation             | 5      | T059–T063: tsc, lint, grep assertions                                                     |
| **Total**              | **63** |                                                                                           |

**Parallel tasks: 45** | **Sequential tasks: 18**

---

## Transactional Tasks

N/A — This is a frontend-only stage with no write operations or database interactions.

---

## Idempotency Tasks

N/A — Navigation guards are pure functions with no side effects requiring idempotency.

---

## Constitutional Compliance

| Check                                             | Status | Notes                                                                                          |
| ------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| All write paths include transaction tasks         | ✅     | N/A — no write operations                                                                      |
| Idempotency tasks are defined where required      | ✅     | N/A — guards are stateless                                                                     |
| Layer boundary rules are respected                | ✅     | No cross-app imports; guards use injected callbacks only                                       |
| No unrelated file modifications planned           | ✅     | All 63 tasks target stage-scoped files only                                                    |
| Migration tasks included when required            | ✅     | STAGE_17 migration (T036–T039), RouteMeta migration (T031–T035), singleton removal (T040–T045) |
| Test tasks included for all guard implementations | ✅     | T046–T058: unit + integration tests for all guards                                             |
| Validation gate tasks present                     | ✅     | T059–T063: tsc, lint, grep                                                                     |
