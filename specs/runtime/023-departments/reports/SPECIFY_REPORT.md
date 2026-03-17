# SPECIFY REPORT — Departments (STAGE_23)

**Stage:** Departments
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE
**Branch:** `spec/023-departments`
**Generated:** 2026-03-17
**Step:** 1 — Specify

---

## Summary

Specification generated successfully for the Departments stage. The spec covers all functional and
non-functional requirements derived from `STAGE_23_DEPARTMENTS.md`.

**Spec file:** `specs/runtime/023-departments/spec.md` (975 lines)
**Checklist:** `specs/runtime/023-departments/checklists/requirements.md` (all items checked ✅)

---

## Scope Defined

| Area                                         | In Scope |
| -------------------------------------------- | -------- |
| departments table (CRUD)                     | ✅       |
| self-referencing hierarchy (unlimited depth) | ✅       |
| Type classification (MAIN / SUB / SIMPLE)    | ✅       |
| Division association (nullable FK)           | ✅       |
| max_users transactional enforcement          | ✅       |
| staff_departments join table                 | ✅       |
| Cycle detection at API layer                 | ✅       |
| Deletion guards (children / assignments)     | ✅       |
| Status (ENABLED / DISABLED) blocking         | ✅       |
| Tree & children traversal endpoints          | ✅       |
| Migration dependency on STAGE_22             | ✅       |

---

## Deferred / Out of Scope

| Item                                       | Reason                            |
| ------------------------------------------ | --------------------------------- |
| Content visibility filtering by department | Optional, future stage            |
| Commercial structure integration           | Out of scope                      |
| Bulk operations                            | Future enhancement                |
| Soft delete                                | Hard delete only (per stage file) |
| Frontoffice department display             | Future stage                      |
| Tagging system                             | Not department's concern          |

---

## API Endpoints Specified

| Method | Path                                                                      | Description                    |
| ------ | ------------------------------------------------------------------------- | ------------------------------ |
| GET    | `/api/v1/backoffice/workspace/departments`                                | List with filters + pagination |
| POST   | `/api/v1/backoffice/workspace/departments`                                | Create department              |
| GET    | `/api/v1/backoffice/workspace/departments/:id`                            | Read by ID                     |
| PUT    | `/api/v1/backoffice/workspace/departments/:id`                            | Update department              |
| DELETE | `/api/v1/backoffice/workspace/departments/:id`                            | Delete (with guards)           |
| GET    | `/api/v1/backoffice/workspace/departments/:id/children`                   | Direct children                |
| GET    | `/api/v1/backoffice/workspace/departments/tree`                           | Full hierarchy tree            |
| GET    | `/api/v1/backoffice/workspace/staff/:staff_id/departments`                | Staff department list          |
| POST   | `/api/v1/backoffice/workspace/staff/:staff_id/departments`                | Assign staff to dept           |
| DELETE | `/api/v1/backoffice/workspace/staff/:staff_id/departments/:department_id` | Remove staff from dept         |

---

## Data Models Specified

- `departments` — 10 columns, 6 constraints, 5 indexes, self-referencing FK
- `staff_departments` — join table, composite PK, ON DELETE CASCADE
- `students.department_id` — nullable FK addition, ON DELETE SET NULL

---

## Error Codes Defined

| Code                          | HTTP | Meaning                                         |
| ----------------------------- | ---- | ----------------------------------------------- |
| DEPARTMENT_NOT_FOUND          | 404  | Department does not exist in this workspace     |
| DEPARTMENT_NAME_DUPLICATE     | 409  | Name already taken in the same parent scope     |
| DEPARTMENT_CIRCULAR_REFERENCE | 422  | Setting parent would create a cycle             |
| DEPARTMENT_DIVISION_MISMATCH  | 422  | Parent and child division_id are inconsistent   |
| DEPARTMENT_HAS_CHILDREN       | 409  | Cannot delete; children exist                   |
| DEPARTMENT_HAS_ASSIGNMENTS    | 409  | Cannot delete; active student/staff assignments |
| DEPARTMENT_MAX_USERS_EXCEEDED | 422  | Student assignment would exceed limit           |
| DEPARTMENT_DISABLED           | 422  | Cannot assign to a disabled department          |
| DEPARTMENT_PARENT_NOT_FOUND   | 422  | Specified parent_id does not exist              |
| DEPARTMENT_INVALID_TYPE       | 422  | Invalid type value                              |

---

## Clarifications Resolved

All ambiguities were resolved during specification. No `[NEEDS CLARIFICATION]` markers remain.

| #   | Issue                                | Resolution                                  |
| --- | ------------------------------------ | ------------------------------------------- |
| 1   | Name uniqueness scope                | Per-parent scope (null parent = root scope) |
| 2   | staff_departments ON DELETE behavior | CASCADE — API guard is the safety gate      |
| 3   | Staff minimum departments            | Not enforced (unlike divisions)             |
| 4   | max_users scope                      | Students only in this stage                 |

---

## Constitutional Compliance

- ✅ No cross-tenant access
- ✅ License middleware mandatory on all routes
- ✅ No direct DB instantiation — all via tenant resolver
- ✅ No grading logic affected
- ✅ All writes transactional
- ✅ Server-authoritative timestamps
- ✅ Structured logging with correlation_id and workspace_slug

---

## Next Step

**Step 2 — Clarify** — Run ambiguity scan and resolve any specification gaps before planning.
