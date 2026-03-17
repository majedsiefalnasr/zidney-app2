# STAGE 23 – Departments

Phase: 03_BACKOFFICE_CORE  
Domain: 02_ACADEMIC_STRUCTURE  
Database: Tenant DB only  
Status: Organizational-Academic Structure Layer

---

## Stage Status

Status: DRAFT
Step: pre_step
Risk Level: UNKNOWN
Initiated: 2026-03-17T00:00:00Z

Scope Open:

- Specification pending

Constitutional Compliance:

- Pending constitutional audit

Notes:
Stage initialized. Specification in progress.

---

## Objective

Implement Department as a hierarchical organizational-academic entity within a workspace.

Department is used for:

- Academic segmentation
- Organizational grouping
- Content visibility filtering (optional)
- Reporting segmentation
- Staff assignment structure

Department is subordinate to Division but may exist without explicit division assignment.

---

## Architectural Role

Department:

- Supports parent-child hierarchy
- May optionally associate to a division
- May contain students
- May contain staff
- May be used in content access rules
- May be used in ads targeting

Department is NOT:

- A replacement for division
- A tagging system
- A commercial structure

Division remains the primary isolation boundary. Department is secondary segmentation.

---

## Data Model

Table: departments

Columns:

- id (uuid, primary key)
- name (varchar, required)
- type (MAIN | SUB | SIMPLE, required)
- parent_id (uuid, nullable, self-reference)
- division_id (uuid, nullable, FK to divisions)
- max_users (integer, nullable)
- description (text, nullable)
- status (ENABLED | DISABLED)
- created_at (timestamp)
- updated_at (timestamp)

Constraints:

- name must be unique within same parent scope
- parent_id must reference departments.id
- parent and child must belong to same division scope if division_id is not null
- No circular references allowed
- division_id must reference valid division if provided

Indexes:

- index(parent_id)
- index(division_id)
- index(status)

---

## Hierarchy Rules

- Unlimited depth allowed
- Circular hierarchy strictly prohibited
- Parent deletion blocked if children exist
- Changing parent must validate no cycle creation
- Division consistency enforced across hierarchy

Cycle detection must be enforced at API layer.

---

## Assignment Rules

Students:

- May belong to 0 or 1 department
- department_id nullable
- If assigned, department must be ENABLED

Staff:

- May belong to multiple departments
- Managed through staff_departments join table
- Must belong to at least one division (enforced by Division stage)
- Department assignment must match at least one of staff's divisions if department.division_id is
  not null

Validation enforced at API layer.

---

## Division Interaction Rules

If department.division_id is NOT NULL:

- Only users from same division may be assigned
- Content filtering may use division + department

If department.division_id is NULL:

- Department is considered cross-division
- Still restricted by division visibility of user

Division remains mandatory boundary.

---

## Max Users Enforcement

If max_users is set:

- Student assignment must check current count inside transaction
- Reject assignment if exceeding limit
- Enforcement must be transactional
- Staff may optionally be included in count (configurable in future)

If max_users is NULL:

- Unlimited

---

## Referential Integrity

Foreign key rules:

- department_id in students → ON DELETE SET NULL
- department_id in join tables → ON DELETE CASCADE
- parent_id → ON DELETE RESTRICT

Department cannot be deleted if:

- Has children
- Has assigned students (unless reassigned)
- Has assigned staff (unless reassigned)

Deletion must be explicit and validated.

---

## Visibility Enforcement Contract

Content may optionally be filtered by department.

When department-based visibility is enabled:

WHERE department_id IN (allowed_departments_for_user)

For students:

- Allowed department = student.department_id

For staff:

- Allowed departments = assigned departments

Division filtering must always apply before department filtering.

---

## Status Rules

If department.status = DISABLED:

- Cannot assign new students or staff
- Existing assignments remain valid
- Content visibility may exclude disabled departments
- Deletion requires status = DISABLED

---

## Migration Considerations

Departments table must be created after:

STAGE_22_DIVISIONS

It must be ready before:

- Student management
- Staff management
- Content visibility rules

---

## Failure Handling

Reject operations when:

- Creating circular hierarchy
- Assigning student to disabled department
- Assigning user to department outside allowed division
- Deleting department with active children
- Exceeding max_users

Return explicit validation error codes.

---

## Validation Criteria

Stage complete when:

- Hierarchy supports unlimited depth
- Cycle detection enforced
- Division consistency validated
- Student assignment nullable but controlled
- Staff multi-department supported
- max_users enforced transactionally
- FK integrity validated
- No cross-division leakage through departments

---

## Not Allowed

- Circular references
- Department without name
- Parent-child division mismatch
- Assignment bypassing division validation
- UI-only enforcement
- Soft delete without validation

---

## Stability Principle

Department is a structural segmentation layer.

If hierarchy integrity fails or division boundaries are bypassed, academic segmentation becomes
unreliable.

This stage must be stable before:

STAGE_24_GROUPS
