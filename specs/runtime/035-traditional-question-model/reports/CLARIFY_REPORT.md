# Clarify Report — Traditional Question Model

**Step:** 2 — Clarify  
**Timestamp:** 2026-03-31T13:00:00Z  
**Status:** COMPLETE

---

## Summary

Five material ambiguities were identified during the clarification scan of `spec.md`. All five were resolved through interactive clarification with the developer. No specification ambiguities remain. Risk level assessed as **MEDIUM** based on the stub migration strategy and JSONB validation complexity.

---

## Inputs Reviewed

- `specs/runtime/035-traditional-question-model/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                                        | Resolution                                                                                                                                                              | Impact                                                                                                                   |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | How to handle `subsection_id` FK dependency on Stage 37 tables? | Stage 35 migration creates stub `traditional_exam_sections` + `traditional_exam_subsections` tables (minimal columns). Stage 37 adds remaining columns via ALTER TABLE. | Migration order: stub tables → `traditional_questions` → join tables. Stage 37 uses ALTER TABLE instead of CREATE TABLE. |
| 2   | How should `FILL_BLANK` accepted values matching work?          | Case-insensitive string matching. No diacritics/tashkeel normalization in v1. Matching logic deferred to attempt grading stage.                                         | Stage 35 only stores accepted values with whitespace trimming. No matching implementation needed.                        |
| 3   | Should the workflow support backward transitions?               | No backward transitions — strictly forward-only (`DRAFT → COMPLETED → UNDER_REVIEW → APPROVED → ENABLED`). To re-edit after approval, create a new question.            | Simplifies workflow integration. Consistent with MCQ model (Stage 034).                                                  |
| 4   | How should the `search` filter work?                            | PostgreSQL `ILIKE '%query%'` on content column. No full-text search (tsvector) in v1.                                                                                   | No GIN index needed. Sufficient for < 50K questions per tenant. API contract unchanged if upgraded later.                |
| 5   | Which tables should the deletion guard check?                   | Guard checks only currently existing tables. Future stages add their own guard hooks when they create referencing tables.                                               | Pluggable guard pattern — deletion service checks only `traditional_exam_subsections` in v1.                             |

---

## Open Items

- None

---

## Spec Updates Applied

- Appended `## Clarifications` section to spec.md with all 5 resolved clarifications
- Added `### Session 2026-03-31` subsection documenting each decision with rationale
- Documented stub migration strategy with explicit column lists
- Documented forward-only workflow constraint
- Documented ILIKE search approach with performance threshold
- Documented pluggable deletion guard pattern

---

## Architecture Governance Compliance

| Check                                                          | Status | Notes                                                                             |
| -------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| All material ambiguities resolved                              | ✅     | 5/5 clarifications resolved                                                       |
| Transaction strategy confirmed                                 | ✅     | All write operations wrapped in transactions per spec FR requirements             |
| Idempotency strategy confirmed                                 | ✅     | Create endpoint returns existing if duplicate detected via composite unique index |
| Isolation boundaries confirmed (ADR-0001)                      | ✅     | Database-per-tenant. All queries scoped to tenant DB via resolver middleware      |
| Version and license constraints confirmed (ADR-0007, ADR-0008) | ✅     | License middleware mandatory on all workspace routes. Version header enforced     |
| Trust chain respected                                          | ✅     | Isolation → License → Authentication → Runtime chain preserved                    |
| Import boundaries respected                                    | ✅     | Domain packages pure. API layer routing only. No cross-app imports                |

**Overall:** COMPLIANT

---

## Open Risks

- **Stub migration coordination** — Stage 37 must use ALTER TABLE (not CREATE TABLE) for `traditional_exam_sections` and `traditional_exam_subsections`. This dependency must be documented in Stage 37's spec.
- **JSONB validation** — No database-level CHECK constraint on `correct_answer` JSONB structure. Validation enforced at API layer only via Zod schemas.

---

## Next Step

Proceed to Step 3 — Plan.
