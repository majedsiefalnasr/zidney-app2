# Implementation Plan: STAGE_21 — Role & Permission System

**Branch**: `021-role-permission-system` | **Date**: 2026-03-02 | **Spec**: [spec.md](./spec.md)  
**Input**: `specs/runtime/021-role-permission-system/spec.md` (635 lines, all clarifications resolved)

---

## Summary

Implement a tenant-scoped RBAC system for Backoffice staff users. The system introduces boolean-flag module permissions on roles, a permission guard middleware (sitting after JWT auth, before route handlers), atomic role mutations with audit logging, and a route permission registry that fails-closed. All tables reside exclusively in the per-tenant database. The existing STAGE_17 RBAC skeleton (`backoffice_roles`, `backoffice_staff_users`) is extended — not replaced. A new `backoffice_role_module_permissions` table implements the boolean-flags model, and a new `rbac_audit_logs` table provides the immutable audit trail.

---

## Technical Context

**Language/Version**: TypeScript 5.x, Bun runtime  
**Primary Dependencies**: Hono (routing + middleware), Drizzle ORM (schema definitions), pg (SQL execution in migrations), ioredis (optional cache), @zidney/logger (structured logging)  
**Storage**: PostgreSQL per-tenant (Bun + pg pool manager), Redis (optional short-lived cache)  
**Testing**: Vitest (unit + integration), supertest-style HTTP tests  
**Target Platform**: Bun server, Linux container  
**Project Type**: Web service (API layer) + domain package  
**Performance Goals**: Permission evaluation ≤ 10ms p95 (per-request cache path)  
**Constraints**: No cross-tenant joins; no global DB singleton; server-authoritative timestamps; no hardcoded admin bypass  
**Scale/Scope**: 10 modules × 4 flags per role; expected < 100 roles per tenant

---

## Constitution Check

_Gate passed — pre-implementation and post-design._

| Rule                                | Status | Notes                                                          |
| ----------------------------------- | ------ | -------------------------------------------------------------- |
| Database-per-tenant                 | ✓ PASS | All tables in tenant DB; migration targets tenant pool only    |
| No cross-tenant access              | ✓ PASS | All queries scoped to resolved tenant connection               |
| License middleware prerequisite     | ✓ PASS | Permission guard positioned after license enforcement in chain |
| No global DB singleton              | ✓ PASS | DB access via `c.get('tenant').pool` only                      |
| Transaction boundaries respected    | ✓ PASS | All role mutations in single transaction                       |
| Audit log within same transaction   | ✓ PASS | rbac_audit_logs INSERT in same tx as mutation                  |
| Attempt engine untouched            | ✓ PASS | Feature does not touch attempt/grading paths                   |
| No forward-only migration violation | ✓ PASS | No existing migration files modified                           |
| No frontend enforcement             | ✓ PASS | Vue composable is display-only; all enforcement is server-side |
| JWT workspace_id assertion          | ✓ PASS | Permission guard performs explicit workspace_id check          |
| Structured logging                  | ✓ PASS | All log calls via @zidney/logger with required fields          |

---

## Migration Strategy

### Migration File

**Filename**: `apps/api/src/db/tenant/migrations/20260302_001_rbac_role_permissions_complete.ts`  
**Schema version bump**: `1.3.0 → 1.4.0`

### What it does (single DDL transaction)

1. **ALTER TABLE `backoffice_roles`** — ADD COLUMN `status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED'))`  
   → Existing rows automatically receive `status = 'ACTIVE'`. Additive, no data loss.

2. **CREATE TABLE `backoffice_role_module_permissions`** — boolean-flags model  
   → Columns: `id`, `role_id` (FK → backoffice_roles CASCADE), `module`, `can_view`, `can_create`, `can_edit`, `can_delete`, `created_at`, `updated_at`  
   → UNIQUE `(role_id, module)`  
   → Indexes: `idx_brmp_role_id`, `idx_brmp_role_module`

3. **ALTER TABLE `backoffice_staff_users`** — ADD COLUMN `role_id UUID NULLABLE REFERENCES backoffice_roles(id) ON DELETE SET NULL`  
   → Existing rows receive `role_id = NULL` (treated as no-access per FR-018).

4. **ALTER TABLE `backoffice_staff_users`** — ADD COLUMN `division_ids UUID[] NOT NULL DEFAULT '{}'`

