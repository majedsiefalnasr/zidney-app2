# Implementation Plan — Stage 43: License Limit Enforcement

**Stage:** STAGE_43_LIMIT_ENFORCEMENT  
**Phase:** 03_BACKOFFICE_CORE / 05_USER_MANAGEMENT  
**Branch:** `spec/043-limit-enforcement`  
**Plan Date:** 2026-04-04

---

## Summary

This stage patches 13 gaps in license limit enforcement across the student and staff domains.
No schema migrations are required — all changes are application logic, type system fixes, and
a new staff bulk import feature.

**Architecture boundaries:**

- All domain changes in `packages/domain-core/src/`
- Type/schema changes in `packages/validation/src/`
- Route changes in `apps/api/src/routes/backoffice/`
- Middleware fix in `apps/api/src/middleware/`
- No shared tables, no cross-tenant access, no new DB columns

---

## Layer Architecture

```text
Request
  └─ license-enforcement.ts (middleware)        ← G13: fix string → number|null
       └─ BackofficeVariables (types.ts)         ← G12: fix number → number|null
            └─ Route Handlers                    ← G3,G4,G6,G7: fix limit reads
                 └─ Domain Service Functions     ← G1,G2,G5,G9: fix signatures + enable checks
                      └─ Bulk Import Domain      ← G8,G11: fix types + new staff bulk import
                           └─ Error Classes      ← G10: add limit_value/current_value fields
                                └─ Error Helpers ← G10: map to LICENSE_LIMIT_REACHED
```

---

## Dependency Order

Changes must be applied bottom-up to satisfy TypeScript type checking:

```text
Phase A — Foundation (types, error classes, middleware)
  ├─ G12: Fix BackofficeVariables types (types.ts)
  ├─ G13: Fix middleware limit setting (license-enforcement.ts)
  ├─ G10a: Extend StudentError with limit_value/current_value
  └─ G10b: Extend StaffError with limit_value/current_value

Phase B — Domain signatures (domain-core)
  ├─ G5: Fix createStaff staffLimit: number → number|null
  ├─ G8: Fix processBulkImport studentLimit: number → number|null
  └─ G9: Fix bulkImportStudents studentLimit: number → number|null

Phase C — Enable limit checks (domain-core — new logic)
  ├─ G1: enableStudent — add SERIALIZABLE + count check
  └─ G2: enableStaff — add SERIALIZABLE + count check

Phase D — Route handler fixes
  ├─ G3: enable-student.ts — pass studentLimit
  ├─ G4: enable-staff.ts — pass staffLimit
  ├─ G6: create-staff.ts — remove ?? 50 fallback
  └─ G7: bulk-import-students.ts — fix studentLimit read

Phase E — Error response mapping
  ├─ G10c: studentErrorResponse — map STUDENT_LIMIT_EXCEEDED → LICENSE_LIMIT_REACHED
  └─ G10d: staffErrorResponse — map STAFF_LIMIT_EXCEEDED → LICENSE_LIMIT_REACHED

Phase F — New feature: Staff bulk import
  ├─ New: StaffBulkImportRow, StaffBulkImportRowError, StaffBulkImportResult types (staff.types.ts)
  ├─ New: bulkImportStaffBodySchema + bulkImportStaffRowSchema (staff.schema.ts)
  ├─ New: processStaffBulkImport() (staff.bulk-import.ts)
  ├─ New: bulkImportStaff() service wrapper (staff.service.ts)
  ├─ New: handleBulkImportStaff() route handler (bulk-import-staff.ts)
  ├─ New: Register route in staff router (index.ts)
  └─ New: Export bulkImportStaff from staff domain barrel (staff/index.ts)

Phase G — Tests
  ├─ Unit tests for all domain function changes
  └─ Integration tests for route handlers (enable, create, bulk import)
```

---

## Detailed Design Decisions

### null Handling Pattern (applies everywhere)

```typescript
// All domain functions — null = unlimited
if (limit !== null && activeCount >= limit) {
  throw new XxxError('XXX_LIMIT_EXCEEDED', ...)
}
```

No `?? 0`, no `?? Number.MAX_SAFE_INTEGER`, no `String(... ?? 'unlimited')`.

### G1 + G2: enableStudent / enableStaff

New signature:

```typescript
enableStudent(db, workspaceId, studentId, studentLimit: number | null, audit): Promise<StudentRecord>
enableStaff(db, workspaceId, staffId, staffLimit: number | null, audit): Promise<StaffRecord>
```

