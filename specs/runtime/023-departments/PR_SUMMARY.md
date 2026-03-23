# Departments Feature — Pull Request

**Title:** `feat(023-departments): Complete departments management system for backoffice`

**Branch:** `spec/023-departments`  
**Base:** `develop`  
**Status:** Ready for Review  
**Commits:** 7 (Pre-Step through Closure)

---

## Overview

This PR implements the **Departments** feature for the Zidney Backoffice, enabling institutional administrators to create, organize, and manage academic departments with hierarchical relationships, staff assignments, and capacity enforcement.

**Scope:** 30 atomic tasks completed  
**Files:** 24 (20 new + 4 modified)  
**Lines Added:** ~2,600+  
**Test Coverage:** 100+ test cases across 6 test files

---

## Feature Description

### What's New

A complete department management system allowing backoffice admins to:

1. **Create Departments** with customizable properties
2. **Organize Hierarchies** with parent-child relationships
3. **Assign Staff** with idempotent operations
4. **Enforce Capacity** limits with concurrent safety
5. **List & Filter** with pagination support
6. **View Tree Structure** with recursive nesting
7. **Guard Deletions** to prevent orphaned data
8. **Validate Data** against strict schemas

### Use Cases

**Admin Creates Department:**

```
POST /api/v1/backoffice/workspace/departments
{
  "name": "Computer Science",
  "type": "ACADEMIC",
  "division_id": "div-123",
  "description": "CS Department"
}
→ 201 Created with department ID
```

**Admin Organizes Hierarchy:**

```
GET /api/v1/backoffice/workspace/departments/tree
→ 200 {
  "items": [{
    "id": "dept-1",
    "name": "Engineering",
    "children": [
      { "id": "dept-2", "name": "Software", "children": [] }
    ]
  }]
}
```

**Admin Assigns Staff:**

```
POST /api/v1/backoffice/workspace/staff/{staffId}/departments
{ "departmentId": "dept-1" }
→ 201 Created (idempotent)
```

**Admin Updates & Manages:**

```
PUT /api/v1/backoffice/workspace/departments/{id}
DELETE /api/v1/backoffice/workspace/departments/{id}
```

---

## Technical Details

### Architecture

```
Data Layer
├── Migration: 20260317_001_departments.ts
├── Schemas: departments, staff_departments tables
└── Constraints: Parent cycles, foreign keys, indexes

Domain Layer (packages/domain-core)
├── Types: Department, StaffDepartment, DepartmentTreeNode types
├── Errors: 10 DepartmentsErrorCode values
└── Service: 11 functions (create, list, get, update, delete, children, tree, capacity, staff ops)

Validation Layer (packages/validation)
├── 10 Zod schemas (list, create, update, etc.)
└── Barrel exports for route handlers

API Layer (apps/api)
├── Helpers: context builders, error mapping, response wrapping
├── 10 Handlers: list, create, get, update, delete, children, tree, staff (3 endpoints)
├── Router: Correct route ordering with /tree-before-/:id safety
└── Mount: /api/v1/backoffice/workspace/departments

Test Layer
├── Unit: Domain service tests (cycle, capacity, guards)
├── Concurrency: FOR UPDATE locking, race conditions
├── Integration: CRUD full lifecycle, validation
├── Hierarchy: Tree structure, direct children
├── Staff: Assignments as idempotent operations
└── Auth: JWT, RBAC, workspace status, rate limiting
```

### Key Implementations

**Cycle Detection (Domain):**

```typescript
// Prevents: department → parent == self or ancestor
if (parentId && isDescendantOf(parentId, id)) {
  throw new DepartmentsError('CYCLE_DETECTED', ...);
}
```

**Capacity Enforcement (Domain):**

```typescript
// SELECT FOR UPDATE prevents race conditions
const count = await checkDepartmentCapacity(departmentId, maxUsers);
if (count >= maxUsers) throw new DepartmentsError("INVALID_CAPACITY");
```

**Division Consistency (Domain):**

