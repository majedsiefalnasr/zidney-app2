# Stage 43 – License Limit Enforcement

**Phase:** 3 – Backoffice Core  
**Subdomain:** 05_USER_MANAGEMENT  
**Branch:** `spec/043-limit-enforcement`  
**Stage File:** `specs/phases/03_BACKOFFICE_CORE/05_USER_MANAGEMENT/STAGE_43_LIMIT_ENFORCEMENT.md`

---

## Objective

Implement complete, transactional enforcement of `student_limit` and `staff_limit` license constraints
across all user-creation entry points (creation, reactivation, bulk import — for both students and staff).

The current codebase has partial enforcement: student and staff creation are guarded under SERIALIZABLE
transactions, but reactivation paths have **no limit checks**, bulk import has **null-safety bugs**, the
type system has **inconsistencies** between middleware and domain, and no staff bulk import exists.

This stage closes all gaps and makes limit enforcement a hard, race-condition-safe contractual guarantee
across every path.

---

## Source of Truth

```
master_db.licenses
├── student_limit  INTEGER | NULL   (NULL = unlimited per workspace)
└── staff_limit    INTEGER | NULL   (NULL = unlimited per workspace)
```

Limits apply per workspace. Enforcement is against **ACTIVE** users only.

---

## Current State Analysis

### Working Correctly (no changes needed)

| Path                                                      | Status                        |
| --------------------------------------------------------- | ----------------------------- |
| `createStudent()` — SERIALIZABLE, limit-checked on insert | ✅ Correct                    |
| `createStaff()` — SERIALIZABLE, limit-checked on insert   | ✅ Correct (pending type fix) |
| `processBulkImport()` per-batch count check               | ✅ Correct (pending type fix) |

### Gaps Identified (must be fixed)

| ID  | Gap                                                                                               | Location                                                                                                | Severity |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| G1  | `enableStudent()` — no limit check before ACTIVE transition                                       | `packages/domain-core/src/students/students.service.ts`                                                 | CRITICAL |
| G2  | `enableStaff()` — no limit check before ACTIVE transition                                         | `packages/domain-core/src/staff/staff.service.ts`                                                       | CRITICAL |
| G3  | `enable-student.ts` — does not read `student_limit` from context                                  | `apps/api/src/routes/backoffice/students/enable-student.ts`                                             | CRITICAL |
| G4  | `enable-staff.ts` — does not read `staff_limit` from context                                      | `apps/api/src/routes/backoffice/staff/enable-staff.ts`                                                  | CRITICAL |
| G5  | `createStaff()` typed `staffLimit: number` not `number \| null`                                   | `packages/domain-core/src/staff/staff.service.ts`                                                       | HIGH     |
| G6  | `create-staff.ts` uses `?? 50` fallback for null limit (unlimited becomes 50)                     | `apps/api/src/routes/backoffice/staff/create-staff.ts`                                                  | HIGH     |
| G7  | `bulk-import-students.ts` assigns `license.student_limit` (null) to `number` type                 | `apps/api/src/routes/backoffice/students/bulk-import-students.ts`                                       | HIGH     |
| G8  | `processBulkImport()` typed `studentLimit: number` not `number \| null`                           | `packages/domain-core/src/students/students.bulk-import.ts`                                             | HIGH     |
| G9  | `bulkImportStudents()` typed `studentLimit: number` not `number \| null`                          | `packages/domain-core/src/students/students.service.ts`                                                 | HIGH     |
| G10 | Error helpers return raw domain code (`STUDENT_LIMIT_EXCEEDED`) not `LICENSE_LIMIT_REACHED` shape | `apps/api/src/routes/backoffice/students/helpers.ts`, `apps/api/src/routes/backoffice/staff/helpers.ts` | MEDIUM   |
| G11 | Staff bulk import feature does not exist                                                          | New files required in `packages/domain-core/src/staff/` and `apps/api/src/routes/backoffice/staff/`     | MEDIUM   |
| G12 | `BackofficeVariables.student_limit` and `staff_limit` typed as `number` not `number \| null`      | `apps/api/src/routes/backoffice/types.ts`                                                               | MEDIUM   |
| G13 | Middleware sets `student_limit`/`staff_limit` as string `'unlimited'` not `number \| null`        | `apps/api/src/middleware/license-enforcement.ts`                                                        | MEDIUM   |

---

