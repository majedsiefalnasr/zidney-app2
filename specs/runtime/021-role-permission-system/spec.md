# Feature Specification: Role & Permission System (Backoffice)

**Feature Branch**: `021-role-permission-system`  
**Stage**: `STAGE_21_ROLE_PERMISSION_SYSTEM`  
**Phase**: `03_BACKOFFICE_CORE / 01_FOUNDATION`  
**Created**: 2026-03-02  
**Status**: IN PROGRESS  
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/01_FOUNDATION/STAGE_21_ROLE_PERMISSION_SYSTEM.md`

---

## Feature Overview

This stage implements the Role-Based Access Control (RBAC) system for Backoffice staff users within the Zidney platform. It introduces tenant-scoped roles and module-level permissions, enforced exclusively server-side via middleware.

**What is being built:**

- A `roles` table per-tenant holding role definitions and statuses.
- A `role_permissions` table per-tenant mapping roles to per-module permission flags.
- Extension of `staff_users` to reference a single assigned role.
- A permission guard middleware layer applied to every Backoffice API route.
- Cache layer (per-request, optionally short-lived in-process) for permission lookups.
- Audit log writes for destructive operations (create, update, delete).
- Cache invalidation triggers on role or permission mutation.

**Phase & Stage mapping:** Phase 03 Backoffice Core, Foundation domain.

**Affected system areas:**

| Area                | Affected? | Notes                                          |
| ------------------- | --------- | ---------------------------------------------- |
| Tenant Isolation    | Yes       | All tables reside in tenant DB; no shared RBAC |
| License Enforcement | Yes       | License middleware prerequisite for all routes |
| Attempt Engine      | No        | RBAC does not affect exam attempt flow         |
| Worker              | No        | No async jobs for RBAC in Phase 3              |
| Runtime             | No        | Students are not governed by this system       |
| Frontoffice         | No        | No RBAC exposure to student-facing layer       |

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution v1.2.0**.

| Rule                                   | Compliance                                                     |
| -------------------------------------- | -------------------------------------------------------------- |
| No cross-tenant access                 | ✓ All RBAC tables reside exclusively within the tenant DB      |
| No middleware bypass                   | ✓ Permission guard executes after JWT → tenant → license chain |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic              |
| No direct DB instantiation             | ✓ All DB access originates from tenant resolver context        |
| No weakening of snapshot integrity     | ✓ Feature does not touch attempt snapshots                     |
| No weakening of transaction boundaries | ✓ Role and permission mutations are transactional              |
| No weakening of version enforcement    | ✓ Schema version bump required; migration forward-only         |
| No hardcoded admin bypass              | ✓ All roles must have a DB entry; no implicit superuser        |
| Server-side enforcement only           | ✓ Zero permission logic permitted in frontend layer            |

No exceptions requiring ADR were detected for this stage.

---

## Isolation Impact Analysis

- **Database accessed:** Tenant DB only (per resolved workspace context).
- **Tenant resolution:** Via existing tenant resolver middleware, before any DB operation.
- **Connection pool:** Obtained from tenant-scoped in-memory connection pool map.
- **Resolver middleware:** Mandatory; no route handler may access DB before tenant and license validation.
- **Tables created or modified (implementation names):**
  - `backoffice_roles` extended (existing STAGE_17 table): `status` column added
  - `backoffice_role_module_permissions` created (new boolean-flags permissions table)
  - `rbac_audit_logs` created (new immutable audit table, following STAGE-19 pattern)
  - `backoffice_staff_users` extended: `role_id` and `division_ids` columns added

**Confirmed:** No shared tenant data. No cross-tenant joins. No global RBAC singleton.

---

## License & Version Enforcement

- **License middleware required:** Yes — all Backoffice API routes require active workspace license.
- **Allowed license states:** `ACTIVE` only. `SOFT_LOCKED` → 423, `ARCHIVED` → 403, `NOT FOUND` → 404.
- **Limit enforcement required:** No explicit RBAC-specific limits, but general workspace limits apply.
- **`schema_version` checked:** Yes — migration increments schema version; runtime rejects incompatible tenants.
- **`product_version` checked:** Yes — enforced at request boundary per Constitution.

---

## User Scenarios & Testing

### User Story 1 – Administrator Assigns a Role to a Staff User (Priority: P1)

A Backoffice administrator creates a new role with specific module permissions and assigns it to a staff user. The staff user can immediately access only the modules and actions permitted by that role.

**Why this priority:** This is the foundational capability of the entire RBAC system. Without role assignment, all other permission scenarios are untestable.

**Independent Test:** Create a role with `can_view: true` on the "Exam Engine" module, assign it to a staff user, then confirm that staff user can GET exam records but is rejected with 403 on create/edit/delete.

**Acceptance Scenarios:**

1. **Given** a tenant workspace with an active license, **When** an admin creates a role named "Exam Viewer" with `can_view: true` and `can_create: false` on the Exam Engine module, **Then** the role is persisted in the tenant's `roles` table with status `ACTIVE`.
2. **Given** a role exists with status `ACTIVE`, **When** a staff user is assigned that role, **Then** `staff_users.role_id` references the role and the user can only perform `view` actions on the Exam Engine module.
3. **Given** a staff user with "Exam Viewer" role attempts to create an exam, **Then** the API returns 403 with a generic forbidden message.
4. **Given** a staff user with "Exam Viewer" role attempts to view exams, **Then** the API returns the appropriate exam data.

---

### User Story 2 – Disabled Role Immediately Revokes Access (Priority: P1)

A Backoffice administrator disables a role. All staff users assigned to that role lose API access immediately — without requiring logout or session invalidation.

**Why this priority:** Security-critical. Delayed revocation is a platform integrity failure.

**Independent Test:** Assign a role to a staff user, disable the role, then immediately attempt an API call as that staff user and verify the 403 response.

**Acceptance Scenarios:**

1. **Given** a staff user with an `ACTIVE` role can access the Dashboard module, **When** the role status is updated to `DISABLED`, **Then** the next API request by that user returns 403.
2. **Given** a role is `DISABLED`, **When** an admin attempts to assign that role to a new staff user, **Then** the system rejects the assignment.
3. **Given** a role is `DISABLED`, **When** the user's JWT is still valid, **Then** authentication may succeed but all API actions return 403.

---

### User Story 3 – Permission Update Takes Effect Without Restart (Priority: P2)

When an admin updates the permissions of a role (e.g., removes `can_delete` from the Settings module), all staff users assigned to that role immediately lose the revoked permission.

**Why this priority:** Operational correctness. Stale permissions are a security risk.

**Independent Test:** Grant a role `can_delete` on Settings, confirm the delete endpoint accepts the user's request, revoke `can_delete`, then confirm the next delete attempt returns 403 — all without service restart.

**Acceptance Scenarios:**

1. **Given** a role has `can_delete: true` on the Settings module, **When** an admin sets `can_delete: false`, **Then** the next request by an assigned staff user attempting delete returns 403.
2. **Given** permission is updated, **When** cache invalidation is triggered, **Then** the updated permission is reflected on the very next request without service restart.

---

### User Story 4 – Staff User Without Role Cannot Access Any Module (Priority: P2)

A staff user that has no role assigned or whose role has no permissions returns 403 for all module access attempts.

**Why this priority:** Defense-in-depth. No access leak via missing role.

**Independent Test:** Create a staff user with no `role_id` set and attempt any Backoffice API call.

**Acceptance Scenarios:**

1. **Given** a staff user with `role_id: null`, **When** any Backoffice API route is accessed, **Then** the API returns 403.
2. **Given** a staff user with a role that has all permissions explicitly set to `false`, **When** any module action is attempted, **Then** the API returns 403.

---

### User Story 5 – Admin Views Role and Permission Definitions (Priority: P3)

A Backoffice super-administrator can list all roles defined for the workspace, and view the permission matrix for each role.

**Why this priority:** Management visibility; not required for enforcement, but required for usability.

**Independent Test:** Seed two roles with different permission sets, call the roles list endpoint, and verify both roles with their permissions are returned.

**Acceptance Scenarios:**

1. **Given** three roles exist in the tenant, **When** the admin lists roles, **Then** all three are returned with their names, statuses, and permission matrices.
2. **Given** a role exists, **When** admin fetches a single role by ID, **Then** the full permission matrix for all modules is returned.

---

### Edge Cases

- What happens when a staff user's role is deleted entirely (not just disabled)? → Role deletion must check for assigned users; if any assigned user exists, deletion is rejected unless the user is reassigned or deactivated first. Roles with active assigned users must not be hard-deleted.
- What happens when a new module is added to the system but an existing role has no entry for it? → Absent permission row is treated as all-false; access denied for that module.
- What happens if two concurrent requests attempt to update the same role permissions simultaneously? → Last-write-wins within the database transaction; race condition is acceptable at this phase since updates are admin-only and infrequent.
- What happens when `role_permissions` has no row for a given module? → Evaluated as `can_view: false, can_create: false, can_edit: false, can_delete: false` — full denial.
- What happens when the permission cache is warm and the role is disabled mid-request? → Per-request cache means the current request operates on a consistent snapshot. The next request will evaluate the updated state.

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST store roles within the tenant's own database in a `roles` table, with columns for `id`, `name`, `status`, `created_at`, and `updated_at`.
- **FR-002**: Role `name` MUST be unique per tenant workspace.
- **FR-003**: The system MUST store module-level permissions in a `role_permissions` table with flags `can_view`, `can_create`, `can_edit`, `can_delete` per `(role_id, module)` pair.
- **FR-004**: The combination of `(role_id, module)` MUST be unique — no duplicate permission rows per role per module.
- **FR-005**: Staff users MUST have a single `role_id` foreign key referencing the `roles` table.
- **FR-006**: Every Backoffice API route MUST execute permission evaluation in middleware before any business logic runs.
- **FR-007**: Permission evaluation MUST follow the order: resolve tenant → validate license → validate JWT (assert jwt.workspace_id === resolvedTenant.id; mismatch → 403 WARN) → load staff user → check user status → load role → check role status → load role permissions → check module+action permission.
- **FR-008**: If `role.status != ACTIVE`, the system MUST return 403 Forbidden with a generic message.
- **FR-009**: If `user.status != ACTIVE`, the system MUST return 403 Forbidden with a generic message. (**NOTE**: `backoffice_staff_users` stores this as `is_active BOOLEAN`; the permission guard maps `is_active = false` as equivalent to status `DISABLED`. `is_active = true` is treated as `ACTIVE`.)
- **FR-010**: If the required permission flag is absent or `false` for the requested module and action, the system MUST return 403 Forbidden with a generic message.
- **FR-011**: Error responses MUST NOT expose internal permission structure, role names, or permission flag values.
- **FR-012**: Permission lookup results MAY be cached for the duration of a single request (per-request cache); any longer-lived cache MUST be invalidated immediately on role update, permission update, or role status change.
- **FR-013**: The system MUST write an audit log entry for every destructive action (create, update, delete, **assign**) containing: `user_id`, `role_id`, `module`, `action`, `timestamp`, and `request_id`. Permitted audit action values: `CREATE_ROLE`, `UPDATE_ROLE`, `DISABLE_ROLE`, `DELETE_ROLE`, `UPDATE_PERMISSIONS`, `ASSIGN_ROLE`.
- **FR-014**: Audit log writes MUST be performed within the same transaction as the mutation they record.
- **FR-015**: Audit log records MUST be immutable — no update or delete operations on audit records.
- **FR-016**: Roles with status `DISABLED` MUST NOT be assignable to new or existing staff users.
- **FR-017**: Role deletion MUST be rejected if any `ACTIVE` staff user is assigned to that role.
- **FR-018**: A missing `role_permissions` row for a module MUST be treated as full denial (all flags `false`).
- **FR-019**: The permission schema MUST support future addition of new permission flags (e.g., `can_approve`, `can_review`) without requiring a full schema redesign — additional boolean columns on `role_permissions` are the accepted extension pattern.
- **FR-020**: Division membership (`division_ids` on `staff_users`) MUST NOT affect permission evaluation in this phase; RBAC does not change per division in Phase 3.
- **FR-021**: Per-user permission overrides MUST NOT be implemented in this phase.
- **FR-022**: All role and permission mutations MUST execute within a database transaction.
- **FR-023**: The permission guard MUST be applied as server-side middleware; no permission enforcement may exist in any frontend layer.

### Key Entities

- **Role**: Represents a named, tenant-scoped permission bundle. Has a lifecycle status (`ACTIVE` | `DISABLED`). One role belongs to one tenant only.
- **RolePermissions**: Maps a role to a module with explicit boolean permission flags. One row per `(role, module)` pair. Absent row equals all-false.
- **StaffUser (extended)**: Backoffice human actor. Assigned exactly one role. Has its own lifecycle status independent of the role status.
- **PermissionGuard (middleware)**: Server-side enforcement layer. Executes the full evaluation chain on every Backoffice API request. Not a data entity — a behavioral contract.
- **AuditLog**: Immutable record of destructive operations. Scoped to tenant DB. Contains actor identity, role, module, action, timestamp, and correlation ID.

---

## Data Model Changes

> **Implementation note:** The logical names `roles`, `role_permissions`, and `staff_users` used in diagrams above correspond to the implementation table names `backoffice_roles`, `backoffice_role_module_permissions`, and `backoffice_staff_users`. `backoffice_roles` and `backoffice_staff_users` are existing STAGE-17 tables being extended; `backoffice_role_module_permissions` and `rbac_audit_logs` are new tables.

### Tables Created or Modified

#### Extended: `backoffice_roles` (tenant DB, existing since STAGE-17)

| Column         | Type         | Constraints                                                  |
| -------------- | ------------ | ------------------------------------------------------------ |
| `id`           | UUID         | Primary Key, default gen_random_uuid() — existing            |
| `workspace_id` | UUID         | NOT NULL — existing (denormalized for query convenience)     |
| `name`         | varchar(128) | NOT NULL, UNIQUE per tenant — existing                       |
| `description`  | text         | NULLABLE — existing                                          |
| `status`       | varchar(10)  | NOT NULL, default 'ACTIVE' — **ADDED by STAGE-21 migration** |
| `created_at`   | timestamptz  | NOT NULL, default now() — existing                           |
| `updated_at`   | timestamptz  | NOT NULL, default now() — existing                           |

Indexes: `UNIQUE (name)` (tenant-scoped by database isolation).

#### New: `backoffice_role_module_permissions` (tenant DB)

| Column       | Type         | Constraints                                          |
| ------------ | ------------ | ---------------------------------------------------- |
| `id`         | UUID         | Primary Key, default gen_random_uuid()               |
| `role_id`    | UUID         | NOT NULL, FK → backoffice_roles.id ON DELETE CASCADE |
| `module`     | varchar(100) | NOT NULL                                             |
| `can_view`   | boolean      | NOT NULL, default false                              |
| `can_create` | boolean      | NOT NULL, default false                              |
| `can_edit`   | boolean      | NOT NULL, default false                              |
| `can_delete` | boolean      | NOT NULL, default false                              |
| `created_at` | timestamptz  | NOT NULL, default now()                              |
| `updated_at` | timestamptz  | NOT NULL, default now()                              |

Indexes: `UNIQUE (role_id, module)`.

> **Note:** The pre-existing STAGE-17 table `backoffice_role_permissions` (triplet model: role_id, module, action) is NOT modified and coexists. STAGE-21 uses the new boolean-flags model only. A future stage may deprecate the triplet table.

#### Extended: `backoffice_staff_users` (tenant DB, existing since STAGE-17)

| Column         | Change                                                                  |
| -------------- | ----------------------------------------------------------------------- |
| `role_id`      | ADD COLUMN: UUID, NULLABLE, FK → backoffice_roles.id ON DELETE SET NULL |
| `division_ids` | ADD COLUMN (if not present): UUID[], default '{}'                       |

> `role_id` is nullable to support migration without data loss. Nullable role is treated as no-access (FR-018 applies).
> `backoffice_staff_users.is_active` is an existing BOOLEAN column. The permission guard maps `is_active = true → ACTIVE` and `is_active = false → DISABLED` (see FR-009).

### Migration Impact

- **Migration type:** Additive — new tables + column additions. No destructive changes.
- **Version bump required:** Yes — tenant schema version must be incremented.
- **Backward compatibility:** Existing `staff_users` rows will have `role_id = null` after migration; they are treated as no-access until a role is assigned.
- **Forward-only:** Yes — rollback only via snapshot restore per Constitution policy.

---

## Transaction Boundaries

| Operation                 | Transaction Required      | Notes                                                     |
| ------------------------- | ------------------------- | --------------------------------------------------------- |
| Create role               | Yes                       | Insert into `roles`; idempotent by name unique constraint |
| Update role status        | Yes                       | Update `roles.status`; must invalidate permission cache   |
| Update role permissions   | Yes                       | Upsert into `role_permissions`; must invalidate cache     |
| Assign role to staff user | Yes                       | Update `staff_users.role_id`                              |
| Delete role               | Yes                       | Check no active users assigned before delete              |
| Audit log write           | Yes (same tx as mutation) | Must be atomic with the triggering operation              |

- All mutation endpoints are idempotent by nature (role name uniqueness, upsert semantics for permissions).
- No retries required (synchronous, no async worker involvement).
- Partial transaction failure rolls back entirely; no partial state permitted.

---

## Idempotency Strategy

| Operation                 | Idempotency Mechanism                                                       |
| ------------------------- | --------------------------------------------------------------------------- |
| Create role               | UNIQUE constraint on `(name)` — duplicate names return conflict error       |
| Upsert role permissions   | UNIQUE constraint on `(role_id, module)` — upsert via ON CONFLICT DO UPDATE |
| Assign role to staff user | Idempotent update; assigning same role twice is no-op                       |
| Disable role              | Idempotent status update; disabling already-disabled role is safe           |

- No idempotency key header is required for these admin operations; DB constraints provide the guarantee.

---

## Permission Evaluation Model

```
Request arrives at Backoffice API
         │
         ▼
