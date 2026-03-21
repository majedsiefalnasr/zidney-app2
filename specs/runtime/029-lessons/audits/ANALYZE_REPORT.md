# Analyze Report — Lessons

**Step:** 5 — Analyze (Drift Detector)
**Timestamp:** 2026-03-21T01:00:00.000Z
**Status:** PASS
**Attempt:** 2 (Attempt 1 was BLOCKED — 2 medium violations remediated before this pass)

---

## Summary

Structural drift audit and composite guardian review passed on attempt 2. Two medium-severity violations detected in attempt 1 were fully remediated before re-audit:

- **Criterion 11 (fixed):** `deleteLesson` TX flow no longer passes `updated_at: new Date()` to `updateLessonRow`. The repository function sets `updated_at = NOW()` internally via SQL, enforcing server-authoritative time.
- **Criterion 12 (fixed):** All router mount references across plan.md (T023, Rollback steps 4–5, Deployment Notes checklist) now consistently reference `apps/api/src/app.ts` and `packages/domain-core/package.json`.

All 15 architectural criteria passed on attempt 2. No new violations introduced by fixes. Stage is architecturally compliant with Zidney Constitution v1.2.0. Implementation is authorized.

---

## Inputs Reviewed

- `specs/runtime/029-lessons/spec.md`
- `specs/runtime/029-lessons/plan.md` (3 fixes applied before attempt 2)
- `specs/runtime/029-lessons/tasks.md`
- `specs/runtime/029-lessons/data-model.md`

---

## Violations Detected

### Attempt 1 (BLOCKED — now resolved)

| #   | Violation Type             | Description                                                                                                                                               | Severity | Remediation                                                                                                                     |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Server-authoritative time  | `deleteLesson` TX passed `updated_at: new Date()` but `UpdateLessonInput` has no `updated_at` field — TypeScript compile error + clock drift risk         | MEDIUM   | Removed `updated_at: new Date()` from call site; documented that `updateLessonRow` sets `updated_at = NOW()` via SQL internally |
| 2   | Router mount inconsistency | Plan Deployment Notes checklist and Rollback steps 4–5 still referenced `apps/api/src/routes/backoffice/index.ts` and `packages/domain-core/src/index.ts` | MEDIUM   | Updated all occurrences to `apps/api/src/app.ts` and `packages/domain-core/package.json`                                        |

### Attempt 2

**None** — all criteria pass.

---

## Audit Checklist

| Domain             | Check                                                                                       | Status | Notes                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| Isolation          | No cross-tenant joins                                                                       | ✅     | All DB access via `c.get('tenant').pool`; no global singleton                                                       |
| Isolation          | Tenant resolver required for tenant DB access                                               | ✅     | `getDb` helper extracts pool from context; tenant resolver first in chain                                           |
| License            | License middleware enforced before tenant DB access; `GET /lessons/runtime` is license-only | ✅     | Route table confirms license-only for runtime; full stack for all other routes                                      |
| Transactions       | All write paths (`createLesson`, `updateLesson`, `deleteLesson`) transactional              | ✅     | Service layer manages `BEGIN/COMMIT/ROLLBACK`; repository never opens TX                                            |
| Idempotency        | Replay protection on all write paths                                                        | ✅     | Pre-check + `23505` catch on create/update; `LESSON_ALREADY_DISABLED` guard on delete; `IF NOT EXISTS` on migration |
| Snapshot Integrity | N/A — Lesson CRUD is synchronous; no attempt engine interaction                             | N/A    | —                                                                                                                   |
| Versioning         | `MIN_SCHEMA_VERSION = "1.13.0"` enforced before all handlers                                | ✅     | `409 SCHEMA_VERSION_MISMATCH` returned for tenants below `1.13.0`                                                   |
| Observability      | Structured logs include `correlation_id` and `workspace_slug`                               | ✅     | Log helpers receive context; `correlation_id` threaded via Hono context                                             |
| Security           | No tenant override from request body                                                        | ✅     | Tenant identity comes exclusively from slug middleware; no request-body override path                               |
| Route order        | `/lessons/runtime` registered before `/lessons/:id`                                         | ✅     | T022 and plan route table confirm correct ordering                                                                  |
| Routing            | Routing authority registry N/A — no agent/prompt/template routing in scope                  | N/A    | —                                                                                                                   |
| Templates          | N/A                                                                                         | N/A    | —                                                                                                                   |
| Prompts            | N/A                                                                                         | N/A    | —                                                                                                                   |
| Guidance           | N/A — no stale legacy template references in scope                                          | N/A    | —                                                                                                                   |
| Entrypoints        | Router mount in `app.ts`; subpath export in `package.json`                                  | ✅     | All three plan.md locations now consistent                                                                          |
| Validation Cadence | N/A — no multi-batch routing changes                                                        | N/A    | —                                                                                                                   |
| Stage Authority    | Requirements and boundaries fully reflected in plan.md and tasks.md                         | ✅     | 26 tasks cover all spec scenarios                                                                                   |
| Support Surfaces   | N/A                                                                                         | N/A    | —                                                                                                                   |
| Protected Surfaces | No governance files modified                                                                | ✅     | Only spec/plan/tasks/data-model artifacts created in stage runtime dir                                              |

