# Tasks Report — STAGE_28 Subjects

**Step:** 4 — Tasks
**Timestamp:** 2026-03-20T00:45:00.000Z
**Status:** COMPLETE

---

## Summary

27 atomic tasks generated across 10 sequential phases (A–J) covering: tenant DB migration, Drizzle
schema, domain package (types + errors + repository + service functions), Zod validation schemas,
7 route handlers, router assembly, app registration, unit tests, integration tests, and final
validation gate. Parallel execution groups are declared for Phase B (domain core types) and Phase G
(route handlers). All transactional boundaries, idempotency guards, and state machine rules are
represented as explicit tasks.

---

## Inputs Reviewed

- `specs/runtime/028-subjects/spec.md`
- `specs/runtime/028-subjects/plan.md`
- `specs/runtime/028-subjects/data-model.md`
- `specs/runtime/028-subjects/checklists/requirements.md`
- `specs/runtime/028-subjects/checklists/security.md`
- `specs/runtime/028-subjects/checklists/performance.md`

---

## Task Breakdown

| Category            | Tasks  | IDs       | Notes                                                                       |
| ------------------- | ------ | --------- | --------------------------------------------------------------------------- |
| Migration           | 1      | T001      | Forward-only, single BEGIN/COMMIT, schema_version 1.11.0→1.12.0             |
| Drizzle Schema      | 1      | T002      | Partial/functional indexes stay migration-owned; 6 non-partial in schema    |
| Domain Types        | 1      | T003      | 8 exported interfaces + SubjectStatus union                                 |
| Domain Errors       | 1      | T004      | 11 error codes, HTTP status map, SubjectsError class                        |
| Dependency Registry | 1      | T005      | Empty at launch; downstream stages append additively                        |
| Repository          | 1      | T006      | 10 query functions; no transactions (service-managed)                       |
| Service Layer       | 7      | T007–T013 | 6 service functions + barrel index                                          |
| Validation Schemas  | 1      | T014      | 5 Zod schemas; whitespace-only name guard; at-least-one-field refine        |
| Route Helpers       | 1      | T015      | `getDb`, `buildAuditCtx`, `successResponse`, `subjectsErrorResponse`        |
| Route Handlers      | 7      | T016–T022 | 7 handlers (parallel group); GET /subjects/runtime before GET /subjects/:id |
| Router & App        | 2      | T023–T024 | Router assembly + app.ts registration                                       |
| Tests               | 2      | T025–T026 | Unit (13 cases) + integration (26 scenarios)                                |
| Validation Gate     | 1      | T027      | biome + tsc + migration idempotency + test run                              |
| **Total**           | **27** |           |                                                                             |

---

## Parallel Execution Groups

### Group B — Domain Core Types (T003, T004, T005)

All three files are mutually independent. They may be implemented concurrently. T006 (repository)
depends on all three being complete before starting.

### Group G — Route Handlers (T016–T022)

All seven handler files are independent modules. They may be implemented concurrently. T023 (router
index) depends on all seven being complete before starting.

---

## Transactional Tasks

The following service tasks open and manage database transactions directly:

| Task | Function                  | Transaction Boundary                                                                                 |
| ---- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| T008 | `createSubject`           | BEGIN → FK validation → uniqueness checks → insertSubject → COMMIT                                   |
| T010 | `updateSubject`           | BEGIN → lockForUpdate → SUBJECT_ARCHIVED guard → name/code/FK validation → updateSubjectRow → COMMIT |
| T011 | `transitionSubjectStatus` | BEGIN → lockForUpdate → state machine check → CAS update → rowCount=0→409 → COMMIT                   |
| T012 | `deleteSubject`           | BEGIN → lockForUpdate → dependency registry check → softDeleteSubject → COMMIT                       |

Read-only functions (`listSubjects`, `getSubjectById`) do not open transactions.

---

## Idempotency Tasks

