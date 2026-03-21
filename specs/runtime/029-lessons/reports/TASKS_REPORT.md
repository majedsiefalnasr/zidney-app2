# Tasks Report — STAGE_29_LESSONS

**Step:** 4 — Tasks  
**Timestamp:** 2026-03-21T00:40:00.000Z  
**Status:** COMPLETE

---

## Summary

26 atomic tasks generated across 10 phases (A–J) for the Lessons domain. Task order mirrors the STAGE_28_SUBJECTS pattern exactly — domain-first (types → errors → dependency-registry → repository → service), then validation, then route handlers, then router assembly, then tests. Plan corrections applied: `packages/domain-core/package.json` subpath export and `apps/api/src/app.ts` registration confirmed as the correct modified files (plan.md updated). Total tasks: 26.

---

## Inputs Reviewed

- `specs/runtime/029-lessons/spec.md` (with 10 clarifications + 8 guardian remediation fixes)
- `specs/runtime/029-lessons/plan.md` (2 file path corrections applied)
- `specs/runtime/029-lessons/data-model.md`

---

## Task Breakdown

| Category       | Count  | Notes                                                                             |
| -------------- | ------ | --------------------------------------------------------------------------------- |
| Infrastructure | 2      | T001 (migration), T012 (package.json subpath + barrel)                            |
| Domain Core    | 9      | T002–T005 (types/errors/registry/repository), T006–T011 (service functions)       |
| API            | 10     | T013 (schemas), T014 (helpers), T015–T020 (handlers), T022–T023 (router + app.ts) |
| Dependency Reg | 1      | T021 (subjects.dependency-registry.ts countLessonsForSubject)                     |
| Testing        | 2      | T024 (unit), T025 (integration)                                                   |
| Validation     | 1      | T026 (full validation gate)                                                       |
| Worker         | 0      | Not applicable — no async jobs in this stage                                      |
| Frontend       | 0      | Not applicable — API-only stage                                                   |
| **Total**      | **26** |                                                                                   |

---

## Parallel Task Groups

### Group 1 — Phase B (Domain Core Types)

T002, T003, T004 can execute concurrently; all are independent type-definition files.

### Group 2 — Phase G (Route Handlers)

T015, T016, T017, T018, T019, T020 can execute concurrently; each handler is an independent module. Helpers (T014) must complete first.

---

## Transactional Tasks

| Task | Operation     | Transaction Boundary                                 |
| ---- | ------------- | ---------------------------------------------------- |
| T007 | createLesson  | Service-managed `BEGIN / COMMIT / ROLLBACK`          |
| T010 | updateLesson  | Service-managed `BEGIN / COMMIT / ROLLBACK`          |
| T011 | deleteLesson  | Service-managed `BEGIN / COMMIT / ROLLBACK`          |
| T001 | Migration DDL | Migration runner-managed `BEGIN / COMMIT / ROLLBACK` |

All read operations (T006, T008, T009) are transactionless. Repository functions never open transactions.

---

## Idempotency Tasks

| Task | Mechanism                                                        |
| ---- | ---------------------------------------------------------------- |
| T001 | Migration DDL uses `IF NOT EXISTS` guards — idempotent on re-run |
| T005 | `lessonNameExistsInSubject` pre-check + `23505` PG error catch   |
| T007 | Duplicate POST → 409 `LESSON_NAME_DUPLICATE` (no corrupt state)  |
| T010 | Duplicate PATCH name → 409; redundant status → 422               |
| T011 | Duplicate DELETE → 422 `LESSON_ALREADY_DISABLED`                 |

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                                       |
| -------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | T007, T010, T011 each have service-layer `BEGIN / COMMIT / ROLLBACK`        |
| Idempotency tasks are defined where required | ✅     | Migration (T001), createLesson (T007), updateLesson (T010), delete (T011)   |
| Layer boundary rules are respected           | ✅     | Domain package has zero HTTP/Hono imports; handlers never open transactions |
| No unrelated file modifications planned      | ✅     | Only 3 existing files modified (package.json, subjects registry, app.ts)    |
| Migration tasks included when required       | ✅     | T001 — forward-only migration, version 1.12.0→1.13.0, ADR-0008 compliant    |
| No direct DB instantiation                   | ✅     | All DB access via `c.get('tenant').pool` through `getDb()` helper           |
| Server-authoritative time                    | ✅     | `created_at`/`updated_at` set by DB `DEFAULT NOW()`, never client-supplied  |
| No cross-tenant data                         | ✅     | All queries scoped to tenant pool from request context                      |

**Overall:** COMPLIANT

---

## Risk-Ranked Task Summary

