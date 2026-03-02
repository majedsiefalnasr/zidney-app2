# STAGE 21 – Role & Permission System (Backoffice)

Phase: 03_BACKOFFICE_CORE  
Domain: 01_FOUNDATION  
Scope: Tenant-level RBAC system  
Database: Tenant DB only

---

## Stage Status

Status: PRODUCTION READY
Risk Level: LOW
Closure Date: 2026-03-02
Last Updated: 2026-03-02T16:00:00.000Z

Implementation: COMPLETE
Tasks: 22 / 22 completed

Scope Closed:

- Tenant migration: backoffice_roles, backoffice_role_module_permissions, rbac_audit_logs; schema_version 1.3.0 → 1.4.0
- Drizzle schemas: backoffice-roles, backoffice-role-module-permissions, rbac-audit-logs, backoffice-staff-users (role_id, division_ids)
- Domain-core package: rbac.types.ts, rbac.service.ts, rbac.audit.ts, permission-registry.ts (10 modules × 4 actions)
- Permission guard v2: cache-first (rbac_v2:), SCAN cursor invalidation, starts at step 2 (workspace_id assertion is chain-level)
- 9 REST endpoints: CRUD roles + permissions + staff role assignment + module list
- Vue pages: RolesListPage, CreateRolePage, RoleDetailPage + usePermission composable
- 62 tests passing: 18 unit (rbac.service) + 20 unit (permission-registry) + 18 integration (routes) + 6 integration (version-compat)

Deferred Scope:

- Per-user custom permission overrides (Phase 3+)
- Division-scoped permission overrides (future phase)
- Audit log retention/archival policy (future stage)
- STAGE_17 triplet permission table deprecation (post-STAGE_21 cleanup)

Constitutional Compliance:

- ADR-0001 Database-per-tenant isolation enforced
- ADR-0002 Snapshot immutability enforced (additive-only, forward-only migration)
- ADR-0006 Server-authoritative time enforced
- ADR-0007 Version compatibility enforced (1.3.0 → 1.4.0)
- ADR-0008 Semantic versioning enforced (forward-only down())
- All writes transactional; audit logs co-transactional
- SCAN cursor for Redis invalidation; rbac_v2: prefix
- No raw SQL; Drizzle typed queries throughout
- Middleware order preserved; no duplicate workspace_id assertion

Phase Artifacts:

- Specification: specs/runtime/021-role-permission-system/spec.md (with Clarifications)
- Design Plan: specs/runtime/021-role-permission-system/plan.md
- Task Breakdown: specs/runtime/021-role-permission-system/tasks.md (all 22 [X])
- Implementation Report: specs/runtime/021-role-permission-system/reports/IMPLEMENT_REPORT.md
- Validation Evidence: specs/runtime/021-role-permission-system/audits/VALIDATION_REPORT.md
- Drift Analysis: specs/runtime/021-role-permission-system/audits/ANALYZE_REPORT.md (PASSED)
- Closure Report: specs/runtime/021-role-permission-system/reports/CLOSURE_REPORT.md
- Testing Guide: specs/runtime/021-role-permission-system/guides/TESTING_GUIDE.md
- PR Summary: specs/runtime/021-role-permission-system/PR_SUMMARY.md

Notes:
Stage is production ready. Ready for PR review and deployment. Testing guide available for QA teams.

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