| Task | Mechanism                                                                                                                          |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| T001 | `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` — migration is safe to re-run                                           |
| T006 | `insertSubject` returns existing row shape; uniqueness is enforced by DB index, not application retry                              |
| T011 | CAS pattern: `UPDATE ... WHERE id = $id AND status = $expected` — zero rows = 409, no double-apply                                 |
| T012 | `softDeleteSubject` sets `deleted_at = NOW()` only when `deleted_at IS NULL` (idempotent re-delete returns 404 from lockForUpdate) |
| T027 | Migration idempotency verified by applying twice against a clean test DB                                                           |

---

## Risk-Ranked Task Summary

| Task ID | Risk      | Description                                                                     |
| ------- | --------- | ------------------------------------------------------------------------------- |
| T001    | 🔴 HIGH   | Tenant DB migration — creates subjects table, 9 indexes, schema_version bump    |
| T002    | 🔴 HIGH   | Drizzle schema — authoritative ORM type source for all downstream usage         |
| T003    | 🟡 MEDIUM | Domain types — foundational; incorrect types cascade to all layers              |
| T004    | 🟡 MEDIUM | Error definitions — incorrect HTTP codes produce non-compliant API              |
| T005    | 🟢 LOW    | Dependency registry — starts empty; low risk                                    |
| T006    | 🔴 HIGH   | Repository layer — raw SQL; incorrect queries cause data corruption             |
| T007    | 🟡 MEDIUM | Service: listSubjects — pagination, filter SQL                                  |
| T008    | 🔴 HIGH   | Service: createSubject — transaction, FK validation, business rules             |
| T009    | 🟢 LOW    | Service: getSubjectById — simple read, low risk                                 |
| T010    | 🔴 HIGH   | Service: updateSubject — transaction, SUBJECT_ARCHIVED guard, FK validation     |
| T011    | 🔴 HIGH   | Service: transitionSubjectStatus — state machine, CAS, concurrent conflict      |
| T012    | 🔴 HIGH   | Service: deleteSubject — dependency registry, soft-delete transaction           |
| T013    | 🟢 LOW    | Domain barrel index — re-export only                                            |
| T014    | 🟡 MEDIUM | Zod schemas — incorrect shapes cascade to handler layer                         |
| T015    | 🟡 MEDIUM | Route helpers — error mapping; incorrect mapping returns wrong HTTP status      |
| T016    | 🟡 MEDIUM | Handler: listSubjects — pagination query forwarding                             |
| T017    | 🟡 MEDIUM | Handler: createSubject — body parsing, 201 response                             |
| T018    | 🟡 MEDIUM | Handler: getActiveSubjects — runtime ACTIVE-only endpoint                       |
| T019    | 🟢 LOW    | Handler: getSubject — simple read handler                                       |
| T020    | 🟡 MEDIUM | Handler: updateSubject — body parsing, PATCH semantics                          |
| T021    | 🟡 MEDIUM | Handler: transitionSubject — state transition endpoint                          |
| T022    | 🟡 MEDIUM | Handler: deleteSubject — soft-delete endpoint                                   |
| T023    | 🔴 HIGH   | Router assembly — GET /subjects/runtime must precede GET /subjects/:id          |
| T024    | 🟡 MEDIUM | App registration — adds subjects to backoffice workspace router                 |
| T025    | 🟡 MEDIUM | Unit tests — 13 cases; state machine + CAS + SUBJECT_ARCHIVED coverage required |
| T026    | 🟡 MEDIUM | Integration tests — 26 scenarios; cross-tenant isolation required               |
| T027    | 🔴 HIGH   | Final validation gate — all checks must exit 0 before implementation complete   |

---

## Tasks with External Dependencies

| Task ID | Package         | Version Note                                                               |
| ------- | --------------- | -------------------------------------------------------------------------- |
| T002    | drizzle-orm     | `pgTable`, `uuid`, `varchar`, `boolean`, `text`, `timestamp`, `index` used |
| T006    | pg (PoolClient) | `SELECT ... FOR UPDATE NOWAIT` — pg lock conflict error code `55P03`       |
| T014    | zod             | `z.enum`, `.refine()`, `.transform()`, `.omit()` used in schemas           |
| T025    | vitest          | Test runner; mock `DbClient` pattern                                       |
| T026    | vitest + HTTP   | Integration test HTTP client from `tests/http-client.ts`                   |