[1] Resolve Tenant (from subdomain/path slug)
         │
         ▼
[2] Validate License (status, schema_version, product_version)
         │  SOFT_LOCKED → 423 | ARCHIVED → 403 | NOT FOUND → 404
         ▼
[3] Validate JWT (signature, expiry, workspace scope)
         │  Assert jwt.workspace_id === resolvedTenant.id → 403 FORBIDDEN + WARN log on mismatch
         ▼
[4] Load StaffUser from tenant DB (by sub claim in JWT)
         │  Not found → 403
         ▼
[5] Check user.status == ACTIVE
         │  DISABLED → 403
         ▼
[6] Load Role (staff_user.role_id)
         │  null role_id → 403
         ▼
[7] Check role.status == ACTIVE
         │  DISABLED → 403
         ▼
[8] Load RolePermissions for (role_id, target_module)
         │  No row → treat as all-false → 403
         ▼
[9] Check required permission flag (can_view / can_create / can_edit / can_delete)
         │  false → 403
         ▼
[10] Execute Business Logic
```

**Error response format (all 403 cases):**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied"
  }
}
```

Internal permission details, role names, and flag values MUST NOT appear in the error response.

---

## Caching Rules

| Scope                                             | Allowed                                     | Invalidation Trigger                            |
| ------------------------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| Per-request in-memory                             | Yes — preferred default                     | N/A (lives only for request duration)           |
| Short-lived in-process cache (e.g., 5–30 seconds) | Allowed as optimization                     | Role updated, permission updated, role disabled |
| Cross-request persistent cache (Redis or similar) | Allowed but requires immediate invalidation | Role mutation must publish invalidation event   |
| Client-side permission cache                      | Never allowed                               | —                                               |