5. **CREATE TABLE `rbac_audit_logs`** — immutable RBAC audit trail  
   → Columns: `id`, `user_id` (nullable), `role_id` (nullable), `module` (nullable), `action`, `request_id`, `workspace_slug`, `timestamp`, `is_immutable`, `metadata` (JSONB)  
   → Immutability trigger reuses existing `prevent_audit_modification()` function  
   → Indexes: `idx_rbac_al_role_id`, `idx_rbac_al_user_id`, `idx_rbac_al_timestamp`

6. **UPDATE `schema_version`** — `1.3.0 → 1.4.0`

7. **down()** — throws (forward-only per ADR-0008)

### Why not modify baseline tables

- `roles` (STAGE_12) is a frontoffice/general model. Do not alter.
- `role_permissions` (STAGE_12) uses string-code junction model. Do not alter.
- `backoffice_role_permissions` (STAGE_17) uses triplet model. Cannot convert in-place — create new `backoffice_role_module_permissions` table.
- `audit_logs` (STAGE_03) has rigid `event_type` CHECK constraint. Cannot extend — create new `rbac_audit_logs` table.

---

## Permission Guard Middleware Design

### Position in stack

```
correlationId
  → tenantResolver           (sets c.get('tenant'))
  → licenseMiddleware        (423/403/404 on bad license)
  → validateJwtMiddleware    (validates signature, expiry, scope='backoffice')
  → workspace-id-assertion   (jwt.workspace_id === tenant.id — 403 on mismatch, WARN log)
  → [per-route] createPermissionGuard(logger, module, action)
  → route handler
```

### Route permission registry

File: `apps/api/src/middleware/route-permission-registry.ts`

```typescript
// Maps "METHOD /path/pattern" → { module, action }
// Used by permission guard to determine what to evaluate.
// Rules:
// - Every route must appear here OR be explicitly marked public.
// - Routes absent from registry AND not marked public → 403 (fail-closed).
export const ROUTE_PERMISSION_REGISTRY: Record<
  string,
  {
    module: string
    action: 'can_view' | 'can_create' | 'can_edit' | 'can_delete'
  }
> = {
  'GET /api/backoffice/roles': { module: 'settings', action: 'can_view' },
  'POST /api/backoffice/roles': { module: 'settings', action: 'can_create' },
  'GET /api/backoffice/roles/:id': { module: 'settings', action: 'can_view' },
  'PATCH /api/backoffice/roles/:id': { module: 'settings', action: 'can_edit' },
  'PUT /api/backoffice/roles/:id/permissions': {
    module: 'settings',
    action: 'can_edit',
  },
  'DELETE /api/backoffice/roles/:id': {
    module: 'settings',
    action: 'can_delete',
  },
  'GET /api/backoffice/roles/:id/users': {
    module: 'settings',
    action: 'can_view',
  },
  'PATCH /api/backoffice/staff/:userId/role': {
    module: 'users',
    action: 'can_edit',
  },
  'GET /api/backoffice/role-permission-modules': {
    module: 'settings',
    action: 'can_view',
  },
}

export const PUBLIC_ROUTES = new Set([
  'GET /api/backoffice/health',
  'GET /api/backoffice/context', // auth required but no module permission check
])
```

### Guard factory

File: `apps/api/src/middleware/backoffice-permission-guard-v2.ts`

```typescript
export function createPermissionGuard(
  logger: Logger,
  module: string,
  action: 'can_view' | 'can_create' | 'can_edit' | 'can_delete'
): MiddlewareHandler {
  return async (c, next) => {
    // 1. Workspace-id assertion (cross-tenant token replay guard)
    // 2. Load staff user from backoffice_staff_users by jwt.sub
    // 3. Check user.is_active === true → else 403
    // 4. Check user.role_id != null → else 403
    // 5. Load role from backoffice_roles WHERE id = user.role_id
    // 6. Check role.status === 'ACTIVE' → else 403
    // 7. Load permission from backoffice_role_module_permissions WHERE role_id + module
    //    (check per-request in-memory cache first, then Redis if available)
    // 8. Check permission[action] === true → else 403
    // 9. All 403s use { code: 'FORBIDDEN', message: 'Access denied' }
    //    log at WARN with correlation_id, user_id, module, action, workspace_slug
  }
}
```

### Caching

| Scope                  | Mechanism                                                              | Invalidation                      |
| ---------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| Per-request            | `Map<string, boolean>` created at guard entry, disposed at response    | N/A — request-scoped              |
| Short-lived in-process | Redis key `rbac_v2:{workspace_id}:{user_id}:{module}:{action}` TTL 30s | Flush on role/permission mutation |

