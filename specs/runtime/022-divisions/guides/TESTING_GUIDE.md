# Testing Guide — Divisions

**Stage:** Divisions (STAGE_22_DIVISIONS)  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Stage Directory:** `spec/022-divisions`  
**Generated On:** 2026-03-16

---

## Purpose

This guide explains how to validate the Divisions implementation end-to-end. Divisions introduce the primary academic isolation layer within a Zidney workspace, enabling scoping of students, staff, subjects, exams, and other academic entities.

---

## Summary of Delivered Behavior

The Divisions feature provides:

- **Division CRUD** — Create, read, update, delete divisions within a workspace
- **Staff Assignment** — Assign staff to divisions (many-to-many relationship)
- **Status Management** — Enable/disable individual divisions
- **Feature Toggle** — Switch workspaces between multi-division and single-division mode
- **Default Division** — Immutable default division (cannot be deleted)
- **Disable-All-Divisions** — Privileged operation to reassign all students to default division and lock the workspace into single-division mode

Key outcomes:

- Divisions control visibility and access grouping for all academic entities
- Student records are scoped to exactly one division (NOT NULL FK)
- Staff can be assigned to multiple divisions
- Divisions are isolated per-tenant (database-per-tenant)
- All operations are transactional and RBAC-enforced

---

## Prerequisites

| Requirement              | Validation Command / Check                |
| ------------------------ | ----------------------------------------- |
| Node.js installed        | `node --version` (v20+)                   |
| Bun installed            | `bun --version` (v1+)                     |
| Docker running           | `docker ps`                               |
| Environment file present | Verify `.env` or `.env.local` exists      |
| Migrations applied       | `bun run db:migrate`                      |
| Branch checked out       | `git branch` shows `spec/022-divisions`   |
| Dependencies installed   | `bun install` (run if needed)             |
| API server starts        | `bun run dev:api` (starts without errors) |

---

## Files in Scope

**Database:**

```
apps/api/src/db/tenant/migrations/20260316_001_divisions.ts
apps/api/src/db/tenant/schemas/divisions.schema.ts
```

**Domain Layer:**

```
packages/domain-core/src/divisions/types.ts
packages/domain-core/src/divisions/errors.ts
packages/domain-core/src/divisions/service.ts
packages/domain-core/src/divisions/index.ts
packages/validation/src/divisions-validation.ts
```

**API Layer:**

```
apps/api/src/routes/backoffice/divisions/index.ts
apps/api/src/routes/backoffice/divisions/handlers.ts
apps/api/src/routes/backoffice/divisions/helpers.ts
apps/api/src/routes/backoffice/divisions/middleware.ts
apps/api/src/routes/backoffice/index.ts (updated to mount divisions router)
```

**Tests:**

```
packages/domain-core/src/divisions/divisions.test.ts (36 domain tests)
apps/api/src/routes/backoffice/divisions/divisions.integration.test.ts (42 integration tests)
apps/api/src/db/tenant/migrations/divisions-migration.test.ts (13 migration tests)
```

---

## Local Development Commands

```bash
# Install dependencies
bun install

# Apply migrations to dev/test database
bun run db:migrate

# Start API server (localhost:3000)
bun run dev:api

# Run all tests
bun test

# Run divisions tests only
bun test divisions

# Generate coverage report
bun test --coverage
```

---

## Automated Validation Commands

```bash
# Unit tests (domain-core divisions service)
bun test packages/domain-core/src/divisions/divisions.test.ts

# Integration tests (API endpoints)
bun test apps/api/src/routes/backoffice/divisions/divisions.integration.test.ts

# Migration tests (schema and constraints)
bun test apps/api/src/db/tenant/migrations/divisions-migration.test.ts

# All tests
bun test

# All tests with coverage
bun test --coverage
```

**Expected outcome:** All 265 divisions-related tests pass (99 integration + 166 unit).

---

## Manual Test Scenarios

### Scenario 1 — Create Division (Happy Path)

**Purpose:** Verify authenticated backoffice staff can create a new division with valid data.

**Prerequisites:**

- API running on localhost:3000
- Authenticated as backoffice staff with ADMIN role
- `divisions_enabled = true` in workspace_settings

**Steps:**

