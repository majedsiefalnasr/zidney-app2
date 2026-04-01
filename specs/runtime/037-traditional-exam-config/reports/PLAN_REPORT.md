# Plan Report — Traditional Exam Configuration

**Step:** 3 — Plan  
**Timestamp:** 2026-04-02T00:30:00.000Z  
**Status:** COMPLETE

---

## Summary

Technical plan produced for Stage 37 — Traditional Exam Configuration. The plan follows the MCQ Exam Configuration (Stage 36) architecture exactly: Route Handler → Domain Service → Repository → Raw SQL. Key decisions include custom status transitions (no shared workflow engine due to DISABLED state and missing COMPLETED step), template initialization on exam creation, and structural validation before ENABLED transition.

---

## Inputs Reviewed

- `specs/runtime/037-traditional-exam-config/spec.md` (with clarifications from Step 2)
- `packages/domain-core/src/mcq-exams/` (full pattern reference)
- `packages/validation/src/backoffice/mcq-exams.schemas.ts` (validation pattern)
- `apps/api/src/routes/backoffice/mcq-exams/` (route patterns, guards, helpers)
- `apps/api/src/db/tenant/migrations/20260401_014_mcq_exams.ts` (migration convention)
- `packages/domain-core/src/workflow/` (workflow engine analysis — decided not to use)
- `apps/api/src/db/tenant/schemas/traditional-exam-sections.schema.ts` (stub to complete)
- `apps/api/src/db/tenant/schemas/traditional-exam-subsections.schema.ts` (stub to complete)

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                        |
| --------- | ---------------------------------------------------------------------- |
| API       | 16 new route handlers + router factory + helpers + app.ts registration |
| Worker    | None — no async processing needed                                      |
| Frontend  | None — out of scope                                                    |
| DB Master | None                                                                   |
| DB Tenant | 1 migration: 3 new tables + 2 ALTER TABLE on stubs                     |

---

## Key Technical Decisions

| #   | Decision                                                    | Rationale                                                                                                                                                     |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Custom status transitions instead of shared workflow engine | Shared engine requires COMPLETED step (traditional exams skip it) and lacks DISABLED state. Custom transition handler follows same SELECT FOR UPDATE pattern. |
| 2   | Column named `status` not `workflow_status`                 | Follows MCQ exam convention; compatible with future workflow engine integration                                                                               |
| 3   | Template validation via application-level queries           | Template tables are out of scope — service queries and returns 404/422 if missing                                                                             |
| 4   | Score snapshot on question assignment                       | `traditional_exam_questions.score` is copied at assignment time, not live-referenced                                                                          |
| 5   | No FK on template_id or semester_id                         | Per spec clarifications — both treated as opaque UUIDs in this stage                                                                                          |
| 6   | Division filtering at SQL layer, not middleware             | Consistent with MCQ exam pattern; query WHERE clause handles null division                                                                                    |

---

## Migration Impact

| Item                  | Value | Notes                                          |
| --------------------- | ----- | ---------------------------------------------- |
| Migration required    | Yes   | `20260402_015_traditional_exams.ts`            |
| `schema_version` bump | Yes   | 1.20.0 → 1.21.0                                |
| Backward compatible   | Yes   | New tables + additive ALTER TABLE columns only |

---

## Transaction Boundaries

- **Exam creation** — single TX: INSERT exam → INSERT sections → INSERT subsections from template
- **Exam update** — single TX: SELECT FOR UPDATE → validate status → UPDATE
- **Exam deletion** — single TX: dependency check → soft delete (set deleted_at)
- **Status transition** — single TX: SELECT FOR UPDATE → validate transition → UPDATE status + timestamps
- **Question assignment** — single TX: validate all questions → bulk INSERT with ON CONFLICT
- **Question reorder** — single TX: DELETE all order_index → re-INSERT with new order values
- **Settings upsert** — single TX: INSERT ON CONFLICT (exam_id) DO UPDATE

---

## Idempotency Strategy

- **Question assignment** — UNIQUE(subsection_id, question_id), ON CONFLICT returns existing
- **Settings upsert** — UNIQUE(exam_id), INSERT ON CONFLICT DO UPDATE
- **Status transition** — SELECT FOR UPDATE prevents concurrent transitions
- **Reorder** — exact-array replacement (client sends full ordered list)

---

## Architecture Governance Compliance

| Check                                               | Status | Notes                                             |
| --------------------------------------------------- | ------ | ------------------------------------------------- |
| No cross-tenant logic introduced (ADR-0001)         | ✅     | All DB access via tenant resolver pool            |
| All writes are transactional by design              | ✅     | BEGIN/COMMIT/ROLLBACK for all mutations           |
| Server-authoritative time enforced (ADR-0006)       | ✅     | NOW() in SQL for all timestamps                   |
| License middleware enforced                         | ✅     | Workspace route prefix applies license middleware |
| Version compatibility enforced (ADR-0007, ADR-0008) | ✅     | Schema version bumped in migration                |
| No architecture redesign without ADR                | ✅     | Follows existing MCQ exam architecture exactly    |
| Trust chain respected                               | ✅     | Isolation → License → Auth → RBAC → Handler       |
| Import boundaries respected                         | ✅     | domain-core ↛ apps; routes import from packages   |

**Overall:** COMPLIANT

---

## Open Risks

- Template tables may not exist in tenant DB — mitigated by returning 404/422 with clear error
- None other identified

---

## Next Step

Proceed to Step 4 — Tasks.
