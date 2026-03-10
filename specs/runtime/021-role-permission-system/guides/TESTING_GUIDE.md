# Testing Guide — STAGE_21_ROLE_PERMISSION_SYSTEM

**Stage:** STAGE_21_ROLE_PERMISSION_SYSTEM  
**Phase:** 03_BACKOFFICE_CORE / 01_FOUNDATION  
**Stage Directory:** `021-role-permission-system`  
**Generated On:** 2026-03-02

---

## Purpose

This guide explains how to validate the Backoffice Role & Permission System (RBAC v2) implementation
end-to-end. The stage introduces tenant-scoped role-based access control for backoffice staff users.

---

## Summary of Delivered Behavior

The implementation adds a strict, server-side, tenant-isolated role-based access control (RBAC)
system to the Backoffice. Backoffice staff users are assigned roles, and roles contain
boolean-flagged permissions for 10 modules × 4 actions (view, create, edit, delete). Permission
evaluation is transactional, cached (Redis), audited (immutable log), and enforced at every API
route.

Key outcomes:

- **Role Management:** Create, read, update, disable, delete roles with transaction atomicity
- **Permission Matrix:** Assign fine-grained permissions (10 modules, 4 actions each) to roles
- **Staff Assignment:** Assign roles to backoffice users atomically
- **Permission Guard:** 7-step middleware chain validates permission before every backoffice request
- **Audit Trail:** Every RBAC mutation is logged immutably with user, timestamp, action, result
- **Cache-Aware:** Redis-backed cache (rbac_v2: prefix) invalidates synchronously on mutations
- **Tenant-Isolated:** All RBAC tables are in tenant DB only; no cross-tenant visibility

---

## Prerequisites

| Requirement                | Validation Command / Check                                              |
| -------------------------- | ----------------------------------------------------------------------- |
| Node.js installed          | `node --version` (v20+)                                                 |
| Bun installed              | `bun --version` (v1.1+)                                                 |
| Docker running             | `docker ps` (see at least postgres, redis containers running)           |
| PostgreSQL tenant instance | Verify connection to tenant DB at `$DATABASE_URL`                       |
| Redis instance             | Verify connection to redis at `$REDIS_URL`                              |
| Migrations applied         | Start API; it auto-applies at boot or can manually run tenant migration |
| Correct branch checked out | `git branch` shows `021-role-permission-system` active                  |
| All tests passing          | `bun run test:unit && bun run test:integration`                         |

---

## Files in Scope

### Database Layer

```
apps/api/src/db/tenant/migrations/20260302_001_rbac_role_permissions_complete.ts
apps/api/src/db/tenant/schemas/backoffice-roles.schema.ts
apps/api/src/db/tenant/schemas/backoffice-role-module-permissions.schema.ts
apps/api/src/db/tenant/schemas/rbac-audit-logs.schema.ts
apps/api/src/db/tenant/schemas/backoffice-staff-users.schema.ts (extended)
```

### Business Logic (Domain Package)

```
packages/domain-core/src/rbac/rbac.types.ts
packages/domain-core/src/rbac/rbac.service.ts
packages/domain-core/src/rbac/rbac.audit.ts
packages/domain-core/src/rbac/permission-registry.ts (SINGLE SOURCE OF TRUTH)
packages/domain-core/src/rbac/index.ts
```

### API Layer

```
apps/api/src/middleware/backoffice-permission-guard-v2.ts
apps/api/src/middleware/route-permission-registry.ts (re-export shim)
apps/api/src/routes/backoffice/roles.ts (9 endpoints)
apps/api/src/boot/migration-registry.ts (migration registration)
apps/api/src/app.ts (route group registration)
```

### Frontend Layer

```
apps/backoffice/src/composables/usePermission.ts
apps/backoffice/src/pages/roles/RolesListPage.vue
apps/backoffice/src/pages/roles/CreateRolePage.vue
apps/backoffice/src/pages/roles/RoleDetailPage.vue
```

### Tests

```
tests/unit/rbac/rbac.service.test.ts (18 tests)
tests/unit/rbac/permission-registry.test.ts (20 tests)
tests/integration/backoffice/roles.routes.test.ts (18 tests)
tests/integration/rbac/version-compatibility.test.ts (6 tests)
```

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Apply all migrations (runs automatically at API boot)
bun run dev:api

# Start frontend dev server (separate terminal)
bun run --cwd apps/backoffice dev

# Start worker (optional, separate terminal)
bun run dev:worker

# Stop all
# Ctrl+C in each terminal
```

Once the API boots, it auto-applies the STAGE_21 migration to all tenant databases. Check logs for:

```
[cid=boot...] Applied migration: 20260302_001_rbac_role_permissions_complete (schema 1.3.0 → 1.4.0)
[cid=boot...] All tenant migrations completed successfully
```

---

## Automated Validation Commands

```bash
# Run all tests
bun run test

# Run unit tests only
bun run test:unit

# Run integration tests only (slower, requires DB)
bun run test:integration

# Run STAGE_21 tests specifically
bun test tests/unit/rbac/ tests/integration/rbac/ tests/integration/backoffice/roles.routes.test.ts

