# STAGE_UI_03_EXAM_MANAGEMENT

Phase: 03_BACKOFFICE_CORE  
Track: UI (apps/backoffice)  
Dependency:

- STAGE_UI_01_BACKOFFICE_SHELL
- STAGE_UI_02_ACADEMIC_STRUCTURE

Backend Dependencies:

- STAGE_30_CATEGORIES
- STAGE_31_CATEGORY_VALUES
- STAGE_32_TAGS
- STAGE_33_MCQ_BASKETS
- STAGE_34_MCQ_QUESTION_MODEL
- STAGE_35_TRADITIONAL_QUESTION_MODEL
- STAGE_36_MCQ_EXAM_CONFIG
- STAGE_37_TRADITIONAL_EXAM_CONFIG
- STAGE_38_SCHEDULED_ENGINE
- STAGE_39_AUTO_SELECTION_ENGINE
- STAGE_40_GRADING_CORE

---

## Purpose

This stage implements the Backoffice UI for managing:

- Question banks (MCQ & Traditional)
- Baskets
- Exam configurations
- Scheduling
- Auto-selection rules
- Grading configuration visibility

This stage must strictly consume backend contracts.

No grading logic may exist in UI.

No snapshot mutation logic may exist in UI.

---

## Architectural Constraints

Exam Management UI must:

- Be fully tenant-scoped
- Never access master_db
- Never compute grading client-side
- Never modify snapshot state after publish
- Never allow schedule manipulation outside backend validation
- Use centralized API client
- Use RBAC-based rendering

Backend is authoritative for:

- Question validation
- Exam config versioning
- Scheduling constraints
- Grading configuration rules
- Snapshot immutability

---

## Module Breakdown

### 1️⃣ Question Management

Supports:

- MCQ questions
- Traditional questions

UI must provide:

- Create
- Edit
- Archive (if supported)
- Filter & search
- Tag assignment
- Basket assignment

Validation Rules:

- Use Zod-aligned client validation
- Unique constraints verified by backend
- Rich text editor must sanitize output
- No inline HTML injection

No client-side answer correctness evaluation logic allowed.

---

### 2️⃣ Basket Management

UI must allow:

- Create basket
- Assign questions
- Remove questions
- View usage count

Deletion must:

- Be blocked if basket used in exam config
- Respect backend conflict responses

No silent cascade.

---

### 3️⃣ Exam Configuration

UI must support:

- Create exam config
- Select type (MCQ / Traditional)
- Assign baskets
- Configure timing
- Configure grading parameters
- Configure visibility rules
- Configure attempt rules

Important:

Exam config must display:

- Version number
- Published state
- Immutable indicator if scheduled

If exam is published or scheduled:

- UI must disable structural edits
- Only allowed fields editable (if backend permits)

---

### 4️⃣ Auto Selection Engine UI

UI must allow:

- Rule definition (e.g., random selection)
- Category-based selection
- Difficulty distribution rules

All rules must:

- Be validated server-side
- Be previewable (if backend provides preview endpoint)

UI must not simulate selection logic locally.

---

### 5️⃣ Scheduling UI

UI must support:

- Create schedule
- Define start/end time
- Assign target groups
- Define attempt policy

Scheduling Constraints:

- UI must respect backend time validation
- Cannot edit config while active
- Cannot delete exam while scheduled

If schedule conflict:

- Surface clear error
- Do not allow silent override

---

### 6️⃣ Status Workflow Integration

Exam state machine must be reflected visually:

Possible states (example):

- Draft
- Published
- Scheduled
- Active
- Completed
- Archived

UI must:

- Display status badge
- Disable illegal transitions
- Never allow invalid state manipulation

State transitions only through backend endpoints.

---

## Snapshot Integrity Enforcement

UI must enforce:

- No editing of exam config after publish
- No modifying question content affecting historical attempts
- Clear warning if attempting to edit published entity
- Version history visible (read-only)

If backend rejects due to immutability:

- Show informative message
- Do not retry automatically

---

## RBAC Enforcement

Examples:

- question:create
- exam:update
- exam:schedule
- basket:delete

UI must:

- Hide restricted actions
- Respect 403 responses
- Never assume permission from UI state alone

Permission changes must reflect immediately.

---

## Error Handling

Must handle:

- 404 (entity missing)
- 403 (forbidden)
- 409 (conflict)
- 422 (validation error)
- 500 (server error)

Validation errors must map to specific form fields.

No raw stack traces rendered.

---

## Performance Requirements

Exam and question lists may be large.

UI must:

- Use server-side pagination
- Use filter parameters
- Avoid loading full dataset
- Lazy-load heavy editors
- Avoid blocking re-renders

Initial route load must remain performant.

---

## Concurrency Handling

UI must gracefully handle:

- Version conflict errors
- Concurrent publish attempts
- Concurrent scheduling attempts

If backend returns conflict:

- Inform user
- Refresh entity state

No optimistic concurrency without backend support.

---

## E2E Validation Scenarios

Mandatory tests:

1. Create MCQ question
2. Create Traditional question
3. Create basket & assign questions
4. Create exam config
5. Publish exam
6. Attempt edit after publish (blocked)
7. Schedule exam
8. Attempt illegal state transition
9. RBAC visibility test
10. Conflict simulation

All scenarios must pass before stage completion.

---

## Security Considerations

Must prevent:

- XSS in question content
- Script injection in rich text
- Unauthorized access to hidden routes
- Leakage of grading configuration
- Token exposure

All rendered HTML must be sanitized.

---

## Validation Gate

Stage complete when:

- Questions manageable
- Baskets manageable
- Exam configs manageable
- Scheduling functional
- State machine respected
- Snapshot immutability preserved
- RBAC enforced
- No console errors
- E2E scenarios pass

---

## Completion Criteria

- Full exam lifecycle manageable via Backoffice UI
- No grading logic in UI
- No snapshot mutation allowed
- Strict backend contract adherence
- Ready for integration with Runtime attempt engine

---

## Governance Rule

No Runtime (Phase 4) attempt flow UI integration may begin until this stage is stable.

Exam Management UI forms the bridge between Backoffice configuration and Runtime execution.

---
