# Testing Guide — Departments Feature

**Stage:** Departments  
**Date:** 2026-03-17  
**Target Audience:** QA Engineers, Backend Developers, Integration Test Teams

---

## Quick Start: Run All Tests

```bash
# Unit + integration tests for departments
bun test departments

# Or run specific test suite
bun test packages/domain-core/src/departments/__tests__/
bun test tests/api/departments/

# With coverage
bun test --coverage departments
```

---

## Test Files Overview

| Test File                                                                       | Purpose               | Scenarios                                                  | Run Time |
| ------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------- | -------- |
| `packages/domain-core/src/departments/__tests__/departments.service.test.ts`    | Domain business logic | Cycle detection, capacity, division consistency, guards    | ~2s      |
| `packages/domain-core/src/departments/__tests__/departments-concurrent.test.ts` | Concurrency & locking | FOR UPDATE, capacity boundaries, race condition prevention | ~3s      |
| `tests/api/departments/departments-crud.test.ts`                                | Full CRUD lifecycle   | Create, read, update, delete, validation, isolation        | ~5s      |
| `tests/api/departments/departments-hierarchy.test.ts`                           | Tree structure        | Hierarchy navigation, tree building, route ordering        | ~3s      |
| `tests/api/departments/departments-staff.test.ts`                               | Staff assignments     | Assign, remove, list, cross-tenant check                   | ~4s      |
| `tests/api/departments/departments-auth.test.ts`                                | Auth & RBAC           | JWT, workspace status, permissions, rate limiting          | ~6s      |

**Total Runtime:** ~23 seconds per full suite

---

## Manual Testing Scenarios

### Scenario 1: Basic Department CRUD

**Setup:** Admin user with ACADEMIC_ADMIN role, active workspace

**Steps:**

1. **Create Department** (POST /api/v1/backoffice/workspace/departments)

   ```json
   {
     "name": "Computer Science",
     "type": "ACADEMIC",
     "division_id": "div-001",
     "description": "Computer Science Department"
   }
   ```

   **Expected:** 201 response with department ID

2. **List Departments** (GET /api/v1/backoffice/workspace/departments)
   **Expected:** 200 response with array containing created department

3. **Get Department Detail** (GET /api/v1/backoffice/workspace/departments/{id})
   **Expected:** 200 response with full department object

4. **Update Department** (PUT /api/v1/backoffice/workspace/departments/{id})

   ```json
   {
     "name": "Computer Science (Updated)",
     "description": "Updated description"
   }
   ```

   **Expected:** 200 response with updated fields

5. **Delete Department** (DELETE /api/v1/backoffice/workspace/departments/{id})
   **Expected:** 200 response with `{ "id": "..." }`

---

### Scenario 2: Department Hierarchy

**Setup:** Admin user, clean database

**Steps:**

1. **Create Root Department**

   ```json
   {
     "name": "Engineering",
     "type": "ACADEMIC",
     "division_id": "div-001"
   }
   ```

   Save ID as {PARENT_ID}

2. **Create Child Department**

   ```json
   {
     "name": "Software Engineering",
     "type": "ACADEMIC",
     "division_id": "div-001",
     "parent_id": "{PARENT_ID}"
   }
   ```

   Save ID as {CHILD_ID}

3. **Get Tree Structure** (GET /api/v1/backoffice/workspace/departments/tree)
   **Expected:** 200 response with nested structure:

   ```json
   {
     "items": [
       {
         "id": "{PARENT_ID}",
         "name": "Engineering",
         "children": [
           {
             "id": "{CHILD_ID}",
             "name": "Software Engineering",
             "children": []
           }
         ]
       }
     ]
   }
   ```

4. **Get Direct Children** (GET /api/v1/backoffice/workspace/departments/{PARENT_ID}/children)
   **Expected:** 200 with array of direct children only (not grandchildren)

5. **Attempt Invalid Parent Update** (PUT /api/v1/backoffice/workspace/departments/{PARENT_ID})
   ```json
   {
     "parent_id": "{CHILD_ID}"
   }
   ```
   **Expected:** 422 response with error code `CYCLE_DETECTED`

---