**Cache invalidation is best-effort synchronous** — permission change must be observable on the very next request under normal conditions. If Redis DEL fails, the mutation still commits and the next cache miss triggers a fresh DB read; maximum stale window equals the cache TTL (0–30s). Persistent stale cache that results in incorrect permission elevation is a platform integrity violation.

---

## Supported Modules (Phase 3 Scope)

The following modules are supported permission targets in this phase:

| Module Key               | Display Name             |
| ------------------------ | ------------------------ |
| `academic_structure`     | Academic Structure       |
| `content_classification` | Content Classification   |
| `exam_engine`            | Exam Engine              |
| `users`                  | Users (Staff & Students) |
| `commercial`             | Commercial Layer         |
| `media_assets`           | Media & Assets           |
| `communication`          | Communication            |
| `ads`                    | Ads                      |
| `dashboard`              | Dashboard                |
| `settings`               | Settings                 |

Module keys are stored as `varchar` in `role_permissions.module`. New modules are added by inserting new permission rows — no schema change required.

---

## Audit Requirements

Every destructive action (create, update, delete, assign on roles and permissions) MUST produce a structured audit log entry.

### Required Audit Fields

| Field            | Source                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `user_id`        | Authenticated staff user making the request                                                      |
| `role_id`        | Role being created/modified/deleted                                                              |
| `module`         | Module affected (for permission changes)                                                         |
| `action`         | `CREATE_ROLE`, `UPDATE_ROLE`, `DISABLE_ROLE`, `DELETE_ROLE`, `UPDATE_PERMISSIONS`, `ASSIGN_ROLE` |
| `timestamp`      | Server time (authoritative)                                                                      |
| `request_id`     | Correlation ID from request context                                                              |
| `workspace_slug` | Tenant identifier                                                                                |

