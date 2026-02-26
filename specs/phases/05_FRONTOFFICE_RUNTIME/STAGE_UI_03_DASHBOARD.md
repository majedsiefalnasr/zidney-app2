# STAGE_UI_03_DASHBOARD

Phase: 05_FRONTOFFICE_RUNTIME  
Layer: Frontend (Vue 3 + Phase 6 Runtime Core)  
Status: DRAFT  
Depends On:

- STAGE_UI_01_FRONTOFFICE_SHELL
- STAGE_UI_02_STUDENT_AUTH
- PHASE_3_BACKOFFICE_CORE (Academic Structure)
- PHASE_4_RUNTIME (Attempt Engine)

---

## Objective

Implement the student dashboard as the primary runtime entry point.

The dashboard must:

- Provide a clear overview of the student’s academic state
- Surface actionable items (upcoming exams, active attempts)
- Reflect subscription status
- Display relevant notifications
- Respect division and workspace boundaries

This stage does **not** compute academic logic.  
It consumes backend-aggregated data.

---

## Architectural Role

The Dashboard is:

- A read-only aggregation surface
- A navigation gateway
- A subscription reflection surface
- A runtime activity monitor

The Dashboard is NOT:

- A grading engine
- A scheduling authority
- A subscription calculator
- A configuration layer

All calculations remain server-side.

---

## Primary Route

`/dashboard`

Accessible only to:

- Authenticated users
- Role = student
- Valid workspace context

Guarded via global route guard.

---

## Data Contract

Frontend must consume:

`GET /v1/frontoffice/dashboard`

Response must include:

- student_id
- workspace_slug
- subscription_status
- division_id
- upcoming_exams[]
- active_attempts[]
- recent_results[]
- notification_count
- library_summary
- ads_slots (if enabled)

Frontend must NOT:

- Recalculate subscription validity
- Infer division access
- Derive exam eligibility

All fields come pre-filtered.

---

## Dashboard Sections

### 1. Welcome Header

Displays:

- Student name
- Workspace name
- Division name
- Current subscription state

Subscription states:

- ACTIVE
- SOFT_LOCKED
- EXPIRED
- ARCHIVED

UI must visually reflect restricted states.

---

### 2. Active Attempt Panel

If active attempt exists:

- Show exam title
- Remaining time (client UX only)
- Resume button
- Warning if nearing deadline

If none:

- Hide panel

No client-side time authority.

---

### 3. Upcoming Exams

List:

- Exam name
- Schedule window
- Start button (if allowed)
- Locked indicator (if outside window)

Start button must call:

`POST /v1/frontoffice/attempt/start`

Backend decides final eligibility.

---

### 4. Recent Results

Display:

- Exam name
- Score
- Pass/Fail badge
- View result button
- Certificate button (if eligible)

Data must match snapshot from Phase 4.

No recalculation allowed.

---

### 5. Library Summary

Display:

- Total accessible subjects
- Recently viewed lessons
- Quick navigation buttons

Must reflect division + subscription filtering from backend.

---

### 6. Notifications Preview

- Unread count
- Recent 3 notifications
- Link to full notifications page

No notification logic in dashboard.

---

### 7. Ads Slot (If Enabled)

- Safe ad container
- No layout shift
- No data leakage
- No interference with active attempt panel

Ads must never override subscription enforcement.

---

## Subscription Restriction Handling

If subscription expired:

Dashboard must:

- Show banner warning
- Disable “Start Exam” buttons
- Allow viewing past results
- Allow certificate download

Must NOT:

- Hide results
- Hide profile
- Hide dashboard entirely

Backend remains authority.

---

## State Management

Dashboard state must:

- Live in Pinia store or composable
- Be loaded via single API call
- Support refresh
- Support background polling (optional)

No multiple redundant calls.

---

## Loading & Error States

Loading:

- Skeleton layout
- No content flash

Error:

- Render fallback
- Retry button
- Log error via centralized logger

If 401:

- Trigger logout

If 403:

- Redirect to restricted page

---

## Performance Requirements

Dashboard must:

- Render within 200ms after data received
- Avoid blocking UI thread
- Lazy-load heavy components
- Cache short-lived data responsibly

Avoid over-fetching.

---

## Accessibility

- Clear heading hierarchy
- Focus reset on navigation
- Accessible buttons
- Screen-reader labels
- Color contrast compliance

---

## Observability

Frontend logs must include:

- dashboard_loaded
- dashboard_error
- exam_start_clicked
- result_view_clicked

Must propagate:

- workspace_slug
- student_id
- request_id

No sensitive data logged.

---

## Failure Conditions

Stage fails if:

- Dashboard accessible without authentication
- Subscription logic duplicated client-side
- Exam eligibility computed client-side
- Active attempt not surfaced
- Cross-division data visible
- Expired subscription allows new exam start

---

## Exit Criteria

Stage complete when:

- Dashboard renders correctly
- Backend aggregation consumed properly
- Subscription state reflected accurately
- Active attempts integrated
- Upcoming exams actionable
- Recent results displayed correctly
- Notifications preview working
- No console errors
- Security review passed

Upon completion:

Frontoffice primary entry point is operational.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
