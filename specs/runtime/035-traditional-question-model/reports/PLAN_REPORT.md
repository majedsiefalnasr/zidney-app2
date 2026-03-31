# Plan Report — Traditional Question Model

**Step:** 3 — Plan  
**Timestamp:** 2026-03-31T14:00:00Z  
**Status:** COMPLETE

---

## Summary

Technical plan for the Traditional Question Model is complete. The implementation follows the MCQ Question Model (Stage 034) structural pattern with type-specific adaptations for JSONB-based `correct_answer` storage, 3 question types (TRUE_FALSE, FILL_BLANK, SHORT_ANSWER), stub migration for Stage 37 dependency tables, and 10 API endpoints across 25 new files + 3 modifications. No architectural novelty — this is a well-established pattern replication.

---

## Inputs Reviewed

- `specs/runtime/035-traditional-question-model/spec.md` (including Clarifications)
- `specs/runtime/035-traditional-question-model/plan.md`
- MCQ implementation (Stage 034) — schemas, domain core, validation, routes, migration

---

## Architecture Layers Touched

| Layer       | Planned Changes                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| DB Tenant   | 1 migration: 5 tables (2 stub + 1 core + 2 join), indexes, CHECK constraints                                                   |
| Domain Core | New `traditional-questions` module — 8 files (service, repo, types, errors, validators, sanitize, dependency-registry, barrel) |
| Validation  | New Zod schemas — 9 schemas with type-discriminated correct_answer validation                                                  |
| API Routes  | New router — 12 files (10 endpoints + helpers + index)                                                                         |
| DB Schema   | 3 new Drizzle schema files for type inference                                                                                  |
| App         | 1 modification — register `traditionalQuestionsRouter` in app.ts                                                               |
| Worker      | None                                                                                                                           |
| Frontend    | None                                                                                                                           |
| DB Master   | None                                                                                                                           |

---

## Key Technical Decisions

| #   | Decision                                     | Rationale                                                                               |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | JSONB `correct_answer` with Zod validation   | Type-specific answers (bool/array/string) validated at API boundary; DB stores raw JSON |
| 2   | Stub migration for exam sections/subsections | Resolves FK dependency for `subsection_id` without creating full Stage 37 schema        |
| 3   | question_type immutable after creation       | Changing type would invalidate correct_answer — safer to delete and recreate            |
| 4   | Forward-only workflow transitions            | Simplicity for v1; backward transitions deferred per clarification CLR-003              |
| 5   | ILIKE search — no full-text index            | Sufficient for < 50K questions/tenant; GIN index deferred to scale stage                |
| 6   | Pluggable deletion guard pattern             | Same as MCQ — allows future stages to register their own reference checkers             |
| 7   | Two-phase migration pattern                  | Phase 1: DDL in transaction; Phase 2: CONCURRENT unique indexes outside transaction     |
| 8   | Reuse shared workflow engine                 | `ENTITY_TABLE_MAP` already declares `traditional_question` — no engine changes needed   |

---

## Migration Impact

| Item                  | Value | Notes                                                                                                    |
| --------------------- | ----- | -------------------------------------------------------------------------------------------------------- |
| Migration required    | Yes   | `20260331_013_traditional_questions.ts`                                                                  |
| `schema_version` bump | Yes   | 1.18.0 → 1.19.0                                                                                          |
| Backward compatible   | Yes   | Additive-only: new tables, no existing table changes                                                     |
| Stub tables           | 2     | `traditional_exam_sections`, `traditional_exam_subsections` — Stage 37 adds full columns via ALTER TABLE |

---

## Transaction Boundaries

- **Create question:** BEGIN → insert → COMMIT
- **Update question:** BEGIN → SELECT FOR UPDATE → validate → update → COMMIT
- **Delete question:** BEGIN → guard check → soft delete → COMMIT
- **Workflow transition:** Delegated to workflow engine (SELECT FOR UPDATE)
- **Link/unlink category:** BEGIN → check exists → insert/delete → COMMIT
- **Link/unlink tag:** BEGIN → check exists → insert/delete → COMMIT

---

## Idempotency Strategy

- **Link category/tag:** UNIQUE constraint → catch PostgreSQL 23505 → return 409 Conflict
- **Workflow transition:** SELECT FOR UPDATE → reject if already in target state
- **Delete question:** Soft delete → if already deleted, return 404
- **Create question:** No natural key — each POST creates a new record (no idempotency key)

---

## Architecture Governance Compliance

| Check                                               | Status | Notes                                                       |
| --------------------------------------------------- | ------ | ----------------------------------------------------------- |
| No cross-tenant logic introduced (ADR-0001)         | ✅     | Tenant resolved via middleware; all queries use tenant pool |
| All writes are transactional by design              | ✅     | Explicit BEGIN/COMMIT/ROLLBACK on all write ops             |
| Server-authoritative time enforced (ADR-0006)       | ✅     | All timestamps from DB DEFAULT NOW()                        |
| License middleware enforced                         | ✅     | Workspace routes chain through license middleware           |
| Version compatibility enforced (ADR-0007, ADR-0008) | ✅     | schema_version bump 1.18.0 → 1.19.0                         |
| No architecture redesign without ADR                | ✅     | Follows established MCQ pattern — no novel architecture     |
| Trust chain respected                               | ✅     | Isolation → License → Auth → Runtime → Route                |
| Import boundaries respected                         | ✅     | domain-core has no HTTP imports; UI not touched             |

**Overall:** COMPLIANT

---

## Open Risks

- **Stub table mismatch:** If Stage 37 changes the stub table PK type or naming, ALTER TABLE may need adjustment. Mitigation: minimal columns only (id, FK, timestamps).
- **JSONB validation bypass:** If a client sends raw SQL bypassing the API, invalid correct_answer shapes could enter the DB. Mitigation: all access through API boundary; no direct DB access by clients.

---

## Next Step

Proceed to Step 4 — Tasks.
