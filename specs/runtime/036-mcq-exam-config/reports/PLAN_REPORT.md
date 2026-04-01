# Plan Report — MCQ Exam Configuration

**Step:** 3 — Plan  
**Timestamp:** 2026-04-01T00:03:00Z  
**Status:** COMPLETE

---

## Summary

Technical plan completed for MCQ Exam Configuration. 4 tenant-scoped database tables, Drizzle ORM schemas, a full domain-core module (7 files), Zod validation schemas, and 14 Hono API route handlers planned across 29 new files and 5 modified files. Migration 014 bumps schema from 1.19.0 → 1.20.0 with two-phase pattern. Pre-enable validation hooks, extensible deletion guards, and automatic/manual selection modes fully designed.

---

## Inputs Reviewed

- `specs/runtime/036-mcq-exam-config/spec.md`
- `specs/runtime/036-mcq-exam-config/plan.md`
- `specs/runtime/036-mcq-exam-config/research.md`
- `specs/runtime/036-mcq-exam-config/data-model.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                     |
| --------- | ------------------------------------------------------------------- |
| API       | 14 route handlers + router + helpers + Zod schemas                  |
| Worker    | None                                                                |
| Frontend  | None                                                                |
| DB Master | None                                                                |
| DB Tenant | Migration 014: 4 tables, FK constraints, indexes, CHECK constraints |

---

## Key Technical Decisions

| #   | Decision                                          | Rationale                                                |
| --- | ------------------------------------------------- | -------------------------------------------------------- |
| 1   | Two-phase migration pattern                       | CONCURRENT unique index cannot run in transaction        |
| 2   | uuid[] arrays for auto criteria references        | Per clarification C5 — Postgres native, no join tables   |
| 3   | Settings as separate table (1:1)                  | Keeps mcq_exams row lean, settings UPSERT-friendly       |
| 4   | Pre-enable validation in service layer            | Per clarification C3 — before workflow engine transition |
| 5   | Extensible deletion guard via dependency registry | Per clarification C4 — future stages register checkers   |
| 6   | Initial status = COMPLETED                        | Per clarification C2 — skip DRAFT, instant-complete      |
| 7   | Entity type key = mcq_exam                        | Per clarification C1 — added to ENTITY_TABLE_MAP         |
| 8   | Atomic replace for criteria/reorder               | DELETE all + INSERT all in TX ensures consistency        |

---

## Migration Impact

| Item                  | Value | Notes                                           |
| --------------------- | ----- | ----------------------------------------------- |
| Migration required    | Yes   | 20260401_014_mcq_exams.ts — 4 new tables        |
| `schema_version` bump | Yes   | 1.19.0 → 1.20.0                                 |
| Backward compatible   | Yes   | All new tables, no existing table modifications |

---

## Transaction Boundaries

- **createExam:** BEGIN → INSERT mcq_exams → INSERT mcq_exam_settings (default) → COMMIT
- **updateExam:** BEGIN → SELECT FOR UPDATE → UPDATE → COMMIT
- **deleteExam:** BEGIN → guard checks → UPDATE deleted_at → COMMIT
- **upsertSettings:** BEGIN → INSERT ON CONFLICT UPDATE → COMMIT
- **addQuestions:** BEGIN → validate all questions → INSERT batch → COMMIT
- **removeQuestion:** BEGIN → DELETE → COMMIT
- **reorderQuestions:** BEGIN → DELETE all for exam → INSERT batch → COMMIT
- **setCriteria:** BEGIN → DELETE old criteria → INSERT batch → verify sum = 100 → COMMIT
- **transitionStatus:** pre-enable validation → executeTransition (has own TX via workflow engine)

---

## Idempotency Strategy

- **POST /mcq-exams:** Code uniqueness constraint — duplicate returns 409
- **PUT /settings:** UPSERT pattern — INSERT ON CONFLICT DO UPDATE
- **PUT /criteria:** Atomic replace — DELETE all + INSERT all in TX
- **PUT /questions/reorder:** Atomic replace — DELETE all + INSERT all in TX
- **POST /questions:** Unique(exam_id, question_id) constraint → 409 on duplicate
- **POST /transition:** Workflow engine SELECT FOR UPDATE prevents race conditions

---

## Architecture Governance Compliance

| Check                                               | Status | Notes                                              |
| --------------------------------------------------- | ------ | -------------------------------------------------- |
| No cross-tenant logic introduced (ADR-0001)         | ✅     | All tables tenant-scoped, no cross-tenant joins    |
| All writes are transactional by design              | ✅     | Every mutation wrapped in TX                       |
| Server-authoritative time enforced (ADR-0006)       | ✅     | NOW() for all timestamps, no client time accepted  |
| License middleware enforced                         | ✅     | All routes under tenant + license middleware       |
| Version compatibility enforced (ADR-0007, ADR-0008) | ✅     | schema_version bumped 1.19.0 → 1.20.0              |
| No architecture redesign without ADR                | ✅     | Uses existing workflow engine, no new patterns     |
| Trust chain respected                               | ✅     | Isolation → License → Auth → Route                 |
| Import boundaries respected                         | ✅     | domain-core ← validation ← api (correct direction) |

**Overall:** COMPLIANT

---

## Open Risks

- uuid[] arrays in mcq_exam_auto_criteria may need GIN indexes if query volume grows — monitor post-launch
- Division FK references divisions table — assumed to exist from earlier stage
- Message template FK deferred — templates table does not yet exist

---

## Next Step

Proceed to Step 4 — Tasks.
