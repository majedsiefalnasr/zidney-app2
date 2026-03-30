# Tasks Report — MCQ Question Model

**Step:** 4 — Tasks  
**Timestamp:** 2026-03-30T00:04:00Z  
**Status:** COMPLETE

---

## Summary

48 atomic tasks generated across 14 phases covering the full MCQ Question Model implementation. Tasks are dependency-ordered: foundational layers (setup → migration → domain-core → validation) must complete before user story handlers can begin. 28 tasks are marked parallel-safe (`[P]`), enabling significant concurrency after Phase 4.

---

## Inputs Reviewed

- `specs/runtime/034-mcq-question-model/spec.md` — 20 FRs, 7 user stories, 5 clarifications
- `specs/runtime/034-mcq-question-model/plan.md` — 5 implementation layers, 34 new files
- `specs/runtime/034-mcq-question-model/data-model.md` — 5 Drizzle schema definitions
- `specs/runtime/034-mcq-question-model/research.md` — 11 research items

---

## Task Breakdown

| Category          | Count  | Notes                                                          |
| ----------------- | ------ | -------------------------------------------------------------- |
| Setup             | 1      | T001: sanitize-html dependency                                 |
| Database          | 7      | T002–T008: migration + 5 schemas + barrel export               |
| Domain Core       | 9      | T009–T017: types, errors, validators, sanitizer, repo, service |
| Validation        | 2      | T018–T019: 11 Zod schemas + barrel export                      |
| Route Infra       | 1      | T020: shared helpers                                           |
| API Handlers      | 12     | T021–T032: 14 handlers across 6 user stories                   |
| Route Wiring      | 2      | T033–T034: router factory + registration                       |
| Unit Tests        | 3      | T035–T037: validators, sanitizer, dependency registry          |
| Integration Tests | 8      | T038–T045: all user stories + isolation + concurrency          |
| Polish            | 3      | T046–T048: migration idempotency, pipeline, logging            |
| **Total**         | **48** | **34 new files + 3 modified files**                            |

---

## Risk-Ranked Task Summary

| Task ID | Risk      | Description                                                   |
| ------- | --------- | ------------------------------------------------------------- |
| T002    | 🔴 HIGH   | Create tenant migration with 5 tables, 7 indexes, 6 FKs       |
| T014    | 🔴 HIGH   | Create repository with raw SQL data access for all operations |
| T015    | 🔴 HIGH   | Create service layer with transaction orchestration           |
| T023    | 🔴 HIGH   | PATCH handler with optimistic concurrency control             |
| T032    | 🔴 HIGH   | DELETE handler with dependency registry guard                 |
| T012    | 🟡 MEDIUM | sanitize-html whitelist configuration                         |
| T024    | 🟡 MEDIUM | Workflow transition handler with ENABLED guard                |
| T029    | 🟡 MEDIUM | Basket linking with max_questions count check                 |
| T031    | 🟡 MEDIUM | List handler with 12 query filters + EXISTS subqueries        |
| T033    | 🟡 MEDIUM | Router factory with permission guards                         |
| T021    | 🟡 MEDIUM | POST create handler with full validation chain                |
| T003    | 🟢 LOW    | Drizzle schema for mcq_questions table                        |
| T009    | 🟢 LOW    | Domain types definition                                       |
| T018    | 🟢 LOW    | Zod validation schemas                                        |
| T035    | 🟢 LOW    | Unit tests for validators                                     |

---

## Tasks with External Dependencies

| Task ID | Package       | Version Note                        |
| ------- | ------------- | ----------------------------------- |
| T001    | sanitize-html | Version-pinned per Advisory A-6     |
| T012    | sanitize-html | Whitelist config per Research R-001 |

---

## High-Downstream-Impact Tasks

| Task ID | Module               | Centrality | Description                              |
| ------- | -------------------- | ---------- | ---------------------------------------- |
| T008    | apps/api/db/schemas  | HIGH       | Schema barrel export — all routes depend |
| T017    | packages/domain-core | HIGH       | Module barrel export — all API depends   |
| T033    | apps/api/routes      | HIGH       | Router factory — all endpoints depend    |
| T034    | apps/api/routes      | HIGH       | Backoffice registration — enables access |

---

## Transactional Tasks

- T002: Migration DDL (implicit transaction)
- T014: Repository write operations (all via `db.transaction()`)
- T015: Service create/update/delete (atomic transactions with option replacement)
- T021: POST create — transaction wraps question + options insert
- T023: PATCH update — transaction wraps metadata + option replacement
- T032: DELETE — transaction wraps soft/hard delete

---

## Idempotency Tasks

- T025–T030: Classification link/unlink handlers with UNIQUE constraint catch (409 on duplicate)
- T021: POST create — idempotent key to prevent duplicate creation
- T023: PATCH update — optimistic concurrency via `updatedAt` comparison

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                      |
| -------------------------------------------- | ------ | ---------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | T014, T015, T021, T023, T032 all use explicit transactions |
| Idempotency tasks are defined where required | ✅     | Classification links: UNIQUE catch. Updates: optimistic CC |
| Layer boundary rules are respected           | ✅     | Domain in domain-core, routes in api, validation in pkg    |
| No unrelated file modifications planned      | ✅     | Only 3 modified files (schema index, domain index, router) |
| Migration tasks included when required       | ✅     | T002: single migration with all 5 tables                   |

**Overall:** COMPLIANT

---

## Parallel Execution Opportunities

After Phase 4 completes (T020), these phases can execute simultaneously:

- Phase 5 (US1+US2): T021–T022
- Phase 6 (US3): T023
- Phase 7 (US4): T024
- Phase 8 (US5): T025–T030
- Phase 9 (US6): T031
- Phase 10 (US7): T032
- Phase 12 (Unit Tests): T035–T037

Maximum concurrency window: **17 parallel tasks** (T021–T037)

---

## Open Risks

- `sanitize-html` dependency requires security audit before production deployment (Advisory A-6, MEDIUM severity)
- Pagination performance at scale (>100K questions) — consider cursor-based pagination in future stage

---

## Next Step

Proceed to Step 5 — Analyze.