### Audit Immutability

- Audit log records MUST NOT be updated or deleted.
- No soft-delete on audit records.
- No endpoint to purge audit logs (Phase 3).
- Audit table MUST NOT be referenced in permission evaluation (separation of concerns).

---

## Observability Requirements

All RBAC-related operations must emit structured logs conforming to the platform logging standard.

### Required Log Fields

| Field            | Mandatory                 | Notes                               |
| ---------------- | ------------------------- | ----------------------------------- |
| `timestamp`      | Yes                       | ISO-8601, server time               |
| `level`          | Yes                       | INFO, WARN, ERROR                   |
| `service`        | Yes                       | `backoffice-api`                    |
| `workspace_slug` | Yes                       | Tenant identifier                   |
| `workspace_id`   | Yes                       | Tenant UUID                         |
| `user_id`        | Yes (when available)      | Authenticated actor                 |
| `correlation_id` | Yes                       | From request context (= request_id) |
| `action`         | Yes (for audit events)    | See audit action list above         |
| `role_id`        | Yes (for role operations) | Target role                         |

- `console.log` is forbidden.
- All logs MUST use the shared structured logger (`packages/logger`).
- Permission denial (403) MUST be logged at `WARN` level with `correlation_id` and `user_id`.

---

## Rate Limiting & Abuse Protection