Cache invalidation is **synchronous with mutation** — Redis DEL before transaction commits. If Redis DEL fails, log ERROR and proceed with transaction; next request does fresh DB read.

Cache key prefix `rbac_v2:` is distinct from STAGE_17's `rbac:` to prevent cross-stage cache pollution.

---

## Transaction Boundaries

| Operation                   | Transaction Scope                                                       | Audit Log in Tx? |
| --------------------------- | ----------------------------------------------------------------------- | ---------------- |
| POST /roles (+ permissions) | roles INSERT + role_permissions INSERTs + rbac_audit_logs INSERT        | Yes              |
| PATCH /roles/:id            | roles UPDATE + rbac_audit_logs INSERT                                   | Yes              |
| PUT /roles/:id/permissions  | role_permissions DELETE + INSERTs + rbac_audit_logs INSERT              | Yes              |
| DELETE /roles/:id           | SELECT FOR UPDATE + count check + roles DELETE + rbac_audit_logs INSERT | Yes              |
| PATCH /staff/:userId/role   | staff_users UPDATE + rbac_audit_logs INSERT                             | Yes              |

All transactions use `BEGIN ... COMMIT` with `ROLLBACK` on any error. No partial state is permitted.

**Delete-role concurrency** (A5 resolution):

```sql
BEGIN;
SELECT id FROM backoffice_roles WHERE id = $1 FOR UPDATE;
SELECT COUNT(*) FROM backoffice_staff_users WHERE role_id = $1 AND is_active = true;
-- if count > 0: ROLLBACK, return 409 ROLE_HAS_ACTIVE_USERS
DELETE FROM backoffice_roles WHERE id = $1;
INSERT INTO rbac_audit_logs ...;
COMMIT;
```

---

## Error Handling

All mutation errors follow the platform error contract `{ success, data, error: { code, message } }`.

| Scenario                           | Status | Code                    | Internal details exposed?                      |
| ---------------------------------- | ------ | ----------------------- | ---------------------------------------------- |
| Permission denied (any guard step) | 403    | `FORBIDDEN`             | Never                                          |
| Duplicate role name                | 409    | `ROLE_NAME_CONFLICT`    | Never                                          |
| Delete with active users           | 409    | `ROLE_HAS_ACTIVE_USERS` | Never (no count in message)                    |
| Assign disabled role               | 422    | `ROLE_NOT_ASSIGNABLE`   | Never                                          |
| Unknown module key                 | 422    | `INVALID_MODULE`        | Never                                          |
| Role not found                     | 404    | `ROLE_NOT_FOUND`        | Never                                          |
| DB unavailable                     | 503    | `SERVICE_UNAVAILABLE`   | Never (generic message)                        |
| Transaction failure                | 500    | `INTERNAL_ERROR`        | Never (full error in log only)                 |
| JWT workspace mismatch             | 403    | `FORBIDDEN`             | Never (logged at WARN with both workspace IDs) |

---

## Logging Requirements

All RBAC operations emit structured JSON logs via `@zidney/logger`. `console.log` is forbidden.

**Required fields on every log entry**:

| Field            | Source                                           |
| ---------------- | ------------------------------------------------ |
| `timestamp`      | Server time (ISO-8601)                           |
| `level`          | `INFO` / `WARN` / `ERROR`                        |
| `service`        | `'backoffice-api'`                               |
| `workspace_slug` | `c.get('tenant').slug`                           |
| `workspace_id`   | `c.get('tenant').id`                             |
| `user_id`        | `c.get('staff_user').user_id` (if authenticated) |
| `correlation_id` | `c.get('correlationId')`                         |
| `role_id`        | Target role (for role operations)                |
| `action`         | Audit action string                              |

**Log levels**:

- Permission denied → `WARN`
- Role mutation success → `INFO`
- Transaction failure → `ERROR`
- JWT workspace mismatch → `WARN` (includes both `jwt_workspace_id` and `resolved_workspace_id`)
- Cache invalidation failure → `ERROR`

---

## File Structure

### New files to create

