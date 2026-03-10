# STAGE 48 – Notifications Engine

Phase: 3 – Backoffice Core  
Domain: Communication Layer  
Status: Critical

---

## Stage Status

Status: DRAFT

---

## 1. Objective

Implement a tenant-isolated, event-driven Notifications Engine responsible for:

- Real-time delivery
- Scheduled reminders
- System alerts
- Commercial alerts
- Academic alerts

The engine must be:

- Tenant isolated
- Event-driven
- Preference-aware
- Scalable
- Auditable
- Retry-safe

No notification may cross workspace boundaries.

---

## 2. Architectural Model

Notifications follow an event-driven architecture:

Event → Notification Job → Channel Dispatcher → Delivery → Status Update

Core components:

- Notification events
- Notification templates
- User preferences
- Delivery channels
- Retry & failure handling
- Audit logs

Execution:

- Triggered via API or domain event
- Processed asynchronously via worker queue (Redis)
- Real-time WebSocket dispatch when applicable

---

## 3. Notification Channels

### 3.1 WebSocket (Real-Time)

Used for:

- Exam reminders
- System messages
- Dashboard alerts
- Subscription warnings

Requirements:

- Workspace-isolated
- User-scoped rooms
- Automatic reconnection supported
- Idempotent message delivery

WebSocket events must include:

- notification_id
- type
- payload
- created_at

---

### 3.2 Email (Optional Per Workspace)

Used for:

- Subscription expiration
- Scheduled exam reminders
- Certificate issuance
- Password reset

Requirements:

- Tenant-configured SMTP
- Branded email templates
- Retry policy
- Delivery status tracking

---

### 3.3 SMS (Optional Per Workspace)

Used for:

- High-priority reminders
- Exam start alerts

Requirements:

- Tenant-configured SMS provider
- Rate-limited
- Retry safe

---

## 4. Notification Types

System must support configurable types including:

Academic:

- Scheduled exam reminder
- Exam start alert
- Exam ending soon
- Certificate issued
- Result published

Commercial:

- Subscription expiring
- Subscription expired
- Invoice created
- Payment confirmed

System:

- Soft lock warning
- License archived
- Security alert

Notification types must be:

- Workspace-configurable (enable/disable)
- Channel-configurable (web/email/SMS)

---

## 5. Notification Data Model (Tenant DB)

Table: notifications

Must include:

- id
- user_id
- type
- title
- body
- payload (JSON)
- is_read
- channel (WEBSOCKET | EMAIL | SMS)
- status (PENDING | SENT | FAILED)
- retry_count
- created_at
- sent_at

Index:

- user_id
- created_at
- status

---

## 6. User Preferences Model

Table: notification_preferences

Fields:

- user_id
- notification_type
- enable_websocket
- enable_email
- enable_sms

Rules:

- Default = WebSocket enabled
- Email/SMS disabled unless configured
- User may override per type

Engine must respect preferences before dispatch.

---

## 7. Event Triggers

Notifications must be triggered by:

- Exam scheduling
- Attempt submission
- Certificate issuance
- Subscription change
- License lifecycle changes
- Admin broadcast

No manual ad-hoc notification without event logging.

---

## 8. Scheduling Engine

Scheduled notifications (e.g., exam reminders):

- Must create delayed job in Redis queue
- Must validate exam still active at send time
- Must validate user still eligible
- Must skip if attempt already started

All scheduled jobs must be idempotent.

---

## 9. Isolation Rules

Notification system must:

- Never query another tenant DB
- Never broadcast cross-workspace
- Never leak user_id across tenants
- Use tenant-scoped worker context

Worker must resolve tenant before processing job.

---

## 10. Retry & Failure Strategy

For EMAIL and SMS:

- Max retries: 3
- Exponential backoff
- Failure logged
- Status updated to FAILED

For WebSocket:

- No retry (real-time only)
- Stored in DB for UI retrieval

Dead-letter queue required for:

- Repeated failures
- Invalid payload

---

## 11. Audit Logging

Every notification must log:

- tenant_id
- user_id
- notification_type
- channel
- status
- timestamp

Logs must be structured and traceable.

---

## 12. Rate Limiting

Per-user throttling required:

- Max 10 notifications per minute per channel
- Prevent spam or loops

System-level burst protection required.

---

## 13. Validation Criteria

Stage complete when:

- Real-time notifications delivered via WebSocket
- Email works with retry logic
- SMS optional integration functional
- Scheduled exam reminders fire correctly
- Preferences respected
- Isolation verified
- Worker idempotency validated
- Retry logic validated
- Rate limiting enforced
- Audit logs present

---

## 14. Not Allowed

- Cross-tenant notification
- Direct DB writes bypassing worker
- Sending without user preference check
- Blocking API request while sending email
- Synchronous notification processing

---

## 15. Stability Principle

Notifications must never:

- Block core academic flow
- Cause performance degradation
- Break tenant isolation

Notifications are asynchronous enhancements, not core runtime dependencies.
