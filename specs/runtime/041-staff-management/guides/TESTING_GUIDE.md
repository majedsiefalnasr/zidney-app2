# Testing Guide — Staff Management

**Stage:** Staff Management  
**Phase:** 03_BACKOFFICE_CORE / 05_USER_MANAGEMENT  
**Stage Directory:** 041-staff-management  
**Generated On:** 2026-04-04

---

## Purpose

This guide helps developers and QA engineers validate the staff management API end-to-end, covering all seven CRUD endpoints, authentication migration, license-limit enforcement, and tenant isolation guarantees.

---

## Summary of Delivered Behavior

This stage implements the complete lifecycle management for Backoffice staff users within a tenant scope. Staff records are stored exclusively in the tenant database, fully isolated per workspace.

Key outcomes:

- Staff can be created, listed, read, updated, disabled, re-enabled, and deleted via REST API
- Password hashing uses Argon2id (bcrypt replaced in backoffice login flow)
- License-limit enforcement prevents creation beyond `staff_limit` per tenant
- Disabling a staff account revokes sessions and invalidates tokens atomically
- All writes are transactional; partial failures roll back cleanly

---

## Prerequisites

| Requirement             | Validation Command / Check                                 |
| ----------------------- | ---------------------------------------------------------- |
| Bun installed           | `bun --version` (v1+)                                      |
| Docker running          | `docker ps`                                                |
| `.env` present          | Verify `apps/api/.env` or `.env.local` exists              |
| Migrations applied      | `bun run db:migrate`                                       |
| Correct branch          | `git branch` shows `spec/041-staff-management`             |
| API running             | `bun run dev:api`                                          |
| Test tenant provisioned | Tenant subdomain/slug available (e.g., `demo`)             |
| Backoffice admin token  | Login via `POST /api/v1/auth/backoffice/login` (see below) |

---

## Files in Scope

```text
apps/api/src/db/tenant/migrations/20260404_020_staff_management.ts
apps/api/src/db/tenant/schemas/backoffice-staff-users.schema.ts
apps/api/src/db/tenant/schemas/staff-hierarchy-levels.schema.ts
apps/api/src/db/tenant/schemas/index.ts
apps/api/src/routes/auth/backoffice-login.ts
apps/api/src/routes/backoffice/staff/helpers.ts
apps/api/src/routes/backoffice/staff/create-staff.ts
apps/api/src/routes/backoffice/staff/list-staff.ts
apps/api/src/routes/backoffice/staff/get-staff.ts
apps/api/src/routes/backoffice/staff/update-staff.ts
apps/api/src/routes/backoffice/staff/disable-staff.ts
apps/api/src/routes/backoffice/staff/enable-staff.ts
apps/api/src/routes/backoffice/staff/delete-staff.ts
apps/api/src/routes/backoffice/staff/index.ts
packages/domain-core/src/auth/staff-password.ts
packages/domain-core/src/auth/index.ts
packages/domain-core/src/staff/staff.types.ts
packages/domain-core/src/staff/staff.errors.ts
packages/domain-core/src/staff/staff.repository.ts
packages/domain-core/src/staff/staff.service.ts
packages/domain-core/src/staff/index.ts
packages/domain-core/src/index.ts
packages/validation/src/staff.schema.ts
packages/validation/src/index.ts
```

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Apply migrations (tenant DB)
bun run db:migrate

# Start API server
bun run dev:api

# Run all tests
bun test

# Run staff-specific tests only
bun test apps/api/src/routes/backoffice/staff/__tests__/
```

---

## Automated Validation Commands

```bash
# Full test suite
bun test

# Staff test files specifically
bun test apps/api/src/routes/backoffice/staff/__tests__/staff.crud.test.ts
bun test apps/api/src/routes/backoffice/staff/__tests__/staff.isolation.test.ts
bun test apps/api/src/routes/backoffice/staff/__tests__/staff.limit.test.ts

# Type checking
bun run typecheck

# Lint
bun run lint
```

Expected outcome: **30/30 tests pass, 0 TypeScript errors, 0 Biome errors**.

---

## Authentication Setup

All staff routes require a valid Backoffice bearer token. Obtain one first:

```bash
# Login as backoffice admin
curl -s -X POST http://localhost:3000/api/v1/auth/backoffice/login \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Slug: demo" \
  -d '{"email":"admin@demo.com","password":"your-admin-password"}' | jq .

# Store token
TOKEN="<access_token from response>"
WORKSPACE="demo"
BASE="http://localhost:3000/api/v1/backoffice/workspace"
```

---

## Manual Test Scenarios

### Scenario 1 — Create a Staff Member

**Purpose:** Verify staff creation, Argon2id password hashing, and license-limit enforcement.

1. Send a POST request to create staff:

```bash
curl -s -X POST "$BASE/staff" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Slug: $WORKSPACE" \
  -d '{
    "email": "john.doe@demo.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "roleId": "<valid-role-uuid>"
  }' | jq .
```

2. Verify the response shape:

```json
{
  "success": true,
  "data": {
    "id": "<uuid>",
    "email": "john.doe@demo.com",
    "firstName": "John",
    "lastName": "Doe",
    "status": "ACTIVE",
    "createdAt": "<timestamp>"
  },
  "error": null
}
```

3. Confirm no plaintext password appears in the response.

**Expected:** HTTP 201 with staff record. `status: "ACTIVE"`.

**Troubleshooting:** If 409, the email already exists. If 403 with `STAFF_LIMIT_REACHED`, the tenant has reached its `staff_limit`.

---

### Scenario 2 — List Staff (Paginated)

**Purpose:** Verify listing with pagination and filters.

1. List all staff:

```bash
curl -s "$BASE/staff?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Slug: $WORKSPACE" | jq .
```

2. Filter by status:

```bash
curl -s "$BASE/staff?status=ACTIVE&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Slug: $WORKSPACE" | jq .
```

3. Verify the response includes `data`, `total`, `page`, `limit`.

**Expected:** HTTP 200 with paginated list. Only records belonging to the current workspace.

**Troubleshooting:** If empty list, no staff have been created yet. Run Scenario 1 first.

---

### Scenario 3 — Get a Single Staff Member

**Purpose:** Verify `GET /staff/:id` returns correct staff data.

1. Use the `id` from Scenario 1:

```bash
STAFF_ID="<uuid from Scenario 1>"