| Endpoint Category           | Rate Limit Policy                                                          |
| --------------------------- | -------------------------------------------------------------------------- |
| Role management (admin)     | Standard authenticated admin rate limit (inherited from platform baseline) |
| Permission guard evaluation | No separate rate limit — covered by existing JWT + route-level limits      |
| Login (inherited)           | 5 attempts/minute per IP (existing platform policy)                        |

- No special RBAC-specific rate limits are introduced. Platform baseline applies.
- Role mutation endpoints are admin-only (internal) and protected by existing auth rate limits.

---

## Layer Separation Confirmation

| Layer                    | Compliance                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Frontend (Backoffice UI) | MUST NOT contain any permission evaluation logic; UI may receive role data for display only |
| API (Backoffice routes)  | Enforces all RBAC authority via middleware; no permission logic in controllers              |
| Worker                   | No involvement in RBAC Phase 3                                                              |
| MMC                      | MUST NOT access tenant RBAC tables; MMC has separate permission model                       |
| Domain packages          | Business logic for role management resides in a domain package; no HTTP logic               |
| Frontoffice              | No RBAC exposure; students are governed by a separate fixed-permission model                |

**Confirmed:** Frontend contains zero business logic for permissions.

---

## Authoritative Time Usage

- Audit log `timestamp` MUST use server-authoritative time only.
- `created_at` and `updated_at` columns populated by server/DB clock, never by client.
- No time-based permission expiry in this phase.

