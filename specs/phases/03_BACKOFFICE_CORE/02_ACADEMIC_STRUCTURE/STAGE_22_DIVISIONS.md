# STAGE 22 – Divisions

Phase: 03_BACKOFFICE_CORE  
Domain: 02_ACADEMIC_STRUCTURE  
Database: Tenant DB only  
Status: Critical Academic Scope Layer

---

## Stage Status

Status: PRODUCTION READY
Step: Closure (7/7)
Risk Level: LOW
Closure Date: 2026-03-16T18:45:00Z

Implementation: COMPLETE (35/36 tasks)
Test Results: 99 integration + 166 unit = 265 total PASSING

Tasks Executed:

- Total: 36 atomic tasks
- Phase 0: 7 pre-condition checks (read-only) ✅
- Phase 1: 5 data layer tasks ✅
- Phase 2: 5 domain layer tasks ✅
- Phase 3: 2 validation layer tasks ✅
- Phase 4: 11 API layer tasks ✅
- Phase 5: 6 test tasks ✅
- Deferred: T036 scheduled_jobs_framework (optional, no impact)

Scope Delivered:

- Division CRUD (create, list, get, update, delete) ✅
- Division status management (enable/disable individual) ✅
- Disable-all-divisions feature toggle (SUPER_ADMIN) ✅
- Staff–division assignment/removal ✅
- Tenant-scoped; database-per-tenant enforced ✅
- Full RBAC enforcement ✅
- Transactional integrity (SERIALIZABLE on critical ops) ✅
- Structured logging with correlation_id + workspace_slug ✅

Deferred Scope:

- Frontoffice visibility enforcement (STAGE_24 or later)
- Analytics segmentation by division (STAGE_25 or later)
- Live session division filtering (STAGE_24 or later)
- Scheduled division state monitoring (deferred infrastructure; T036)

Constitutional Compliance Final:

- ✅ ADR-0001: Database-per-tenant isolation
- ✅ ADR-0002: Snapshot immutability (not applicable; feature does not touch attempts)
- ✅ ADR-0006: Server-authoritative time
- ✅ ADR-0007: Version compatibility
- ✅ ADR-0008: Semantic versioning
- ✅ All 4 guardian verdicts: PASS (security, performance, QA, code review)
- ✅ 21 constitutional violations identified and remediated
- ✅ Fully compliant with Zidney Constitution v1.2.0

Closure Evidence:

- CLOSURE_REPORT.md: Final compliance verification
- TESTING_GUIDE.md: Comprehensive manual test procedures
- PR_SUMMARY.md: Ready-to-use pull request description
- All workflow artifacts in reports/, audits/, guides/

Notes:
Stage is production ready. All drift criteria passed.
Closure complete. Ready for merge and deployment.
Next stage: STAGE_23_DEPARTMENTS (depends on divisions foundation).

---

## Objective

Implement Division as the primary academic isolation layer inside a workspace.

Division controls visibility and access boundaries for:

- Students
- Staff
- Subjects
- Exams (MCQ + Traditional)
- Library content
- Live sessions
- Ads targeting
- Future analytics segmentation

Division is a first-class isolation dimension inside tenant DB.

---

## Architectural Role

Division is:

- Shared between students and staff
- Required for all student records
- Optional multi-assignment for staff
- Mandatory filter boundary in content visibility rules

Division is NOT:

- A hierarchy replacement
- A commercial grouping
- A soft tag

It is a strict academic scope boundary.

---

## Division Feature Toggle

Workspace settings may disable divisions.

However:

- A default division must always exist
- System cannot operate without at least one division
- Disabling divisions does NOT remove the table
- It converts system into single-division mode

Single-division mode means:

- All entities reference default division
- UI hides division selection
- Division enforcement becomes implicit

---

## Data Model

Table: divisions

Columns:

- id (uuid, primary key)
- name (varchar, required)
- description (text, nullable)
- is_default (boolean, required)
- status (ENABLED | DISABLED)
- created_at (timestamp)
- updated_at (timestamp)

Constraints:

- Exactly one row must have is_default = true
- Default division must always have status = ENABLED
- name must be unique within workspace
- is_default cannot be changed after creation (except system migration)

Indexes:

- unique(name)
- index(status)

---

## Assignment Rules

Students:

- Must belong to exactly one division
- Division_id NOT NULL
- Cannot belong to multiple divisions

Staff:

- May belong to multiple divisions
- Managed through staff_divisions join table
- Must belong to at least one division

Validation enforced at API layer.

---

## Disable Divisions Operation

If workspace disables divisions:

1. Require explicit destructive confirmation
2. Reassign all references to default division:
   - students
   - staff_divisions
   - subjects
   - exams
   - content classification
   - any FK referencing divisions
3. Delete or mark DISABLED all non-default divisions
4. Lock feature flag to prevent re-enable without migration

This operation is irreversible.

System must log:

- who triggered
- timestamp
- affected records count

Must execute inside a transaction.

---

## Referential Integrity Rules

No entity referencing division_id may exist without valid division.

Foreign keys must enforce:

ON DELETE RESTRICT (default)

Default division cannot be deleted.

---

## Visibility Enforcement Contract

All content retrieval endpoints must include:

WHERE division_id IN (allowed_divisions_for_user)

For students:

allowed_divisions_for_user = student.division_id

For staff:

allowed_divisions_for_user = staff assigned divisions

No implicit cross-division visibility allowed.

---

## Migration Considerations

Default division must be created during:

STAGE_17_TENANT_BOOTSTRAP

Division table must exist before:

- Subjects
- Exams
- Student creation
- Staff assignment

---

## Failure Handling

Reject operations when:

- Attempting to delete default division
- Attempting to disable default division
- Attempting to remove last division
- Student created without division
- Staff has zero divisions

Return validation errors with clear reason codes.

---

## Validation Criteria

Stage complete when:

- Default division auto-created
- Default division immutable
- Students require division
- Staff multi-division supported
- Disable operation reassigns safely
- FK integrity validated
- Division filtering enforced in queries
- Feature toggle tested in single-division mode

---

## Not Allowed

- Null division_id for students
- Soft-delete of default division
- Multiple default divisions
- Cross-division content leakage
- Disabling divisions without reassignment
- UI-only enforcement without backend validation

---

## Stability Principle

Division is the academic boundary layer.

If division filtering fails, data leaks across academic segments.

This stage must be stable before:

STAGE_23_DEPARTMENTS