1. Send POST request:

   ```bash
   curl -X POST http://localhost:3000/backoffice/divisions \
     -H "Authorization: Bearer <admins_token>" \
     -H "Content-Type: application/json" \
     -H "Cookie: workspace=test-workspace" \
     -d '{
       "name": "Engineering Division",
       "description": "For engineering students",
       "status": "ENABLED"
     }'
   ```

2. Verify HTTP 201 response
3. Verify response body contains:
   - `success: true`
   - `data.id` (UUID)
   - `data.name: "Engineering Division"`
   - `data.is_default: false`
   - `data.created_at` (ISO timestamp)

**Expected:** Division created successfully, listed in subsequent GET requests.

**Troubleshooting:** If 403 Forbidden, verify staff has ADMIN role. If 401 Unauthorized, check token validity.

---

### Scenario 2 — List Divisions with Keyset Pagination

**Purpose:** Verify keyset pagination works correctly for large division lists.

**Prerequisites:**

- API running
- Authenticated with ADMIN role
- At least 5 divisions created

**Steps:**

1. Fetch first page:

   ```bash
   curl "http://localhost:3000/backoffice/divisions?limit=2" \
     -H "Authorization: Bearer <token>" \
     -H "Cookie: workspace=test-workspace"
   ```

2. Verify response contains 2 divisions + `next_cursor` in metadata
3. Fetch next page using cursor:

   ```bash
   curl "http://localhost:3000/backoffice/divisions?limit=2&after=<next_cursor>" \
     -H "Authorization: Bearer <token>" \
     -H "Cookie: workspace=test-workspace"
   ```

4. Verify no duplicate data between pages
5. Verify `has_more: false` on final page

**Expected:** Pagination works without fetching duplicates or missing records.

**Troubleshooting:** If `next_cursor` is missing, check response metadata structure.

---

### Scenario 3 — Update Division (Name & Description)

**Purpose:** Verify division updates preserve constraints and enforce case-insensitive name uniqueness.

**Prerequisites:**

- API running
- Two divisions created: "Engineering" and "Science"
- Authenticated as ADMIN

**Steps:**

1. Update "Engineering" description:

   ```bash
   curl -X PUT http://localhost:3000/backoffice/divisions/<div_id> \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -H "Cookie: workspace=test-workspace" \
     -d '{
       "name": "Engineering",
       "description": "Revised description"
     }'
   ```

2. Verify HTTP 200 response with updated description

3. Attempt to rename to case variant "engineering" (should fail):

   ```bash
   curl -X PUT http://localhost:3000/backoffice/divisions/<div_id> \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -H "Cookie: workspace=test-workspace" \
     -d '{
       "name": "engineering"
     }'
   ```

4. Verify HTTP 409 Conflict (AlreadyExists error)

**Expected:** Case-insensitive uniqueness enforced.

**Troubleshooting:** If constraint is not enforced, check migration SQL for `LOWER(name)` unique index.

---

### Scenario 4 — Assign Staff to Division

**Purpose:** Verify staff-to-division assignment creates many-to-many records and prevents duplicate assignments.

**Prerequisites:**

- API running
- Staff user created
- Division created
- Authenticated as ADMIN

**Steps:**

1. Assign staff to division:

   ```bash
   curl -X POST http://localhost:3000/backoffice/divisions/<div_id>/staff/<staff_id> \
     -H "Authorization: Bearer <token>" \
     -H "Cookie: workspace=test-workspace"
   ```

2. Verify HTTP 201 response
3. Query division staff list:

   ```bash
   curl http://localhost:3000/backoffice/divisions/<div_id>/staff \
     -H "Authorization: Bearer <token>" \
     -H "Cookie: workspace=test-workspace"
   ```

4. Verify staff appears in list
5. Attempt to assign again (should fail with duplicate error):

   ```bash
   curl -X POST http://localhost:3000/backoffice/divisions/<div_id>/staff/<staff_id> \
     -H "Authorization: Bearer <token>" \
     -H "Cookie: workspace=test-workspace"
   ```

6. Verify HTTP 409 Conflict

**Expected:** Staff assigned once; duplicate attempts rejected.

**Troubleshooting:** If staff appears multiple times, check migration for composite PK on staff_divisions.