---

## Failure Modes & Recovery

| Failure Mode                           | Handling                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| DB unavailable during permission check | Return 503 Service Unavailable; log error with `correlation_id`                                  |
| Role row missing unexpectedly          | Return 403; log WARN                                                                             |
| Permission row missing for module      | Treat as all-false; return 403; no error log (expected path)                                     |
| Transaction failure on role mutation   | Full rollback; return 500 with generic error; log ERROR with `correlation_id`                    |
| Cache invalidation failure (if async)  | Log ERROR; fallback to fresh DB read on next request; never serve stale forbidden-bypassing data |
| Schema version mismatch                | License middleware rejects at request boundary; route never reached                              |

---

## Extensibility Contract

The schema is designed to remain stable across future RBAC enhancements:

| Future Enhancement                    | Extension Path                                                         | Schema Redesign Required?                 |
| ------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| Add `can_approve`, `can_review` flags | Add nullable boolean columns to `role_permissions`                     | No — additive migration only              |
| Division-scoped permission overrides  | New `division_role_overrides` table joining `staff_users.division_ids` | No — new table, existing tables unchanged |
| Temporary role elevation              | New `staff_user_role_overrides` table with expiry                      | No — new table only                       |
| Field-level permissions               | New `field_permissions` table referencing roles                        | No — new table only                       |
| Workflow transition permissions       | New `workflow_permissions` table or new flag columns                   | No — additive                             |

**Per-user permission overrides are explicitly excluded from Phase 3.** Any Phase 4+ extension must be implemented as a separate stage with its own ADR.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A staff user assigned a role with specific module permissions can access only permitted modules and actions; all non-permitted actions return 403 immediately.
- **SC-002**: Disabling a role causes all assigned staff users to receive 403 on their very next API request — no delay, no session drain required.
- **SC-003**: Removing a permission flag from a role takes effect within one request of the change — no service restart required.
- **SC-004**: A staff user with no assigned role, or an assigned role with all permissions false, receives 403 on all module access attempts.
- **SC-005**: All role and permission mutations are fully atomic — partial writes do not persist under any failure scenario.
- **SC-006**: Audit log entries are written for 100% of destructive role and permission operations.
- **SC-007**: Error responses for all permission denials are uniform and reveal no internal permission structure to the caller.
- **SC-008**: All Backoffice API routes are covered by the permission guard — no route exists without permission enforcement.
- **SC-009**: The system supports adding new permission flag types without requiring a full migration of existing role data.
- **SC-010**: All RBAC-related log entries include `correlation_id`, `workspace_slug`, and `user_id`.

