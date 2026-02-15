# PHASE 5 – FRONT OFFICE RUNTIME IMPLEMENTATION

## Scope

This phase implements the full student runtime layer:

- Authentication (student-only)
- Subscription gating
- Content visibility enforcement
- Runtime modules (MCQ, Traditional, Library, Live, Ads, Notifications)
- Results & certificate access
- Runtime isolation enforcement

This phase must not introduce new domain models.
It strictly consumes Backoffice + Runtime engine logic.

---

## Implementation Order (Strict)

1. STAGE_59_FRONTOFFICE_AUTH
2. STAGE_60_SUBSCRIPTION_ENFORCEMENT
3. STAGE_61_CONTENT_VISIBILITY_RULES
4. STAGE_62_DASHBOARD_AGGREGATION
5. STAGE_63_LIBRARY_RUNTIME
6. STAGE_64_LIVE_SESSION_RUNTIME
7. STAGE_65_NOTIFICATION_SYSTEM
8. STAGE_66_ADS_RUNTIME
9. STAGE_67_RESULTS_AND_CERTIFICATES

Order must not be changed.

Each stage depends on the previous one.

---

## Execution Strategy

### Stage 59 – Frontoffice Authentication

- Workspace-bound login only
- Student-only JWT issuance
- Strict workspace_id validation
- Token must contain:
  - workspace_id
  - user_id
  - division_id
  - subscription_status
  - role = STUDENT

No staff login allowed in this phase.

---

### Stage 60 – Subscription Enforcement

Middleware must enforce:

- Dashboard blocked if expired
- Attempt start blocked if expired
- Library access blocked if expired
- Live session join blocked if expired

Allowed when expired:

- Profile access
- Certificate download
- Payment screen

Subscription state must be evaluated server-side only.

---

### Stage 61 – Content Visibility Rules

All content must be filtered by:

- Division (mandatory)
- Department (optional)
- Group (optional)
- Scheduled window (for scheduled exams)

No client-side filtering trusted.

All queries must enforce visibility in SQL layer.

---

### Stage 62 – Dashboard Aggregation

Dashboard must aggregate:

- Upcoming scheduled exams
- Upcoming live sessions
- Earned certificates
- Performance statistics
- Notifications summary

All queries must be scoped by workspace and student id.

No heavy analytics in this phase.

---

### Stage 63 – Library Runtime

- Filter by visibility rules
- Respect subscription gating
- Enforce download authorization
- Track file access logs

No file access without visibility validation.

---

### Stage 64 – Live Session Runtime

- Validate division visibility
- Validate subscription
- Track attendance
- Store join timestamps

No direct session URL exposure without validation.

---

### Stage 65 – Notification System

- WebSocket-based delivery
- Scoped by workspace and user
- Real-time push for:
  - Scheduled exam reminders
  - Live session reminders
  - Result published
  - System notifications

All WS connections must validate JWT at handshake.

---

### Stage 66 – Ads Runtime

- Ads filtered by:
  - Division
  - Department
  - Group
  - Placement location

Ads must never override visibility rules.

Ads rendering must not block runtime.

---

### Stage 67 – Results & Certificates

- Read-only result retrieval
- Respect exam configuration:
  - show results
  - show correct answers
  - show explanations
- Certificate retrieval:
  - Versioned template
  - Immutable after issuance

No recalculation of old attempts allowed.

---

## Integration Rules

Frontoffice must:

- Never access master_db directly
- Never bypass tenant resolver
- Never bypass subscription middleware
- Never trust client-provided identifiers

All DB access must come from resolver context.

---

## Failure Handling

Must handle:

- Expired subscription → 402 or custom subscription error
- Division mismatch → 403
- Scheduled window violation → 403
- JWT mismatch → 401
- Tenant archived → 403

All errors must be structured and logged with workspace_slug.

---

## Validation Criteria

Phase complete when:

- Student login works
- Subscription expiration correctly gates access
- Division filtering prevents cross-division access
- Scheduled exam timing enforced
- Live attendance tracked
- Notifications delivered in real-time
- Ads appear only in allowed placements
- Results respect exam configuration flags
- Certificates downloadable after expiration

No UI polishing required before validation.

---

## Exit Condition

Frontoffice is considered stable when:

- No cross-division leakage
- No subscription bypass possible
- No archived workspace accessible
- No attempt replay possible
- All runtime modules enforce workspace isolation

Only after this phase passes review can performance optimization begin.