Transaction upgrade from `BEGIN` → `BEGIN ISOLATION LEVEL SERIALIZABLE`.

Logic after finding the record:

```typescript
const activeCount = await countActiveXxx(client, workspaceId);
if (limit !== null && activeCount >= limit) {
  throw new XxxError("XXX_LIMIT_EXCEEDED", `Workspace has reached the limit of ${limit}`);
}
```

No retry on serialization failure — return `LICENSE_LIMIT_REACHED` immediately.

For `enableStudent`: uses `db.connect()` pattern (pool.connect()) — same as existing code.  
For `enableStaff`: upgrades from `db.query('BEGIN')` (pool-level) to `db.connect()` + client pattern (consistent with enableStudent after fix).

### G10: Error Class Extension

```typescript
// StudentError
constructor(code: StudentErrorCode, message?: string, public readonly limit_value?: number, public readonly current_value?: number)

// StaffError — same pattern
```

Both `limit_value` and `current_value` are optional — only set when code is `xxx_LIMIT_EXCEEDED`.

### G10: Response Mapping

```typescript
// In studentErrorResponse():
if (err instanceof StudentError) {
  if (err.code === "STUDENT_LIMIT_EXCEEDED") {
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: "LICENSE_LIMIT_REACHED",
          type: "STUDENT_LIMIT",
          limit_value: err.limit_value ?? null,
          current_value: err.current_value ?? null,
          message: err.message,
        },
      },
      422,
    );
  }
  // existing handling for other codes
}
```

### G11: Staff Bulk Import Feature

The `processStaffBulkImport` function mirrors the student bulk import pattern:

- Batch size: 50
- Per-batch SERIALIZABLE transaction
- Per-batch count check before each row
- `null` limit = unlimited (skip all count checks)
- Returns `StaffBulkImportResult` (same shape as `BulkImportResult`)
- Uses `findStaffByEmailForUpdate` + `countActiveStaff` + `insertStaff` from `staff.repository.ts`
- Does NOT require `divisionId` (staff have no division constraint)

Staff bulk import row schema (in `staff.schema.ts`):

```typescript
const bulkImportStaffRowSchema = z.object({
  email: z.string().email().max(320).toLowerCase(),
  name: z.string().trim().min(1).max(256),
  password: z.string().min(8).max(128),
  role_id: z.string().uuid().nullable().optional(),
});
const bulkImportStaffBodySchema = z.object({
  rows: z.array(bulkImportStaffRowSchema).min(1).max(500),
});
```

Route: `POST /backoffice/:workspace_slug/v1/staff/bulk-import`

---

## Files to Change

### Modify (existing)