---

## Test Strategy

### Unit Tests

- Permission evaluation function: all branches (null role, disabled role, disabled user, missing permission row, all flags false, specific flag true/false).
- Role status check logic.
- Audit log entry construction.
- Cache invalidation trigger logic.

### Integration Tests

- End-to-end: create role → assign permissions → assign to user → verify access grants and denials.
- Disable role → verify immediate 403 on next request.
- Update permission → verify updated behavior on next request without restart.
- Delete role with active user → verify rejection.
- Audit log written transactionally — verify entry exists after mutation, does not exist if transaction rolled back.
- Missing `role_permissions` row → verify 403.

### Transaction Rollback Tests

- Simulate DB failure mid-mutation — verify no partial state persists.
- Audit log rollback — verify no orphan audit entry if role mutation fails.

### Idempotency Tests

- Create role twice with same name — verify second attempt returns conflict, no duplicate row.
- Upsert permissions with existing row — verify clean update, no duplicate row.

### Version Compatibility Tests

- Verify migration increments schema version.
- Verify runtime rejects requests to tenant with outdated schema version.

### Isolation Tests

- Confirm roles from Tenant A are not accessible from Tenant B.
- Confirm permission guard uses only tenant-resolved DB connection.

---

## Explicit Non-Goals

This stage does NOT:

- Implement per-user permission overrides (deferred to Phase 4+).
- Implement division-scoped permission variations (deferred to Phase 4+).
- Implement temporary role elevation (deferred to Phase 4+).
- Implement field-level permissions.
- Implement workflow transition permissions.
- Govern student access — students use a separate fixed-permission model.
- Affect MMC RBAC — MMC has a fully separate permission model.
- Implement SSO or federated identity for staff users.
- Implement permission sync across tenants.
- Implement a UI for permission management (API contracts only in this stage; UI is a separate task).
- Implement role hierarchies or role inheritance.

---

## Assumptions

The following reasonable defaults were applied without requiring clarification:

| #   | Assumption                                                                     | Rationale                                                                     |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| A1  | `role_id` on `staff_users` is nullable (not NOT NULL)                          | Allows migration without data loss; null = no access, not an error            |
| A2  | Role deletion is soft-blocked if active users exist (not cascade-delete users) | Prevents accidental mass lockout                                              |
| A3  | Missing `role_permissions` row = full denial (all flags false)                 | Secure default; explicit grant required                                       |
| A4  | Short-lived process-level cache lifetime = 0–30 seconds max                    | Balances performance vs. security; exact value is a deployment config concern |
| A5  | Audit log stored in tenant DB (not a shared audit DB)                          | Preserves per-tenant isolation                                                |
| A6  | Module keys are `varchar` strings validated at the application layer           | Allows new modules without enum migration                                     |
| A7  | `can_view: false` but no row = same outcome; absent row is not an error state  | Simplifies evaluation logic                                                   |
| A8  | Role names are case-sensitive (stored as-is, uniqueness enforced as stored)    | Standard DB behavior; normalization can be added in future                    |

---

## Compliant with Zidney Constitution v1.2.0 — No violations detected.

---

## Clarifications

### Session 2026-03-02

**Q1:** How does the permission guard middleware know which `module` key and permission flag to evaluate for a given route? The spec lists 10 module keys and 4 action flags but does not define the binding mechanism between a route and its `(module, action)` pair.

**A1:** Each Backoffice API route MUST declare its `(module, action)` pair via route-level metadata at registration time. A central route permission registry (a plain object/map keyed by `[METHOD, path pattern]`) maps every protected route to exactly one `(module, action)` tuple. The permission guard middleware reads this registry at execution time to determine what to check. Routes not present in the registry are treated as unprotected by default only if explicitly flagged as public (e.g., health check); any route that omits its `(module, action)` registration and is not explicitly marked public MUST be rejected with 403. This makes unregistered routes fail-closed, consistent with the deny-by-default model.

**FR-024** added: Every Backoffice API route MUST be registered in the route permission registry with an explicit `(module, action)` pair before it is considered production-ready. Omission of registration is a deployment gate failure.

