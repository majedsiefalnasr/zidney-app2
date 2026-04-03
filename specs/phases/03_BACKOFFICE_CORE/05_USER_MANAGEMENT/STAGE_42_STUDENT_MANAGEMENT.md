# STAGE 42 – Student Management

Phase: 3 – Backoffice Core  
Subdomain: 05_USER_MANAGEMENT  
Scope: Frontoffice student lifecycle, academic assignment enforcement, and subscription binding

---

## Stage Status

Status: DRAFT
Step: tasks
Risk Level: MEDIUM
Last Updated: 2026-04-06T00:30:00.000Z

Tasks Generated:

- Total: 25 atomic tasks across 6 phases (A–F)
- Phase A: 2 tasks (migration + schema)
- Phase B: 7 tasks (domain-core module + unit tests)
- Phase C: 2 tasks (validation schemas)
- Phase D: 11 tasks (backoffice route handlers)
- Phase E: 1 task (auth migration)
- Phase F: 2 tasks (app registration + integration tests)
- Parallelizable: T009, T025

Deferred Scope:

- None

Architecture Governance Compliance:

- Task set compliant — drift analysis required before implementation

Notes:
Atomic task set generated. Drift analysis gate pending.

---

## Objective

Implement the Student Management system with:

- Strict academic boundary enforcement
- License student_limit enforcement
- Subscription binding
- Division-based isolation
- Secure authentication compatibility
- Tenant-level data isolation
- Full auditability

Students exist only inside tenant databases.

No cross-tenant student reference allowed.

---

## Core Model

Students are Frontoffice users stored in the tenant database.

Students differ from staff:

- Must belong to exactly one division
- Cannot belong to multiple divisions
- Subscription-bound
- Limited by license.student_limit
- Restricted to academic structure

---

## Database Schema

students table must include:

- id
- first_name
- last_name
- email (unique per tenant)
- phone (nullable)
- password_hash
- division_id (NOT NULL)
- department_id (nullable)
- group_id (nullable)
- semester_id (nullable)
- subscription_status (ACTIVE | EXPIRED | NONE)
- status (ACTIVE | DISABLED)
- created_at
- updated_at

Foreign key rules:

- division_id → divisions.id (NOT NULL)
- department_id → departments.id (nullable)
- group_id → groups.id (nullable)
- semester_id → semesters.id (nullable)

All FKs must enforce same-tenant constraint.

---

## Academic Assignment Rules

Student must:

- Belong to exactly 1 division
- Division must be ACTIVE
- Department must belong to same division (if present)
- Group must belong to same department or division (if present)
- Semester must exist (if present)

Student cannot:

- Belong to multiple divisions
- Switch division without explicit update action
- Bypass division validation

Division is the primary academic boundary.

---

## License Limit Enforcement

Before creating student:

1. Start transaction
2. Count ACTIVE students
3. Compare with license.student_limit
4. If limit exceeded → reject
5. Else insert student
6. Commit transaction

Limit applies to total registered ACTIVE students.

Limit check must be transactional.

No cached counter allowed.

---

## Subscription Binding

Each student must have subscription_status:

ACTIVE  
EXPIRED  
NONE

Rules:

If subscription_status = NONE:

- Login allowed
- Dashboard restricted
- Exams not accessible

If subscription_status = EXPIRED:

- Login allowed
- Exam start blocked
- Results visible
- Certificates downloadable

If subscription_status = ACTIVE:

- Full access within division scope

Subscription enforcement must happen in runtime middleware.

Frontend cannot be trusted.

---

## Division Visibility Enforcement

Student can access only:

- Exams assigned to their division
- Library items assigned to their division
- Live sessions assigned to their division
- Scheduled exams assigned to their division

All queries must filter by:

WHERE division_id = student.division_id

UI filtering alone is insufficient.

---

## Account Status Rules

status values:

ACTIVE  
DISABLED

If DISABLED:

- Login blocked
- Token invalidated
- Active sessions revoked

Soft deletion preferred over hard deletion.

---

## Deletion Rules

Student deletion must:

- Be transactional
- Preserve attempts history
- Preserve grading history
- Preserve certificate records
- Preserve audit logs

If student has attempts: → Hard deletion prohibited  
→ Use DISABLED status

---

## Security Requirements

- Password hashed using Argon2
- Email uniqueness enforced per tenant
- No global students table
- No cross-tenant queries
- No direct division override via request body

Workspace identity must be derived from tenant resolver context.

---

## Bulk Import Rules

Bulk import allowed with:

- Strict division validation
- Transactional insert batches
- Partial failure reporting
- student_limit enforcement per batch

Import must stop when limit reached.

No silent overflow.

---

## Audit Requirements

Every student action must log:

- student_id
- workspace_id
- request_id
- action_type
- performed_by (staff_id or system)

Audit logs stored in tenant DB.

---

## Validation Criteria

Stage complete when:

- Student CRUD works
- student_limit enforced transactionally
- Division validation enforced
- Subscription binding enforced
- DISABLED blocks login
- Cross-tenant access impossible
- Attempts preserved after disable
- Bulk import validated
- Audit logs generated

---

## Hard Rules

No multi-division student  
No division stored outside FK  
No UI-only division filtering  
No cross-tenant lookup  
No non-transactional limit enforcement  
No deletion of graded history

Student Management enforces academic isolation at the user level.
