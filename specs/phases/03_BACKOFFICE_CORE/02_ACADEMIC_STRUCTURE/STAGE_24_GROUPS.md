# STAGE 24 – Groups

Phase: 03_BACKOFFICE_CORE  
Domain: 02_ACADEMIC_STRUCTURE  
Database: Tenant DB only

---

## Stage Status

Status: BACKEND CLOSED
Step: implement
Risk Level: MEDIUM
Last Updated: 2026-03-19T12:00:00.000Z

Implementation: COMPLETE
Tasks: 29 / 29 completed

Scope Closed:

- Group CRUD: `groups` table, 12 API endpoints (CRUD, student assignment, staff assignment)
- `staff_groups` join table for multi-group staff membership
- `students.group_id` nullable FK column (ON DELETE SET NULL)
- Migration `20260319_001_groups.ts`: schema 1.6.0 → 1.7.0
- SAVEPOINT-per-guard for safe deletion checks
- SELECT FOR UPDATE on `groups` row for concurrent `max_members` enforcement
- Idempotent student assignment (UPDATE) and staff assignment (ON CONFLICT DO NOTHING)
- Domain layer: groups.types.ts, groups.errors.ts, groups.repository.ts, groups.service.ts
- API routes: 12 handlers + helpers + router index
- Validation schemas for all 9 endpoint inputs
- Unit tests: 35 passing (groups domain service)
- Integration tests: 48 passing (groups API endpoints)

Deferred Scope:

- None

Constitutional Compliance:

- ADR-0001: Database-per-tenant isolation enforced (DbClient injection, no global singleton)
- ADR-0006: Server-authoritative time only (no client timestamps)
- ADR-0008: Semantic versioning enforced (schema 1.6.0 → 1.7.0)
- Architecture Checker: VERDICT PASS (9/9 criteria)
- API Designer: VERDICT PASS (7/7 criteria)
- Drift Audit: PASS — all cross-artifact issues remediated

Notes:
Backend implementation complete. No structural backend modifications allowed.
All 29 tasks implemented and committed across 4 governance commits.

---

## Objective

Implement Groups as an optional academic clustering layer for students and staff.

Groups are used for:

- Content visibility scoping
- Scheduled exam targeting
- Ads targeting
- Notification targeting
- Operational segmentation inside a division or department

Groups are not structural hierarchy entities. They are logical clustering entities.

---

## Data Model

groups table:

- id (UUID, PK)
- name (varchar, required)
- department_id (UUID, nullable, FK → departments.id)
- max_members (integer, nullable)
- description (text, nullable)
- status (enum: ENABLED | DISABLED)
- created_at (timestamp)
- updated_at (timestamp)

Indexes required:

- index on department_id
- index on status

---

## Relationship Rules

### Student Assignment

- Student may belong to 0 or 1 group
- student.group_id nullable FK → groups.id
- Student cannot belong to multiple groups

Hard constraint:

Unique enforcement must exist at application layer to prevent multiple assignments.

---

### Staff Assignment

Staff may belong to multiple groups.

Required join table:

staff_groups:

- staff_id (FK → users.id)
- group_id (FK → groups.id)
- created_at

Composite PK:

(staff_id, group_id)

---

## Division Interaction

Group does not directly require division.

However:

If department_id is provided, then department.division_id defines indirect division boundary.

Division-based filtering must be enforced at query layer.

No cross-division group access allowed.

---

## max_members Enforcement

If max_members is not NULL:

- Student assignment must occur inside transaction
- Count current members
- Reject if limit reached

Limit enforcement must:

- Use SELECT FOR UPDATE
- Prevent race conditions
- Not rely on cached counts

Staff assignment does NOT count toward max_members.

---

## Status Behavior

ENABLED:

- Can assign students
- Visible in dropdowns
- Can be targeted by content

DISABLED:

- Cannot assign new students
- Existing assignments remain
- Must not appear in selection lists

DISABLED does not remove existing links.

---

## Deletion Rules

Group cannot be deleted if:

- Students assigned
- Staff assigned
- Referenced by active exam targeting
- Referenced by active ads targeting

Deletion must be transactional.

Soft delete recommended over hard delete.

---

## Visibility Enforcement Contract

All content queries must apply:

WHERE ( content.group_id IS NULL OR content.group_id = student.group_id )

For staff:

WHERE ( content.group_id IS NULL OR content.group_id IN (staff assigned groups) )

Enforcement must occur in backend only.

---

## Validation Criteria

Stage is complete when:

- Group CRUD functional
- Student single-group constraint enforced
- Staff multi-group join working
- max_members race-safe
- Disabled groups not assignable
- Deletion restrictions enforced
- Visibility filtering verified

---

## Not Allowed

- Multiple groups per student
- Cross-division group leakage
- max_members enforced via frontend only
- Hard delete without reference checks
- Global group shared across tenants

---

Next: STAGE_25_HIERARCHY_TREE