---

**Q2:** If a valid JWT issued for Tenant A is presented against Tenant B's resolved workspace context (cross-tenant token replay), does Step 1 (JWT validation) detect and reject this mismatch? The spec does not specify whether the JWT carries a workspace-scoped claim that is validated against the resolved tenant context.

**A2:** JWT tokens issued for Backoffice staff MUST embed a `workspace_id` claim (tenant UUID) at issuance time. During Step 1 (JWT validation), after verifying signature and expiry, the middleware MUST assert that `jwt.workspace_id === resolvedTenant.id`. A mismatch MUST immediately return 403 with the generic `FORBIDDEN` response and MUST be logged at `WARN` level with `correlation_id`, `user_id` (from JWT), and both `jwt.workspace_id` and `resolved_workspace_id` values. No DB access in the tenant's connection pool may occur if this check fails. This closes the cross-tenant token replay attack surface and is a non-negotiable tenant isolation guarantee per the Zidney Constitution.

**FR-007** is updated: Step 3 (Validate JWT) MUST include sub-step: assert `jwt.workspace_id === resolvedTenant.id`; mismatch → 403 immediately, log WARN, abort chain. (**Ordering correction applied in H3 remediation**: JWT validation is Step 3 — after tenant resolution (Step 1) and license check (Step 2) — per Zidney trust chain: Isolation → License → Authentication.)

---

**Q3:** The spec defines the 403 error body for permission denials but does not specify HTTP status codes or error `code` values for mutation validation failures: (a) creating a role with a duplicate name, (b) assigning a `DISABLED` role to a staff user, (c) deleting a role that has at least one `ACTIVE` assigned user.

**A3:** The following HTTP status codes and error codes are adopted, aligned with the platform error contract (`{ success, data, error: { code, message } }`):

| Scenario                               | HTTP Status                | Error Code              | Message                                                  |
| -------------------------------------- | -------------------------- | ----------------------- | -------------------------------------------------------- |
| Create role — duplicate name           | `409 Conflict`             | `ROLE_NAME_CONFLICT`    | "A role with this name already exists"                   |
| Assign disabled role                   | `422 Unprocessable Entity` | `ROLE_NOT_ASSIGNABLE`   | "Role is not active and cannot be assigned"              |
| Delete role with active users          | `409 Conflict`             | `ROLE_HAS_ACTIVE_USERS` | "Role cannot be deleted while active users are assigned" |
| Permission flag on non-existent module | `422 Unprocessable Entity` | `INVALID_MODULE`        | "Unknown permission module"                              |

Error messages MUST NOT expose role IDs, user counts, or internal state in any of these responses.

---

**Q4:** When an API caller creates a role and its initial set of permissions in a single request, the spec's transaction table lists "Create role" and "Update role permissions" as separate rows. It is ambiguous whether both the `roles` insert and all initial `role_permissions` inserts are wrapped in a single database transaction or executed sequentially in separate transactions.

**A4:** A role creation request that includes an initial permissions payload MUST execute both the `roles` INSERT and all `role_permissions` INSERTs within a single database transaction. If any `role_permissions` insert fails (e.g., invalid module key), the entire transaction MUST roll back — including the `roles` row — leaving no partial state. The audit log entry for `CREATE_ROLE` MUST also be written within the same transaction (per FR-014). This applies equally to any API endpoint that combines role creation with initial permission assignment. The transaction table is updated to reflect: "Create role + initial permissions" → single transaction, atomic.

---

**Q5:** The spec states that role deletion must "check for assigned users" before proceeding, but does not specify the concurrency mechanism. Two concurrent admin requests could both observe zero active assigned users and both proceed to delete the same role. The spec's existing concurrency note only addresses permission updates (last-write-wins acceptable), not the delete guard check.

**A5:** The delete-role operation MUST acquire a row-level lock using `SELECT id FROM roles WHERE id = $roleId FOR UPDATE` at the start of the transaction, before evaluating the active-user check. This ensures that two concurrent delete attempts on the same role are serialized: the second request will either see the role already deleted (and return 404) or block until the first transaction commits. Additionally, the active-user count query (`SELECT COUNT(*) FROM staff_users WHERE role_id = $roleId AND status = 'ACTIVE'`) MUST execute within the same transaction after the lock is acquired. PostgreSQL default `READ COMMITTED` isolation is sufficient for all other role mutations (update, disable) since those are idempotent; only the delete guard requires `SELECT FOR UPDATE`.
