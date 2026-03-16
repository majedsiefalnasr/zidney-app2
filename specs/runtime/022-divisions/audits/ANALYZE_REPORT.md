# Analyze Report — Divisions

**Step:** 5 — Analyze (Drift Detector)  
**Timestamp:** 2025-07-21T00:00:00Z  
**Status:** PASS

---

## Summary

Full drift audit completed for STAGE_22_DIVISIONS. speckit.analyze returned APPROVED (9/9 criteria).
All 4 composite guardians initially returned BLOCKED verdicts. The analysis-retry-engine protocol
was applied: all blocking issues were remediated across spec.md, data-model.md, plan.md, and
tasks.md. All 4 guardians were re-audited and returned PASS. Post-audit follow-up fixes from
QA (NEW-01/02/03/04) and Code Review (NI-1) were also applied before closure.

This stage does NOT touch routing authority, template surfaces, or agent prompt consumers.

---

## Inputs Reviewed

- `specs/runtime/022-divisions/spec.md`
- `specs/runtime/022-divisions/plan.md`
- `specs/runtime/022-divisions/tasks.md`
- `specs/runtime/022-divisions/data-model.md`

---

## Violations Detected (Initial Audit — All Remediated)

| #   | Violation Type       | Description                                                                               | Severity    | Owner                  | Remediation                                                            |
| --- | -------------------- | ----------------------------------------------------------------------------------------- | ----------- | ---------------------- | ---------------------------------------------------------------------- |
| 1   | Auth — Permission    | staff-division routes used wrong PermissionModule ("Staff") instead of ACADEMIC_STRUCTURE | 🚨 Critical | spec.md                | Changed all 3 staff-division route entries to ACADEMIC_STRUCTURE       |
| 2   | Isolation — FK       | staff_divisions.staff_id FK referenced `staff_users` instead of `backoffice_staff_users`  | 🚨 Critical | spec.md, data-model.md | Updated FK target to backoffice_staff_users throughout                 |
| 3   | SC-008 — Logging     | logger.info called inside try/catch after COMMIT — violates SC-008 pattern                | ⚠️ High     | plan.md                | Moved logger.info outside try/catch in all 7 service functions         |
| 4   | TOCTOU — Concurrency | isDivisionsEnabled() called before transaction; no lock held during gap                   | ⚠️ High     | plan.md                | Replaced with `SELECT … FOR SHARE` as first stmt inside each tx        |
| 5   | Concurrency — Lock   | removeStaffDivision min-one guard used COUNT without row lock; race condition possible    | ⚠️ High     | plan.md                | Replaced with `SELECT … FOR UPDATE` to acquire row-level lock          |
| 6   | RBAC — Test Gap      | T032 lacked 403/401 cases for PUT, PATCH, DELETE, POST staff, DELETE staff                | ⚠️ High     | tasks.md               | Added 403/401 test cases for all 5 mutation endpoints                  |
| 7   | API — Contract       | correlationId in error responses not documented                                           | ⚠️ High     | spec.md                | Added FR-023a defining correlationId extension in error object         |
| 8   | Migration — Steps    | spec.md migration missing workspace_settings.divisions_enabled step                       | ⚠️ High     | spec.md                | Expanded migration steps from 7 to 8; added Step 3                     |
| 9   | Index — Case         | UNIQUE(name) inline constraint does not handle case variants                              | ⚡ Medium   | data-model.md          | Replaced with functional index: LOWER(name) unique index               |
| 10  | Index — Keyset       | Missing (created_at, id) composite index for keyset pagination                            | ⚡ Medium   | data-model.md          | Added idx_divisions_created_at_id on (created_at ASC, id ASC)          |
| 11  | Tests — Migration    | No migration regression tests                                                             | ⚡ Medium   | tasks.md               | Added T034: migration regression test (6 scenarios)                    |
| 12  | Tests — Isolation    | No cross-tenant CRUD isolation tests                                                      | ⚡ Medium   | tasks.md               | Added T035: cross-tenant 404 isolation (tenant A/B)                    |
| 13  | Index — Redundant    | idx_staff_divisions_staff_id is redundant (PK leading column covers it)                   | ℹ️ Low      | data-model.md          | Removed from migration DDL and Drizzle schema                          |
| 14  | Schema — stale ref   | plan.md summary table still showed `varchar(255) NOT NULL UNIQUE` + `uniqueIndex`         | ⚡ Medium   | plan.md                | Updated summary table to reflect functional index pattern              |
| 15  | Spec — phantom index | spec.md staff_divisions Indexes listed phantom idx_staff_divisions_staff_id               | ℹ️ Low      | spec.md                | Removed; added note that PK leading column covers staff_id             |
| 16  | Tasks — stale refs   | T008/T009 still referenced uniqueIndex and idx_staff_divisions_staff_id                   | ⚡ Medium   | tasks.md               | Updated T008/T009 to reflect functional index ownership model          |
| 17  | Tasks — stale refs   | T010 described "two indexes on staff_id and division_id"                                  | ⚡ Medium   | tasks.md               | Updated to "one explicit index on division_id; PK covers staff-prefix" |
| 18  | Spec — type mismatch | spec.md status column typed as ENUM(ENABLED, DISABLED) instead of VARCHAR(20) + CHECK     | ℹ️ Low      | spec.md                | Updated type to VARCHAR(20) with CHECK note                            |
| 19  | Spec — missing index | spec.md divisions Indexes missing idx_divisions_created_at_id                             | ℹ️ Low      | spec.md                | Added idx_divisions_created_at_id to spec.md Indexes section           |
| 20  | Spec — table name    | spec.md Isolation section still said `staff_users` instead of `backoffice_staff_users`    | ℹ️ Low      | spec.md                | Updated to backoffice_staff_users                                      |
| 21  | ERD — ambiguous      | data-model.md ERD showed `name (UNIQUE)` — ambiguous for plain vs functional constraint   | ℹ️ Low      | data-model.md          | Updated to `name (UNIQUE via LOWER(name) functional idx)`              |

