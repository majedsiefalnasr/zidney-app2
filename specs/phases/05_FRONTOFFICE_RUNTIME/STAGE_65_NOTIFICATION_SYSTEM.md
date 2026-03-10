# STAGE 65 – Notification System

Phase: 05_FRONTOFFICE_RUNTIME  
Status: Critical  
Scope: Real-time and asynchronous notification delivery, isolation, and enforcement

---

## Stage Status

Status: DRAFT

---

## Objective

Define a secure, tenant-isolated notification system for Zidney that supports:

- Real-time WebSocket delivery
- In-app notification center
- Email notifications (optional)
- SMS notifications (optional)
- Scheduled and event-based triggers
- Strict workspace isolation

Notifications must be reliable, auditable, and non-blocking.

---

## Architectural Model

Notification system consists of:

1. Notification Producer (domain events)
2. Notification Queue (Redis-based)
3. Worker Processor
4. Delivery Layer
5. Persistence Layer
6. WebSocket Gateway

Notifications must never block primary business flows.

All heavy processing must be asynchronous.

---

## Notification Isolation

Notifications are strictly tenant-scoped.

Each notification record must include:

- workspace_id
- user_id
- type
- payload
- status
- created_at

Broadcasting across tenants is strictly forbidden.

WebSocket channels must be namespaced per workspace.

---

## Notification Types

Core supported types:

- Scheduled exam reminder
- Exam almost ending warning
- Certificate issued
- Subscription expiring
- Live session reminder
- System announcements (workspace-scoped)

Each type must have:

- event trigger
- template
- delivery configuration
- severity level

---

## Persistence Model

notifications table must include:

- id
- workspace_id
- user_id
- type
- title
- message
- payload (JSON)
- read_status (boolean)
- delivered_channels (JSON)
- created_at
- read_at (nullable)

Indexes required on:

- user_id
- workspace_id
- read_status
- created_at

Notifications must be retained for a defined retention period.

---

## WebSocket Delivery

WebSocket must:

- Authenticate using JWT
- Validate workspace match
- Subscribe user to: workspace:{workspace_id}:user:{user_id}

On notification creation:

- Publish to Redis channel
- WebSocket gateway pushes to connected client

If user offline:

- Notification remains persisted
- Delivered when user reconnects

No WebSocket connection allowed without valid JWT.

---

## Email Delivery (Optional)

If enabled in workspace settings:

- Worker sends email via configured provider
- Template-based rendering
- Must include unsubscribe handling if applicable

Email failure must not block in-app notification.

Delivery status must be logged.

---

## SMS Delivery (Optional)

If enabled:

- Worker sends SMS via configured provider
- Short message format required
- Rate-limited per user

SMS failures must not affect in-app notification.

---

## Event Triggers

Notifications must be triggered by domain events, such as:

- Scheduled exam approaching start time
- Exam nearing end (30 seconds warning)
- Certificate issuance
- Subscription expiration threshold
- Live session start time

Event triggers must be handled by worker, not API layer.

No cron-based business logic without domain validation.

---

## Read/Unread Logic

Student must be able to:

- View notification list
- Mark notification as read
- Delete notification (soft delete)

Unread count must be efficiently computed using indexed query.

Dashboard must only fetch summary (not full history).

---

## Rate Limiting

Notification sending must enforce:

- No duplicate notifications for same event
- No spam within defined interval
- Per-user throttle for SMS and email

Worker must deduplicate identical pending notifications.

---

## Failure Handling

If notification creation fails:

- Log error with workspace_slug
- Do not crash worker
- Retry if transient error

If delivery fails:

- Mark channel delivery failed
- Do not delete notification

System must remain stable under delivery provider outage.

---

## Security Rules

System must prevent:

- Cross-workspace notification leakage
- User receiving another user’s notifications
- WebSocket connection without workspace validation
- Client-side injection of fake notifications

Notification payload must not contain sensitive internal fields.

---

## Observability

Each notification event must log:

- workspace_slug
- user_id
- notification_type
- channel
- delivery_status
- request_id (if triggered by request)

WebSocket connection logs must include:

- workspace_slug
- user_id
- connection_id

---

## Performance Requirements

System must support:

- Hundreds of concurrent WebSocket connections per workspace
- Burst notification events
- Low-latency delivery (< 100ms internal publish)

Redis pub/sub must be properly namespaced.

---

## Completion Criteria

Stage complete when:

- Notification table implemented
- WebSocket delivery functional
- Workspace isolation verified
- Email optional delivery working
- SMS optional delivery working
- Deduplication enforced
- Rate limiting enforced
- Dashboard unread count accurate
- Logs include required metadata

---

## Forbidden

- Cross-tenant broadcast
- Blocking API while sending notification
- Notification without persistence
- WebSocket without JWT validation
- Trusting frontend to filter notifications

---

## Stability Principle

Notifications are a real-time trust signal.

If notifications leak across tenants or fail silently, institutional confidence is damaged.

The notification system must be isolated, reliable, and observable.
