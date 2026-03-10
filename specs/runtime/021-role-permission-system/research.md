# Research: STAGE_21 — Role & Permission System

**Branch**: `021-role-permission-system`  
**Date**: 2026-03-02  
**Phase 0 output of** `/speckit.plan`  
**Spec**: `specs/runtime/021-role-permission-system/spec.md`

---

## Methodology

All findings produced by direct codebase inspection of:

- `apps/api/src/db/tenant/migrations/` — migration history
- `apps/api/src/db/tenant/schemas/` — existing Drizzle schemas
- `apps/api/src/middleware/` — existing middleware patterns
- `apps/api/src/routes/backoffice/` — existing Backoffice route patterns
- `packages/domain-core/src/` — existing domain logic structure

---

## R-001: Existing Tenant Schema State

### What already exists in the tenant DB

| Table                         | Source Migration                                  | Relevance                                                                                           |
| ----------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `roles`                       | `baseline_002_roles.sql` (STAGE_12)               | Simple name+description+permission_level; **NOT** the backoffice RBAC model                         |
| `permissions`                 | `baseline_003_permissions.sql` (STAGE_12)         | Code-string permissions (`exam:create`, etc.); **NOT** module-flag model                            |
| `role_permissions`            | `baseline_003_permissions.sql` (STAGE_12)         | Junction: `(role_id, permission_id)` — string-code model                                            |
| `backoffice_roles`            | `20260228_001_tenant_rbac_skeleton.ts` (STAGE_17) | Backoffice roles table — **missing `status` column**                                                |
| `backoffice_role_permissions` | `20260228_001_tenant_rbac_skeleton.ts` (STAGE_17) | Triplet model: `(role_id, module, action)` — **NOT** boolean-flags model                            |
| `backoffice_staff_users`      | `20260228_001_tenant_rbac_skeleton.ts` (STAGE_17) | Staff accounts — uses `is_active BOOLEAN`, **no `role_id` FK column**, **no `division_ids` column** |
| `backoffice_staff_user_roles` | `20260228_001_tenant_rbac_skeleton.ts` (STAGE_17) | Many-to-many junction; spec requires single-role FK model                                           |
| `audit_logs`                  | `20260217_002_create_audit_logs.ts` (STAGE_03)    | Generic event audit; `event_type` is constrained to fixed values — RBAC events not in list          |
| `translations`                | `20260301_001_translation_system.ts` (STAGE_19)   | Unrelated to RBAC                                                                                   |
| `workflow_logs`               | `20260301_002_workflow_engine.ts` (STAGE_20)      | Unrelated to RBAC                                                                                   |

**Decision**: Use `backoffice_` prefix for all new STAGE_21 tables to maintain consistency with
STAGE_17 pattern and avoid collision.

---

## R-002: Schema Version Baseline

- Last migration: `20260301_002_workflow_engine.ts` — bumped schema_version `1.2.0 → 1.3.0`
- **STAGE_21 migration must bump: `1.3.0 → 1.4.0`**

---

## R-003: backoffice_roles — Missing `status` Column

**Finding**: `backoffice_roles` (STAGE_17) has columns `id`, `workspace_id`, `name`, `description`,
`created_at`, `updated_at`. **No `status` column.**

**Decision**:

- STAGE_21 migration adds
  `status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED'))` to
  `backoffice_roles`
- All existing rows automatically receive `status = 'ACTIVE'` via default value
- Additive migration — no data loss

---

## R-004: backoffice_role_permissions — Schema Model Mismatch

**Finding**: STAGE_17 `backoffice_role_permissions` uses a **triplet model**: one row per
`(role_id, module, action)` with a CHECK constraint
`action IN ('view', 'create', 'edit', 'delete')`.

**Spec STAGE_21 requires**: A **boolean-flags model** — one row per `(role_id, module)` with columns
`can_view`, `can_create`, `can_edit`, `can_delete`.

These are fundamentally different schemas and cannot be migrated in-place without destructive
change.

**Decision**:

- Create new table: `backoffice_role_module_permissions` (boolean flags model)
- The STAGE_17 `backoffice_role_permissions` table remains intact (not dropped) to avoid breaking
  any STAGE_17 code paths