| File                                                              | Gap(s) | Change                                                                                                                                                     |
| ----------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/routes/backoffice/types.ts`                         | G12    | `student_limit: number` → `number \| null`, `staff_limit: number` → `number \| null`                                                                       |
| `apps/api/src/middleware/license-enforcement.ts`                  | G13    | `ctx.set('student_limit', String(license.student_limit ?? 'unlimited'))` → `ctx.set('student_limit', license.student_limit ?? null)`, same for staff_limit |
| `packages/domain-core/src/students/students.errors.ts`            | G10a   | Add optional `limit_value?: number`, `current_value?: number` to `StudentError` constructor                                                                |
| `packages/domain-core/src/staff/staff.errors.ts`                  | G10b   | Add optional `limit_value?: number`, `current_value?: number` to `StaffError` constructor                                                                  |
| `packages/domain-core/src/staff/staff.service.ts`                 | G5, G2 | `createStaff` staffLimit `number` → `number \| null`; `enableStaff` add limit param + SERIALIZABLE                                                         |
| `packages/domain-core/src/students/students.bulk-import.ts`       | G8     | `studentLimit: number` → `number \| null`; guard: `if (limit !== null && ...)`                                                                             |
| `packages/domain-core/src/students/students.service.ts`           | G9, G1 | `bulkImportStudents` studentLimit `number` → `number \| null`; `enableStudent` add limit param + SERIALIZABLE                                              |
| `apps/api/src/routes/backoffice/students/enable-student.ts`       | G3     | Read `c.get('student_limit')`, pass to `enableStudent()`                                                                                                   |
| `apps/api/src/routes/backoffice/staff/enable-staff.ts`            | G4     | Read `c.get('staff_limit')`, pass to `enableStaff()`                                                                                                       |
| `apps/api/src/routes/backoffice/staff/create-staff.ts`            | G6     | Remove `?? 50`; read `c.get('staff_limit')` (typed `number \| null`)                                                                                       |
| `apps/api/src/routes/backoffice/students/bulk-import-students.ts` | G7     | Replace `license.student_limit` with `c.get('student_limit')`                                                                                              |
| `apps/api/src/routes/backoffice/students/helpers.ts`              | G10c   | Map `STUDENT_LIMIT_EXCEEDED` → `LICENSE_LIMIT_REACHED` shape                                                                                               |
| `apps/api/src/routes/backoffice/staff/helpers.ts`                 | G10d   | Map `STAFF_LIMIT_EXCEEDED` → `LICENSE_LIMIT_REACHED` shape                                                                                                 |
| `packages/domain-core/src/staff/staff.types.ts`                   | G11    | Add `StaffBulkImportRow`, `StaffBulkImportRowError`, `StaffBulkImportResult` interfaces                                                                    |
| `packages/validation/src/staff.schema.ts`                         | G11    | Add `bulkImportStaffRowSchema`, `bulkImportStaffBodySchema`, exported types                                                                                |
| `packages/validation/src/index.ts`                                | G11    | Export new staff bulk import schemas/types                                                                                                                 |
| `packages/domain-core/src/staff/index.ts`                         | G11    | Export `bulkImportStaff`, new bulk import types                                                                                                            |

### Create (new)

| File                                                        | Gap | Purpose                                    |
| ----------------------------------------------------------- | --- | ------------------------------------------ |
| `packages/domain-core/src/staff/staff.bulk-import.ts`       | G11 | `processStaffBulkImport()` domain function |
| `apps/api/src/routes/backoffice/staff/bulk-import-staff.ts` | G11 | `handleBulkImportStaff()` route handler    |

### Route Registration

| File                                            | Change                                            |
| ----------------------------------------------- | ------------------------------------------------- |
| `apps/api/src/routes/backoffice/staff/index.ts` | Add `POST /bulk-import` → `handleBulkImportStaff` |

---

## Testing Plan

### Unit Tests (packages/domain-core)

- `enableStudent()` — ACTIVE count at limit → throws STUDENT_LIMIT_EXCEEDED
- `enableStudent()` — ACTIVE count below limit → succeeds
- `enableStudent()` — null limit (unlimited) → succeeds regardless of count
- `enableStaff()` — same 3 cases
- `createStaff()` — null limit (unlimited) → succeeds
- `processStaffBulkImport()` — at limit → rows skipped with STAFF_LIMIT_EXCEEDED code
- `processStaffBulkImport()` — null limit → all rows processed
- `processBulkImport()` (student) — null limit → all rows processed

### Integration Tests (apps/api)

- `PATCH /students/:id/enable` — returns 422 with `LICENSE_LIMIT_REACHED` shape when at student limit
- `PATCH /staff/:id/enable` — returns 403 with `LICENSE_LIMIT_REACHED` shape when at staff limit
- `POST /staff` — returns 403 when staff_limit=0 (unlimited null passes through)
- `POST /staff/bulk-import` — returns 200, processes rows, stops at limit
- `POST /students/bulk-import` — null limit processes all rows

---

## Risk Assessment

| Risk                                                    | Severity | Mitigation                                                                                                   |
| ------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| Serialization failures on concurrent enable             | MEDIUM   | Return LICENSE_LIMIT_REACHED immediately (no retry). Document in error response.                             |
| Staff bulk import missing divisionId                    | LOW      | Staff have no division_id column — N/A, no change needed.                                                    |
| Breaking change to enableStudent/enableStaff signatures | HIGH     | Update all callers (route handlers) in same PR. TypeScript compile confirms all callers updated.             |
| Middleware string→null change breaks existing routes    | HIGH     | All routes reading student_limit/staff_limit use c.get() which is typed. Number null is backward compatible. |

---

## Architecture Governance Compliance

- ✅ No cross-tenant logic
- ✅ No direct DB instantiation (uses pool/DbClient)
- ✅ All writes transactional (SERIALIZABLE)
- ✅ Package boundaries respected (`packages/*` → no `apps/*` imports)
- ✅ No HTTP in domain-core
- ✅ Server-authoritative COUNT queries only
- ✅ Error contract follows `{ success, data, error }` shape
- ✅ No business logic in frontend (UI not touched)