## Functional Requirements

### FR-01 — Student creation blocked at limit

`createStudent()` already enforces the limit under SERIALIZABLE isolation. No logic change required.
Fix needed: parameter type `studentLimit` should be `number | null`; `null` means unlimited (already handled by `Number.MAX_SAFE_INTEGER` default, but explicit type is safer).

### FR-02 — Staff creation blocked at limit

`createStaff()` enforces the limit under SERIALIZABLE isolation. Fix required: parameter type
`staffLimit: number` → `number | null`. When `null`, skip the limit check (unlimited).

Route `create-staff.ts`: Remove `?? 50` fallback; pass `staff_limit` as-is (possibly `null`).

### FR-03 — Student bulk import respects limit (null = unlimited)

`processBulkImport()` and `bulkImportStudents()`: change `studentLimit: number` → `number | null`.
When `null`, skip per-batch count checks (unlimited). When number, enforce as today.

Route `bulk-import-students.ts`: change `const studentLimit: number = license.student_limit` →
`const studentLimit = c.get('student_limit')` (after middleware fix, this is `number | null` correctly typed).

### FR-04 — Staff bulk import respects limit (new feature)

Create staff bulk import with same pattern as student bulk import:

- `staff.bulk-import.ts` in `packages/domain-core/src/staff/` — `processStaffBulkImport()` with
  per-batch limit check, batch size 50, stops at limit
- `bulk-import-staff.ts` in `apps/api/src/routes/backoffice/staff/` — route handler reading
  `staff_limit` from context and passing it to the domain function
- Validation schema in `packages/validation/src/staff/` for CSV row shape
- Route registered on `POST /backoffice/:workspace_slug/v1/staff/bulk-import`

### FR-05 — Reactivation checks limit before enabling

After fix, `enableStudent(db, workspaceId, studentId, limit, audit)` and `enableStaff(db, workspaceId, staffId, limit, audit)` must:

1. Begin SERIALIZABLE transaction
2. Check ACTIVE count against limit
3. If `count >= limit` → throw `STUDENT_LIMIT_EXCEEDED` / `STAFF_LIMIT_EXCEEDED`
4. Else set `status = ACTIVE`, commit

Route handlers `enable-student.ts` and `enable-staff.ts` must pass `c.get('student_limit')` /
`c.get('staff_limit')` to the service functions.

### FR-06 — `null` limit means unlimited across ALL paths

Every code path that receives a limit value must handle `null` explicitly:

- Domain functions: `if (limit !== null && count >= limit) throw ...`
- Route handlers: read `number | null` from context, pass as-is
- Middleware: set `student_limit` and `staff_limit` as `number | null` (not string)

**No** `?? 50`, `?? 0`, or `String(... ?? 'unlimited')` conversions anywhere.

### FR-07 — Structured error response: `LICENSE_LIMIT_REACHED`

