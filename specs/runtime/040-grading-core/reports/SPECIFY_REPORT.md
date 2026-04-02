# Specify Report — Grading Core

**Step:** 1 — Specify  
**Timestamp:** 2026-04-02T00:00:00.000Z  
**Status:** COMPLETE

---

## Summary

Comprehensive specification created for the Grading Core — a unified, deterministic grading engine supporting all MCQ and Traditional question types. The engine operates exclusively on immutable snapshots and persists results in dedicated grading tables.

---

## Inputs Reviewed

- `specs/phases/03_BACKOFFICE_CORE/04_EXAM_ENGINE_CORE/STAGE_40_GRADING_CORE.md`
- `apps/api/src/db/tenant/schemas/attempts.schema.ts`
- `apps/api/src/db/tenant/schemas/attempt-questions.schema.ts`
- `apps/api/src/db/tenant/schemas/mcq-questions.schema.ts`
- `apps/api/src/db/tenant/schemas/mcq-question-options.schema.ts`
- `apps/api/src/db/tenant/schemas/traditional-questions.schema.ts`
- `packages/domain-core/src/attempts/attempt-init.ts`
- `apps/api/src/services/submission-validator.ts`
- `apps/api/src/services/job-queue-service.ts`

---

## Key Decisions

| #   | Decision                                                       | Rationale                                                       |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | Domain logic in `packages/domain-core/src/grading/`            | Pure domain package, no HTTP deps — follows layering rules      |
| 2   | Separate `grading_results` + `grading_question_results` tables | Enables per-question audit trail and future re-grading          |
| 3   | No API endpoints in this stage                                 | Grading is a domain function; HTTP exposure is Phase 04_RUNTIME |
| 4   | `grading_overrides` table for admin changes                    | Immutability preserved — overrides are append-only records      |
| 5   | No partial scoring for MULTIPLE choice in v1                   | Simplicity first; partial scoring deferred to v2                |

---

## Functional Requirements Captured

- MCQ grading for SINGLE, MULTIPLE, TRUE_FALSE, ARRANGEMENT types
- Traditional grading for TRUE_FALSE, FILL_BLANK, SHORT_ANSWER types
- Score aggregation with percentage and pass/fail computation
- Forced submission handling with reason tracking
- Immutability enforcement with admin override audit trail
- Transactional guarantee with SELECT FOR UPDATE
- Determinism guarantee — no random logic in grading
- Grading version tracking for auditability

---

## Clarifications Required

- None — all requirements are fully specified from the stage file.

---

## Architecture Governance Compliance

| Check                                              | Status | Notes                                            |
| -------------------------------------------------- | ------ | ------------------------------------------------ |
| No cross-tenant access introduced (ADR-0001)       | ✅     | workspace_id on all tables and queries           |
| License middleware requirement captured            | ✅     | Not applicable — no HTTP endpoints in this stage |
| Snapshot integrity requirement captured (ADR-0002) | ✅     | Grading uses only snapshot data                  |
| Server-authoritative time (ADR-0006)               | ✅     | graded_at uses server time                       |
| Version compatibility (ADR-0007)                   | ✅     | grading_version tracked                          |
| Import boundaries respected                        | ✅     | domain-core has no app imports                   |
