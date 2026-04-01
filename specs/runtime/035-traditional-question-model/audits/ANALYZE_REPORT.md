# Analyze Report — Traditional Question Model

**Step:** 5 — Analyze (Drift Detector)  
**Timestamp:** 2025-07-22T12:00:00Z  
**Status:** PASS (Attempt 2 — after remediation)

---

## Summary

Structural drift analysis identified **9 violations** (3 CRITICAL, 3 HIGH, 3 MEDIUM) on Attempt 1. All violations were remediated in `plan.md` and `tasks.md` to align with the authoritative `spec.md`. Attempt 2 re-audit confirms full alignment. Implementation authorized.

This stage does not touch routing or template authority — routing registry check is N/A.

---

## Inputs Reviewed

- `specs/runtime/035-traditional-question-model/spec.md`
- `specs/runtime/035-traditional-question-model/plan.md`
- `specs/runtime/035-traditional-question-model/tasks.md`
- `docs/architecture/intelligence/ARCHITECTURE_MAP.json`
- `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json`

---

## Violations Detected (Attempt 1 → Attempt 2)

All 9 violations were remediated between Attempt 1 and Attempt 2.

| #   | Status   | Severity    | Violation Type       | Description                                                                                         | Remediation Applied                                                                                        |
| --- | -------- | ----------- | -------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| V1  | ✅ Fixed | 🚨 CRITICAL | Missing column       | `lesson_id` (UUID nullable FK → lessons.id) absent from plan data model + tasks T002                | Added to plan table, indexes, T002, T007, T008, T012, T016                                                 |
| V2  | ✅ Fixed | 🚨 CRITICAL | Missing column       | `correction_criteria` (JSONB nullable) absent from plan; `explanation` TEXT incorrectly substituted | Replaced `explanation` with `correction_criteria JSONB NULL` in plan; updated T002, T007, T008, T011, T016 |
| V3  | ✅ Fixed | 🚨 CRITICAL | Nullability mismatch | `correct_answer` marked NOT NULL in plan but spec requires nullable (SHORT_ANSWER optional)         | Changed to `NULL` with type-conditional requirement note in plan; updated T002, T007, T010                 |
| V4  | ✅ Fixed | ⚠️ HIGH     | Missing filters      | `lessonId`, `categoryValueId`, `tagId` absent from list query schema in plan + T016                 | Added all three to plan validation schema, T008 ListFilters, T012 repo filters, T016 Zod schema            |
| V5  | ✅ Fixed | ⚠️ HIGH     | Missing guard        | `subsection_id` immutability guard + `TRAD_QUESTION_SUBSECTION_IMMUTABLE` error code absent         | Added error code to plan registry (400), added to T009, T013 immutability guards                           |
| V6  | ✅ Fixed | ⚠️ HIGH     | Incomplete delete    | Plan/tasks only soft delete; spec requires dual soft/hard (hard only when DRAFT + zero refs)        | Updated plan TX strategy, added `hardDeleteQuestion` to T012, dual logic to T013, 200+deleteType to T022   |
| V7  | ✅ Fixed | ⚡ MEDIUM   | Scope expansion      | `is_revision_only`, `is_exam_only`, `difficulty_level` in plan but not in spec                      | Removed from plan data model table; excluded in T002, T007                                                 |
| V8  | ✅ Fixed | ⚡ MEDIUM   | Phantom columns      | `self_correction_type`, `self_correction_content` in T002 but not in spec or plan                   | Removed from T002; explicitly excluded in T007                                                             |
| V9  | ✅ Fixed | ⚡ MEDIUM   | Precision mismatch   | Score `NUMERIC(8,2)` in plan vs `NUMERIC(10,2)` in spec                                             | Changed to `NUMERIC(10,2)` in plan; confirmed in T002, T007                                                |

**Remediation Progress (Attempt 1 → Attempt 2):**

- ✅ Fixed: 9
- ❌ Remaining: 0
- 🆕 New: 0

---

## Audit Checklist

| Domain             | Check                                                     | Status | Notes                                                                              |
| ------------------ | --------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| Isolation          | No cross-tenant joins                                     | ✅     | All queries scoped to tenant DB via `c.get('tenant').pool`                         |
| Isolation          | Tenant resolver required for tenant DB access             | ✅     | Routes registered under workspace prefix with tenant middleware                    |
| License            | License middleware enforced before tenant DB access       | ✅     | Workspace routes include license validation middleware                             |
| Transactions       | All write paths transactional                             | ✅     | All 8 write operations use explicit BEGIN/COMMIT/ROLLBACK                          |
| Idempotency        | Replay protection defined for critical flows              | ✅     | UNIQUE constraints on join tables (23505 catch), SELECT FOR UPDATE for transitions |
| Snapshot Integrity | Snapshot remains immutable after start                    | N/A    | Not an attempt/exam engine stage                                                   |
| Versioning         | Schema/product compatibility checks enforced              | ✅     | Schema version bumped 1.18.0 → 1.19.0 in migration                                 |
| Observability      | Structured logs include correlation_id and workspace_slug | ✅     | T029 specifies structured logging with question_id, workspace_id, correlation_id   |
| Security           | No tenant override from request body                      | ✅     | Tenant resolved from middleware only                                               |
| Routing            | Routing authority registry complete                       | N/A    | No routing authority changes in this stage                                         |
| Templates          | Canonical parity for rewired consumers                    | N/A    | No template rewiring                                                               |
| Prompts            | Prompt surfaces synchronized                              | N/A    | No prompt changes                                                                  |
| Guidance           | Stale legacy references removed                           | N/A    | No legacy reference changes                                                        |
| Entrypoints        | Shell/loader paths resolve one authority                  | N/A    | No entrypoint changes                                                              |
| Validation Cadence | Per-batch smoke evidence recorded                         | N/A    | Not a routing stage                                                                |
| Validation Cadence | Full governance suite reruns                              | ✅     | Governance gate planned in implementation                                          |
| Stage Authority    | Stage-file requirements reflected in artifacts            | ✅     | All spec requirements covered in plan + tasks                                      |
| Support Surfaces   | Support surfaces have dispositions                        | N/A    | No support surface changes                                                         |
| Protected Surfaces | Protected files unchanged                                 | ✅     | No governance file modifications planned                                           |

---

## Guardian Verdicts

| Guardian               | Verdict          | Key Findings                                                                                                                                                                                       |
| ---------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structural Drift Audit | PASS (Attempt 2) | All 9 violations remediated. Spec↔Plan↔Tasks fully aligned                                                                                                                                         |
| Architecture           | PASS             | Database-per-tenant isolation preserved. No cross-app imports. Domain-core module follows existing MCQ pattern. New module registered via barrel export                                            |
| Security               | PASS             | Permission guards (readGuard, writeGuard, transitionGuard) defined. Input validation via Zod schemas. Rich text sanitization. No tenant override from body. FK RESTRICT prevents orphan references |
| Performance            | PASS             | B-tree indexes on all filter columns (7 indexes). Pagination enforced. ILIKE search scoped. Category/tag filters via subquery. SELECT FOR UPDATE for concurrency                                   |
| QA Coverage            | PASS             | 30 tasks cover: migration, schema, domain types, errors, validators, sanitizer, repository, service, validation schemas, route handlers, app registration, observability, arch guard               |

---

## Final Gate Decision

`PASS — Implementation authorized.`

All 9 structural drift violations from Attempt 1 have been remediated. Spec ↔ Plan ↔ Tasks are fully aligned. All audit criteria pass. Guardian verdicts are all PASS.

---

## Next Step

Proceed to Step 6 — Implement.