### Scenario 3: Staff Assignment

**Setup:** Admin user, existing departments, existing staff members with IDs {STAFF_ID_1}, {STAFF_ID_2}

**Steps:**

1. **Assign Staff to Department** (POST /api/v1/backoffice/workspace/staff/{STAFF_ID_1}/departments)

   ```json
   {
     "departmentId": "{DEPT_ID}"
   }
   ```

   **Expected:** 201 response

2. **Verify Idempotency** (POST same request again)
   **Expected:** 201 response again (idempotent)

3. **List Staff Assignments** (GET /api/v1/backoffice/workspace/staff/{STAFF_ID_1}/departments)
   **Expected:** 200 with array of department assignments sorted by assigned_at

4. **Remove Staff from Department** (DELETE /api/v1/backoffice/workspace/staff/{STAFF_ID_1}/departments/{DEPT_ID})
   **Expected:** 200 with `{ "departmentId": "...", "staffId": "..." }`

5. **Verify Removal** (GET same staff assignments)
   **Expected:** Department no longer in list

---

### Scenario 4: Capacity Enforcement

**Setup:** Admin user, department with max_users = 3

**Steps:**

1. **Assign 3 Staff Members** (POST staff assignments for staff IDs 1, 2, 3)
   **Expected:** All three succeed (201)

2. **Attempt to Assign 4th Staff** (POST for staff ID 4)
   **Expected:** 422 response with error code `INVALID_CAPACITY`

3. **Remove One Staff Member** (DELETE assignment for staff ID 1)
   **Expected:** 200

4. **Now Assign Different Staff** (POST for staff ID 5)
   **Expected:** 201 (capacity now available)

---

### Scenario 5: Cross-Tenant Isolation

**Setup:** Two workspaces with different tenant IDs

**Steps:**

1. **Create Department in Workspace A**

   ```json
   {
     "name": "Workspace A Dept",
     "division_id": "div-001"
   }
   ```

   Save ID as {DEPT_A_ID}

2. **Switch to Workspace B tenant context** (via subdomain/header)

3. **Attempt to Get Department from Workspace A** (GET /api/v1/backoffice/workspace/departments/{DEPT_A_ID})
   **Expected:** 404 NOT_FOUND (isolation verified)

4. **Attempt to Update Department from Workspace A** (PUT /api/v1/backoffice/workspace/departments/{DEPT_A_ID})
   **Expected:** 404 NOT_FOUND

5. **Attempt to Delete Department from Workspace A** (DELETE /api/v1/backoffice/workspace/departments/{DEPT_A_ID})
   **Expected:** 404 NOT_FOUND

---

### Scenario 6: Authorization & RBAC

**Setup:** Two users: ADMIN (ACADEMIC_ADMIN), VIEWER (ACADEMIC_VIEWER)

**Steps (as ADMIN):**

1. **Create Department**
   **Expected:** 201 (all operations allowed)

2. **Update Department**
   **Expected:** 200 (write allowed)

3. **Delete Department** (if empty)
   **Expected:** 200 (delete allowed)

**Steps (as VIEWER):**

1. **List Departments** (GET)
   **Expected:** 200 (read allowed)

2. **Get Department Detail** (GET)
   **Expected:** 200 (read allowed)

3. **Create Department** (POST)
   **Expected:** 403 FORBIDDEN (write denied)

4. **Update Department** (PUT)
   **Expected:** 403 FORBIDDEN (write denied)

5. **Delete Department** (DELETE)
   **Expected:** 403 FORBIDDEN (delete denied)

---

### Scenario 7: Validation Errors

**Test all validation constraints.**

1. **Missing Required Fields** (POST without name or type)
   **Expected:** 400 with validation error details

2. **Name Too Long** (name > 255 characters)
   **Expected:** 400 validation error

3. **Description Too Long** (description > 500 characters)
   **Expected:** 400 validation error

4. **Invalid Capacity** (max_users < 1)
   **Expected:** 400 validation error

5. **Invalid Parent Division Match** (child has different division than parent)
   **Expected:** 422 DIVISION_MISMATCH

6. **Duplicate Name in Same Scope**
   **Expected:** 409 DUPLICATE_NAME

