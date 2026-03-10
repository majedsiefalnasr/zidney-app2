# STAGE_UI_02_ACADEMIC_STRUCTURE

Phase: 03_BACKOFFICE_CORE  
Track: UI (apps/backoffice)  
Dependency: STAGE_UI_01_BACKOFFICE_SHELL  
Backend Dependencies:

- STAGE_22_DIVISIONS
- STAGE_23_DEPARTMENTS
- STAGE_24_GROUPS
- STAGE_25_HIERARCHY_TREE
- STAGE_26_TEAMS
- STAGE_27_SEMESTERS
- STAGE_28_SUBJECTS
- STAGE_29_LESSONS

---

## Stage Status

Status: DRAFT

---

## Purpose

This stage implements the Backoffice UI for managing the full Academic Structure hierarchy.

It provides UI interfaces for:

- Divisions
- Departments
- Groups
- Teams
- Semesters
- Subjects
- Lessons

This stage must strictly consume backend APIs and must not reimplement hierarchy logic in the UI.

---

## Architectural Constraints

Academic Structure UI must:

- Be fully tenant-scoped
- Use centralized API client layer
- Use Pinia for state management
- Use permission-based rendering
- Never compute hierarchy rules client-side
- Never bypass backend validation
- Never assume ordering or integrity outside API response

Hierarchy integrity is backend-authoritative.

---

## Information Architecture

The academic structure must be represented as a hierarchical tree.

Hierarchy order (example model):

Division  
→ Department  
→ Group  
→ Subject  
→ Lesson

Teams and Semesters may be:

- Linked to Groups or Subjects (based on backend design)
- Rendered as contextual nodes

UI must render hierarchy dynamically based on API-provided structure.

---

## UI Layout

### 1️⃣ Academic Structure Overview Page

Route Example: `/academic-structure`

Layout:

- Left panel: Tree navigation
- Right panel: Detail view
- Action toolbar (Create / Edit / Delete)
- Breadcrumb for hierarchy context

Tree must:

- Support expand/collapse
- Lazy-load children where appropriate
- Reflect real-time updates

---

### 2️⃣ Tree Component Requirements

Tree must:

- Be virtualized if large
- Prevent duplicate node rendering
- Use backend IDs as stable keys
- Not allow drag-drop unless explicitly supported by backend

No manual reordering in UI unless backend provides reorder endpoint.

---

### 3️⃣ Detail Panel

Selecting a node must:

- Load details via API
- Display metadata
- Display linked entities
- Provide Edit / Delete buttons (permission-based)

Editing must:

- Use drawer or modal form
- Use Zod-aligned validation
- Disable immutable fields
- Surface backend errors cleanly

---

## CRUD Flows

Each entity must support:

- Create
- Update
- Soft delete (if supported)
- Hard delete (if allowed by backend)

Deletion Rules:

- UI must call delete endpoint
- If backend returns dependency conflict → show blocking message
- UI must never silently cascade delete

---

## RBAC Enforcement

Permissions must map to backend roles:

Examples:

- division:create
- department:update
- subject:view
- lesson:delete

UI must:

- Hide actions user cannot perform
- Respect 403 responses
- Never assume permission

---

## Validation Requirements

All forms must:

- Use centralized validation schema
- Validate required fields
- Validate unique constraints only via backend
- Display server error messages mapped to fields

No optimistic validation of uniqueness.

---

## Concurrency & Consistency

UI must handle:

- 409 conflict responses
- Stale data warnings
- Concurrent edits gracefully

If backend returns version mismatch:

- Show "Data updated elsewhere" message
- Refresh entity

---

## Performance Requirements

Academic structure may grow large.

UI must:

- Lazy-load tree children
- Avoid fetching entire hierarchy if not required
- Use pagination where appropriate
- Avoid unnecessary re-renders

Initial page load must not exceed acceptable bundle size.

---

## Error Handling

Must handle:

- 404 (entity not found)
- 403 (forbidden)
- 409 (conflict)
- 422 (validation error)
- 500 (server error)

No raw JSON error messages rendered.

---

## Multi-Tenant Isolation

UI must:

- Never display data from another workspace
- Derive tenant context from shell
- Use tenant JWT
- Not allow workspace switching from UI

If tenant context invalid:

- Redirect to login or workspace error page

---

## E2E Validation Scenarios

Mandatory scenarios:

1. Create Division → verify appears in tree
2. Create Department under Division
3. Create Group under Department
4. Create Subject under Group
5. Create Lesson under Subject
6. Delete leaf node
7. Attempt delete with dependency → blocked
8. Permission-based visibility test
9. Concurrent update simulation
10. Large hierarchy render test

All must pass before stage completion.

---

## Security Considerations

Must prevent:

- XSS in names/labels
- Injection in search inputs
- Console leakage of JWT
- Direct API calls from template logic

All user input must be escaped in UI.

---

## Validation Gate

Stage complete when:

- Tree renders correctly
- CRUD flows functional
- RBAC enforced in UI
- Backend conflicts handled
- No console errors
- No cross-tenant leakage
- E2E scenarios pass

---

## Completion Criteria

- Academic structure fully manageable via UI
- No duplicated business logic
- Strict backend contract adherence
- Ready for integration with Exam Engine UI stage

---

## Governance Rule

No Exam Management UI stage may begin until Academic Structure UI is stable.

This stage forms the structural backbone for all exam-related UI.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