# Watch mode for development
bun test --watch

# Coverage report
bun test --coverage
```

**Expected outcome:** 62/62 STAGE_21 tests pass (38 unit + 24 integration).

---

## Manual Test Scenarios

### Scenario 1 — Create a Role

**Purpose:** Verify role creation is transactional and produces audit logs.

**Manual Steps:**

1. Start API: `bun run dev:api`
2. Open Postman or curl and authenticate as a backoffice staff user
3. POST to `http://localhost:3000/api/v1/backoffice/workspace/roles` with body:
   ```json
   {
     "name": "Exam Manager",
     "description": "Manages exams and candidate access"
   }
   ```
4. Receive 201 with role ID
5. Check the DB:
   ```sql
   SELECT id, name, status, created_at FROM backoffice_roles WHERE name = 'Exam Manager';
   ```
   Should return 1 row with status='ACTIVE'
6. Check audit logs:
   ```sql
   SELECT user_id, role_id, action, timestamp FROM rbac_audit_logs WHERE action = 'CREATE_ROLE' ORDER BY timestamp DESC LIMIT 1;
   ```
   Should show the creation event with your user_id

**Expected Outcome:**

- Status 201 response
- Role appears in DB with name, description, status='ACTIVE'
- Audit log entry created immediately
- Logs include correlation_id, workspace_id, user_id

**If test fails:**

- Check API startup logs for migration errors
- Verify tenant database has backoffice_roles table: `\dt backoffice_roles` in psql
- Verify Redis connection: `redis-cli ping` should return PONG

---

### Scenario 2 — Assign a Role to a Staff User

**Purpose:** Verify role assignment is idempotent and caches correctly.

**Manual Steps:**

1. Create a role (Scenario 1)
2. Identify a staff user ID (e.g., via `SELECT id FROM backoffice_staff_users LIMIT 1`)
3. PATCH `http://localhost:3000/api/v1/backoffice/workspace/staff/{userId}/role` with:
   ```json
   {
     "role_id": "{{ role_id_from_scenario_1 }}"
   }
   ```
4. Receive 200 response
5. Query the staff user:
   ```sql
   SELECT id, role_id, created_at FROM backoffice_staff_users WHERE id = '{{ userId }}';
   ```
   Should show role_id is now set
6. Check Redis cache was invalidated:
   ```bash
   redis-cli GET "rbac_v2:{{ workspace_id }}:staff:{{ userId }}"
   ```
   Should be empty or about to re-populate
7. Make the same request again (re-assign same role)
   - Should receive 200 (idempotent — no error on re-assignment)
   - Audit log should have 2 entries for ASSIGN_ROLE

**Expected Outcome:**

- Status 200
- Staff user's role_id updated in DB
- Audit log records the assignment
- Re-assignment (same role) returns 200 (idempotent)
- Cache invalidates after each mutation

**If test fails:**

- Check that backoffice_staff_users.role_id column exists: `\d backoffice_staff_users` in psql
- Verify Redis is running and accessible
- Check for "redis connection refused" errors in API logs

---

### Scenario 3 — Evaluate Permission (Permission Guard Test)

**Purpose:** Verify permission guard enforces module/action rules.

**Manual Steps:**

1. Create a role with LIMITED permissions:
   ```
   Role: "Viewer"
   Module "dashboard": can_view=true, can_create=false, can_edit=false, can_delete=false
   ```
2. Assign the "Viewer" role to a staff user
3. As that staff user, try to POST to an endpoint that requires dashboard.CREATE:
   ```
   POST http://localhost:3000/api/v1/backoffice/workspace/dashboard/new-item
   ```
   (Replace with an actual endpoint)
4. Receive 403 Forbidden response with error code "PERMISSION_DENIED"
5. Now assign a FULL permissions role and retry
   - Should receive 200 or appropriate status (not 403)

**Expected Outcome:**

- Insufficient permission → 403 with generic error message (no permission details leaked)
- Sufficient permission → route handler executes normally
- All 403 responses include `correlation_id` in logs for debugging

**If test fails:**

- Verify permission guard is registered in the route: check
  `apps/api/src/routes/backoffice/roles.ts`
- Check API logs for permission evaluation steps
- Verify role/permission data is in DB:
  `SELECT * FROM backoffice_role_module_permissions WHERE role_id = '{{ role_id }}' LIMIT 1`

---

### Scenario 4 — Cache Invalidation (Redis Behavior)

**Purpose:** Verify cache _invalidates_ when permissions change, not just when assigned.

**Manual Steps:**

1. Assign a role with full permissions to a staff user (Scenario 2)
2. As that user, make a request to verify permission is cached
   - This populates `rbac_v2:{{ workspace_id }}:staff:{{ user_id }}`
3. UPDATE the role's permissions (e.g., disable can_view for "dashboard"):
   ```
   PUT /api/v1/backoffice/workspace/roles/{{ role_id }}/permissions
   ```
   with body:
   ```json
   {
     "dashboard": {
       "can_view": false,
       "can_create": false,
       "can_edit": false,
       "can_delete": false
     }
   }
   ```
