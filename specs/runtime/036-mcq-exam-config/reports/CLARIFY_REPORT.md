# Clarify Report — MCQ Exam Configuration

**Step:** 2 — Clarify  
**Timestamp:** 2026-04-01T00:02:00Z  
**Status:** COMPLETE

---

## Summary

5 clarification questions identified and resolved through ambiguity scan. Key decisions:
workflow engine entity registration as `mcq_exam`, initial status confirmed as COMPLETED,
pre-enable validation runs in the service layer before workflow engine, deletion guards use
extensible pattern, and UUID arrays confirmed for auto criteria columns.

---

## Inputs Reviewed

- `specs/runtime/036-mcq-exam-config/spec.md` (including `## Clarifications`)
- `packages/domain-core/src/workflow/workflow.engine.ts` — ENTITY_TABLE_MAP
- `packages/domain-core/src/workflow/workflow.states.ts` — WorkflowState enum, transitions

---

## Clarifications Resolved

| #   | Question                                  | Resolution                                            | Impact                                      |
| --- | ----------------------------------------- | ----------------------------------------------------- | ------------------------------------------- |
| 1   | Workflow entity type key for mcq_exams?   | Register `mcq_exam` → `mcq_exams` in ENTITY_TABLE_MAP | Workflow engine modification required       |
| 2   | Initial status: COMPLETED or DRAFT?       | COMPLETED (consistent with subjects, MCQ questions)   | Create endpoint sets status = COMPLETED     |
| 3   | Pre-enable validation location?           | Service layer, before executeTransition()             | Domain validation in mcq-exams.service.ts   |
| 4   | Deletion guard pattern for future tables? | Extensible guard; currently checks status ≠ ENABLED   | Add TODO for attempt/scheduled guards       |
| 5   | UUID arrays vs join tables for criteria?  | Postgres uuid[] arrays (atomic replace, app-level FK) | No join tables needed; GIN indexes optional |

---

## Open Items

None — all ambiguities resolved.

---

## Spec Updates Applied

- Appended `## Clarifications / Session 2026-04-01` section with 5 Q&A pairs
- Confirmed `mcq_exam` entity type key for workflow engine registration
- Confirmed COMPLETED as initial status
- Confirmed pre-enable validation in service layer
- Confirmed extensible deletion guard pattern
- Confirmed uuid[] array design for auto criteria columns

---

## Architecture Governance Compliance

| Check                                                          | Status | Notes                                              |
| -------------------------------------------------------------- | ------ | -------------------------------------------------- |
| All material ambiguities resolved                              | ✅     | 5/5 clarifications closed                          |
| Transaction strategy confirmed                                 | ✅     | All writes transactional, criteria atomic replace  |
| Idempotency strategy confirmed                                 | ✅     | Code-based dedup, upsert settings, atomic criteria |
| Isolation boundaries confirmed (ADR-0001)                      | ✅     | All tables tenant-scoped, no cross-tenant access   |
| Version and license constraints confirmed (ADR-0007, ADR-0008) | ✅     | License middleware required on all routes          |
| Trust chain respected                                          | ✅     | Isolation → License → Auth chain preserved         |
| Import boundaries respected                                    | ✅     | Domain logic in domain-core, schema in api/db      |

**Overall:** COMPLIANT

---

## Open Risks

- Future deletion guards will need modification when attempt/scheduled tables are created.
- UUID array columns lack DB-level referential integrity; relies on application validation.

---

## Risk Level Assessment

| Factor                                               | Present? | Points |
| ---------------------------------------------------- | -------- | ------ |
| Database migration (schema change)                   | Yes      | +3     |
| New table or column added                            | Yes      | +2     |
| Security-sensitive logic (auth, tokens, permissions) | No       | +0     |
| Worker interaction or async job                      | No       | +0     |
| Multi-tenant data isolation logic                    | Yes      | +3     |
| External API integration                             | No       | +0     |
| More than 10 tasks                                   | Yes      | +1     |
| More than 20 tasks                                   | No       | +0     |
| New package dependency added                         | No       | +0     |

**Total Score: 9 → Risk Level: HIGH**

---

## Next Step

Proceed to Step 3 — Plan.
