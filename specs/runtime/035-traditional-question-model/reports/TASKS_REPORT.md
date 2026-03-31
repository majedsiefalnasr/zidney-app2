# Tasks Report — Traditional Question Model

**Step:** 4 — Tasks  
**Timestamp:** 2026-03-31T14:30:00Z  
**Status:** COMPLETE

---

## Summary

30 atomic tasks generated across 8 execution phases. The task set covers the full implementation scope: 1 migration (4 tasks for two-phase DDL), 3 Drizzle schemas, 8 domain-core module files, 1 validation schema, 12 API route files, 2 app-level modifications, observability, and architecture guard validation. 2 parallel-eligible task groups identified (T024/T025 for classification linking, T029 for logging).

---

## Inputs Reviewed

- `specs/runtime/035-traditional-question-model/spec.md`
- `specs/runtime/035-traditional-question-model/plan.md`
- `specs/runtime/035-traditional-question-model/tasks.md`

---

## Task Breakdown

| Category       | Count  | Notes                                                                           |
| -------------- | ------ | ------------------------------------------------------------------------------- |
| Infrastructure | 7      | Migration (4 tasks) + Drizzle schemas (3 tasks)                                 |
| Domain Core    | 8      | Types, errors, validators, sanitize, repo, service, dependency-registry, barrel |
| Validation     | 1      | Zod schemas with type-discriminated correct_answer                              |
| API Routes     | 10     | 10 endpoint handlers + helpers + router index                                   |
| App Wiring     | 2      | Route registration + barrel export                                              |
| Observability  | 1      | Structured logging for all service operations                                   |
| Architecture   | 1      | Architecture guard audit                                                        |
| Worker         | 0      | No background jobs in this stage                                                |
| Frontend       | 0      | No UI in this stage                                                             |
| **Total**      | **30** |                                                                                 |

---

## Transactional Tasks

- T002 — Create traditional_questions table (within migration transaction)
- T003 — Create join tables (within migration transaction)
- T013 — Service: createQuestion, updateQuestion, deleteQuestion, link/unlink ops (all BEGIN/COMMIT/ROLLBACK)
- T018 — Create handler (invokes transactional service)
- T021 — Update handler (invokes transactional service with SELECT FOR UPDATE)
- T022 — Delete handler (invokes transactional service with guard check)
- T023 — Transition handler (delegates to workflow engine with SELECT FOR UPDATE)
- T024 — Link/unlink category (transactional)
- T025 — Link/unlink tag (transactional)

---

## Idempotency Tasks

- T003/T004 — UNIQUE constraints on join tables prevent duplicate links (PostgreSQL 23505)
- T013 — Service catches 23505 on link operations, returns 409 Conflict
- T023 — Workflow transition rejects if already in target state
- T024/T025 — Link handlers return 409 on constraint violation

---

## Risk-Ranked Task Summary

| Task ID   | Risk      | Description                                                               |
| --------- | --------- | ------------------------------------------------------------------------- |
| T001      | 🔴 HIGH   | Stub migration for exam sections/subsections (Stage 37 dependency)        |
| T002      | 🔴 HIGH   | Core traditional_questions table migration with FKs and CHECK constraints |
| T003      | 🔴 HIGH   | Join tables + schema version bump in migration                            |
| T004      | 🟡 MEDIUM | CONCURRENT unique indexes (outside transaction)                           |
| T010      | 🟡 MEDIUM | correct_answer JSONB validation (type-discriminated)                      |
| T012      | 🟡 MEDIUM | Repository: raw SQL queries with pagination, filters, ILIKE search        |
| T013      | 🟡 MEDIUM | Service: TX orchestration, FK validation, immutability guards             |
| T023      | 🟡 MEDIUM | Workflow transition handler bridging RBAC to engine permissions           |
| T027      | 🟡 MEDIUM | Route registration in app.ts (cross-module wiring)                        |
| T005      | 🟢 LOW    | Drizzle schema for stub exam sections                                     |
| T006      | 🟢 LOW    | Drizzle schema for stub exam subsections                                  |
| T007      | 🟢 LOW    | Drizzle schema for traditional questions + join tables                    |
| T008      | 🟢 LOW    | Domain types and enums                                                    |
| T009      | 🟢 LOW    | Error codes and HTTP mapping                                              |
| T011      | 🟢 LOW    | Rich text sanitization                                                    |
| T014      | 🟢 LOW    | Pluggable deletion guard registry                                         |
| T015      | 🟢 LOW    | Barrel export                                                             |
| T016      | 🟢 LOW    | Zod validation schemas                                                    |
| T017      | 🟢 LOW    | Route helpers                                                             |
| T018-T022 | 🟢 LOW    | CRUD endpoint handlers (established pattern)                              |
| T024-T025 | 🟢 LOW    | Classification linking handlers                                           |
| T026      | 🟢 LOW    | Router factory                                                            |
| T028      | 🟢 LOW    | Domain-core barrel export update                                          |
| T029      | 🟢 LOW    | Structured logging addition                                               |
| T030      | 🟢 LOW    | Architecture guard audit                                                  |

---

## Tasks with External Dependencies

None identified. All dependencies are internal Zidney packages.

---

## High-Downstream-Impact Tasks

| Task ID | Module               | Centrality | Description                             |
| ------- | -------------------- | ---------- | --------------------------------------- |
| T027    | apps/api/src/app.ts  | HIGH       | Route registration — central app wiring |
| T013    | packages/domain-core | MEDIUM     | New service module in shared package    |

---

## Architecture Governance Compliance

| Check                                        | Status | Notes                                                     |
| -------------------------------------------- | ------ | --------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | T013 + all write handlers use BEGIN/COMMIT                |
| Idempotency tasks are defined where required | ✅     | UNIQUE constraints + 23505 catch + workflow guard         |
| Layer boundary rules are respected           | ✅     | domain-core has no HTTP imports                           |
| No unrelated file modifications planned      | ✅     | Only traditional-questions scope files                    |
| Migration tasks included when required       | ✅     | T001-T004 cover full migration                            |
| Trust chain respected                        | ✅     | Routes chain through tenant resolver + license middleware |
| Import boundaries respected                  | ✅     | packages/_ to packages/_ only; apps/_ to packages/_ only  |
| Architecture guard task included             | ✅     | T030 — final architecture audit                           |

**Overall:** COMPLIANT

---

## Open Risks

- **Stub table schema drift**: If Stage 37 design changes the stub table PK type, ALTER TABLE in Stage 37 may need careful coordination. Risk: LOW — stub uses UUID which is the platform standard.

---

## Next Step

Proceed to Step 5 — Analyze.