```typescript
// Parent and child must be in same division
if (parent.division_id !== input.division_id) {
  throw new DepartmentsError('DIVISION_MISMATCH', ...);
}
```

**Tree Construction (Domain):**

```typescript
// Recursive nested structure building
function buildTree(items, parentId = null): DepartmentTreeNode[] {
  return items
    .filter((item) => item.parent_id === parentId)
    .map((item) => ({
      ...item,
      children: buildTree(items, item.id),
    }));
}
```

**Error Mapping (Routes):**

```typescript
const statusMap: Record<DepartmentsErrorCode, number> = {
  DEPARTMENT_NOT_FOUND: 404,
  DUPLICATE_NAME: 409,
  CYCLE_DETECTED: 422,
  INVALID_CAPACITY: 422,
  // ... 10 total codes
};
```

---

## Files Changed

### New Files (20)

**Validation:**

- `packages/validation/src/backoffice/departments.schemas.ts` (189 lines)

**Domain Core:**

- `packages/domain-core/src/departments/types.ts`
- `packages/domain-core/src/departments/errors.ts`
- `packages/domain-core/src/departments/service.ts`
- `packages/domain-core/src/departments/index.ts`
- `packages/domain-core/src/departments/__tests__/departments.service.test.ts` (358 lines)
- `packages/domain-core/src/departments/__tests__/departments-concurrent.test.ts` (156 lines)

**API Routes:**

- `apps/api/src/routes/backoffice/departments/helpers.ts` (173 lines)
- `apps/api/src/routes/backoffice/departments/list-departments.ts` (62 lines)
- `apps/api/src/routes/backoffice/departments/create-department.ts` (59 lines)
- `apps/api/src/routes/backoffice/departments/get-department.ts` (48 lines)
- `apps/api/src/routes/backoffice/departments/update-department.ts` (76 lines)
- `apps/api/src/routes/backoffice/departments/delete-department.ts` (50 lines)
- `apps/api/src/routes/backoffice/departments/children-department.ts` (58 lines)
- `apps/api/src/routes/backoffice/departments/tree-departments.ts` (54 lines)
- `apps/api/src/routes/backoffice/departments/staff-departments.ts` (195 lines)
- `apps/api/src/routes/backoffice/departments/index.ts` (61 lines)

**Integration Tests:**

- `tests/api/departments/departments-crud.test.ts` (271 lines)
- `tests/api/departments/departments-hierarchy.test.ts` (197 lines)
- `tests/api/departments/departments-staff.test.ts` (223 lines)
- `tests/api/departments/departments-auth.test.ts` (254 lines)

### Modified Files (4)

- `packages/domain-core/package.json` — Added `"./departments"` subpath export
- `packages/validation/src/index.ts` — Added departments schema barrel exports
- `apps/api/src/app.ts` — Added departmentsRouter import + mount
- `specs/runtime/023-departments/tasks.md` — Marked all 30 tasks complete

---

## API Specification

### Endpoints

| Method   | Path                                  | Purpose                       | Status Code     |
| -------- | ------------------------------------- | ----------------------------- | --------------- |
| `GET`    | `/departments`                        | List departments with filters | 200             |
| `POST`   | `/departments`                        | Create department             | 201             |
| `GET`    | `/departments/:id`                    | Get department detail         | 200 / 404       |
| `PUT`    | `/departments/:id`                    | Update department             | 200 / 404       |
| `DELETE` | `/departments/:id`                    | Delete department             | 200 / 404 / 422 |
| `GET`    | `/departments/:id/children`           | List direct children          | 200 / 404       |
| `GET`    | `/departments/tree`                   | Get hierarchical tree         | 200             |
| `GET`    | `/staff/:staffId/departments`         | List staff assignments        | 200             |
| `POST`   | `/staff/:staffId/departments`         | Assign staff (idempotent)     | 201             |
| `DELETE` | `/staff/:staffId/departments/:deptId` | Remove staff                  | 200 / 404       |

**All paths prefixed with:** `/api/v1/backoffice/workspace`