---

## Architecture Drift Audit — 15 Criteria Detail

| #   | Criterion                                              | Status          | Notes                                                                                                         |
| --- | ------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Multi-tenancy isolation                                | ✅ PASS         | All DB queries scoped to tenant pool; no cross-tenant SQL                                                     |
| 2   | Transaction boundaries                                 | ✅ PASS         | Service owns all `BEGIN/COMMIT/ROLLBACK`; repository contract prohibits TX opening                            |
| 3   | License middleware                                     | ✅ PASS         | `/runtime` license-only; all other routes full-stack middleware                                               |
| 4   | Layer boundaries                                       | ✅ PASS         | domain-core has zero HTTP imports; handlers use context extraction only                                       |
| 5   | Schema version enforcement                             | ✅ PASS         | `MIN_SCHEMA_VERSION = "1.13.0"` enforced by schema-check middleware                                           |
| 6   | Idempotency                                            | ✅ PASS         | Two-layer duplicate guard on all write paths; `IF NOT EXISTS` on migration                                    |
| 7   | Route order                                            | ✅ PASS         | `/lessons/runtime` registered before `/lessons/:id`                                                           |
| 8   | `activeLessonsQuerySchema` vs `listLessonsQuerySchema` | ✅ PASS         | T017 uses `activeLessonsQuerySchema` with required `subject_id`                                               |
| 9   | `countLessonsForSubject` in dependency registry        | ✅ PASS         | `$1::uuid` cast; raw SQL; no Hono import                                                                      |
| 10  | Error contract                                         | ✅ PASS         | `{ success, data, error }` envelope; HTTP status mapping verified                                             |
| 11  | Server-authoritative time                              | ✅ PASS (fixed) | `deleteLesson` no longer passes `updated_at: new Date()`; `updateLessonRow` sets `updated_at = NOW()` via SQL |
| 12  | Router mount consistent                                | ✅ PASS (fixed) | T023, Rollback, Deployment Notes all say `app.ts` + `package.json`                                            |
| 13  | No Drizzle ORM                                         | ✅ PASS         | All queries raw parameterized SQL; no Drizzle schema files                                                    |
| 14  | Barrel export                                          | ✅ PASS         | `packages/domain-core/package.json` gets `"./lessons": "./src/lessons/index.ts"` subpath                      |
| 15  | Worker scope                                           | ✅ PASS         | Lesson CRUD is synchronous; no Worker or Redis dependency introduced                                          |

---

## Guardian Verdicts

| Guardian                                | Verdict | Key Findings                                                                                                                                                          |
| --------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zidney Architecture Checker (attempt 1) | BLOCKED | 2 medium violations: Node.js clock timestamp in DeleteLesson TX; inconsistent router mount paths                                                                      |
| Zidney Architecture Checker (attempt 2) | PASS    | All 15 criteria pass after remediation; both fixes confirmed; no new violations                                                                                       |
| zidney-security-auditor                 | PASS    | Parameterized SQL throughout; no tenant override from body; license middleware enforced; schema version gate                                                          |
| zidney-performance-optimizer            | PASS    | Indexed FK columns (`subject_id`, `status`); functional index on `LOWER(name)` for case-insensitive uniqueness; `countLessonsForSubject` is a single `COUNT(*)` query |
| zidney-qa-engineer                      | PASS    | All 6 routes covered in tasks; error paths (409, 422, 404, 423) mapped; idempotency replay tested at service layer                                                    |
| zidney-code-reviewer                    | PASS    | Mirrors STAGE_28_SUBJECTS pattern exactly; no novel abstractions; clear transaction boundary ownership                                                                |

---

## Remediation Diff (Attempt 1 → Attempt 2)

| Violation                                                          | Status   |
| ------------------------------------------------------------------ | -------- |
| Criterion 11: `updated_at: new Date()` in `deleteLesson` TX        | ✅ Fixed |
| Criterion 12: `backoffice/index.ts` in Rollback + Deployment Notes | ✅ Fixed |

Remediation progress: **2 fixed / 0 remaining / 0 new** → PASS

---

## Final Gate Decision

`PASS — Implementation authorized.`

All structural drift criteria pass. No constitutional violations detected. Architecture Checker verdict PASS on all 15 criteria. Security, performance, QA, and code-review guards all pass.

---

## Next Step

Proceed to Step 6 — Implement. (26 tasks, phases A–J)
