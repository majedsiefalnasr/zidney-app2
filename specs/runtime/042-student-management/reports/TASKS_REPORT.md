# Tasks Report — STAGE_42_STUDENT_MANAGEMENT

**Stage**: STAGE_42_STUDENT_MANAGEMENT  
**Phase**: 03_BACKOFFICE_CORE / 05_USER_MANAGEMENT  
**Step**: 4 — Tasks  
**Generated**: 2026-04-06T00:00:00.000Z

---

## Summary

| Metric               | Value          |
| -------------------- | -------------- |
| Total Tasks          | 25             |
| Parallelizable Tasks | 2 (T009, T025) |
| User Stories         | 6 (US1–US6)    |
| Phases               | A–F (6 phases) |

---

## Task Breakdown by Phase

| Phase                                    | Purpose                                                 | Tasks     | Count |
| ---------------------------------------- | ------------------------------------------------------- | --------- | ----- |
| A — Database Layer                       | Migration + Drizzle schema update                       | T001–T002 | 2     |
| B — Domain-Core Module                   | Types, errors, repository, service, bulk-import, barrel | T003–T008 | 6     |
| B — Domain-Core Tests                    | Unit tests for service layer                            | T009      | 1     |
| C — Validation Schemas                   | Zod schemas + validation barrel update                  | T010–T011 | 2     |
| D — Backoffice API Routes                | Helpers, router, 9 handlers                             | T012–T022 | 11    |
| E — Auth Migration                       | Frontoffice login fix                                   | T023      | 1     |
| F — App Registration + Integration Tests | App.ts registration + integration test suite            | T024–T025 | 2     |

---

## Risk-Ranked Task Summary

| Task ID   | Risk      | Description                                                                                                                |
| --------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| T001      | 🔴 HIGH   | Database migration: add 7 columns + 2 CHECK constraints + 2 indexes to students table; bump schema version 1.27.0 → 1.28.0 |
| T002      | 🔴 HIGH   | Drizzle schema update: add 7 columns + constraints + indexes to students.schema.ts                                         |
| T023      | 🔴 HIGH   | Auth migration: rewrite frontoffice-login.ts SQL from legacy `users` table to `students` table                             |
| T005      | 🟡 MEDIUM | Repository: all raw SQL SELECT/INSERT/UPDATE with parameterized queries and workspace-scoped filters                       |
| T006      | 🟡 MEDIUM | Service layer: SERIALIZABLE transaction orchestration, account lock logic, limit enforcement                               |
| T007      | 🟡 MEDIUM | Bulk-import: chunked processing with per-row error collection and limit enforcement                                        |
| T012      | 🟡 MEDIUM | Helpers: getDb, buildAuditCtx, studentErrorResponse (cross-cutting concern affecting all handlers)                         |
| T013      | 🟡 MEDIUM | Router index: route registration order critical (bulk-import and action paths before /:id)                                 |
| T014–T022 | 🟡 MEDIUM | 9 route handlers: request parsing + service call + response shaping                                                        |
| T024      | 🟡 MEDIUM | App.ts registration: mount studentsRouter on workspace path                                                                |
| T003      | 🟢 LOW    | Types definition: pure TypeScript interfaces and union types                                                               |
| T004      | 🟢 LOW    | Errors definition: StudentError class + error codes                                                                        |
| T008      | 🟢 LOW    | Domain-core barrel index                                                                                                   |
| T009      | 🟢 LOW    | Unit tests (parallelizable)                                                                                                |
| T010      | 🟢 LOW    | Validation Zod schemas                                                                                                     |
| T011      | 🟢 LOW    | Validation barrel update                                                                                                   |
| T025      | 🟢 LOW    | Integration tests (parallelizable)                                                                                         |

---

## Tasks with External Dependencies

| Task ID | Package                                              | Version Note                                                                                                         |
| ------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| T002    | drizzle-orm                                          | Uses `check()`, `sql`, `integer`, `text` — confirmed API against Drizzle ORM v0.30 patterns (staff schema reference) |
| T005    | pg                                                   | Raw `PoolClient` SQL with parameterized `$N` placeholders — no ORM dependency                                        |
| T006    | argon2 (via @zidney/domain-core/auth/staff-password) | Uses `hashStaffPassword` / `verifyStaffPassword` — re-uses staff auth package                                        |
| T010    | zod                                                  | v3 enum, string, number coerce — matches existing validation package patterns                                        |

---

## High-Downstream-Impact Tasks

These tasks modify architectural hotspots — extra review attention recommended.

| Task ID | Module                                           | Impact | Description                                                                        |
| ------- | ------------------------------------------------ | ------ | ---------------------------------------------------------------------------------- |
| T001    | apps/api/src/db/tenant/migrations                | HIGH   | Schema change touches every tenant DB at runtime; irreversible once deployed       |
| T023    | apps/api/src/routes/auth/frontoffice-login.ts    | HIGH   | Auth path — incorrect migration breaks student login for all tenants               |
| T024    | apps/api/src/app.ts                              | HIGH   | Router registration — affects all 11 student endpoints simultaneously              |
| T013    | apps/api/src/routes/backoffice/students/index.ts | HIGH   | Route order determines Hono matching; bulk-import + action paths MUST precede /:id |

---

## Dependency Order (Execution Graph)

```
T001 (migration) ──┐
T002 (schema)   ──┤
                   │
T003 (types) ──────┼──→ T005 (repository) ──→ T006 (service) ──→ T007 (bulk-import) ──→ T008 (barrel)
T004 (errors) ─────┘                                     └──────────────────────────────────────────┘

T010 (validation zod) ──→ T011 (validation barrel)

T003/T004/T008 (types) ──→ T012 (helpers) ──→ T013 (router) ──→ T014–T022 (handlers) ──→ T024 (app.ts)

T023 (auth migration) — independent, can run after T001

T009 (unit tests) — parallelizable after T006
T025 (integration tests) — parallelizable after T024
```

---

## Compliance Notes

| Constraint                       | Covered By                                             | Task(s)    |
| -------------------------------- | ------------------------------------------------------ | ---------- |
| No cross-tenant SQL              | workspace_id scoped in all queries                     | T005       |
| No password_hash in API response | toStudentRecord() strips fields                        | T006       |
| License limit enforced           | countActiveStudents FOR UPDATE + limit check           | T006, T007 |
| Idempotency (email uniqueness)   | findStudentByEmailForUpdate SELECT FOR UPDATE          | T005       |
| SERIALIZABLE transaction         | createStudent + bulkImportStudents                     | T006, T007 |
| Server-authoritative time        | All timestamps use NOW() in migration SQL              | T001       |
| ADR-0001 isolation               | workspace_id in every query                            | T005       |
| Route order guard                | bulk-import, disable, enable, subscription BEFORE /:id | T013       |