---

### Scenario 8: Delete Guard Rules

**Setup:** Department with students and staff assigned

**Steps:**

1. **Attempt Delete with Active Assignments**
   **Expected:** 422 with error code `HAS_STUDENTS` or `HAS_STAFF`

2. **Remove All Students** (via separate API if applicable)

3. **Attempt Delete Again**
   **Expected:** Still 422 if staff remain

4. **Remove All Staff**

5. **Attempt Delete Again**
   **Expected:** 200 (success)

---

### Scenario 9: Workspace Status Enforcement

**Setup:** Admin user with workspace in SOFT_LOCKED or ARCHIVED state

**Steps (SOFT_LOCKED - status = 423):**

1. **Attempt Any Workspace Operation** (GET, POST, PUT, DELETE)
   **Expected:** 423 LOCKED response

2. **Resolve Lock** (upgrade license or fix status)

3. **Retry Operation**
   **Expected:** 200/201 (operation succeeds)

**Steps (ARCHIVED - status = 403):**

1. **Attempt Any Operation**
   **Expected:** 403 FORBIDDEN

---

### Scenario 10: Pagination & Filtering

**Setup:** Admin user, 25+ departments created

**Steps:**

1. **List Departments with Default Pagination**
   **Expected:** First 20 items returned with nextCursor

2. **Paginate to Next Page**

   ```
   GET /api/v1/backoffice/workspace/departments?cursor={nextCursor}
   ```

   **Expected:** Next 20 items

3. **Filter by Status**

   ```
   GET /api/v1/backoffice/workspace/departments?status=ACTIVE
   ```

   **Expected:** Only ACTIVE departments returned

4. **Filter by Division**

   ```
   GET /api/v1/backoffice/workspace/departments?division_id={DIVISION_ID}
   ```

   **Expected:** Only departments from that division

5. **Filter by Parent**

   ```
   GET /api/v1/backoffice/workspace/departments?parent_id={PARENT_ID}
   ```

   **Expected:** Only direct children of parent

6. **Combine Filters**
   ```
   GET /api/v1/backoffice/workspace/departments?status=ACTIVE&division_id={ID}
   ```
   **Expected:** Departments matching ALL filters (AND logic)

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Database is clean and migrations applied: `bun run db:migrate`
- [ ] Test data initialized: `bun run dev:seed:dashboard-test-data`
- [ ] Redis cache cleared (if applicable)
- [ ] API server running or available
- [ ] Auth tokens generated for test users

### Unit Tests Execution

```bash
# Run domain service tests
bun test packages/domain-core/src/departments/__tests__/departments.service.test.ts

# Check output for:
# ✓ Cycle detection tests passed
# ✓ Capacity enforcement tests passed
# ✓ Division consistency tests passed
# ✓ Name uniqueness tests passed
# ✓ Delete guard tests passed
```

### Concurrency Tests Execution

```bash
# Run concurrent operation tests
bun test packages/domain-core/src/departments/__tests__/departments-concurrent.test.ts

# Check output for:
# ✓ FOR UPDATE locking prevents race conditions
# ✓ Capacity boundaries enforced under concurrent load
# ✓ null max_users allows unlimited assignments
```

### Integration Tests Execution

```bash
# Run CRUD integration tests
bun test tests/api/departments/departments-crud.test.ts

# Check for:
# ✓ POST creates departments
# ✓ Validation errors returned correctly
# ✓ GET list pagination works
# ✓ GET detail returns 200 or 404
# ✓ PUT updates correctly
# ✓ DELETE enforces guards
# ✓ Cross-tenant isolation verified
```

### Hierarchy Tests Execution

```bash
# Run hierarchy tests
bun test tests/api/departments/departments-hierarchy.test.ts

# Check for:
# ✓ GET /tree returns nested structure
# ✓ GET /:id/children returns direct children only
# ✓ /tree route orders before /:id (no parse error)
# ✓ Empty tree handling
# ✓ Deep nesting support
```

### Staff Assignment Tests Execution