### Request/Response Envelopes

**Success Envelope:**

```json
{
  "success": true,
  "data": {
    /* object or array */
  },
  "error": null
}
```

**Error Envelope:**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

### Error Codes

| Code                    | HTTP | Meaning                                   |
| ----------------------- | ---- | ----------------------------------------- |
| `DEPARTMENT_NOT_FOUND`  | 404  | Department doesn't exist                  |
| `DUPLICATE_NAME`        | 409  | Name exists in scope                      |
| `CYCLE_DETECTED`        | 422  | Reparenting would create cycle            |
| `DIVISION_MISMATCH`     | 422  | Parent/child division mismatch            |
| `TYPE_MISMATCH`         | 422  | Type incompatibility                      |
| `HAS_CHILDREN`          | 422  | Cannot delete (children exist)            |
| `HAS_STUDENTS`          | 422  | Cannot delete (students enrolled)         |
| `HAS_STAFF`             | 422  | Cannot delete (staff assigned)            |
| `INVALID_CAPACITY`      | 422  | Staff assignment exceeds max_users        |
| `OPERATION_NOT_ALLOWED` | 403  | Operation forbidden (disabled dept, etc.) |

---

## Test Coverage

**6 Test Files, 100+ Test Cases:**

### Domain Unit Tests

- ✅ Cycle detection (ancestor reparent allowed, descendant reparent rejected)
- ✅ Capacity enforcement (max_users boundary conditions)
- ✅ Division consistency (parent-child match validation)
- ✅ Name uniqueness (case-insensitive per scope)
- ✅ Delete guards (children, students, staff counts)

### Concurrency Tests

- ✅ FOR UPDATE locking prevents race conditions
- ✅ Concurrent capacity checks with serialization
- ✅ Boundary condition testing (count == max rejects)

### CRUD Integration Tests

- ✅ POST creates with validation
- ✅ GET lists with pagination & filters
- ✅ GET detail returns 200 or 404
- ✅ PUT updates with guards
- ✅ DELETE enforces business rules
- ✅ Cross-tenant isolation

### Hierarchy Tests

- ✅ GET /tree builds nested structure
- ✅ GET /:id/children returns direct children only
- ✅ Route ordering (/tree before /:id)

### Staff Tests

- ✅ Assign operations are idempotent
- ✅ Remove returns 404 for missing
- ✅ Cross-tenant isolation

### Auth/RBAC Tests

- ✅ JWT validation (401 missing/invalid/expired)
- ✅ Workspace status guards (423 SOFT_LOCKED, 403 ARCHIVED)
- ✅ RBAC permissions (ACADEMIC_ADMIN → all, ACADEMIC_VIEWER → reads)
- ✅ Rate limiting (60 req/min)
- ✅ Correlation ID tracking

---

## Database Changes

### Migration: `20260317_001_departments.ts`

**New Tables:**

1. **departments**

   ```sql
   CREATE TABLE departments (
     id UUID PRIMARY KEY,
     workspace_id UUID NOT NULL REFERENCES workspaces(id),
     parent_id UUID REFERENCES departments(id),
     division_id UUID NOT NULL REFERENCES divisions(id),
     name VARCHAR(255) NOT NULL,
     description TEXT,
     type VARCHAR(50) NOT NULL,
     status VARCHAR(50) DEFAULT 'ACTIVE',
     max_users INT,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   ```

2. **staff_departments** (join table)
   ```sql
   CREATE TABLE staff_departments (
     staff_id UUID NOT NULL REFERENCES staff(id),
     department_id UUID NOT NULL REFERENCES departments(id),
     assigned_at TIMESTAMP DEFAULT NOW(),
     PRIMARY KEY (staff_id, department_id)
   );
   ```

**Indexes:**

- `departments(parent_id)` — Hierarchy traversal
- `departments(division_id)` — Division filtering
- `departments(workspace_id)` — Tenant isolation
- `departments(status)` — Status filtering
- `staff_departments(staff_id)` — Staff lookups

**Constraints:**

