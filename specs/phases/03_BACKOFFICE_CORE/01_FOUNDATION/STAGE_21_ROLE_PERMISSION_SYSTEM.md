# STAGE 21 – Role & Permission System (Backoffice)

Phase: 03_BACKOFFICE_CORE  
Domain: 01_FOUNDATION  
Scope: Tenant-level RBAC system  
Database: Tenant DB only

---

## Stage Status

Status: DRAFT
Risk Level: MEDIUM
Last Updated: 2026-03-02T00:00:00.000Z

Scope Planned:

- Additive migration 20260302_001_rbac_role_permissions_complete.ts (schema 1.3.0 → 1.4.0)
- New table: backoffice_role_module_permissions (boolean-flags RBAC model)
- New table: rbac_audit_logs (immutable RBAC audit trail)
- Extend: backoffice_roles.status column added
- Extend: backoffice_staff_users.role_id + division_ids columns added
- Domain package: packages/domain-core/src/rbac/ (pure business logic)
- Middleware: apps/api/src/middleware/backoffice-permission-guard.ts
- API: 9 new endpoints under /api/backoffice/roles
- Frontend: apps/backoffice/src/composables/usePermission.ts (display-only)

Deferred Scope:

- Per-user custom permission overrides (Phase 3+)
- Division-scoped permission overrides (future phase)
- Audit log retention/archival policy (future stage)
- STAGE_17 triplet permission table deprecation (post-STAGE_21 cleanup)

Constitutional Compliance:

- Technical plan compliant — task generation authorized

Notes:
Technical plan complete. Both guardian validators returned PASS. Task breakdown in progress.

---

## Objective

Implement a strict, tenant-isolated Role-Based Access Control (RBAC) system for Backoffice users.

RBAC must be:

- Fully tenant-scoped
- Enforced server-side only
- Deterministic
- Auditable
- Extensible without schema redesign

Backoffice RBAC is completely separate from MMC RBAC.

No permission logic may exist in shared platform scope.

---

## RBAC Model

Core rules:

- One staff user → exactly one role
- One role → many permissions
- Permissions are module-scoped
- No per-user custom permission overrides (Phase 3)

RBAC applies only to Backoffice (staff users).

Students use fixed permission model and are not governed by this RBAC stage.

---

## Permission Structure

Permissions are grouped by module.

Modules include:

- Academic Structure
- Content Classification
- Exam Engine
- Users (Staff / Students)
- Commercial Layer
- Media & Assets
- Communication
- Ads
- Dashboard
- Settings

Each module must support:

- can_view
- can_create
- can_edit
- can_delete

Future expansion must allow:

- can_review
- can_approve
- can_enable
- custom workflow transitions

Schema must not require redesign to support new permission flags.

---

## Database Schema

### roles

Columns:

- id (UUID, PK)
- name (varchar, unique per tenant)
- status (ACTIVE | DISABLED)
- created_at
- updated_at

Constraints:

- Role names must be unique per tenant
- DISABLED roles cannot be assigned to new users

---

### role_permissions

Columns:

- id (UUID, PK)
- role_id (FK → roles.id)
- module (varchar)
- can_view (boolean)
- can_create (boolean)
- can_edit (boolean)
- can_delete (boolean)

Constraints:

- Unique (role_id, module)
- No duplicate module permission rows per role

---

### staff_users (extended)

Must include:

- id
- role_id (FK → roles.id)
- division_ids (array of UUID)
- status (ACTIVE | DISABLED)
- created_at
- updated_at

Division membership is separate from permission model.

RBAC does not change per division in Phase 3.

---

## Enforcement Rules

Every Backoffice API route must:

1. Validate JWT
2. Resolve tenant
3. Load staff user
4. Load role
5. Validate role.status == ACTIVE
6. Load role_permissions
7. Validate module + action permission

Permission validation must occur before business logic execution.

No controller may perform action before permission check.

No UI-only permission enforcement allowed.

---

## Permission Evaluation Model

Evaluation must follow:

IF role.status != ACTIVE → 403  
IF user.status != ACTIVE → 403  
IF permission missing → 403

Error response must not expose internal permission structure.

Return generic forbidden response.

---

## Caching Rules

Permission lookup may be cached per request.

Optional short-lived in-memory cache per tenant allowed.

Cache invalidation required when:

- Role updated
- Permission updated
- Role disabled

Permission change must affect users immediately (no long stale cache).

---

## Audit Requirements

Destructive actions must:

- Record user_id
- Record role_id
- Record module
- Record action
- Record timestamp

Audit logs must be immutable.

Audit log must include request_id.

---

## Disabled Role Behavior

If role is DISABLED:

- All assigned users lose access immediately
- Login may succeed
- API access must return 403

No partial permission allowed for disabled role.

---

## Extensibility

Future enhancements may include:

- Workflow transition permissions
- Field-level permissions
- Division-scoped permission overrides
- Temporary role elevation

Current phase must not block future extension.

Schema must remain stable.

---

## Validation Criteria

Stage complete when:

- Unauthorized action blocked server-side
- Disabled role blocks access immediately
- Role update affects users instantly
- Permission removal takes effect without restart
- All Backoffice routes protected
- No direct repository call bypasses permission guard
- Audit logs written for destructive operations

---

## Not Allowed

- Hardcoded admin bypass
- Implicit superuser role without DB entry
- Permission enforcement in frontend only
- Shared roles across tenants
- Global RBAC table outside tenant DB
- Per-user permission overrides (Phase 3)
- Cross-tenant permission checks

---

Backoffice Foundation domain is complete after this stage.

All future Backoffice modules must integrate with this RBAC engine.
