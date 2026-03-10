# Testing Guide — TENANT_BOOTSTRAP

**Stage:** TENANT_BOOTSTRAP **Phase:** 03_BACKOFFICE_CORE/01_FOUNDATION **Stage Directory:**
017-tenant-bootstrap **Generated On:** 2026-02-28

---

## Purpose

This guide explains how to validate the Stage 17 (Tenant Bootstrap) implementation end-to-end. It
covers automated test execution, manual scenario testing, isolation verification, and log structure
confirmation.

---

## Summary of Delivered Behavior

Stage 17 bootstraps the backoffice runtime for a tenant workspace. When a staff user opens the
backoffice, the SPA loads and calls `GET /api/v1/backoffice/context` to retrieve workspace identity,
license data, enabled modules, and the staff user profile. The middleware stack validates the
workspace license (rejecting SOFT_LOCKED / ARCHIVED workspaces), enforces RBAC permissions
(Redis-cached, DB-backed), and enforces module availability. A WebSocket endpoint at
`/ws/backoffice` allows real-time updates with a single-connection-per-user guard.

Key outcomes:

- Staff users can load the backoffice context for their tenant workspace
- Soft-locked workspaces return 423; archived workspaces return 403
- RBAC denies unauthorized module access based on staff user roles and permissions
- WebSocket connections are limited to one per user per workspace via atomic Redis `SET NX`
- The Vue 3 SPA scaffold routes to Dashboard, WorkspaceLocked, or WorkspaceForbidden views

---

## Prerequisites

| Requirement                | Validation Command / Check                |
| -------------------------- | ----------------------------------------- |
| Bun installed              | `bun --version` (v1.2.4+)                 |
| Docker running             | `docker ps`                               |
| PostgreSQL + Redis up      | `docker-compose up -d postgres redis`     |
| Test environment ready     | `bash scripts/verify-test-env.sh`         |
| Correct branch checked out | `git branch` shows `017-tenant-bootstrap` |
| Dependencies installed     | `bun install`                             |

---

## Files in Scope

```text
apps/api/src/app.ts
apps/api/src/middleware/license-enforcement.ts
apps/api/src/middleware/backoffice-rbac-guard.ts
apps/api/src/middleware/backoffice-module-guard.ts
apps/api/src/routes/backoffice/context.ts
apps/api/src/routes/backoffice/types.ts
apps/api/src/routes/backoffice/ws.ts
apps/api/src/db/tenant/migrations/20260228_001_tenant_rbac_skeleton.ts
apps/backoffice/src/main.ts
apps/backoffice/src/App.vue
apps/backoffice/src/stores/context.ts
apps/backoffice/src/composables/useBackofficeContext.ts
apps/backoffice/src/router/index.ts
apps/backoffice/src/plugins/ws.ts
apps/backoffice/src/layouts/BackofficeLayout.vue
apps/backoffice/src/views/Dashboard.vue
apps/backoffice/src/views/WorkspaceLocked.vue
apps/backoffice/src/views/WorkspaceForbidden.vue
apps/backoffice/src/components/Sidebar.vue
packages/types/src/tenant-rbac.ts
packages/redis-utils/src/index.ts
Dockerfile
docker/nginx.conf/nginx.conf
```

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Apply tenant migrations (replace <workspace_slug> with your test slug)
bun run db:migrate --workspace <workspace_slug>

# Start API
bun run dev:api

# Start backoffice SPA (development mode)
cd apps/backoffice && bun run dev

# Build backoffice for production (verify Vite build succeeds)
cd apps/backoffice && bun run build
```

---

## Automated Validation Commands

```bash
# Run all Stage 17 unit tests
bunx vitest run \
  tests/unit/middleware/license-enforcement.test.ts \
  tests/unit/middleware/backoffice-rbac-guard.test.ts \
  tests/unit/middleware/backoffice-module-guard.test.ts \
  tests/unit/db/migrations/tenant-rbac-skeleton.test.ts

# Run all Stage 17 integration tests
bunx vitest run \
  tests/integration/api/backoffice/context.test.ts \
  tests/integration/api/backoffice/ws.test.ts \
  tests/integration/isolation/backoffice-isolation.test.ts