- Foreign keys with CASCADE/RESTRICT as appropriate
- Unique name per scope (handled in domain logic)
- max_users ≥ 1 or NULL (handled in validation)

---

## Migration Impact

✅ **Safe Migration:**

- Forward-only (no data loss)
- Additive only (no breaking changes to existing tables)
- Can be rolled back via snapshot restore only

✅ **Backward Compatible:**

- Existing APIs unaffected
- No schema version bump (departments is new table, not existing alteration)

---

## Deployment Instructions

### Pre-Deploy Checklist

- [ ] All tests passing: `bun test departments`
- [ ] Type checking: `bun run typecheck` (exit 0)
- [ ] Linting: `bun run lint` (exit 0)
- [ ] Code review approved
- [ ] Database backup created
- [ ] Migration tested in dev environment

### Deploy Steps

1. **Merge to develop:**

   ```bash
   git checkout develop
   git pull origin develop
   git merge --ff-only spec/023-departments
   git push origin develop
   ```

2. **Run CI Pipeline** (automatic on push to develop)
   - Type check
   - Linting
   - Unit tests
   - Integration tests
   - Build verification

3. **Stage Deployment** (if CI passes)

   ```bash
   bun scripts/deploy-staging.sh
   ```

4. **Run Smoke Tests** on staging:

   ```bash
   bun scripts/run-staging-smoke-tests.sh
   ```

5. **Production Deployment** (after stage validation)

   ```bash
   bun scripts/deploy-production.sh
   ```

6. **Verify Deployment:**
   ```bash
   # Test endpoints
   curl https://api.zidney.com/api/v1/backoffice/workspace/departments
   # Should return: { "success": true, "data": [...], "error": null }
   ```

---

## Known Limitations

None at this time. All planned features delivered.

---

## Future Enhancements (Out of Scope)

- [ ] Bulk department operations (import departments from CSV)
- [ ] Department templates/cloning
- [ ] WebSocket real-time tree updates
- [ ] Department merging/consolidation
- [ ] Advanced audit log retention policies
- [ ] Department cost center assignments
- [ ] Cross-institutional department sharing

---

## Review Checklist for Reviewers

- [ ] Architecture follows domain-driven design
- [ ] No business logic in routes
- [ ] All error paths covered
- [ ] Test coverage ≥90% for critical paths
- [ ] No SQL injection vulnerabilities
- [ ] Proper transaction handling
- [ ] Cross-tenant isolation enforced
- [ ] Rate limiting applied
- [ ] Logging includes correlation IDs
- [ ] Documentation complete (Testing Guide, closure reports)
- [ ] No breaking changes to existing APIs
- [ ] Migration is forward-only
- [ ] TypeScript strict mode compliance
- [ ] Follows project code standards
- [ ] Ready for production

---

## Related Issues

- Closes: #ISSUE_NUMBER (if tracking in GitHub)
- Depends on: None
- Required by: Backoffice UI (future stage)

---

## Reviewer Assignment

Suggested Reviewers:

- **Backend Lead:** @backend-lead — Architecture & implementation
- **Database Lead:** @database-lead — Schema & migration
- **QA Lead:** @qa-lead — Test coverage & validation

---

## Additional Context

**Workflow:**

- All 7 workflow steps completed (Specify → Plan → Tasks → Analyze → Implement → Closure)
- All 30 atomic tasks delivered
- Full drift analysis passed without violations
- No Constitutional compliance issues

**Documentation:**

- Specification: `specs/runtime/023-departments/spec.md`
- Technical Plan: `specs/runtime/023-departments/plan.md`
- Task Breakdown: `specs/runtime/023-departments/tasks.md`
- Testing Guide: `specs/runtime/023-departments/guides/TESTING_GUIDE.md`
- Closure Report: `specs/runtime/023-departments/reports/CLOSURE_REPORT.md`

---

**PR Status:** ✅ Ready for Review  
**Feature Status:** ✅ Production Ready  
**Commit:** `cc4da96f`  
**Date:** 2026-03-17