HTTP response when limit exceeded:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "LICENSE_LIMIT_REACHED",
    "type": "STUDENT_LIMIT",
    "limit_value": 200,
    "current_value": 200,
    "message": "Student limit reached for this workspace"
  }
}
```

HTTP status: **422** for students, **403** for staff (aligns with existing domain error HTTP maps).

Implementation: extend `StudentError` and `StaffError` to carry `limit_value` and `current_value`
fields. Map in `studentErrorResponse()` / `staffErrorResponse()` helpers: when error code is
`STUDENT_LIMIT_EXCEEDED` or `STAFF_LIMIT_EXCEEDED`, return `LICENSE_LIMIT_REACHED` shape with
type/limit_value/current_value from the error instance.

Internal domain error codes (`STUDENT_LIMIT_EXCEEDED`, `STAFF_LIMIT_EXCEEDED`) are preserved for
internal throws; only the HTTP response layer maps to `LICENSE_LIMIT_REACHED`.

### FR-08 — Type system consistency: `number | null` end-to-end

Full chain must be `number | null`:

1. `BackofficeVariables.student_limit: number | null` and `staff_limit: number | null`
2. Middleware sets `ctx.set('student_limit', license.student_limit ?? null)` (numeric or null)
3. Route handlers type-safely receive `number | null`
4. Domain functions accept `number | null`

**No string `'unlimited'` anywhere in this chain.**

---

## Non-Functional Requirements

### NFR-01 — SERIALIZABLE isolation for all limit checks

All paths that perform a count-then-insert or count-then-update pattern for limit enforcement must use
`BEGIN ISOLATION LEVEL SERIALIZABLE`. If two transactions race, PostgreSQL will abort one with
`ERROR: could not serialize access due to concurrent update`. The retry strategy is: do not retry;
return `LICENSE_LIMIT_REACHED` immediately (signals that the limit was concurrently reached).

### NFR-02 — Performance: sub-50ms COUNT under 50k users

The COUNT query must target the indexed `status` column (`status = 'ACTIVE'`). The `users` table
(students) and `staff` table must have a composite index on `(workspace_id, status)` or an index on
`status` within a tenant DB. V1 uses `SELECT COUNT(*)` with proper WHERE clause; no full scans.

---

## Enforcement Scope Table

| Entry Point            | Entity  | Enforced Today       | Fix Required                           |
| ---------------------- | ------- | -------------------- | -------------------------------------- |
| `createStudent()`      | Student | ✅ (SERIALIZABLE)    | Type signature: `number \| null`       |
| `createStaff()`        | Staff   | ✅ (SERIALIZABLE)    | Type: `staffLimit: number \| null`     |
| `bulkImportStudents()` | Student | ⚠️ (null bug)        | Type + null guard in processBulkImport |
| Bulk import staff      | Staff   | ❌ (not implemented) | Implement staff.bulk-import.ts + route |
| `enableStudent()`      | Student | ❌ (no check)        | Add SERIALIZABLE + count guard         |
| `enableStaff()`        | Staff   | ❌ (no check)        | Add SERIALIZABLE + count guard         |

---

## Error Contract (Formal)

| Field                 | Value                                   |
| --------------------- | --------------------------------------- |
| `code`                | `LICENSE_LIMIT_REACHED`                 |
| `type`                | `STUDENT_LIMIT` or `STAFF_LIMIT`        |
| `limit_value`         | integer (the configured limit)          |
| `current_value`       | integer (active count at time of check) |
| HTTP status (student) | 422                                     |
| HTTP status (staff)   | 403                                     |

### Structured Log Fields (required per rejection)

| Field            | Source                        |
| ---------------- | ----------------------------- |
| `workspace_slug` | tenant context                |
| `user_type`      | `student` or `staff`          |
| `limit_value`    | license field                 |
| `current_value`  | COUNT result                  |
| `request_id`     | `correlation_id` from context |

---

## Concurrency Model

Selected strategy: **SERIALIZABLE isolation level** (already in use for create paths).

PostgreSQL SERIALIZABLE guarantees no phantom reads. Concurrent `enableStudent` calls will conflict
on the status update. One will proceed, the other will get a serialization failure and must return
`LICENSE_LIMIT_REACHED` (do not retry at the API layer).

Advisory locks (`pg_advisory_xact_lock(workspace_id_hash)`) may be used as an alternative if
SERIALIZABLE proves too restrictive in testing. Decision deferred to implementation; document in
plan.md.

---

## Affected Files

### Packages (domain-core)

| File                                                        | Change                                                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain-core/src/students/students.service.ts`     | Fix: `enableStudent()` add limit param + SERIALIZABLE check; fix `bulkImportStudents()` to `number \| null`                |
| `packages/domain-core/src/students/students.bulk-import.ts` | Fix: `processBulkImport()` param to `number \| null`, skip check when null                                                 |
| `packages/domain-core/src/students/students.errors.ts`      | Fix: `StudentError` add `limit_value?: number` and `current_value?: number` fields                                         |
| `packages/domain-core/src/staff/staff.service.ts`           | Fix: `createStaff()` param to `number \| null`, skip check when null; `enableStaff()` add limit param + SERIALIZABLE check |
| `packages/domain-core/src/staff/staff.errors.ts`            | Fix: `StaffError` add `limit_value?: number` and `current_value?: number` fields                                           |
| `packages/domain-core/src/staff/staff.bulk-import.ts`       | New: `processStaffBulkImport()` — batch creation with per-batch limit check                                                |

### API Routes (apps/api)