---

## High-Downstream-Impact Tasks

These tasks modify architectural hotspots — extra review attention recommended.

| Task ID | Module                             | Risk | Description                                                        |
| ------- | ---------------------------------- | ---- | ------------------------------------------------------------------ |
| T001    | apps/api/src/db/tenant/migrations/ | HIGH | New migration in forward-only sequence; must follow 005_semesters  |
| T002    | apps/api/src/db/tenant/schemas/    | HIGH | Drizzle schema; type inference propagates to all downstream stages |
| T023    | apps/api/src/routes/backoffice/    | HIGH | Route order critical: runtime before param (Hono path matching)    |
| T024    | apps/api/src/app.ts                | HIGH | Core app entrypoint; incorrect import breaks server boot           |

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                      |
| -------------------------------------------- | ------ | ---------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | T008, T010, T011, T012 all use BEGIN/COMMIT/ROLLBACK       |
| Idempotency tasks are defined where required | ✅     | T001 (IF NOT EXISTS), T011 (CAS), T012 (deleted_at guard)  |
| Layer boundary rules are respected           | ✅     | No apps→apps imports; packages use only other packages     |
| No unrelated file modifications planned      | ✅     | Only subjects-scoped files + app.ts registration           |
| Migration tasks included when required       | ✅     | T001 is the sole migration; forward-only, no rollback      |
| Soft delete only (no hard delete)            | ✅     | T012 sets deleted_at; no DROP or DELETE rows anywhere      |
| Server-authoritative time only               | ✅     | `created_at`, `updated_at`, `deleted_at` via `NOW()` in DB |
| Structured logging with correlation ID       | ✅     | All handlers (T016–T022) include structured log emission   |

**Overall:** COMPLIANT

---

## State Machine Coverage

The custom DRAFT→ACTIVE→ARCHIVED state machine (inline, not global WorkflowEngine) is fully covered:

| Transition           | Valid | Covered By                                                |
| -------------------- | ----- | --------------------------------------------------------- |
| DRAFT → ACTIVE       | ✓     | T011 (service), T025 (unit test), T026 (integration test) |
| ACTIVE → ARCHIVED    | ✓     | T011, T025, T026                                          |
| DRAFT → ARCHIVED     | ✗     | T011 (INVALID_TRANSITION), T025, T026                     |
| ACTIVE → DRAFT       | ✗     | T011 (INVALID_TRANSITION), T025, T026                     |
| ARCHIVED → anything  | ✗     | T011 (INVALID_TRANSITION — terminal), T025, T026          |
| Any → (CAS conflict) | —     | T011 (TRANSITION_CONFLICT), T025, T026                    |

---

## Open Risks

- **Divisions disabled setting**: `createSubject` must check workspace settings to auto-assign the
  default division. This requires the workspace settings pattern to be confirmed at implementation
  time. If the settings key or default division ID accessor differs from the pattern used in
  divisions/semesters stages, T008 will need adjustment. Risk: LOW (settings pattern is established).

- **Semester-division FK validation**: The service must verify that `semester_id.division_id =
subject.division_id` at create/update. This requires a cross-table query inside the transaction.
  If `semesters` table lacks a `division_id` column, this logic needs adjustment. Confirmed from
  `semesters.schema.ts` that `division_id` is present on semesters. Risk: NONE.

- **GET /subjects/runtime path collision**: Hono will match `"runtime"` as the literal path segment
  before parameterized `:id` ONLY if `/subjects/runtime` is registered before `/subjects/:id`.
  T023 (router assembly) is the critical task. Risk: MITIGATED by task ordering in T023.

---

## Next Step

Proceed to Step 5 — Analyze (Drift Detector).