---

### Scenario 5 — Disable Individual Division (Edge Case)

**Purpose:** Verify disabling a division prevents new student assignments but does not auto-reassign existing students.

**Prerequisites:**

- API running
- Division with students assigned
- Authenticated as ADMIN

**Steps:**

1. Disable the division:

   ```bash
   curl -X PATCH http://localhost:3000/backoffice/divisions/<div_id>/status \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -H "Cookie: workspace=test-workspace" \
     -d '{
       "status": "DISABLED"
     }'
   ```

2. Verify HTTP 200 response
3. Query division status:

   ```bash
   curl http://localhost:3000/backoffice/divisions/<div_id> \
     -H "Authorization: Bearer <token>" \
     -H "Cookie: workspace=test-workspace"
   ```

4. Verify `status: "DISABLED"`
5. Verify existing students still reference this division (not auto-reassigned)
6. Attempt to create new student in disabled division (should fail):
   ```bash
   # This would be tested via student creation endpoint with disabled division_id
   ```

**Expected:** Status change successful; existing students unaffected; new assignments blocked.

**Troubleshooting:** If students are auto-reassigned, check PATCH handler logic.

---

### Scenario 6 — Disable-All-Divisions (System Operation)

**Purpose:** Verify the privileged disable-all-divisions operation works atomically, reassigns all students to default, and is idempotent.

**Prerequisites:**

- API running
- Multiple divisions with students assigned
- Authenticated as SUPER_ADMIN

**Steps:**

1. Run disable-all-divisions:

   ```bash
   curl -X POST http://localhost:3000/backoffice/divisions/post-disable \
     -H "Authorization: Bearer <super_admin_token>" \
     -H "Cookie: workspace=test-workspace"
   ```

2. Verify HTTP 200 response
3. Query workspace_settings:

   ```bash
   select divisions_enabled from workspace_settings where workspace_id = '<ws_id>';
   ```

4. Verify `divisions_enabled = false`
5. Query all students:

   ```bash
   select distinct division_id from students where workspace_id = '<ws_id>';
   ```

6. Verify all students reference **only** the default division
7. Run disable-all-divisions again (idempotency test):

   ```bash
   curl -X POST http://localhost:3000/backoffice/divisions/post-disable \
     -H "Authorization: Bearer <super_admin_token>" \
     -H "Cookie: workspace=test-workspace"
   ```

8. Verify HTTP 200 response (same as before, no error)
9. Verify no duplicate log entries or unexpected side effects

**Expected:** All students reassigned atomically; workspace locked to single-division mode; operation idempotent.

**Troubleshooting:** If operation is not atomic, check migration for SERIALIZABLE isolation. If not idempotent, check redis fail-closed logic.

---

## Negative Cases

| Scenario                            | Trigger                                                   | Expected Response                                                   |
| ----------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| **Unauthorized Access**             | Request without auth token                                | `401 Unauthorized`                                                  |
| **Insufficient Permission**         | Non-admin staff creates division                          | `403 Forbidden` + `{ code: "RBAC_VIOLATION", message: "..." }`      |
| **Duplicate Division Name**         | POST with name matching existing (case-insensitive)       | `409 Conflict` + `{ code: "ALREADY_EXISTS", message: "..." }`       |
| **Invalid Status Value**            | PATCH with status "PENDING" (not ENABLED/DISABLED)        | `400 Bad Request` + `{ code: "VALIDATION_ERROR", message: "..." }`  |
| **Delete Default Division**         | DELETE on division with is_default=true                   | `403 Forbidden` + `{ code: "FORBIDDEN_OPERATION", message: "..." }` |
| **FK Constraint Violation**         | DELETE division with active staff assignments             | `409 Conflict` + `{ code: "CONSTRAINT_VIOLATION", message: "..." }` |
| **Division Not Found**              | GET/PUT/DELETE with invalid division_id                   | `404 Not Found` + `{ code: "NOT_FOUND", message: "..." }`           |
| **Disable-All Without Super Admin** | POST /divisions/post-disable with ADMIN (not SUPER_ADMIN) | `403 Forbidden` + `{ code: "RBAC_VIOLATION", message: "..." }`      |
| **Cross-Workspace Access**          | Request workspace A token against workspace B divisions   | `403 Forbidden` or `404 Not Found` (isolation enforced)             |