# Run all Stage 17 tests at once (expected: 67/67 pass)
bunx vitest run \
  tests/unit/middleware/license-enforcement.test.ts \
  tests/unit/middleware/backoffice-rbac-guard.test.ts \
  tests/unit/middleware/backoffice-module-guard.test.ts \
  tests/unit/db/migrations/tenant-rbac-skeleton.test.ts \
  tests/integration/api/backoffice/context.test.ts \
  tests/integration/api/backoffice/ws.test.ts \
  tests/integration/isolation/backoffice-isolation.test.ts

# ESLint (Stage 17 files only)
bunx eslint \
  apps/api/src/middleware/license-enforcement.ts \
  apps/api/src/middleware/backoffice-rbac-guard.ts \
  apps/api/src/middleware/backoffice-module-guard.ts \
  apps/api/src/routes/backoffice/context.ts \
  apps/api/src/routes/backoffice/ws.ts \
  apps/api/src/app.ts

# TypeScript type check
bunx tsc --noEmit
```

Expected outcome: **67/67 tests pass, 0 ESLint errors, 0 TypeScript errors.**

---

## Manual Test Scenarios

### Scenario 1 — Happy Path: Get backoffice context

**Purpose:** Verify that an active workspace returns full context data to a valid staff user.

1. Start the API: `bun run dev:api`
2. Send a GET request with a valid staff user JWT for an active workspace:
   ```bash
   curl -H "Authorization: Bearer <valid_staff_jwt>" \
        -H "x-workspace-slug: <active_workspace_slug>" \
        http://localhost:3000/api/v1/backoffice/context
   ```
3. Verify the response body.

Expected:

```json
{
  "success": true,
  "data": {
    "workspace": { "id": "<uuid>", "slug": "<slug>", "name": "<name>" },
    "license": {
      "status": "ACTIVE",
      "plan": "<plan>",
      "product_version": "1.0.0"
    },
    "enabled_modules": ["examinations", "..."],
    "user": { "id": "<uuid>", "email": "<email>", "roles": ["<role>"] }
  },
  "error": null
}
```

HTTP status: `200 OK`

Troubleshooting:

- `401` → JWT is missing or expired. Generate a fresh token.
- `404` → Workspace slug does not exist. Check the `x-workspace-slug` header.
- `500` → Check API logs: `bun run dev:api | jq .`

---

### Scenario 2 — Soft-Locked Workspace Returns 423

**Purpose:** Verify that a SOFT_LOCKED workspace is rejected before reaching the handler.

1. Update a workspace's license status to `SOFT_LOCKED` in the master DB.
2. Send a GET request to `/api/v1/backoffice/context` for that workspace:
   ```bash
   curl -H "Authorization: Bearer <valid_staff_jwt>" \
        -H "x-workspace-slug: <soft_locked_slug>" \
        http://localhost:3000/api/v1/backoffice/context
   ```
3. Observe the response.

Expected:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "WORKSPACE_SOFT_LOCKED",
    "message": "Workspace is soft locked"
  }
}
```

HTTP status: `423 Locked`

Troubleshooting:

- If `200` is returned, license middleware is not running. Check `apps/api/src/app.ts` route mount.

---

### Scenario 3 — RBAC Denial: Insufficient Module Permission (Edge Case)

**Purpose:** Verify that a staff user without permission for a given module is denied access.

1. Create a staff user with a role that does NOT have `read` permission on the `examinations`
   module.
2. Send a GET request to an examinations-protected route:
   ```bash
   curl -H "Authorization: Bearer <limited_staff_jwt>" \
        -H "x-workspace-slug: <active_slug>" \
        http://localhost:3000/api/v1/backoffice/context
   ```
3. Check the response and the API logs for a structured warning.

Expected:

- Response: `403 Forbidden` with `RBAC_DENIED` error code.
- API logs include:
  `{ "level": "warn", "msg": "backoffice rbac denied", "workspace_slug": "...", "correlation_id": "..." }`

Troubleshooting:

- If `200` is returned, the RBAC guard is not applied. Check
  `apps/api/src/routes/backoffice/context.ts` middleware chain.

---

### Scenario 4 — WebSocket Connection Guard

**Purpose:** Verify that a second WS connection from the same user is rejected.

1. Open a WebSocket connection to `ws://localhost:3000/ws/backoffice?workspace=<slug>` with a valid
   JWT.
   - Verify connection is accepted.
2. Open a second WebSocket connection using the same user JWT and same workspace.
   - Verify the second connection is rejected (closed with `4029` or similar policy code).

Expected:

- First connection: established successfully.
- Second connection: rejected by the atomic `SET NX` Redis guard.

