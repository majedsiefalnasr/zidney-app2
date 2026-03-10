# STAGE 62 – DASHBOARD_AGGREGATION

Phase: 05_FRONTOFFICE_RUNTIME  
Status: Critical  
Scope: Student dashboard data aggregation, performance constraints, and caching strategy

---

## Stage Status

Status: DRAFT

---

## Objective

Define the Frontoffice student dashboard aggregation layer.

The dashboard must provide a fast, consistent overview of:

- Upcoming scheduled exams
- Upcoming live sessions
- Earned certificates
- Performance analytics
- Notifications summary
- Subscription status summary

The dashboard is read-only and must never trigger heavy recalculation.

---

## Architectural Principle

The dashboard is an aggregation endpoint.

It must:

- Never compute grading logic
- Never recompute statistics live
- Never scan full attempt tables
- Never perform deep joins across large datasets

All heavy computation must be pre-calculated or incrementally updated.

---

## Data Sources

The dashboard aggregates from:

- scheduled_exams
- live_sessions
- certificates
- attempts (pre-aggregated metrics only)
- notifications
- subscriptions

All queries must be scoped by:

- workspace_id
- student_id
- division_id (when applicable)

---

## Upcoming Scheduled Exams

Rules:

- Only exams where:
  - status = ENABLED
  - current_time < end_time
  - student division is eligible
- Sorted by start_time ascending
- Limited result set (e.g., next 5 or 10)

Must use index on:

- start_time
- division visibility columns

No attempt history join allowed here.

---

## Upcoming Live Sessions

Rules:

- Only sessions where:
  - enabled = true
  - current_time < session_time
  - student division eligible
- Sorted by session_time
- Limited result set

Attendance data must not be joined unless required.

---

## Earned Certificates

Rules:

- Certificates where:
  - student_id matches
  - status = ISSUED
- Sorted by issued_at descending
- Limited result set

Do not revalidate exam result here.

Certificate validity must already be enforced at issuance time.

---

## Performance Statistics

Statistics must be derived from:

- Pre-aggregated student metrics table

Recommended structure:

student_statistics:

- student_id
- total_attempts
- total_passed
- total_failed
- average_score
- last_attempt_at
- updated_at

This table must be updated:

- On submission
- Via background worker if needed

Dashboard must never compute aggregates directly from attempts table.

---

## Notifications Summary

Dashboard must include:

- unread_count
- last 5 notifications (light payload only)

Notifications table must be indexed by:

- student_id
- read_status
- created_at

Full notification history is handled in STAGE_64.

---

## Subscription Summary

Dashboard must include:

- subscription_status
- expiration_date
- plan_name

This is read-only.

Access control enforcement handled in STAGE_60.

---

## Aggregation Endpoint Contract

Single API endpoint:

GET /student/dashboard

Response must include:

- scheduled_exams[]
- live_sessions[]
- certificates[]
- statistics
- notifications_summary
- subscription_summary

Response must be compact.

No heavy nested structures.

---

## Caching Strategy

Short-lived caching allowed (optional):

- Per student cache key: dashboard:{workspace_id}:{student_id}

TTL: 30–60 seconds maximum.

Cache invalidation required when:

- New attempt submitted
- New certificate issued
- New notification created
- Subscription status changes

Caching must not break correctness.

---

## Performance Rules

Dashboard response time target:

- < 200ms under normal load

Must avoid:

- N+1 queries
- Full-table scans
- Runtime aggregation on attempts
- Cross-tenant joins

All queries must use indexed columns.

---

## Security Rules

Must validate:

- Authenticated student
- Token workspace matches resolver workspace
- Student belongs to division

No cross-student data access allowed.

---

## Observability

Each dashboard request must log:

- workspace_slug
- student_id
- request_id
- response_time_ms

Slow requests (> 500ms) must be logged as warning.

---

## Validation Criteria

Stage is complete when:

- Dashboard endpoint implemented
- Aggregation uses indexed queries
- No heavy joins
- No runtime grading logic
- Pre-aggregated statistics used
- Caching optional but safe
- Response under performance target
- Security checks enforced

---

## Stability Principle

The dashboard is the student’s first impression.

If it is slow or inconsistent, perceived platform stability is damaged.

Aggregation must be lightweight, deterministic, and safe.
