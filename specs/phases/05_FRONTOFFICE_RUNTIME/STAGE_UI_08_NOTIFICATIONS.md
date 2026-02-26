# STAGE_UI_08_NOTIFICATIONS

Phase: 05_FRONTOFFICE_RUNTIME  
Layer: Frontend (Vue 3 + Phase 6 Runtime Core)  
Status: DRAFT  
Depends On:

- STAGE_UI_01_FRONTOFFICE_SHELL
- STAGE_UI_02_STUDENT_AUTH
- STAGE_UI_03_DASHBOARD
- STAGE_UI_07_SUBSCRIPTION_AND_ACCESS_GATES
- STAGE_65_NOTIFICATION_SYSTEM (Backend)

---

## Stage Status

Status: DRAFT

---

## Objective

Implement the Frontoffice Notifications UI layer.

This stage defines:

- Notification center page
- Real-time notification badge counter
- Read/unread state handling
- Notification detail rendering
- Safe navigation based on notification type

The frontend must NOT:

- Decide notification eligibility
- Generate notifications
- Compute notification targeting

All notification authority remains backend-controlled.

---

## Architectural Role

The Notifications UI is:

- A read-only rendering layer
- A notification state reflector
- A safe navigation entry point

It is NOT:

- A messaging engine
- A targeting system
- A scheduling service

Backend determines:

- Who receives notification
- When it is delivered
- What content is visible

---

## Primary Routes

Notification center:
`/notifications`

Optional detail route:
`/notifications/:notification_id`

All routes require:

- Authenticated student
- Valid workspace context

---

## Data Contracts

### Notification List

`GET /v1/frontoffice/notifications`

Response must include:

- notifications[]
  - notification_id
  - title
  - message
  - type
  - created_at
  - read_at
  - action_link (optional)
  - priority (optional)

Frontend must NOT:

- Modify content
- Infer missing fields
- Generate fallback titles

All content must be rendered as provided.

---

### Mark as Read

`PATCH /v1/frontoffice/notifications/{id}/read`

Frontend must:

- Optimistically update UI
- Roll back if API fails
- Never assume success without confirmation

---

## Notification Badge

Global header must display:

- Unread count
- Live update (if backend supports polling)

Unread count must be derived from API response.

Frontend must NOT:

- Compute unread count from cached partial list
- Increment locally without backend confirmation

---

## Notification Center UI

Must display:

- Title
- Short message preview
- Timestamp
- Read/Unread visual distinction
- Priority indicator (if provided)

Click behavior:

- Mark as read
- Navigate to action_link (if safe)

---

## Safe Navigation Rules

If notification contains action_link:

Frontend must:

- Validate it matches known internal routes
- Never execute arbitrary URLs
- Never allow external redirect without explicit confirmation

If link invalid:

- Ignore link
- Log warning

---

## Real-Time Strategy

If real-time delivery required:

Option A: Poll every 30–60 seconds  
Option B: WebSocket (future enhancement)

Polling must:

- Be lightweight
- Stop on logout
- Avoid duplicate fetches

No excessive polling.

---

## Priority Handling

If priority provided (e.g., HIGH, NORMAL, LOW):

UI may:

- Highlight high-priority notifications
- Show badge icon

Must NOT:

- Reorder unless backend already ordered

---

## State Management

Notification state must:

- Live in dedicated store
- Hydrate on app bootstrap
- Update on page navigation
- Clear on logout

No persistent storage of notification messages.

---

## Loading & Error States

Loading:

- Skeleton list
- Badge placeholder

Error:

- Show fallback state
- Retry button
- Structured error logging

401:

- Logout

403:

- Redirect to dashboard

---

## Performance Constraints

Notifications must:

- Render within 150ms after data load
- Avoid re-rendering entire list on single update
- Use keyed rendering

Large lists must support pagination or lazy loading (backend-driven).

---

## Accessibility

Notifications must:

- Be keyboard navigable
- Use proper ARIA roles
- Announce new notifications (if live)
- Not rely solely on color for unread state

---

## Observability

Frontend logs must include:

- notifications_loaded
- notification_clicked
- notification_marked_read
- notification_error

Must propagate:

- workspace_slug
- student_id
- request_id

No sensitive message content logged.

---

## Security Constraints

Frontend must:

- Never expose hidden notifications
- Never execute unsafe links
- Never trust route param without validation
- Never cache notifications permanently

Backend remains notification authority.

---

## Failure Conditions

Stage fails if:

- Notifications visible without authentication
- External links executed unsafely
- Read state desynchronized from backend
- Hidden notifications accessible via route manipulation
- Subscription logic incorrectly affects notifications

---

## Exit Criteria

Stage complete when:

- Notification center renders correctly
- Badge count accurate
- Read/unread updates reliable
- Safe navigation enforced
- All error states handled
- No console errors
- Security review passed

Upon completion:

Frontoffice notification delivery layer is operational.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
