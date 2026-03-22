# Plan Report — Category Values

**Step:** 3 — Plan  
**Timestamp:** 2026-03-22T14:30:00.000Z  
**Status:** COMPLETE

---

## Summary

Technical plan for the Category Values feature is complete and guardian-validated. The plan covers
4 database tables (1 primary + 2 optional scope linking tables + 1 shared translations reference),
5 API endpoints, 21 error codes, full transaction discipline, and soft-delete idempotency. Two
guardian passes were required to remediate: 7 violations across Architecture Guardian and API
Designer iterations. All violations are resolved; both guardians returned VERDICT: PASS.

---

## Inputs Reviewed

- `specs/runtime/031-category-values/spec.md` (including clarifications from 2026-03-22)
- `specs/runtime/031-category-values/plan.md` (23 sections, ~32KB)
- `specs/runtime/031-category-values/research.md` (11 decisions, 11KB)
- `specs/runtime/031-category-values/data-model.md` (DDL, Drizzle schema, types, 17KB)
- `specs/runtime/031-category-values/contracts/api-contracts.md` (5 endpoints, 17KB)

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| API       | New router `createCategoryValuesRouter()` with 5 handlers; writeGuard on POST/PATCH/DELETE                                 |
| Worker    | None                                                                                                                       |
| Frontend  | None (backoffice implementation is out of scope for this stage)                                                            |
| DB Master | None                                                                                                                       |
| DB Tenant | 3 new tables: `category_values`, `category_value_subjects`, `category_value_divisions`; shared `translations` table reused |

---

## Key Technical Decisions

| #   | Decision                                                                  | Rationale                                                                                             |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Soft-delete (deleted_at) not hard delete                                  | Preserve referential integrity for questions/exams that may reference values                          |
| 2   | Translations in shared `translations` table                               | Consistent with platform convention (Categories, Tags, etc.) — avoids column proliferation            |
| 3   | Translation response grouped by language_code                             | API presents `{ language_code, name, description }` objects; DB stores separate rows per field_name   |
| 4   | FOR UPDATE NOWAIT on all write operations                                 | Prevents phantom updates on concurrent PATCH/DELETE; fails fast with 409 CATEGORY_VALUE_LOCK_CONFLICT |
| 5   | Scope enforcement at service layer                                        | subject_ids and division_ids validated against parent category scope before persist                   |
| 6   | include_deleted=true gated on classification_manage                       | Prevents non-admin users from seeing deleted values in list responses                                 |
| 7   | schema_version 1.15.0 enforcement                                         | Tenant schema must be at least 1.15.0 before any category_values endpoints execute                    |
| 8   | Delete idempotency: already-deleted → 200 { deleted: true }               | Repeat DELETE on a soft-deleted value silently succeeds; safe for retry logic                         |
| 9   | CATEGORY_VALUE_FORBIDDEN replaced with FORBIDDEN                          | Platform-standard FORBIDDEN (403) used for permission failures; no domain-specific 403 code           |
| 10  | Scope linking tables (category_value_subjects/divisions) are optional     | Empty array = globally scoped; non-empty = restricted to listed IDs                                   |
| 11  | Status workflow: COMPLETED → UNDER_REVIEW → APPROVED → ENABLED ↔ DISABLED | Exam-centric lifecycle; only ENABLED values visible to exam-taking apps                               |

---

## Migration Impact

| Item                  | Value | Notes                                                      |
| --------------------- | ----- | ---------------------------------------------------------- |
| Migration required    | Yes   | 3 new tenant tables + indexes                              |
| `schema_version` bump | Yes   | 1.14.x → 1.15.0                                            |
| Backward compatible   | Yes   | Additive-only; no existing tables modified                 |
| CONCURRENTLY indexes  | Yes   | All indexes created CONCURRENTLY outside transaction block |
| IF NOT EXISTS guards  | Yes   | All CREATE TABLE and CREATE INDEX use IF NOT EXISTS        |

---

## Transaction Boundaries

- `createCategoryValue` — full TX: validation → insert category_value + scope rows + translations (IF NOT EXISTS error codes: CATEGORY_VALUE_CODE_DUPLICATE via PG 23505)
- `updateCategoryValue` — full TX: FOR UPDATE NOWAIT → validate → update row + scope + translations (PG 55P03 → CATEGORY_VALUE_LOCK_CONFLICT; PG 23505 → CATEGORY_VALUE_CODE_DUPLICATE)
- `deleteCategoryValue` — full TX: FOR UPDATE NOWAIT → dependency check → soft-delete (PG 55P03 → CATEGORY_VALUE_LOCK_CONFLICT)
- `listCategoryValues` — read-only, no TX
- `getCategoryValue` — read-only, no TX

---

## Idempotency Strategy

- `createCategoryValue` — protected by CATEGORY_VALUE_CODE_DUPLICATE (409) on duplicate (category_id, LOWER(code)); safe for retry with different codes
- `updateCategoryValue` — PATCH is idempotent: applying the same patch twice yields the same state
- `deleteCategoryValue` — fully idempotent: second call on already-soft-deleted value returns `{ deleted: true }` (200) without error
- `listCategoryValues` / `getCategoryValue` — GET is naturally idempotent

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                                                 |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | All queries use per-tenant `db` from tenant resolver; no global DB singleton          |
| All writes are transactional by design | ✅     | All write services open explicit `db.transaction()` blocks                            |
| Server-authoritative time enforced     | ✅     | `deleted_at = NOW()`, `updated_at = NOW()` — never client-supplied                    |
| License middleware enforced            | ✅     | License middleware applied at router factory level; SOFT_LOCKED → 423; ARCHIVED → 403 |
| Version compatibility enforced         | ✅     | schema_version 1.15.0 check as first middleware step on all routes                    |
| No architecture redesign without ADR   | ✅     | Plan uses existing domain-core DDD patterns; no new module types introduced           |

**Overall:** COMPLIANT

---

## Guardian Verdicts

| Guardian              | Attempt | Verdict  | Violations                                                                                                |
| --------------------- | ------- | -------- | --------------------------------------------------------------------------------------------------------- |
| Architecture Guardian | 1       | BLOCKED  | 4 issues (writeGuard missing, 55P03 catch missing, include_deleted gate undeclared, column name mismatch) |
| API Designer          | 1       | BLOCKED  | 2 issues (CATEGORY_VALUE_FORBIDDEN undefined, DELETE 409 row missing)                                     |
| Architecture Guardian | 2       | BLOCKED  | 3 issues (CATEGORY_VALUE_FORBIDDEN not in catalog, admin_manage undefined, GET 403 row missing)           |
| API Designer          | 2       | BLOCKED  | 2 issues (CATEGORY_VALUE_FORBIDDEN not in catalog, translation shape ambiguity)                           |
| Architecture Guardian | 3       | BLOCKED  | 1 issue (delete idempotency: already-deleted case returning 404)                                          |
| API Designer          | 3       | BLOCKED  | 1 issue (translation field key clarification note missing)                                                |
| Architecture Guardian | 4       | **PASS** | 0                                                                                                         |
| API Designer          | 4       | **PASS** | 0                                                                                                         |

All violations resolved across 4 remediation cycles.

---

## Open Risks

- `category_value_subjects` and `category_value_divisions` are optional scope tables; any integration
  bugs with parent scope enforcement (`CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT`) should be caught by
  integration tests before merging.
- Dependency registry check (`checkValueDependencies`) requires the questions and exam configuration
  packages to register their dependency functions at boot time; ensure those are registered in the
  relevant domain package.

---

## Next Step

Proceed to Step 4 — Tasks.