All error responses follow the standard Zidney error contract:

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

---

## Multi-Tenant Isolation Verification

To verify divisions are properly isolated between workspaces:

**Setup:**

- Create two test workspaces: `workspace-a` and `workspace-b`
- Create divisions in `workspace-a`: "Engineering", "Science"
- Create divisions in `workspace-b`: "Humanities", "Arts"

**Test Boundary:**

1. Authenticate as admin in `workspace-a`
2. Fetch divisions (should see only Engineering + Science):

   ```bash
   curl http://localhost:3000/backoffice/divisions \
     -H "Authorization: Bearer <workspace_a_token>" \
     -H "Cookie: workspace=workspace-a"
   ```

3. Verify response contains only workspace-a divisions
4. Authenticate as admin in `workspace-b`
5. Fetch divisions (should see only Humanities + Arts):

   ```bash
   curl http://localhost:3000/backoffice/divisions \
     -H "Authorization: Bearer <workspace_b_token>" \
     -H "Cookie: workspace=workspace-b"
   ```

6. Verify response contains only workspace-b divisions
7. Attempt to access workspace-a division ID from workspace-b context:

   ```bash
   curl http://localhost:3000/backoffice/divisions/<div_a_id> \
     -H "Authorization: Bearer <workspace_b_token>" \
     -H "Cookie: workspace=workspace-b"
   ```

8. Verify HTTP 404 (not 403, to avoid leaking existence)

**Expected:** Complete isolation — each workspace sees only its own divisions.

**Troubleshooting:** If workspaces cross-contaminate, check tenant resolver middleware execution order.

---

## RBAC Verification

Divisions enforce role-based access control:

| Route                               | Allowed Roles      | Blocked Roles      |
| ----------------------------------- | ------------------ | ------------------ |
| GET /divisions                      | ADMIN, SUPER_ADMIN | STAFF, VIEWER      |
| POST /divisions                     | ADMIN, SUPER_ADMIN | STAFF, VIEWER      |
| GET /divisions/:id                  | ADMIN, SUPER_ADMIN | STAFF, VIEWER      |
| PUT /divisions/:id                  | ADMIN, SUPER_ADMIN | STAFF, VIEWER      |
| PATCH /divisions/:id/status         | ADMIN, SUPER_ADMIN | STAFF, VIEWER      |
| DELETE /divisions/:id               | ADMIN, SUPER_ADMIN | STAFF, VIEWER      |
| POST /divisions/:id/staff/:staff_id | ADMIN, SUPER_ADMIN | STAFF, VIEWER      |
| POST /divisions/post-disable        | SUPER_ADMIN only   | ADMIN, STAFF, VIEW |

**Test:** For each blocked route/role combination, verify HTTP 403 Forbidden.

---

## Performance Baseline

Expected performance baselines (run after implementation):

```bash
# Measure API response time for list divisions (10k divisions)
bun test:perf divisions.list

# Measure keyset pagination cursor generation (measured in microseconds)
bun test:perf divisions.keyset-pagination

# Measure disable-all-divisions operation (measured in seconds)
bun test:perf divisions.disable-all
```

---

## Regression Checklist

Run before signing off:

- [ ] All 265 divisions tests pass
- [ ] No new failing tests in other modules
- [ ] `bun run lint` passes
- [ ] `bun run type-check` passes
- [ ] Migration applied without errors
- [ ] API starts without errors
- [ ] Workspace with divisions_enabled=true works
- [ ] Workspace with divisions_enabled=false works (single-division mode)
- [ ] Multi-tenant isolation verified
- [ ] RBAC boundary checked
- [ ] Error contract (success/data/error) validated

---

## Support & Escalation

If issues arise:

1. Check structured logs for correlation_id
2. Review `audits/ANALYZE_REPORT.md` for architectural concerns
3. Reference `spec.md` for scope clarification
4. Contact team lead with test failure details and logs

---

**Generated:** 2026-03-16  
**Version:** STAGE_22_DIVISIONS Implementation Complete  
**Next:** STAGE_23_DEPARTMENTS (depends on this foundation)
