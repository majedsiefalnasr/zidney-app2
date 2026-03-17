# Analyze Report — Departments

**Step:** 5 — Analyze (Drift Detector)
**Timestamp:** 2026-03-17T03:00:00Z
**Stage:** Departments
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE
**Final Verdict:** ✅ APPROVED — All criteria passed

---

## Composite Guardian Results

| Guardian                           | Verdict     | Round Passed    |
| ---------------------------------- | ----------- | --------------- |
| speckit.analyze (structural drift) | ✅ APPROVED | Round 3 (final) |
| Zidney Security Auditor            | ✅ PASS     | Round 3 (final) |
| Zidney Performance Optimizer       | ✅ PASS     | Round 1         |
| Zidney QA Engineer                 | ✅ PASS     | Round 3 (final) |
| Zidney Code Reviewer               | ✅ PASS     | Round 3 (final) |

---

## Structural Drift Audit — 9 Criteria

| #   | Criterion                      | Status        |
| --- | ------------------------------ | ------------- |
| 1   | Tenant Isolation               | ✅ PASS       |
| 2   | License Middleware Enforcement | ✅ PASS       |
| 3   | Snapshot/Attempt Integrity     | ✅ PASS (N/A) |
| 4   | Transaction Boundaries         | ✅ PASS       |
| 5   | Idempotency                    | ✅ PASS       |
| 6   | API vs Worker Authority        | ✅ PASS       |
| 7   | Logging Deficiencies           | ✅ PASS       |
| 8   | Security Violations            | ✅ PASS       |
| 9   | Import Boundaries              | ✅ PASS       |

**All 9/9 criteria: PASS**

---

## Violation History and Remediation

### Round 1 — First Composite Audit

#### speckit.analyze

- ✅ APPROVED (9/9 pass)
- Observation: T030 for `departments-auth.test.ts` was in plan.md but missing from tasks.md

#### Security Auditor

- ❌ NO RESPONSE — agent failed; re-run scheduled

#### Performance Optimizer

- ✅ PASS with 4 medium non-blocking observations (documented below)

#### QA Engineer — ❌ BLOCKED

| ID      | Severity | Issue                                                            | Fix Applied                                                                                                              |
| ------- | -------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| BLOCK-1 | ⚠️ HIGH  | No cross-tenant isolation test in tasks.md                       | T026 expanded with cross-tenant scenario (tenant-A dept invisible from tenant-B)                                         |
| BLOCK-2 | ⚠️ HIGH  | No RBAC/auth tests; T030 absent from tasks.md                    | T030 added: `tests/api/departments/departments-auth.test.ts`                                                             |
| BLOCK-3 | ⚠️ HIGH  | T029 targeted API integration test on non-existent HTTP endpoint | T029 restructured as domain unit test at `packages/domain-core/src/departments/__tests__/departments-concurrent.test.ts` |

#### Code Reviewer — ❌ BLOCKED

| ID        | Severity  | Issue                                                                                                             | Fix Applied                                                                                                      |
| --------- | --------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| CR-HIGH-1 | ⚠️ HIGH   | `assignStaffDepartment` ON CONFLICT DO NOTHING returns 0 rows on duplicate — no SELECT to retrieve assignment row | plan.md step 4b added: `SELECT * FROM staff_departments WHERE staff_id = $1 AND department_id = $2` after INSERT |
| CR-HIGH-2 | ⚠️ HIGH   | `AuditContext.request_id` inconsistent with AGENTS.md `correlation_id`                                            | plan.md AuditContext + buildAuditCtx comment renamed to `correlation_id`                                         |
| CR-HIGH-3 | ⚠️ HIGH   | `departments.service.ts` module-level `createLogger` not specified in plan                                        | plan.md §2.3 preamble updated with `const logger = createLogger("departments-service")`                          |
| CR-MED-1  | ⚡ MEDIUM | `departmentErrorResponse` instanceof guard not explicit (advisory)                                                | Acknowledged; delegated to divisions pattern                                                                     |
| CR-MED-2  | ⚡ MEDIUM | Handler try/catch delegation not explicit (advisory)                                                              | Acknowledged; delegated to divisions pattern                                                                     |
| CR-LOW-1  | ℹ️ LOW    | `DbClient` missing from barrel exports                                                                            | plan.md §2.4 barrel: `type DbClient` added                                                                       |
| CR-LOW-2  | ℹ️ LOW    | `checkDepartmentCapacity` needs `@internal` annotation                                                            | plan.md `@internal` note added                                                                                   |