---

## Audit Checklist

| Domain             | Check                                                           | Status | Notes                                                                 |
| ------------------ | --------------------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| Isolation          | No cross-tenant joins                                           | ✅     | All queries scope to tenant DB; no global singleton                   |
| Isolation          | Tenant resolver required for tenant DB access                   | ✅     | plan.md uses `db` from tenant resolver context throughout             |
| License            | License middleware enforced before tenant DB access             | ✅     | spec.md mandates license middleware on all Backoffice division routes |
| Transactions       | All write paths transactional                                   | ✅     | All 7 service mutation functions use BEGIN/COMMIT/ROLLBACK            |
| Idempotency        | Replay protection defined for critical flows                    | ✅     | disableDivisions CTEs idempotent; T033 tests POST idempotency         |
| Snapshot Integrity | Snapshot remains immutable after start (if applicable)          | N/A    | No attempt engine involvement                                         |
| Versioning         | Schema/product compatibility checks enforced                    | ✅     | schema_version upgraded from 1.4.0 to 1.5.0 in migration STEP 8       |
| Observability      | Structured logs include `correlation_id` and `workspace_slug`   | ✅     | FR-023a; SC-008 pattern; plan.md logger calls include correlation_id  |
| Security           | No tenant override from request body                            | ✅     | Workspace resolved from middleware, not body                          |
| Routing            | Routing authority registry consulted where required             | N/A    | Stage does not touch routing authority surfaces                       |
| Templates          | Canonical parity for rewired legacy template consumers          | N/A    | Stage does not touch template consumers                               |
| Prompts            | Authoritative and compatibility prompt surfaces synchronized    | N/A    | Stage does not touch prompt surfaces                                  |
| Guidance           | Stale legacy references removed                                 | N/A    | Stage introduces new schema only                                      |
| Entrypoints        | Touched shell and loader paths resolve one authority model      | N/A    | No loader paths touched                                               |
| Validation Cadence | Per-batch smoke evidence recorded for routing-affecting batches | N/A    | No routing-affecting batches                                          |
| Validation Cadence | Full governance suite reruns after rewiring/hardening           | N/A    | Not applicable                                                        |
| Stage Authority    | Stage-file requirements reflected in analyzed artifacts         | ✅     | All spec requirements traceable to plan.md and tasks.md               |
| Support Surfaces   | Named in-scope support surfaces have explicit dispositions      | N/A    | No support surfaces in scope                                          |
| Protected Surfaces | Protected governance files remain unchanged                     | ✅     | No governance files modified                                          |

---

## Guardian Verdicts

| Guardian                     | Initial Verdict | Final Verdict | Key Findings                                                                                                      |
| ---------------------------- | --------------- | ------------- | ----------------------------------------------------------------------------------------------------------------- |
| zidney-security-auditor      | BLOCKED         | **PASS**      | S-High-1 (logger SC-008), S-Med-3 (UNIQUE(name)) → all resolved; no new High+                                     |
| zidney-performance-optimizer | BLOCKED         | **PASS**      | P-High-3/4 (TOCTOU, min-one lock), P-Med-1/4/7 (indexes) → all resolved; N-Low-1 only                             |
| zidney-qa-engineer           | BLOCKED         | **PASS**      | QA-I01/02/03/04 (FK, RBAC, migration tests, isolation tests) → all resolved; NEW-01..04 Low/Med follow-up applied |
| zidney-code-reviewer         | BLOCKED         | **PASS**      | CR-I1/2/3/4 (permission, FK, correlationId, migration steps) → all resolved; NI-1 Low follow-up applied           |

---

## Final Gate Decision

`PASS — Implementation authorized.`

All 4 guardians returned PASS on re-audit. All blocking issues remediated. Post-audit follow-up
fixes applied. `drift_passed = true`. `implementation_allowed = true`.

---

## Next Step

Proceed to Step 6 — Implement.
