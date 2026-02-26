# STAGE_UI_07_COMMUNICATION

Phase: 03_BACKOFFICE_CORE  
Track: UI (apps/backoffice)

Backend Dependencies:

- STAGE_48_NOTIFICATIONS_ENGINE
- STAGE_49_FEEDBACK_SYSTEM
- STAGE_50_SYSTEM_FEEDBACK

UI Dependencies:

- STAGE_UI_01_BACKOFFICE_SHELL
- STAGE_UI_04_USER_MANAGEMENT

---

## Purpose

This stage implements the Backoffice Communication UI layer, enabling institutions to:

- Manage notifications
- Send targeted announcements
- View user feedback
- Respond to feedback (if allowed)
- Monitor system-generated alerts

UI must strictly consume backend APIs.

No notification dispatch logic, scheduling logic, or feedback processing logic may exist in UI.

---

## Architectural Constraints

Communication UI must:

- Be tenant-scoped only
- Never access master database
- Never dispatch notifications directly
- Never send emails or push notifications from UI
- Use centralized API client
- Respect RBAC middleware

Backend remains authoritative for:

- Notification dispatch
- Delivery status tracking
- Feedback storage
- Escalation rules
- System alert triggers

---

## Module Breakdown

### 1️⃣ Notification Management

UI must support:

- Create notification
- Select target audience (roles, groups, departments)
- Define delivery channels (if backend supports)
- Schedule notification (if supported)
- View notification history
- View delivery metrics

Constraints:

- Scheduling rules enforced server-side
- Delivery validation performed server-side
- UI must not simulate send

If backend rejects schedule:

- Show clear validation message
- Do not retry automatically

---

### 2️⃣ Announcement Builder

UI must allow:

- Title
- Body (rich text)
- Optional attachments
- Target filters
- Priority level (if supported)

Security:

- Rich text must be sanitized
- No raw HTML injection
- Attachment uploads must go through Media Library stage

---

### 3️⃣ Feedback Management

UI must support:

- View submitted feedback
- Filter by category
- Filter by status
- Assign internal status (OPEN / IN_PROGRESS / RESOLVED)
- Add internal notes (if backend supports)

UI must:

- Respect role restrictions
- Prevent modification of immutable feedback content

---

### 4️⃣ System Alerts Dashboard

UI must display:

- System-generated alerts
- Severity levels (INFO / WARNING / CRITICAL)
- Related entity links
- Timestamp
- Status (ACKNOWLEDGED / UNACKNOWLEDGED)

Acknowledgement:

- Must be confirmed by backend
- No local-only acknowledgment

---

## RBAC Enforcement

Examples:

- notification:create
- notification:view
- feedback:view
- feedback:respond
- alerts:acknowledge

UI must:

- Hide restricted actions
- Respect 403 responses
- Never assume permission

Permission updates must reflect immediately.

---

## Validation Rules

Client-side:

- Required fields
- Basic length validation
- Attachment presence (if required)

Server-side:

- Audience validation
- Scheduling validation
- Rate limiting
- Content filtering

UI must never bypass backend validation.

---

## Security Requirements

Must prevent:

- XSS in notification body
- Script injection in rich text
- Feedback tampering
- Unauthorized audience selection
- Notification flooding via UI abuse

All content must be sanitized before render.

---

## Observability Requirements

UI must log:

- notification_create_attempt
- notification_create_success
- notification_create_failure
- feedback_view
- alert_acknowledge

Include:

- workspace_slug
- correlation_id
- entity_id (if applicable)

No sensitive content logged.

---

## Performance Considerations

Notification history may grow large.

UI must:

- Use server-side pagination
- Support filtering
- Avoid loading full dataset
- Lazy-load rich text previews

Dashboard must remain responsive.

---

## Concurrency Handling

If notification edited concurrently:

- Backend returns 409
- UI refreshes state
- Show conflict message

If alert already acknowledged:

- Backend returns conflict
- UI refreshes state

No optimistic mutation without backend support.

---

## E2E Validation Scenarios

Mandatory tests:

1. Create notification
2. Schedule notification
3. Attempt invalid schedule
4. View notification history
5. Submit feedback (simulate)
6. View feedback
7. Change feedback status
8. View system alert
9. Acknowledge alert
10. RBAC restriction enforcement

All must pass before stage closure.

---

## Completion Criteria

Stage complete when:

- Notifications manageable
- Feedback manageable
- Alerts visible and actionable
- RBAC enforced
- No client-side dispatch logic
- No console errors
- E2E tests pass

---

## Governance Rule

Backoffice Communication UI must never:

- Dispatch notifications directly
- Modify feedback outside backend contract
- Persist unsynchronized notification state
- Override backend rate limiting

All communication authority remains backend-controlled.

---
