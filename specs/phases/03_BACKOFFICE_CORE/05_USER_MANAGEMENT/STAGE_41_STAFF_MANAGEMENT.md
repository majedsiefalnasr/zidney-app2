# STAGE 41 – Staff Management

Phase: 3 – Backoffice Core  
Subdomain: 05_USER_MANAGEMENT  
Scope: Backoffice staff lifecycle, assignment boundaries, and enforcement model

---

## Stage Status

Status: BACKEND CLOSED
Step: implement
Risk Level: MEDIUM
Last Updated: 2026-04-04T00:00:00Z

Implementation: COMPLETE
Tasks: 34 / 34 completed

Scope Closed:

- Staff CRUD (create, list, get, update, disable, enable, delete) — 7 endpoints
- Migration `20260404_020_staff_management.ts`: schema 1.25.0 → 1.26.0
- Domain-core `packages/domain-core/src/staff/` module (5 files)
- `packages/domain-core/src/auth/staff-password.ts` — Argon2id hash/verify
- `packages/validation/src/staff.schema.ts` — 4 Zod schemas
- Backoffice login updated to `backoffice_staff_users` + JOIN roles + Argon2id
- Dead code `apps/api/src/routes/backoffice/users.ts` deleted
- 3 test files: staff.crud (19), staff.isolation (7), staff.limit (4) — 30/30 passing

Deferred Scope:

- `is_active` column removal (future cleanup stage)
- `division_ids` array column removal (future cleanup stage)
- Bulk staff import
- Password reset / change-password flow

Architecture Governance Compliance:

- ADR-0001 (database-per-tenant) preserved — `c.get('tenant').pool` in all handlers
- All write operations transactional — SERIALIZABLE for createStaff
- Import boundaries respected — apps/api → packages/\* only
- Implementation compliant with Architecture Governance (AGENTS.md + ADRs)

Notes:
Backend implementation complete. No structural backend modifications allowed.
Closure step pending.

---

## Objective

Implement the Backoffice Staff Management system with:

- Secure account creation
- Strict RBAC enforcement
- Multi-division assignment support
- Organizational structure binding
- Hard academic boundary enforcement
- License limit validation
- Full tenant isolation

Staff users operate inside the tenant database only.

No cross-tenant staff references allowed.

---

## Core Model

Staff are Backoffice users stored in the tenant database.

Staff differ from students:

- Staff can belong to multiple divisions
- Staff must have exactly one role
- Staff are subject to staff_limit enforcement
- Staff operate under RBAC permissions

---

## Database Tables

users  
staff_divisions  
staff_departments  
staff_groups  
staff_hierarchy_levels  
staff_teams

users table must include:

- id
- email (unique per tenant)
- password_hash
- role_id (FK → roles)
- status (ACTIVE | DISABLED)
- created_at
- updated_at

No division_id column directly in users table.

Division assignment must be many-to-many.

---

## Staff Assignment Rules

A staff member:

- MUST have exactly one role
- MAY belong to multiple divisions
- MAY belong to multiple departments
- MAY belong to multiple groups
- MAY belong to multiple hierarchy levels
- MAY belong to multiple teams

Assignments must be stored in join tables.

All assignments must:

- Belong to same tenant
- Reference existing entities
- Respect FK constraints

---

## License Limit Enforcement

Before creating staff:

1. Start transaction
2. Count active staff
3. Compare with license.staff_limit
4. If exceeded → reject
5. Else insert
6. Commit

Limit applies to total registered staff, not concurrent.

Limit check must not rely on cached counters.

---

## Division Enforcement Model

Division is the primary academic boundary.

Rules:

- Staff may access only divisions they are assigned to
- Staff may create or edit content only inside assigned divisions
- Division filtering must happen at query layer
- UI filtering alone is insufficient

If a staff has no divisions assigned: → Access to division-scoped content is blocked

---

## Role Enforcement Model

Staff must have exactly one role.

Role:

- Defines permissions
- Is tenant-scoped
- Cannot be division-scoped

Permission checks must happen in middleware.

Frontend must not be trusted.

---

## Account Status Rules

Status values:

ACTIVE  
DISABLED

If DISABLED:

- Login blocked
- Token invalidated
- Active sessions revoked

Soft deletion is preferred over hard deletion.

---

## Deletion Rules

Staff deletion must:

- Be transactional
- Remove assignment relations
- Preserve audit logs
- Not cascade-delete academic data

Hard deletion only allowed if:

- No authored content exists
- No audit dependency exists

Otherwise, use DISABLED status.

---

## Security Requirements

- Password hashed using Argon2
- Email uniqueness enforced per tenant
- No global staff table
- No cross-tenant lookup
- No division override via request body

All workspace resolution must come from tenant resolver context.

---

## Audit Requirements

Every staff action must log:

- staff_id
- workspace_id
- request_id
- action_type
- target_entity

Audit logs stored in tenant DB.

---

## Validation Criteria

Stage complete when:

- Staff CRUD works
- Role assignment enforced
- Division filtering enforced at DB level
- staff_limit enforced transactionally
- Disabled account blocks login
- Cross-tenant access impossible
- Assignment relations validated
- Audit logs generated

---

## Hard Rules

No global staff table  
No division stored directly in users table  
No cached permission shortcuts  
No UI-only access restriction  
No cross-tenant joins  
No role without permission definition

Staff Management is the enforcement backbone of Backoffice security.
