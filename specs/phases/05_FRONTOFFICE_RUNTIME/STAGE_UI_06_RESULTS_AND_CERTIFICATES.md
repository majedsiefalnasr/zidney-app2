# STAGE_UI_06_RESULTS_AND_CERTIFICATES

Phase: 05_FRONTOFFICE_RUNTIME  
Layer: Frontend (Vue 3 + Phase 6 Runtime Core)  
Status: DRAFT  
Depends On:

- STAGE_UI_01_FRONTOFFICE_SHELL
- STAGE_UI_02_STUDENT_AUTH
- STAGE_UI_03_DASHBOARD
- STAGE_UI_05_ATTEMPT_RUNTIME
- STAGE_67_RESULTS_AND_CERTIFICATES (Backend)

---

## Objective

Implement the Frontoffice Results and Certificates UI.

This stage defines:

- Result viewing screen
- Detailed score breakdown rendering
- Pass/Fail visualization
- Certificate availability logic (UI reflection only)
- Secure certificate download interaction
- Historical results listing

This stage must strictly respect:

- Snapshot immutability
- Server-authoritative grading
- No score calculation in frontend
- No certificate eligibility logic client-side

All academic authority remains backend-controlled.

---

## Architectural Role

The Results & Certificates UI is:

- A read-only rendering layer for graded attempts
- A certificate access interface
- A historical performance viewer

It is NOT:

- A grading engine
- A certificate generator
- A score calculator
- A ranking computation engine

All computed values must originate from backend APIs.

---

## Primary Routes

Results list:
`/results`

Single result:
`/results/:attempt_id`

Certificate (view/download trigger only):
`/results/:attempt_id/certificate`

All routes require:

- Authenticated student
- Valid workspace context
- Authorized ownership of attempt

---

## Data Contracts

### Results List

`GET /v1/frontoffice/results`

Response must include:

- student_id
- workspace_slug
- attempts[]
  - attempt_id
  - exam_name
  - score
  - max_score
  - percentage
  - pass_status
  - submitted_at
  - certificate_available

Frontend must NOT:

- Recalculate percentage
- Infer pass/fail
- Derive certificate eligibility

---

### Single Result Detail

`GET /v1/frontoffice/results/{attempt_id}`

Response must include:

- attempt_id
- exam_metadata
- score
- max_score
- percentage
- pass_status
- question_breakdown[]
- grading_snapshot_reference
- certificate_available

Question breakdown may include:

- question_id
- student_answer
- correct_answer (if allowed)
- points_awarded
- max_points

Frontend must render exactly as provided.

No recalculation allowed.

---

## Results List UI

Display:

- Exam name
- Score (e.g., 78 / 100)
- Percentage
- Pass/Fail badge
- Submission date
- “View Details” button
- “Download Certificate” button (if available)

Sorting may be client-side only on already loaded data.

No additional filtering that changes backend-defined visibility.

---

## Result Detail UI

Must display:

- Header with exam name
- Score summary card
- Percentage visual indicator (progress bar)
- Pass/Fail status badge
- Submission timestamp

Optional breakdown section:

- Per-question review
- Points awarded
- Highlight correct/incorrect

UI must never reveal hidden data not included in API response.

---

## Certificate Flow

If certificate_available = true:

Certificate button must:

- Call backend endpoint:
  `GET /v1/frontoffice/results/{attempt_id}/certificate`
- Open secure download (PDF or generated document)

Frontend must:

- Not generate certificate locally
- Not cache certificate permanently
- Not expose certificate link publicly

If certificate unavailable:

- Disable button
- Show tooltip explaining reason (text from backend if provided)

---

## Subscription Impact Handling

If subscription becomes restricted:

UI must:

- Continue allowing access to historical results
- Continue allowing certificate download (if backend allows)
- Disable new exam attempts (handled elsewhere)

Results must not disappear due to subscription change.

Backend remains authority.

---

## State Management

Results state must:

- Use dedicated Pinia store or composable
- Cache result list during session
- Invalidate cache on workspace change
- Clear state on logout

No persistent storage of sensitive data.

---

## Loading & Error States

Loading:

- Skeleton cards for results list
- Placeholder detail view

Error:

- Friendly error display
- Retry option
- Structured error logging

401:

- Logout

403:

- Redirect to dashboard

404:

- Show not-found page

---

## Performance Requirements

Results page must:

- Render within 200ms after data load
- Lazy-load detailed breakdown
- Avoid heavy re-renders
- Avoid unnecessary certificate prefetching

Certificate download must not block UI.

---

## Accessibility

- Clear heading hierarchy
- Proper ARIA labels for badges
- Accessible download button
- Keyboard navigation for breakdown

Pass/Fail must not rely on color alone.

---

## Observability

Frontend logs must include:

- results_loaded
- result_detail_opened
- certificate_download_clicked
- certificate_download_success
- certificate_download_error

Logs must propagate:

- workspace_slug
- student_id
- attempt_id
- request_id

No score or answer content logged.

---

## Security Constraints

Frontend must:

- Never compute score locally
- Never reveal hidden answers
- Never expose certificate link without auth
- Never trust route param without validation
- Never cache sensitive grading snapshot

All grading authority is server-side.

---

## Failure Conditions

Stage fails if:

- Score calculated in frontend
- Certificate generated client-side
- Unauthorized result accessible via URL manipulation
- Hidden answers exposed
- Results disappear incorrectly due to subscription change

---

## Exit Criteria

Stage complete when:

- Results list renders correctly
- Detail view accurate
- Certificate download secure
- Historical data preserved
- All error states handled
- No console errors
- Security review passed

Upon completion:

Frontoffice academic feedback and certification layer is operational.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0

---