- The STAGE_21 permission guard, repositories, and domain logic target
  `backoffice_role_module_permissions` exclusively
- `backoffice_role_permissions` is treated as legacy/deprecated for STAGE_21 scope

**Rationale**: Forward-only migration policy forbids destructive changes. The STAGE_17 guard
(`backoffice-rbac-guard.ts`) references the old schema; it will be superseded by the new STAGE_21
guard for new routes but is not deleted in this stage.

---

## R-005: backoffice_staff_users — Missing role_id and division_ids

**Finding**: STAGE_17 `backoffice_staff_users` has:

- `is_active BOOLEAN NOT NULL DEFAULT true` — no `status` enum column
- No `role_id` column — role assignment was via `backoffice_staff_user_roles` junction table
- No `division_ids` column

**Spec STAGE_21 requires**:

- `staff_users.role_id` — nullable UUID FK to `backoffice_roles.id ON DELETE SET NULL`
- `staff_users.division_ids` — UUID array, default `'{}'`

**Decision**:

- STAGE_21 migration ADDS `role_id UUID NULLABLE FK → backoffice_roles(id) ON DELETE SET NULL`
- STAGE_21 migration ADDS `division_ids UUID[] NOT NULL DEFAULT '{}'`
- The `is_active BOOLEAN` field is mapped in the permission guard as `is_active = true → ACTIVE` (no
  schema change needed for status evaluation)
- The legacy `backoffice_staff_user_roles` junction table remains (not dropped); `role_id` on
  `backoffice_staff_users` provides the single-role assignment model

---

## R-006: Audit Log — RBAC Events Not Supported

**Finding**: `audit_logs` (STAGE_03) has a rigid `event_type CHECK` constraint supporting only 14
predefined event types (`login_success`, `login_failed`, etc.). RBAC audit events (`CREATE_ROLE`,
`UPDATE_ROLE`, `DISABLE_ROLE`, `DELETE_ROLE`, `UPDATE_PERMISSIONS`) are **not in the constraint
list**.

**Decision**:

- Per forward-only migration policy, the existing `audit_logs` table constraint cannot be modified
- STAGE_21 migration creates a new **`rbac_audit_logs`** table with an immutability trigger
- This pattern is identical to `translation_audit_logs` (created in STAGE_19)
- `rbac_audit_logs` contains: `id`, `user_id`, `role_id`, `module`, `action`, `request_id`,
  `workspace_slug`, `timestamp`, `is_immutable`

---

## R-007: Middleware Chain — Existing Patterns

**Existing middleware chain** (from `apps/api/src/routes/backoffice/context.ts` and
`apps/api/src/middleware/auth/`):

```
correlationId → tenantResolver → licenseEnforcement → schemaVersion → rateLimit → authentication → route handler
```

**STAGE_21 permission guard insertion point** (post-auth, pre-handler):

```
correlationId → tenantResolver → licenseMiddleware → auth-jwt → [permission-guard] → route handler
```

**Existing STAGE_17 guard** (`backoffice-rbac-guard.ts`): Pattern factory
`createBackofficeRBACGuard(logger, module, action)`. The STAGE_21 guard follows this same factory
pattern but uses:

- `backoffice_role_module_permissions` (new boolean-flags table)
- Route permission registry map
- `backoffice_roles.status` enforcement
- `backoffice_staff_users.is_active` enforcement

**Decision**: New guard file `apps/api/src/middleware/backoffice-permission-guard-v2.ts` with
factory function `createPermissionGuard(logger, module, action)`.

---

## R-008: Route Permission Registry Pattern

**Finding**: Spec A1 mandates a central route-permission registry map. No such registry exists yet.

**Decision**:

- Create `apps/api/src/middleware/route-permission-registry.ts`
- Registry is a `Map<string, { module: string; action: string }>` keyed by `"METHOD /path/pattern"`
- Every Backoffice API route MUST appear in this map before production deployment
- Routes absent from the registry and not explicitly marked `public` are **fail-closed** (403)

---

## R-009: JWT Workspace Claim

**Finding**: `validate-jwt.ts` calls `validateJwtClaims(payload, resolvedWorkspaceId, ...)` from
`@zidney/domain-core/auth`. The `resolvedWorkspaceId` is from `c.get('workspaceId')`. This validates
workspace scope.