curl -s "$BASE/staff/$STAFF_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Slug: $WORKSPACE" | jq .
```

**Expected:** HTTP 200 with a single staff record. Password hash never appears.

**Troubleshooting:** HTTP 404 means the UUID doesn't exist in this workspace.

---

### Scenario 4 — Update Staff Name/Email

**Purpose:** Verify partial update of mutable fields.

1. Send PATCH update:

```bash
curl -s -X PUT "$BASE/staff/$STAFF_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Slug: $WORKSPACE" \
  -d '{"firstName": "Johnny", "lastName": "Doe Updated"}' | jq .
```

**Expected:** HTTP 200 with updated name fields. `updatedAt` is later than `createdAt`.

---

### Scenario 5 — Disable a Staff Account

**Purpose:** Verify account disable atomically revokes access.

1. Disable the staff account:

```bash
curl -s -X PATCH "$BASE/staff/$STAFF_ID/disable" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Slug: $WORKSPACE" | jq .
```

2. Attempt to login with the disabled user's credentials:

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/backoffice/login \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Slug: $WORKSPACE" \
  -d '{"email":"john.doe@demo.com","password":"SecurePass123!"}' | jq .
```

**Expected:** After disable, login returns `403` with `ACCOUNT_DISABLED`. GET /staff/:id shows `status: "INACTIVE"`.

**Troubleshooting:** If login still works, confirm migration was applied (`status` column exists).

---

### Scenario 6 — Re-enable a Staff Account

**Purpose:** Verify re-enabling restores access.

1. Re-enable the disabled account:

```bash
curl -s -X PATCH "$BASE/staff/$STAFF_ID/enable" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Slug: $WORKSPACE" | jq .
```

2. Attempt login again — should succeed.

**Expected:** HTTP 200 on enable. Login succeeds. `status` reverts to `"ACTIVE"`.

---

### Scenario 7 — Delete a Staff Member

**Purpose:** Verify atomic deletion with assignment cleanup.

1. Delete the staff record:

```bash
curl -s -X DELETE "$BASE/staff/$STAFF_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Slug: $WORKSPACE" | jq .
```

2. Try to GET the deleted staff:

```bash
curl -s "$BASE/staff/$STAFF_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Slug: $WORKSPACE" | jq .
```

**Expected:** DELETE returns HTTP 200 with `{ success: true, data: null, error: null }`. Subsequent GET returns 404.

---

### Scenario 8 — License Limit Enforcement (Edge Case)

**Purpose:** Verify staff creation is blocked when `staff_limit` is reached.

1. Find the tenant's `staff_limit` value (from the master DB or admin panel).
2. Create staff records until the limit is reached.
3. Attempt to create one more:

```bash
curl -s -X POST "$BASE/staff" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Slug: $WORKSPACE" \
  -d '{"email":"overflow@demo.com","password":"Pass123!", "firstName":"Over","lastName":"Flow","roleId":"<role-uuid>"}' | jq .
```

**Expected:** HTTP 403 with error code `STAFF_LIMIT_REACHED`. No partial record created.

---

### Scenario 9 — Tenant Isolation (Cross-Workspace Rejection)

**Purpose:** Verify a token from Workspace A cannot access Workspace B's staff.

1. Login on workspace A and store token:

```bash
TOKEN_A="<token from workspace-a login>"
```

2. Try to access workspace B's staff endpoint using Token A:

```bash
curl -s "$BASE/staff" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "X-Workspace-Slug: workspace-b" | jq .
```

**Expected:** HTTP 401 or 403 — workspace mismatch rejected. Never returns workspace-b data.

---

## Error Code Reference

| Code                   | HTTP | Meaning                                |
| ---------------------- | ---- | -------------------------------------- |
| `STAFF_NOT_FOUND`      | 404  | Staff ID does not exist                |
| `STAFF_ALREADY_EXISTS` | 409  | Email already in use in this workspace |
| `STAFF_LIMIT_REACHED`  | 403  | Tenant `staff_limit` exhausted         |
| `ACCOUNT_DISABLED`     | 403  | Login blocked — account is DISABLED    |
| `INVALID_CREDENTIALS`  | 401  | Wrong email/password                   |
| `VALIDATION_ERROR`     | 422  | Request body fails schema validation   |
| `UNAUTHORIZED`         | 401  | Missing or invalid bearer token        |
| `FORBIDDEN`            | 403  | RBAC role lacks required permission    |

---

## Notes for Reviewers

- All staff passwords are hashed with **Argon2id** (not bcrypt). The `backoffice-login.ts` route now calls `verifyStaffPassword()` from `@zidney/domain-core/auth`.
- The legacy `apps/api/src/routes/backoffice/users.ts` file has been **deleted** — the staff router replaces it entirely.
- The `staff_hierarchy_levels` join table supports many-to-many assignment; deletion of a staff record cascades to this table transactionally.
- Test suite uses complete inline mocks for `@zidney/domain-core/staff` to avoid argon2 native binary loading in vitest environments.
