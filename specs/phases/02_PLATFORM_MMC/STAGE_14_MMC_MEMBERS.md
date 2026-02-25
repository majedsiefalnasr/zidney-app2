# STAGE 14 – MMC Members & RBAC

Phase: 2 – Platform MMC  
Status: Critical  
Scope: Internal team management & strict role-based access control (RBAC)

---

## Stage Status

Status: DRAFT
Risk Level: UNKNOWN
Initiated: 2026-02-25T15:00:00Z

Scope Open:

- Specification pending

Constitutional Compliance:

- Pending constitutional audit

Notes:
Stage initialized. Specification in progress.

---

## Objective

Implement a secure internal MMC member management system with deterministic RBAC.

MMC Members include:

- Platform administrators
- Sales team
- Operations
- Support

All MMC data is stored exclusively in master_db.

MMC members must NEVER access tenant databases directly.  
All tenant operations must go through controlled platform services.

---

## Architectural Boundary

MMC operates strictly in master_db scope.

Hard rule:

- No MMC service may import tenant DB connectors.
- No MMC token may be accepted by tenant APIs.
- No cross-context authentication reuse allowed.

Violation is architectural failure.

---

## RBAC Model

RBAC only (no ABAC in Phase 2).

Rules:

- One user → One role
- One role → Many permissions
- Permissions grouped by domain
- No product-level scoping
- No tenant-level scoping
- No dynamic runtime policy evaluation

Permission resolution must be deterministic.

No permission may be inferred implicitly.

---

## MMC Members Table (master_db)

Fields:

- id (UUID)
- username (unique, immutable)
- email (unique)
- password_hash
- role_id (FK → roles.id)
- team_id (nullable)
- group_id (nullable)
- department_id (nullable)
- token_version (integer, default 1)
- status (ACTIVE | DISABLED)
- created_at
- updated_at

Constraints:

- username immutable after creation
- email unique across MMC
- password_hash must use Argon2 or bcrypt
- status enforced at authentication middleware

---

## Roles Table

Fields:

- id (UUID)
- name (multi-language supported via translations table)
- status (ACTIVE | INACTIVE)
- created_at
- updated_at

Rules:

- Roles must not be hardcoded in runtime.
- Role definitions editable via MMC UI.
- INACTIVE roles cannot be assigned to new members.
- Role deletion only allowed if zero members assigned.

---

## role_permissions Table

Fields:

- id
- role_id (FK)
- domain (enum)
- can_view (boolean)
- can_create (boolean)
- can_edit (boolean)
- can_delete (boolean)

Domains (initial):

- ORGANIZATION_SETTINGS
- PRODUCT_MANAGEMENT
- LICENSE_MANAGEMENT
- CLIENT_MANAGEMENT
- AFFILIATE_MANAGEMENT
- MEMBERS_MANAGEMENT
- REPORTING

Rules:

- Domain must be enum-controlled.
- No dynamic domain strings allowed.
- Permission row must exist for every domain per role.
- Missing permission row = deny by default.

---

## Authentication Rules

MMC authentication is fully isolated from tenant authentication.

MMC JWT must contain:

- user_id
- role_id
- permission_snapshot (optional optimization)
- token_version
- issued_at
- expiration

Requirements:

- Short-lived access tokens (recommended ≤ 30 minutes)
- Refresh token optional but recommended
- token_version stored in DB
- On sensitive changes → increment token_version
- Middleware must reject token if version mismatch

Disabled users must be rejected before JWT issuance.

---

## Permission Enforcement

Permission check must happen:

- In API layer
- Before executing business logic
- Before mutating data

Enforcement must:

- Read role_permissions from DB
- Not rely solely on frontend checks
- Not bypass permission via query manipulation

No super-admin bypass allowed unless explicitly defined as a role with explicit permissions.

---

## Member Creation Flow

Two modes:

### Direct Add

Fields:

- username
- email
- password
- role

Password must be hashed before persistence.

### Invite Flow

1. Create invitation record
2. Generate one-time token (short-lived)
3. Send email
4. User sets password
5. Assign role
6. Activate account

Rules:

- Invitation tokens must be hashed in DB.
- Invitation expiration enforced.
- Invitation completion logged.

---

## Role Editing Rules

When role is edited:

- Changes must be effective immediately.
- Increment token_version for all users assigned to role.
- Active sessions become invalid automatically via version mismatch.

Deleting role:

- Only allowed if no users assigned.
- Must log audit event.
- Must be transactional.

---

## Member Status Enforcement

If status = DISABLED:

- Block login
- Invalidate active sessions via token_version increment
- Log administrative action

Status change must require proper permission.

---

## Activity Logging (Audit Trail)

All MMC actions must create immutable audit log entries.

Audit log fields:

- actor_user_id
- action_type
- entity_type
- entity_id
- previous_state (optional JSON snapshot)
- new_state (optional JSON snapshot)
- timestamp
- correlation_id

Audit logs must:

- Be append-only
- Never be updated
- Never be deleted via MMC UI

---

## Concurrency Guarantees

Role edits and permission changes must be transactional.

Member disable operation must:

- Update status
- Increment token_version
- Commit atomically

No partial updates allowed.

---

## Validation Criteria

Stage complete when:

- Member CRUD works
- Role CRUD works
- Permission enforcement blocks unauthorized actions
- Disabled user cannot login
- Role changes invalidate active sessions
- Invite flow fully operational
- Audit logs created for all destructive actions
- No cross-context token acceptance

---

## Not Allowed

- Hardcoded super admin bypass
- Deleting role with assigned users
- Storing plaintext passwords
- Missing permission rows
- Using MMC token in tenant APIs
- Skipping audit log on destructive action
- Implicit permission inference

---

## Governance Principle

MMC controls products, licenses, and revenue.

If internal access control is weak, platform integrity collapses.

RBAC must be fully stable before:

STAGE_15_MMC_DASHBOARD