---

### Round 2 — Security Auditor Re-run (after Round 1 Fixes)

Security Auditor returned BLOCKED with 3 tasks.md issues found during re-check:

| ID      | Severity  | Issue                                                                                                              | Fix Applied                                                                |
| ------- | --------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| SA-R2-1 | ⚠️ HIGH   | T014 in tasks.md still contained `request_id` (plan.md was fixed but tasks.md missed)                              | T014 updated: `request_id` → `correlation_id` in buildAuditCtx description |
| SA-R2-2 | ⚡ MEDIUM | T028 POST staff-department asserted HTTP 201 but spec defines 200                                                  | T028 corrected: `(201)` → `(200)`                                          |
| SA-R2-3 | ⚡ MEDIUM | T030 missing 3 RBAC denial cases: GET without can_view, POST staff without can_edit, DELETE staff without can_edit | T030 expanded with all 3 required scenarios                                |

---

### Round 3 — speckit.analyze Structural Drift Re-audit (after Round 2 Fixes)

speckit.analyze returned BLOCKED due to one incomplete remediation:

| ID         | Severity | Issue                                                                                                                                                   | Fix Applied                                                                                                                                                    |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DRIFT-R3-1 | ⚠️ HIGH  | T029 fix was only applied to tasks.md; plan.md §6.3 still listed `tests/api/departments/departments-concurrent.test.ts` with HTTP status code narrative | plan.md §6.3 file path and narrative updated; Files to Create table updated to `packages/domain-core/src/departments/__tests__/departments-concurrent.test.ts` |

---

### Round 3 Final — All 4 Guardians (Clean Pass)

All 4 guardians returned PASS after all fixes applied. No remaining violations.

---

## Performance Optimizer — Non-Blocking Observations

These observations do not block implementation but are recorded for implementer awareness:

| #      | Observation                                     | Guidance                                                                                      |
| ------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| PERF-1 | Tree endpoint: O(n) in-app build from flat list | Acceptable for current stage; future pagination can be deferred                               |
| PERF-2 | Pair-cycle concurrent reparent race condition   | Ultra-rare; `SELECT FOR UPDATE` on `updateDepartment` target row mitigates common case        |
| PERF-3 | Cursor resolution in listDepartments            | Must document whether it sub-selects for `created_at` from cursor UUID or uses encoded cursor |
| PERF-4 | `students` index blocking on migration          | Near-instant build (all-NULL `department_id` at migration time); non-blocking                 |

---

## QA Engineer — Non-Blocking Standing Gap

| Gap                                                                 | Status                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| No automated test asserts `schema_version = '1.6.0'` post-migration | Non-blocking; consistent with platform convention (migration runner validates) |

---

## Implementation Notes Captured

The following architectural decisions verified during analysis must be respected during implementation:

- **`AuditContext.correlation_id`** — not `request_id`. Enforced in plan.md, tasks.md T014, and all service logger calls.
- **`assignStaffDepartment` step 4b** — mandatory SELECT after INSERT ON CONFLICT DO NOTHING to return the assignment row on both insert and idempotent-skip paths.
- **`checkDepartmentCapacity` @internal** — for use by student-assignment domain only; not a stable public API surface.
- **`type DbClient` barrel export** — required for future cross-stage consumers.
- **T029 is a domain unit test** — `checkDepartmentCapacity` has no HTTP endpoint in Stage 23. Test lives in `packages/domain-core/src/departments/__tests__/departments-concurrent.test.ts`.
- **T030 RBAC test** — `tests/api/departments/departments-auth.test.ts` — 10 endpoints without JWT → 401; `can_view` on write endpoints → 403; SOFT_LOCKED → 423; ARCHIVED → 403.
- **Router order is safety-critical** — `GET /departments/tree` must be registered before `GET /departments/:id` (T023).
- **Cursor pagination** — `listDepartments` must document cursor resolution method in code.

---

## Final Gate Status

```
Structural Drift Analysis:    ✅ PASSED (all 9/9 criteria)
Security Audit:               ✅ PASS
Performance Audit:            ✅ PASS (4 non-blocking observations recorded)
QA Audit:                     ✅ PASS
Code Review:                  ✅ PASS
───────────────────────────────────────────────────
Composite Gate:               ✅ APPROVED
Implementation:               AUTHORIZED
```