**Gap**: The spec (A2 / FR-007 updated) requires asserting `jwt.workspace_id === resolvedTenant.id`
as a mandatory sub-step. The current `validateJwtClaims` call passes `resolvedWorkspaceId` which
should perform this check — but it depends on the `@zidney/domain-core/auth` implementation.

**Decision**: The STAGE_21 permission guard adds an explicit `workspace_id` assertion as a first
step (reading from `c.get('tenant').workspaceId` vs JWT payload `workspace_id` claim), logged at
WARN on mismatch. This ensures the check is present regardless of how `validateJwtClaims` is
implemented.

---

## R-010: Drizzle Schema Files

**Finding**: `apps/api/src/db/tenant/schemas/` currently contains only:

- `translation-audit-logs.schema.ts`
- `translations.schema.ts`
- `workspace-settings.schema.ts`

These use Drizzle ORM (`drizzle-orm/pg-core`) with `pgTable`, `uuid`, `varchar`, `boolean`,
`timestamp` imports.

**Decision**: New Drizzle schema files follow the same pattern:

- `apps/api/src/db/tenant/schemas/backoffice-roles.schema.ts`
- `apps/api/src/db/tenant/schemas/backoffice-staff-users.schema.ts`

---

## R-011: Domain Package Structure

**Finding**: `packages/domain-core/src/` has subdirectories: `auth/`, `audit/`, `errors/`,
`services/`, `translation/`, `workflow/`, etc.

**Decision**: New RBAC business logic lives in `packages/domain-core/src/rbac/` with:

- `role.service.ts` — role CRUD operations
- `permission.service.ts` — permission upsert/replace operations
- `permission-guard.ts` — pure evaluation function (no HTTP)
- `types.ts` — RBAC-specific TypeScript types

---

## R-012: Caching Model

**Finding**: Existing `backoffice-rbac-guard.ts` uses Redis with TTL 30s
(`rbac:{workspace_id}:{user_id}:{module}:{action}` → `'1'|'0'`).

**Decision for STAGE_21**:

- Default: **per-request in-memory** (Map populated at request start, discarded at end)
- Opt-in: Short-lived in-process cache (30s) if Redis is available — consistent with STAGE_17
  pattern
- Invalidation: On any `backoffice_roles` or `backoffice_role_module_permissions` mutation, flush
  all `rbac:{workspace_id}:*` keys from Redis
- Cache key format: `rbac_v2:{workspace_id}:{user_id}:{module}:{action}` (new prefix to avoid
  collision with STAGE_17 keys)

---

## R-013: Frontend Integration

**Finding**: `apps/backoffice/src/` exists but there is no permission composable yet.

**Decision**: A Vue 3 composable `usePermission(module, action)` will be documented as a
**display-only** aid (not enforcement). The composable calls the API to fetch the authenticated
user's permission set on mount. Zero enforcement logic in frontend.

---

## Summary of NEEDS CLARIFICATION → Resolution

| #    | Unknown                                                | Resolution                                                                                        |
| ---- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| RC-1 | What `roles` table does STAGE_21 extend?               | `backoffice_roles` (STAGE_17), adding `status` column                                             |
| RC-2 | Does `role_permissions` conflict with existing tables? | Yes — create `backoffice_role_module_permissions` with boolean-flags model                        |
| RC-3 | Does `staff_users` have a `role_id` column?            | No — STAGE_21 migration adds it via ALTER TABLE                                                   |
| RC-4 | Does `audit_logs` support RBAC events?                 | No — create separate `rbac_audit_logs` table                                                      |
| RC-5 | What is current schema_version?                        | `1.3.0` (set by STAGE_20 migration)                                                               |
| RC-6 | Does JWT embed `workspace_id`?                         | Partially (passes via validateJwtClaims) — STAGE_21 guard adds explicit assertion                 |
| RC-7 | Is there a route permission registry?                  | None — created new in STAGE_21                                                                    |
| RC-8 | Migration file naming convention?                      | `YYYYMMDD_NNN_description.ts` prefix; STAGE_21 → `20260302_001_rbac_role_permissions_complete.ts` |