| Task ID | Risk      | Description                                                                     |
| ------- | --------- | ------------------------------------------------------------------------------- |
| T001    | 🔴 HIGH   | Add `lessons` table migration (schema change, 3 FKs, 3 indexes, version bump)   |
| T010    | 🔴 HIGH   | updateLesson service (multi-path transaction, DISABLED guard, 23505 catch)      |
| T007    | 🔴 HIGH   | createLesson service (transaction, subject FK validation, race condition guard) |
| T021    | 🔴 HIGH   | Modify subjects.dependency-registry.ts (cross-domain registration)              |
| T005    | 🟡 MEDIUM | Repository layer (8 query functions including dynamic WHERE + ILIKE)            |
| T011    | 🟡 MEDIUM | deleteLesson service (transaction, state machine guard, soft-delete)            |
| T013    | 🟡 MEDIUM | Validation schemas (5 schemas, activeLessonsQuerySchema required subject_id)    |
| T017    | 🟡 MEDIUM | get-active-lessons handler (required subject_id, license-only auth, flat array) |
| T022    | 🟡 MEDIUM | Lessons router (route registration order — /runtime before /:id)                |
| T023    | 🟡 MEDIUM | Mount lessonsRouter in app.ts (modifies top-level API app file)                 |
| T024    | 🟡 MEDIUM | Unit tests (15 cases including Q7 scenario and 23505 race guard)                |
| T025    | 🟡 MEDIUM | Integration tests (tenant isolation, 7 routes, schema version enforcement)      |
| T002    | 🟢 LOW    | lessons.types.ts — type declarations only                                       |
| T003    | 🟢 LOW    | lessons.errors.ts — error definitions only                                      |
| T004    | 🟢 LOW    | lessons.dependency-registry.ts — stub, always returns 0                         |
| T006    | 🟢 LOW    | listLessons service — read-only, concurrent count + find                        |
| T008    | 🟢 LOW    | getLesson service — read-only, single findById                                  |
| T009    | 🟢 LOW    | getActiveLessons service — read-only, subjectExists guard + flat query          |
| T012    | 🟢 LOW    | Barrel export (lessons/index.ts + package.json subpath)                         |
| T014    | 🟢 LOW    | Route helpers — utility functions only                                          |
| T015    | 🟢 LOW    | list-lessons handler — standard list handler                                    |
| T016    | 🟢 LOW    | create-lesson handler — standard create handler                                 |
| T018    | 🟢 LOW    | get-lesson handler — standard single-resource handler                           |
| T019    | 🟢 LOW    | update-lesson handler — delegates all logic to service                          |
| T020    | 🟢 LOW    | delete-lesson handler — soft-delete handler                                     |
| T026    | 🟢 LOW    | Validation gate — no new files                                                  |

---

## Tasks with External Dependencies

| Task ID | Package          | Version Note                                                                         |
| ------- | ---------------- | ------------------------------------------------------------------------------------ |
| T001    | pg PoolClient    | Uses `client.query()` with `BEGIN/COMMIT/ROLLBACK` — consistent with 006 migration   |
| T005    | pg               | Repository uses `db.query<T>()` — `DbClient` interface, not Drizzle ORM              |
| T007    | zod              | `createLessonBodySchema.parseAsync()` — Zod v3.x async parse                         |
| T013    | zod              | 5 schemas using `.transform()`, `.pipe()`, `.refine()`, `.optional()`, `.nullable()` |
| T024    | vitest           | Unit tests use `vi.fn()` mock for DbClient                                           |
| T025    | hono test client | Integration tests use Hono `testClient` or supertest pattern                         |

---

## High-Downstream-Impact Tasks

These tasks modify architectural hotspots — extra review attention recommended.

| Task ID | Module                                                              | Impact | Description                                                                         |
| ------- | ------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| T001    | Tenant DB schema                                                    | HIGH   | New `lessons` table added to all tenant DBs on migration run                        |
| T021    | `packages/domain-core/src/subjects/subjects.dependency-registry.ts` | HIGH   | Cross-domain mutation — subject deletion now also blocked by lesson count > 0       |
| T023    | `apps/api/src/app.ts`                                               | HIGH   | Top-level API app modified; incorrect route mounting = 404 for all lesson endpoints |

---

## Open Risks

1. **Route registration order** — `/lessons/runtime` MUST be declared before `/lessons/:id` in the Hono router (T022). Reversal would cause `/runtime` to be matched as `:id = "runtime"`, producing spurious 422 VALIDATION_ERROR on valid UUID check.
2. **activeLessonsQuerySchema vs listLessonsQuerySchema** — The `GET /lessons/runtime` handler (T017) MUST use `activeLessonsQuerySchema` (subject_id **required**), not `listLessonsQuerySchema` (subject_id optional). Using the wrong schema skips the 422 gate and allows a 404 path that bypasses input validation intent.
3. **subjects.dependency-registry.ts modification** (T021) — countLessonsForSubject must use `$1::uuid` cast to avoid implicit type coercion failures on subject_id comparison. Verify this mirrors the pattern in subjects.repository.ts.
4. **Migration 007 ordering** — `lessons_subject_id_fkey` DDL (Step 2 in migration) requires `subjects` table to already exist. If migrations run on a fresh tenant DB without 006, migration 007 will fail at the FK step. The expected safe execution path is always 001→007 in sequence.

---

## Next Step

Proceed to Step 5 — Analyze.