Troubleshooting:

- If both connections succeed, check `apps/api/src/routes/backoffice/ws.ts` — verify `SET NX` is in
  the connection handler.

---

## Negative Cases

| Scenario                     | Trigger                                           | Expected Response                    |
| ---------------------------- | ------------------------------------------------- | ------------------------------------ |
| Missing Authorization header | Omit `Authorization` header                       | `401 Unauthorized`                   |
| Archived workspace           | Workspace license status = `ARCHIVED`             | `403 Forbidden` (WORKSPACE_ARCHIVED) |
| Soft-locked workspace        | Workspace license status = `SOFT_LOCKED`          | `423 Locked` (WORKSPACE_SOFT_LOCKED) |
| Unknown workspace slug       | `x-workspace-slug: nonexistent`                   | `404 Not Found`                      |
| Invalid JWT                  | Tampered / expired token                          | `401 Unauthorized`                   |
| Duplicate WS connection      | Same user opens 2nd WS connection                 | `4029` / connection closed           |
| Module not enabled           | Request for module not in `enabled_modules`       | `403 Forbidden` (MODULE_DISABLED)    |
| RBAC permission missing      | Staff user has no permission for requested action | `403 Forbidden` (RBAC_DENIED)        |

Error responses must follow:

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

1. Create two test workspaces: `workspace-a` and `workspace-b`, each with their own staff users.
2. Authenticate as a staff user of `workspace-a` and call `GET /api/v1/backoffice/context`.
3. Verify the response contains only `workspace-a` data.
4. Repeat with a `workspace-b` JWT and verify only `workspace-b` data is returned.
5. Attempt to pass `workspace-b`'s slug with `workspace-a`'s JWT — should return `403` or `404`.

Expected: Absolutely no data leakage between workspaces. Each tenant's RBAC tables, license data,
and user profiles are completely isolated by tenant DB connection pool.

If data leakage is observed, stop and report immediately.

---

## Migration Verification

```bash
# Confirm migration tables were created in a test tenant DB
bun run db:console --workspace <test_workspace_slug>
```

Verify the following tables exist:

| Table                         | Verification                                                               |
| ----------------------------- | -------------------------------------------------------------------------- |
| `backoffice_roles`            | `SELECT id, name FROM backoffice_roles LIMIT 5;`                           |
| `backoffice_role_permissions` | `SELECT role_id, module, action FROM backoffice_role_permissions LIMIT 5;` |
| `backoffice_staff_users`      | `SELECT id, email FROM backoffice_staff_users LIMIT 5;`                    |
| `backoffice_staff_user_roles` | `SELECT staff_user_id, role_id FROM backoffice_staff_user_roles LIMIT 5;`  |

All tables should be present. `roles` and `role_permissions` (STAGE_12 baseline) must still exist
unchanged.

---

## Structured Log Verification

```bash
# Start API and pipe through jq
bun run dev:api | jq .
```

Make requests and confirm each log entry contains:

```json
{
  "level": "info",
  "timestamp": "2026-...",
  "service": "license-engine",
  "workspace_slug": "<slug>",
  "correlation_id": "<uuid>"
}
```

Confirm absence of `console.log` output (plain unstructured strings).

---

## Sign-Off Checklist

- [ ] All 67 automated tests pass (`bunx vitest run <7 files>`)
- [ ] Manual Scenario 1 (happy path context) passes
- [ ] Manual Scenario 2 (soft-locked 423) passes
- [ ] Manual Scenario 3 (RBAC denial) passes
- [ ] Manual Scenario 4 (WS duplicate connection rejected) passes
- [ ] All 8 negative cases return the correct error contract
- [ ] Multi-tenant isolation confirmed (no cross-workspace data)
- [ ] Migration tables (`backoffice_*`) confirmed present
- [ ] No `console.log` or plaintext stack traces in API output
- [ ] All logs include `workspace_slug` and `correlation_id`

---

## References

- `specs/runtime/017-tenant-bootstrap/reports/IMPLEMENT_REPORT.md`
- `specs/runtime/017-tenant-bootstrap/reports/PLAN_REPORT.md`
- `specs/runtime/017-tenant-bootstrap/audits/VALIDATION_REPORT.md`
- `specs/runtime/017-tenant-bootstrap/audits/ANALYZE_REPORT.md`

---

Generated by Zidney Orchestrator Hard Mode v1.2.0.