```bash
# Run staff tests
bun test tests/api/departments/departments-staff.test.ts

# Check for:
# ✓ List staff departments (sorted by assigned_at)
# ✓ Assign staff (idempotent)
# ✓ Fails on disabled/mismatch/missing
# ✓ Remove staff
# ✓ Cross-tenant isolation
```

### Auth & RBAC Tests Execution

```bash
# Run auth tests
bun test tests/api/departments/departments-auth.test.ts

# Check for:
# ✓ 401 without JWT
# ✓ 423 SOFT_LOCKED workspace
# ✓ 403 ARCHIVED workspace
# ✓ RBAC: ACADEMIC_ADMIN allows all
# ✓ RBAC: ACADEMIC_VIEWER allows reads only
# ✓ STAFF_ASSIGNMENT permission checks
# ✓ Cross-workspace 403/404
# ✓ Rate limiting (60 req/min)
# ✓ Correlation ID propagated
```

### Coverage Report

```bash
# Generate coverage
bun test --coverage departments

# Target metrics:
# Line coverage: >90%
# Branch coverage: >85%
# Function coverage: >90%
```

---

## Common Issues & Troubleshooting

### Issue: 404 NOT_FOUND on Valid Department ID

**Possible Causes:**

- Cross-tenant context mismatch (workspace ID in token vs. request)
- Department was deleted or doesn't exist
- Tenant resolver not extracting workspace ID correctly

**Debug Steps:**

1. Verify workspace ID in JWT token
2. Check department exists in same workspace: `SELECT * FROM departments WHERE id = ? AND workspace_id = ?`
3. Check correlation ID in logs matches request header

---

### Issue: 422 CYCLE_DETECTED When Reparenting to Ancestor

**This is expected behavior.** You cannot make a department its own descendant.

**Correct Usage:**

- Parent ID must not be in the subtree of the department being updated
- Reparenting to unrelated branch is allowed
- Reparenting to nil (root level) is allowed

---

### Issue: 422 DIVISION_MISMATCH

**Cause:** Parent department has different division_id than child.

**Resolution:**

- Ensure parent and child are in same division
- Or check if departments belong to different institutional divisions (intentional constraint)

---

### Issue: 422 HAS_CHILDREN / HAS_STUDENTS / HAS_STAFF

**Cause:** Cannot delete non-leaf departments or departments with assignments.

**Resolution:**

1. Delete or reassign children to different parent
2. Unenroll all students from department
3. Remove all staff assignments
4. Only then delete the department

---

### Issue: Rate Limit 429

**Cause:** Exceeded 60 requests per minute from same IP.

**Resolution:**

- Wait 1 minute for limit window to reset
- Or use different IP/test client
- Check `X-RateLimit-Remaining` header to monitor remaining quota

---

### Issue: Tests Hang

**Possible Causes:**

- Database connection not closing
- Redis connection not closing
- Middleware infinite loop

**Resolution:**

```bash
# Kill hanging test process
ps aux | grep vitest
kill -9 <PID>

# Run with timeout
bun test --timeout=30000 departments
```

---

## Performance Baselines

For load/stress testing, use these baselines:

| Operation                 | Expected Response Time | Notes                    |
| ------------------------- | ---------------------- | ------------------------ |
| GET list (empty filter)   | <100ms                 | Keyset pagination        |
| GET list (with 3 filters) | <150ms                 | Index scans              |
| POST create               | <200ms                 | Includes cycle detection |
| GET tree (100 depts)      | <300ms                 | Recursive build          |
| PUT update with reparent  | <250ms                 | Includes validation      |
| GET detail                | <50ms                  | Direct lookup            |
| DELETE (with guards)      | <150ms                 | Count checks             |

---

## Deployment Validation Checklist

Before deploying to production, run:

```bash
# Full test suite
bun test departments

# Type check
bun run typecheck

# Linting
bun run lint

# Build
bun run build

# Migration validation
bun scripts/db/migrate.ts --dry-run
```

All must pass (exit code 0).

---

## Contact & Support

For test failures or clarification:

- Backend Team: @engineering-team
- QA Lead: @qa-lead
- Database Team: @database-team

---

**Testing Guide Generated:** 2026-03-17  
**Feature Status:** Ready for QA