```text
apps/api/src/
├── db/tenant/
│   ├── migrations/
│   │   └── 20260302_001_rbac_role_permissions_complete.ts   ← STAGE_21 migration
│   └── schemas/
│       ├── backoffice-roles.schema.ts                        ← Drizzle schema (extended)
│       ├── backoffice-role-module-permissions.schema.ts      ← New boolean-flags table
│       ├── backoffice-staff-users.schema.ts                  ← Drizzle schema (extended)
│       └── rbac-audit-logs.schema.ts                         ← New audit table
├── middleware/
│   ├── backoffice-permission-guard-v2.ts                     ← New permission guard factory
│   └── route-permission-registry.ts                          ← Route → (module,action) map
└── routes/backoffice/
    └── roles.ts                                              ← All 9 role management endpoints (CRUD, permissions, staff assignment, module list)

packages/domain-core/src/rbac/
├── rbac.types.ts            ← RbacRole, RolePermission, RbacAuditEntry types (T007)
├── rbac.service.ts          ← createRole, updateRole, deleteRole, listRoles, getRole, evaluatePermission, replacePermissions (T008)
├── rbac.audit.ts            ← writeRbacAuditLog() — called within DB transaction (T009)
└── permission-registry.ts   ← ROUTE_PERMISSION_REGISTRY, lookupPermission (T010 — single source of truth)

tests/
├── unit/rbac/
│   ├── permission-guard.test.ts    ← unit tests for evaluatePermission()
│   └── role-service.test.ts        ← unit tests for role CRUD logic
├── integration/rbac/
│   ├── roles-api.test.ts           ← end-to-end API tests
│   ├── permission-guard-chain.test.ts ← middleware chain tests
│   └── audit-log.test.ts           ← audit log transactionality tests
└── contract/rbac/
    └── rbac-api.contract.test.ts   ← contract tests against api-contracts.md

apps/backoffice/src/composables/
└── usePermission.ts          ← Display-only Vue 3 composable (no enforcement logic)
```

### Files NOT modified in STAGE_21

- `apps/api/src/middleware/backoffice-rbac-guard.ts` (STAGE_17 guard — not deleted; used by STAGE_17 routes)
- Any master DB migrations
- `apps/api/src/db/tenant/migrations/20260228_001_tenant_rbac_skeleton.ts` (STAGE_17 — forward-only)
- `apps/api/src/db/tenant/migrations/20260217_002_create_audit_logs.ts` (STAGE_03 — forward-only)

---

## Frontend Integration Notes

### Display-only permission composable

```typescript
// apps/backoffice/src/composables/usePermission.ts
// PURPOSE: UI display aid only. Zero enforcement.
// Enforcement is 100% server-side via permission guard middleware.
export function usePermission() {
  const permissions = ref<Record<string, Record<string, boolean>>>({})

  async function fetchPermissions() {
    // GET /api/backoffice/context (already returns user context)
    // Extract permission set from context response and populate local map
  }

  function can(
    module: string,
    action: 'view' | 'create' | 'edit' | 'delete'
  ): boolean {
    return permissions.value[module]?.[`can_${action}`] ?? false
  }

  return { fetchPermissions, can }
}
```

**Rules for frontend use**:

- `can()` may be used to show/hide buttons and routes in the UI
- `can()` outcome MUST NOT be trusted for security decisions
- If the API returns 403, the UI shows a generic "Access denied" view
- No permission logic runs in the frontend routing layer

### Role management UI (shadcn-vue)

- Use `<Table>` component from shadcn-vue for the role list
- Use `<Switch>` component for enabling/disabling roles
- Use a permission matrix component (custom grid built on shadcn-vue `<Checkbox>`) for PUT /roles/:id/permissions
- All writes go through the API; UI re-fetches after mutation

---

## Project Structure

### Documentation (this feature)

```text
specs/runtime/021-role-permission-system/
├── plan.md              ← This file
├── research.md          ← Phase 0 complete
├── data-model.md        ← Phase 1 complete
├── contracts/
│   └── api-contracts.md ← Phase 1 complete
└── tasks.md             ← Phase 2 complete (22 tasks including T022 version compatibility)
```

### Source Code Layout

See "File Structure" section above.

---

## Complexity Tracking

No Constitution violations detected. No ADR exceptions required for this stage.

**Complexity flags**:

- The `backoffice_role_permissions` (STAGE_17 triplet model) remains intact alongside the new `backoffice_role_module_permissions` (Phase 3 boolean-flags model). The STAGE_21 guard targets only the new table. The coexistence of two permission table models is a known technical artifact of forward-only migration policy. STAGE_22+ may deprecate the triplet table explicitly.
- The `is_active BOOLEAN` vs `status VARCHAR` difference on `backoffice_staff_users` is handled by mapping `is_active = true → ACTIVE` in the guard logic. A future migration may normalize this.

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