4. Receive 200
5. Redis cache should be cleared immediately:
   ```bash
   redis-cli GET "rbac_v2:{{ workspace_id }}:staff:{{ user_id }}"
   ```
   Should be empty (cache invalidated)
6. Make the next request as that user
   - Should re-evaluate and now return 403 for dashboard-related operations

**Expected Outcome:**

- Permission update returns 200
- Cache key is cleared synchronously (not at TTL)
- Next permission check uses invalidated cache and deny-by-default logic
- User can no longer perform denied actions

**If test fails:**

- Check Redis SCAN command is working: `redis-cli SCAN 0 MATCH 'rbac_v2:*' COUNT 10`
- Verify updatePermissions calls cache invalidation logic
- Check API logs for "cache invalidation" messages

---

### Scenario 5 — Audit Immutability (Try to Tamper with Audit Logs)

**Purpose:** Verify audit logs cannot be modified (immutability trigger).

**Manual Steps:**

1. Create a role (Scenario 1) — this generates an audit log entry
2. Query the audit log ID:
   ```sql
   SELECT id FROM rbac_audit_logs WHERE action = 'CREATE_ROLE' LIMIT 1;
   ```
3. Try to UPDATE it:
   ```sql
   UPDATE rbac_audit_logs SET action = 'DELETED_ROLE' WHERE id = '{{ audit_log_id }}';
   ```
4. Receive error:
   ```
   ERROR: permission denied for relation rbac_audit_logs
   ```
   or a trigger error if the table has an update trigger

**Expected Outcome:**

- UPDATE fails with explicit error
- Audit logs remain immutable
- App logs show the failed attempt (if monitored)

**If test fails:**

- Verify `prevent_audit_modification()` trigger was created
- Check:
  `SELECT * FROM information_schema.triggers WHERE trigger_name = 'prevent_rbac_audit_modification' LIMIT 1;`

---

### Scenario 6 — Cross-Tenant Isolation (Try JWT Token Replay)

**Purpose:** Verify a JWT from TenantA cannot access TenantB.

**Manual Steps:**

1. Get a valid JWT token while authenticated to Tenant A
2. Start a new curl session; set the JWT header:
   ```bash
   export TOKEN="{{ tenant_a_jwt }}"
   ```
3. Make a request to an API endpoint with X-Workspace-Slug or subdomain pointing to Tenant B:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
        http://tenant-b.localhost:3000/api/v1/backoffice/workspace/roles
   ```
4. Receive 403 Forbidden with error "WORKSPACE_MISMATCH" or "UNAUTHORIZED"
5. Verify the error log includes "cross-tenant replay detected"

**Expected Outcome:**

- Request rejected at middleware chain level (not at permission guard)
- Status 403 or 401
- No data from Tenant B is leaked
- Audit log in Tenant A does NOT record the malicious attempt (request rejected upstream)

**If test fails:**

- Verify middleware chain includes `workspace-id-assertion` before permission guard
- Check tenant resolver correctly extracts workspace_id from request

---

## Automated Test Summary

| Test File                       | Tests | Coverage                                                                                                                    |
| ------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| `rbac.service.test.ts`          | 18    | All domain logic: createRole, updateRole, deleteRole, updatePermissions, evaluatePermission, transactions, failure rollback |
| `permission-registry.test.ts`   | 20    | Module/action registry, validation functions, completeness of all 10 modules                                                |
| `roles.routes.test.ts`          | 18    | All 9 endpoints, idempotency, error scenarios, SC-007 (no error info leakage), SC-008 (tenant isolation)                    |
| `version-compatibility.test.ts` | 6     | Migration schema_version bump, forward-compat, rollback policy                                                              |

**All should pass:**
`bun test tests/unit/rbac tests/integration/rbac tests/integration/backoffice/roles.routes.test.ts`

---

## Troubleshooting Guide

| Issue                                                               | Cause                                          | Solution                                                                             |
| ------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Migration fails at boot: "relation backoffice_roles does not exist" | Migration not executed                         | Check API logs for migration errors; manually run migration or restart API           |
| 403 on every request to backoffice endpoints                        | Permission guard returning deny-by-default     | Check role/permission data in DB; verify staff user has a role assigned              |
| Redis cache not being created                                       | Redis connection failed                        | Verify `REDIS_URL` env var; check `redis-cli ping` returns PONG                      |
| Tests fail: "Cannot find module 'hono/jwt'"                         | Pre-existing vitest config issue for MMC tests | STAGE_21 tests should pass; this is a pre-existing MMC issue; skip `tests/unit/mmc/` |
| Audit logs not appearing                                            | Audit log insert failed silently               | Check rbac_audit_logs table permissions; verify trigger is present                   |
| Role deletion fails with "active users assigned"                    | Constraint check                               | Disable all users assigned to role first, then delete role                           |

---

## Sign-Off

**Tested By:** QA / Reviewing Engineer  
**Test Date:** [Fill in]  
**Build:** STAGE_21_ROLE_PERMISSION_SYSTEM  
**Status:** [PASS / FAIL]  
**Notes:** [Comments]

Grade: A (all 62 tests passing) | B (minor issues) | C (blockers)
