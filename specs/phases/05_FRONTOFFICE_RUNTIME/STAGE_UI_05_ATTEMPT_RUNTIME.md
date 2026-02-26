# STAGE_UI_05_ATTEMPT_RUNTIME

Phase: 05_FRONTOFFICE_RUNTIME  
Layer: Frontend (Vue 3 + Phase 6 Runtime Core)  
Status: DRAFT  
Depends On:

- STAGE_UI_01_FRONTOFFICE_SHELL
- STAGE_UI_02_STUDENT_AUTH
- STAGE_UI_03_DASHBOARD
- PHASE_4_RUNTIME (Attempt Engine Backend)
- STAGE_54_ATTEMPT_START_FLOW
- STAGE_55_ANSWER_AUTOSAVE
- STAGE_56_SUBMISSION_FLOW
- STAGE_57_RECONNECTION_LOGIC
- STAGE_58_CONCURRENCY_GUARDS

---

## Objective

Implement the full Frontoffice Attempt Runtime UI.

This stage defines:

- Exam start flow UI
- Question rendering engine (UI only)
- Autosave interaction layer
- Submission flow UX
- Reconnection handling
- Concurrency guard handling (multi-tab, expired attempts)

This stage must strictly respect:

- Snapshot immutability
- Server-authoritative time
- No grading logic in frontend
- No exam rule computation client-side

---

## Architectural Role

The Attempt Runtime UI is:

- A controlled rendering shell for backend-provided snapshot
- A submission interaction layer
- A state synchronization client
- A UX layer around strict backend enforcement

It is NOT:

- A grading engine
- A timer authority
- A rule validator
- A submission decision-maker

All exam rules live in backend.

---

## Primary Routes

Start:
`POST /v1/frontoffice/attempt/start`

Runtime:
`/attempt/:attempt_id`

Submission:
`POST /v1/frontoffice/attempt/submit`

Result polling:
`GET /v1/frontoffice/attempt/:id/status`

---

## Start Flow UX

When student clicks “Start Exam”:

1. Disable button immediately
2. Show loading indicator
3. Call backend start endpoint
4. If success:
   - Redirect to `/attempt/:id`
5. If rejected:
   - Show reason returned from backend
   - Never infer reason client-side

Possible backend responses:

- 200 → success
- 409 → concurrency violation
- 423 → license locked
- 403 → not eligible
- 429 → rate limited

Frontend must handle each explicitly.

---

## Snapshot Rendering

Upon entering attempt route:

Frontend must call:

`GET /v1/frontoffice/attempt/{id}`

Response includes:

- Snapshot metadata
- Questions array
- Time constraints
- Attempt status
- Remaining time (server-calculated)
- Concurrency token (if provided)

Frontend must:

- Render questions exactly as provided
- Never shuffle unless snapshot already shuffled
- Never modify answer structure
- Never alter question ordering

Snapshot is immutable.

---

## Timer Behavior

Timer rules:

- Backend authoritative
- Frontend displays countdown based on server remaining_time
- Sync on page load
- Re-sync periodically (optional)
- On timer expiration:
  - Auto-submit trigger
  - But backend decides final validity

Client clock must never decide exam end.

---

## Question Rendering Engine

Must support:

- MCQ single choice
- MCQ multiple choice
- Traditional text input (if defined in backend)
- Future extensibility (without architecture rewrite)

Each question component must:

- Receive question DTO
- Emit answer change event
- Remain stateless regarding grading

No score calculation in UI.

---

## Autosave Mechanism

On answer change:

1. Debounce (e.g., 500–1000ms)
2. Send PATCH to:
   `PATCH /v1/frontoffice/attempt/{id}/progress`
3. Include:
   - Question ID
   - Answer payload
   - Idempotency key (if required)

Autosave must:

- Retry safely on network error
- Never duplicate answers
- Respect idempotency contract

If autosave fails repeatedly:

- Show persistent warning banner

---

## Submission Flow

When user clicks “Submit”:

1. Show confirmation modal
2. Confirm unanswered questions warning
3. On confirm:
   - Disable UI
   - Call submit endpoint

Backend handles:

- Locking
- Final validation
- Grading job enqueue
- State transition

Frontend must:

- Not assume submission succeeded until confirmed
- Redirect to result polling screen

---

## Reconnection Logic

If page reload occurs:

Frontend must:

- Detect active attempt
- Fetch attempt state
- Resume rendering
- Restore answers from backend

If backend says:

- SUBMITTED → redirect to result
- EXPIRED → show expired message
- ARCHIVED → block access

Never trust local cache.

---

## Multi-Tab Concurrency Handling

If backend enforces single active session:

Possible response: 409 CONFLICT

Frontend must:

- Display clear message
- Offer “Take over session” only if backend supports
- Never bypass concurrency guard

No attempt state in localStorage except temporary UI cache.

---

## Result Transition

After submission:

Frontend must:

- Poll status endpoint
- When graded:
  - Redirect to `/results/:id`
  - Or show immediate result page

No grading logic client-side.

---

## State Management

Attempt state must:

- Live in dedicated store
- Be scoped to attempt_id
- Be cleared on submission
- Be cleared on logout

Never persist full snapshot in localStorage.

---

## Error Handling

Must explicitly handle:

- 401 → logout
- 403 → redirect to dashboard
- 409 → concurrency message
- 423 → license lock message
- 429 → rate-limit message
- 500 → generic fallback

No silent failures.

---

## Performance Constraints

Attempt UI must:

- Render questions within 150ms
- Avoid re-rendering all questions on single answer change
- Use key-based rendering
- Avoid memory leaks on long exams

Large exams must not freeze browser.

---

## Accessibility

- Keyboard navigation between questions
- Focus management
- Screen-reader support for timer
- Clear submission confirmation
- Visible warning states

---

## Observability

Frontend logs must include:

- attempt_started
- attempt_loaded
- answer_saved
- submission_clicked
- submission_success
- submission_error
- attempt_reconnected

Must propagate:

- workspace_slug
- student_id
- attempt_id
- request_id

No answer content logged.

---

## Security Constraints

Frontend must:

- Never expose grading logic
- Never trust client time
- Never bypass submission lock
- Never expose hidden questions
- Never allow exam start without backend confirmation

---

## Failure Conditions

Stage fails if:

- Timer authority implemented client-side
- Questions shuffled client-side against snapshot
- Grading logic present in frontend
- Attempt continues after backend says expired
- Autosave duplicates answers
- Concurrency guard bypassed

---

## Exit Criteria

Stage complete when:

- Full attempt flow works end-to-end
- Snapshot respected
- Autosave reliable
- Submission atomic
- Reconnection safe
- Concurrency enforced
- All error states handled
- No console errors
- Security review passed

Upon completion:

Frontoffice examination runtime layer is operational.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
