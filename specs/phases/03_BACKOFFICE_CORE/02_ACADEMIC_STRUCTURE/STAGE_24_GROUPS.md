# STAGE 24 – Groups

Phase: 03_BACKOFFICE_CORE  
Domain: 02_ACADEMIC_STRUCTURE  
Database: Tenant DB only

---

## Stage Status

Status: IN PROGRESS
Step: analyze
Risk Level: MEDIUM
Last Updated: 2026-03-19T03:00:00.000Z

Drift Analysis: PASSED (all criteria)
Implementation: AUTHORIZED

Scope Authorized:

- Group CRUD: `groups` table, 11 API endpoints (CRUD, student assignment, staff assignment)
- `staff_groups` join table for multi-group staff membership
- `students.group_id` nullable FK column (ON DELETE SET NULL)
- Migration `20260319_001_groups.ts`: schema 1.6.0 → 1.7.0
- SAVEPOINT-per-guard (AD-05) for safe deletion checks
- SELECT FOR UPDATE on `groups` row for concurrent `max_members` enforcement (AD-03)
- Idempotent student assignment (UPDATE) and staff assignment (ON CONFLICT DO NOTHING)
- Service (9 functions) + Repository layer in `packages/domain-core/src/groups/`
- 29 atomic tasks across 5 phases

Constitutional Compliance:

- Architecture Checker: VERDICT PASS (9/9 criteria)
- API Designer: VERDICT PASS (7/7 criteria)
- Drift Audit: PASS (8/9 criteria + 1 N/A) — all cross-artifact issues remediated
- All 7 cross-artifact inconsistencies resolved during analyze step

Notes:
Full drift analysis passed. Implementation gate open. 29 tasks ready for execution.

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
