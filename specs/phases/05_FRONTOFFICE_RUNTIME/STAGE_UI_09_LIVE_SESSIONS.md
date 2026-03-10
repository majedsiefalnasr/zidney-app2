# STAGE_UI_09_LIVE_SESSIONS

Phase: 05_FRONTOFFICE_RUNTIME  
Layer: Frontend (Vue 3 + Phase 6 Runtime Core)  
Status: DRAFT  
Depends On:

- STAGE_UI_01_FRONTOFFICE_SHELL
- STAGE_UI_02_STUDENT_AUTH
- STAGE_UI_07_SUBSCRIPTION_AND_ACCESS_GATES
- STAGE_64_LIVE_SESSION_RUNTIME (Backend)

---

## Stage Status

Status: DRAFT

---

## Objective

Implement the Frontoffice Live Sessions UI layer.

This stage defines:

- Live sessions listing page
- Upcoming session calendar view
- Session detail view
- Join session interaction flow
- Access gating based on subscription and schedule
- Safe integration with external live providers (if applicable)

The frontend must NOT:

- Determine session eligibility independently
- Manage live streaming infrastructure
- Generate session links
- Validate subscription logic client-side

All eligibility and access control remain backend-controlled.

---

## Architectural Role

The Live Sessions UI is:

- A schedule viewer
- A session access interface
- A controlled navigation layer

It is NOT:

- A streaming engine
- A conferencing provider
- A session scheduler
- A subscription validator

Backend determines:

- Which sessions are visible
- Who can join
- When join is allowed
- What provider link is used

---

## Primary Routes

Live sessions list: `/live`

Single session detail: `/live/:session_id`

All routes require:

- Authenticated student
- Valid workspace context

---

## Data Contracts

### Sessions List

`GET /v1/frontoffice/live-sessions`

Response must include:

- sessions[]
  - session_id
  - title
  - description
  - division_id
  - start_time
  - end_time
  - join_available
  - access_state
  - provider_type (optional)

Frontend must NOT:

- Infer join eligibility
- Recalculate schedule windows
- Filter based on subscription locally

All filtering is backend-provided.

---

### Session Detail

`GET /v1/frontoffice/live-sessions/{session_id}`

Response must include:

- session_id
- title
- description
- instructor_name (if provided)
- start_time
- end_time
- join_available
- access_state
- join_url (only when allowed)

Frontend must render exactly as provided.

---

## Access States

Backend may return access_state values such as:

- AVAILABLE
- NOT_STARTED
- ENDED
- LOCKED_SUBSCRIPTION
- LOCKED_DIVISION
- ARCHIVED

Frontend must:

- Reflect state visually
- Disable join button when not AVAILABLE
- Show reason text when provided

Never override backend state.

---

## Live Sessions List UI

Must display:

- Session title
- Date & time
- Status badge
- Join button (if applicable)
- Countdown indicator (UI only, non-authoritative)

Sorting may be based on start_time (client-side only on received dataset).

No additional eligibility filtering allowed.

---

## Calendar View (Optional Enhancement)

If implemented:

- Use month/week view
- Display session blocks
- Clicking block navigates to detail

Calendar must rely entirely on API data.

---

## Join Flow

When student clicks “Join”:

1. Disable button immediately
2. Validate join_available flag
3. Call backend (if required) to confirm join session
4. Open join_url securely

Frontend must:

- Not construct provider URLs
- Not store join_url permanently
- Not expose URL before backend allows

If join_url invalid or missing:

- Show error
- Log event

---

## Time Handling

Time is server-authoritative.

Frontend may:

- Display countdown to start_time
- Show "Session Live" indicator

Frontend must NOT:

- Determine join window expiration
- Decide session ended based solely on client clock

If mismatch occurs, backend response overrides UI.

---

## Subscription & Division Enforcement

Frontend must:

- Reflect LOCKED_SUBSCRIPTION state
- Reflect LOCKED_DIVISION state
- Show explanatory tooltip or banner

Join attempt must always rely on backend validation.

---

## External Provider Integration

If provider_type = "ZOOM" / "WEBRTC" / etc.:

Frontend must:

- Open link in new secure tab
- Use rel="noopener noreferrer"
- Never embed untrusted iframes without validation

If embedded provider required (future stage):

- Must undergo separate security review

---

## State Management

Live sessions state must:

- Live in dedicated store
- Hydrate on page visit
- Support manual refresh
- Clear on logout

No caching of join_url.

---

## Loading & Error States

Loading:

- Skeleton session cards
- Placeholder badges

Error:

- Friendly fallback
- Retry button
- Structured logging

401:

- Logout

403:

- Redirect to dashboard

404:

- Show not found page

---

## Performance Constraints

Live sessions page must:

- Render within 200ms after data load
- Avoid re-rendering entire list on state change
- Support pagination if large dataset

Join interaction must be instant (UI feedback under 100ms).

---

## Accessibility

Live sessions must:

- Be keyboard navigable
- Announce join availability state
- Use ARIA roles for status badges
- Provide accessible countdown text

Do not rely solely on color for state indication.

---

## Observability

Frontend logs must include:

- live_sessions_loaded
- live_session_opened
- live_session_join_clicked
- live_session_join_success
- live_session_join_error

Must propagate:

- workspace_slug
- student_id
- session_id
- request_id

No join_url logged.

---

## Security Constraints

Frontend must:

- Never expose hidden sessions
- Never trust session_id without backend validation
- Never embed unsafe provider URLs
- Never store join_url in localStorage

All session authority is backend-controlled.

---

## Failure Conditions

Stage fails if:

- Join button active when backend says not available
- Session accessible without authentication
- Join URL exposed prematurely
- Division-restricted session visible incorrectly
- Client-side time decides join window

---

## Exit Criteria

Stage complete when:

- Sessions list renders correctly
- Access states reflected accurately
- Join flow secure and validated
- Subscription & division restrictions respected
- Error states handled correctly
- No console errors
- Security review passed

Upon completion:

Frontoffice live session runtime layer is operational.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
