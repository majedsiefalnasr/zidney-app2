# STAGE_UI_04_LIBRARY

Phase: 05_FRONTOFFICE_RUNTIME  
Layer: Frontend (Vue 3 + Phase 6 Runtime Core)  
Status: DRAFT  
Depends On:

- STAGE_UI_01_FRONTOFFICE_SHELL
- STAGE_UI_02_STUDENT_AUTH
- STAGE_UI_03_DASHBOARD
- PHASE_3_BACKOFFICE_CORE (Academic Structure)
- STAGE_63_LIBRARY_RUNTIME (Backend)

---

## Stage Status

Status: DRAFT

---

## Objective

Implement the Frontoffice Library UI for students.

The Library must:

- Display accessible subjects and lessons
- Respect division boundaries
- Respect subscription visibility rules
- Reflect content classification
- Provide secure navigation to lesson content
- Remain strictly read-only (content consumption only)

The Library does NOT manage:

- Content creation
- Content classification logic
- Subscription validation logic
- Access enforcement logic

All eligibility and filtering must be performed server-side.

---

## Architectural Role

The Library is:

- A content consumption interface
- A filtered, pre-authorized data renderer
- A structured academic navigator

The Library is NOT:

- A content editor
- A permission engine
- A subscription validator
- A classification processor

All content authority resides in backend.

---

## Primary Route

`/library`

Accessible only to:

- Authenticated student
- Valid workspace context
- Valid subscription (read access allowed)

Guarded via global route guard.

---

## Data Contract

Frontend must consume:

`GET /v1/frontoffice/library`

Response must include:

- workspace_slug
- division_id
- subjects[]
- lessons[]
- category_filters[]
- total_counts
- visibility_flags
- subscription_state

Each subject must include:

- subject_id
- subject_name
- lesson_count
- accessible_flag

Each lesson must include:

- lesson_id
- lesson_title
- subject_id
- visibility_state
- locked_reason (if any)

Frontend must NOT:

- Compute subject eligibility
- Filter lessons by subscription
- Infer access rights

All data is pre-filtered.

---

## Library Structure

### 1. Subject Overview

Display:

- Grid or list of subjects
- Lesson count
- Locked indicator (if subject inaccessible)
- Quick navigation

Locked subjects must:

- Show lock icon
- Show tooltip explaining reason
- Prevent navigation

---

### 2. Lesson Listing

When subject selected:

- Show lessons under that subject
- Indicate availability status
- Show progress indicator (if provided)

Lesson states:

- AVAILABLE
- LOCKED_SUBSCRIPTION
- LOCKED_SCHEDULE
- ARCHIVED

UI must visually differentiate states.

No logic duplication allowed.

---

### 3. Lesson Detail Navigation

Route:

`/library/lesson/:lesson_id`

Navigation must:

- Validate lesson exists in current context
- Redirect to 404 if not accessible
- Never expose hidden lesson IDs

Lesson content fetched via:

`GET /v1/frontoffice/library/lesson/{id}`

---

## Filtering & Search

Library must support:

- Category filtering (if provided by backend)
- Simple search (client-side on already loaded dataset only)
- Reset filters

Search must:

- Never request unfiltered content
- Never bypass backend constraints

---

## Subscription Restriction Handling

If subscription state changes to restricted:

Library must:

- Disable access to new locked lessons
- Show restriction banner
- Preserve ability to view previously allowed content if backend permits

Frontend must trust subscription_state returned from API.

---

## Progress Indicators

If backend provides progress metadata:

- Show completion badge
- Show percentage
- Show last accessed timestamp

Progress must never be calculated client-side.

---

## State Management

Library state must:

- Use dedicated store or composable
- Cache subject list for session duration
- Refresh on manual trigger
- Invalidate cache on workspace change

No duplicate API calls.

---

## Loading & Error States

Loading:

- Skeleton grid
- Placeholder lesson list

Error:

- Display friendly error block
- Retry button
- Log structured error

401:

- Trigger logout

403:

- Redirect to restricted page

404:

- Show not found page

---

## Performance Requirements

Library must:

- Render within 200ms after data received
- Avoid deep nested re-renders
- Lazy-load lesson detail page
- Avoid loading unnecessary assets

Pagination (if required) must be backend-driven.

---

## Accessibility

- Keyboard navigation across subjects
- Focus management when changing views
- ARIA labels for locked content
- Proper heading hierarchy

---

## Observability

Frontend logs must include:

- library_loaded
- subject_selected
- lesson_opened
- library_error

Logs must propagate:

- workspace_slug
- student_id
- request_id

No lesson content logged.

---

## Security Constraints

Library must:

- Never expose lesson content without API authorization
- Never trust route param without validation
- Never cache sensitive lesson content in localStorage
- Never render raw HTML without sanitization

All content rendered must be sanitized.

---

## Failure Conditions

Stage fails if:

- Student can access lesson without backend authorization
- Subscription logic duplicated client-side
- Cross-division subjects visible
- Hidden lessons appear via URL manipulation
- Library renders without authentication

---

## Exit Criteria

Stage complete when:

- Subjects display correctly
- Lessons filtered correctly
- Subscription restrictions reflected
- Lesson detail route secure
- Filtering works safely
- Search does not bypass backend
- All error states handled
- No console errors
- Security review passed

Upon completion:

Frontoffice content consumption layer is operational.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
