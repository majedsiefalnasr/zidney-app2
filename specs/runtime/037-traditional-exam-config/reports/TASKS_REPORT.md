# Tasks Report — Traditional Exam Configuration

**Step:** 4 — Tasks  
**Timestamp:** 2026-04-02T00:35:00Z  
**Status:** COMPLETE

---

## Summary

45 atomic tasks generated across 14 phases covering migration, Drizzle schemas, domain-core module (types, errors, validators, dependency-registry, repository, service, barrel), Zod validation schemas, 16 route handlers + router factory + helpers, app registration, and governance validation. Tasks follow strict dependency order — infrastructure first, domain logic second, routes third, validation last.

---

## Inputs Reviewed

- `specs/runtime/037-traditional-exam-config/spec.md`
- `specs/runtime/037-traditional-exam-config/plan.md`
- `specs/runtime/037-traditional-exam-config/tasks.md`

---

## Task Breakdown

| Category       | Count  | Notes                                                                                              |
| -------------- | ------ | -------------------------------------------------------------------------------------------------- |
| Infrastructure | 6      | Migration (T001), 3 new Drizzle schemas (T002–T003, T006), 2 stub updates (T004–T005)              |
| Domain Types   | 2      | Types + Error definitions (T007–T008)                                                              |
| Domain Logic   | 12     | Validators (T009), dep-registry (T010), repository (T011–T014), service (T015–T022), barrel (T023) |
| Validation     | 1      | 13 Zod schemas in 1 file (T024)                                                                    |
| Routes         | 18     | Helpers (T025), 16 handlers (T026–T040), router factory (T041)                                     |
| Registration   | 1      | app.ts mount (T042)                                                                                |
| Governance     | 3      | typecheck (T043), lint (T044), arch guard (T045)                                                   |
| **Total**      | **45** | 32 new files, 3 modified files                                                                     |

---

## Transactional Tasks

- T015: Create exam with template initialization (INSERT exam + sections + subsections in single TX)
- T017: Update exam with SELECT FOR UPDATE + status guard
- T018: Delete exam with dependency check + soft delete
- T019: Transition exam with SELECT FOR UPDATE + custom transition validation + structural validation
- T020: Upsert settings with INSERT ON CONFLICT DO UPDATE
- T022: Assign questions (bulk INSERT ON CONFLICT) + reorder (DELETE + re-INSERT)

---

## Idempotency Tasks

- T014: Question assignment — UNIQUE(subsection_id, question_id), ON CONFLICT returns existing
- T012: Settings upsert — UNIQUE(exam_id), INSERT ON CONFLICT DO UPDATE
- T019: Status transition — SELECT FOR UPDATE prevents concurrent transitions

---

## Risk-Ranked Task Summary

| Task ID | Risk      | Description                                                  |
| ------- | --------- | ------------------------------------------------------------ |
| T001    | 🔴 HIGH   | Migration: 3 new tables + 2 ALTER TABLE + CONCURRENT indexes |
| T015    | 🔴 HIGH   | Service: createExam with template initialization TX          |
| T019    | 🔴 HIGH   | Service: transitionExam with structural validation           |
| T011    | 🟡 MEDIUM | Repository: core CRUD queries with SELECT FOR UPDATE         |
| T014    | 🟡 MEDIUM | Repository: question assignment with ON CONFLICT             |
| T022    | 🟡 MEDIUM | Service: question assignment + reorder with score snapshot   |
| T041    | 🟡 MEDIUM | Router factory: RBAC guard configuration                     |
| T042    | 🟡 MEDIUM | App.ts registration                                          |
| T007    | 🟢 LOW    | Types and DTOs                                               |
| T008    | 🟢 LOW    | Error codes and class                                        |
| T024    | 🟢 LOW    | Zod validation schemas                                       |
| T043-45 | 🟢 LOW    | Governance validation                                        |

---

## Tasks with External Dependencies

None identified — all libraries (Hono, Drizzle, Zod) are already installed in the workspace.

---

## High-Downstream-Impact Tasks

| Task ID | Module                        | Impact | Description                                      |
| ------- | ----------------------------- | ------ | ------------------------------------------------ |
| T001    | apps/api/db/tenant/migrations | HIGH   | Migration affects all tenant databases           |
| T042    | apps/api/src/app.ts           | MEDIUM | Central router file — single import + mount line |

---

## Architecture Governance Compliance

| Check                                        | Status | Notes                                                |
| -------------------------------------------- | ------ | ---------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | T015, T017–T020, T022 all use TX                     |
| Idempotency tasks are defined where required | ✅     | T012 (settings), T014 (questions), T019 (transition) |
| Layer boundary rules are respected           | ✅     | domain-core ↛ apps; routes import from packages      |
| No unrelated file modifications planned      | ✅     | Only traditional-exam scoped files                   |
| Migration tasks included when required       | ✅     | T001 covers full migration                           |
| Trust chain respected                        | ✅     | Tenant → License → Auth → RBAC → Handler             |
| Import boundaries respected                  | ✅     | No cross-app imports                                 |
| Architecture guard task included             | ✅     | T045                                                 |

**Overall:** COMPLIANT

---

## Open Risks

- Template tables may not exist in tenant DB — mitigated by returning TRAD_EXAM_TEMPLATE_NOT_FOUND error (T015)

---

## Next Step

Proceed to Step 5 — Analyze.