| File                                                              | Change                                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/api/src/routes/backoffice/types.ts`                         | Fix: `student_limit: number \| null`, `staff_limit: number \| null` in `BackofficeVariables` |
| `apps/api/src/middleware/license-enforcement.ts`                  | Fix: set `student_limit` and `staff_limit` as `number \| null` not string                    |
| `apps/api/src/routes/backoffice/students/enable-student.ts`       | Fix: read `student_limit`, pass to `enableStudent()`                                         |
| `apps/api/src/routes/backoffice/staff/enable-staff.ts`            | Fix: read `staff_limit`, pass to `enableStaff()`                                             |
| `apps/api/src/routes/backoffice/students/bulk-import-students.ts` | Fix: null-safe limit read from context                                                       |
| `apps/api/src/routes/backoffice/staff/create-staff.ts`            | Fix: remove `?? 50` fallback                                                                 |
| `apps/api/src/routes/backoffice/students/helpers.ts`              | Fix: `studentErrorResponse()` map `STUDENT_LIMIT_EXCEEDED` → `LICENSE_LIMIT_REACHED` shape   |
| `apps/api/src/routes/backoffice/staff/helpers.ts`                 | Fix: `staffErrorResponse()` map `STAFF_LIMIT_EXCEEDED` → `LICENSE_LIMIT_REACHED` shape       |
| `apps/api/src/routes/backoffice/staff/bulk-import-staff.ts`       | New: route handler for `POST .../staff/bulk-import`                                          |

### Validation Package

| File                                                  | Change                                        |
| ----------------------------------------------------- | --------------------------------------------- |
| `packages/validation/src/staff/bulk-import.schema.ts` | New: Zod schema for staff bulk import CSV row |

---

## Hard Rules (from Stage Spec)

- No UI-only enforcement
- No cached counter shortcuts
- No silent overflow
- No eventual consistency window
- No cross-tenant limit aggregation
- License validation (middleware) runs **before** limit enforcement (route/domain)
- All limit checks inside a database transaction

---

## Out of Scope

- Aggregated counter table (v2 scaling concern, not v1)
- Frontend error display beyond receiving the structured error JSON
- Alerting on repeated limit hits (observability v2)
- Exam-related limits (separate stage)

---

## Clarifications

### Session 2026-04-04

**Q1 — HTTP status code for `LICENSE_LIMIT_REACHED`**

The stage spec says "No generic 500 errors allowed. Frontend must receive explicit failure reason."
It does not specify 422 vs 403. Existing domain error maps use 422 for `STUDENT_LIMIT_EXCEEDED` and
403 for `STAFF_LIMIT_EXCEEDED`. This stage preserves those values (aligns with existing test
expectations); the `LICENSE_LIMIT_REACHED` code is used at the HTTP response wrapper layer while
the underlying HTTP status is unchanged.

**Q2 — Error metadata: extend error class vs. read from context at route layer**

Decision: extend `StudentError` and `StaffError` to carry `limit_value` and `current_value` as
optional fields. Domain functions pass these when throwing, so the route helper can include them in
the `LICENSE_LIMIT_REACHED` response body without needing to re-query context. This is the cleanest
chain and keeps the HTTP response layer stateless.

**Q3 — `c.get('license')` usage in create-student.ts and create-staff.ts**

These routes call `c.get('license')` (which is NOT a declared key in `BackofficeVariables` and is
never set by the middleware). The routes are effectively relying on the license status check that
the `licenseEnforcementMiddleware` already performed upstream. The `license` context key is
undeclared. Stage 43 does NOT refactor these routes' license-status guard — that is an orthogonal
concern. Stage 43 only fixes the limit-value path (`c.get('student_limit')` / `c.get('staff_limit')`).

**Q4 — Advisory lock vs. SERIALIZABLE**

Use SERIALIZABLE for all new limit-check paths (consistent with existing `createStudent`/`createStaff`
pattern). Document the retry behavior: API layer does NOT retry on serialization failure; returns
`LICENSE_LIMIT_REACHED` immediately. Revisit advisory locks only if SERIALIZABLE causes excessive
rollback rates in load testing (out of scope here).

**Q5 — Staff bulk import: route prefix and version**

Route: `POST /backoffice/:workspace_slug/v1/staff/bulk-import`  
Consistent with student bulk import: `POST /backoffice/:workspace_slug/v1/students/bulk-import`

**Q6 — `correlation_id` vs `correlationId` in context**

`BackofficeVariables` declares `correlationId: string` (camelCase). Some middleware sets
`correlation_id` (snake_case). Stage 43 uses whichever key is already set in the route's context.
Check per-file and use consistently. No renaming in this stage.
