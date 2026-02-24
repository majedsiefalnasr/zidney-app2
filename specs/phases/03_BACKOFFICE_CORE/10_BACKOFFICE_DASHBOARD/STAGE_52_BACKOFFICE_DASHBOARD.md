# STAGE 52 – Backoffice Dashboard

Phase: 3 – Backoffice Core  
Domain: 10_BACKOFFICE_DASHBOARD  
Status: High Priority  
Scope: Aggregated institutional insights, operational visibility, and performance summaries

---

## Stage Status

Status: DRAFT

---

## Objective

Provide workspace administrators with a structured, fast-loading operational overview of:

- Academic activity
- User growth
- Subscription health
- Revenue (if enabled)
- Scheduled exam readiness
- System health indicators

The dashboard must:

- Be read-optimized
- Never block runtime operations
- Never perform heavy synchronous computations
- Use pre-aggregated or indexed queries only

This stage defines visibility, not analytics intelligence.

---

## Dashboard Audience

Accessible only to:

- Workspace administrators
- Roles with dashboard_view permission

Students and regular staff cannot access this dashboard.

---

## Dashboard Sections

### Institutional Summary

High-level counters:

- Total registered students
- Total registered staff
- Active student subscriptions
- Expired subscriptions
- Total divisions (if enabled)
- Total subjects

All counts must:

- Use indexed COUNT queries
- Respect license limits
- Exclude soft-deleted entities

---

### Exam Activity

- Upcoming scheduled exams (next 7–14 days)
- Active scheduled exams (currently running)
- Recent completed exams (last 7 days)
- Total attempts (last 30 days)

Rules:

- Use indexed date filters
- Limit list to max 10 rows per section
- Support “View All” navigation to detailed pages

---

### Revenue Summary (If Commercial Module Enabled)

Visible only if:

- Commercial module active in product
- Billing enabled

Metrics:

- Monthly revenue
- Active plans
- Pending invoices
- Subscription churn (basic count only)

No complex financial analytics in Phase 3.

---

### Performance Overview

Operational metrics:

- Average exam completion rate (last 30 days)
- Pass rate percentage
- Most attempted subject
- Most active division

These must use:

- Pre-aggregated materialized view OR
- Indexed summary tables updated via worker jobs

Never calculate large aggregates synchronously.

---

### Alerts Section

Surface warnings:

- Student limit nearing threshold (> 90%)
- Staff limit nearing threshold
- Upcoming license expiration
- Failed scheduled jobs
- Large number of failed attempts (basic anomaly detection)

Alerts must be rule-based, not AI-driven.

---

## Data Source Strategy

Dashboard must not:

- Query raw attempt table with full scan
- Join large question tables
- Recalculate grading logic

Allowed:

- Indexed queries
- Pre-aggregated tables
- Worker-maintained summary tables
- Cached Redis metrics (optional future)

Recommended pattern:

- nightly aggregation job
- incremental counters updated on write

---

## Performance Requirements

- Dashboard initial load < 500ms (target)
- No query > 200ms
- Pagination for list widgets
- All heavy metrics offloaded to worker

If performance degrades:

- Disable non-essential widgets first

---

## Multi-Tenancy Isolation

All dashboard queries must:

- Use tenant DB only
- Never access master_db (except license metadata via middleware)
- Respect division filtering rules if division-enabled mode active

No cross-workspace aggregation allowed.

---

## UI Architecture (High-Level)

Dashboard must use:

- Widget-based layout
- Independent data fetching per widget
- Graceful loading states
- Partial failure tolerance

If one widget fails:

- Other widgets must still render

---

## Security & Permissions

Dashboard access requires:

- Valid JWT
- Valid license status (ACTIVE only)
- dashboard_view permission

Soft-locked workspaces cannot access dashboard.

---

## Observability

Each dashboard request must log:

- workspace_slug
- request_id
- execution_time
- slow_query_warning if > 200ms

If aggregation table missing:

- Log warning
- Fallback to safe minimal query

---

## Forbidden

- Real-time heavy recalculation
- Full table scans on attempts
- Blocking synchronous aggregation
- Cross-tenant metrics
- Analytics engine inside dashboard controller

---

## Completion Criteria

Stage complete when:

- Dashboard accessible via backoffice
- All counters accurate
- Indexed queries verified
- Large attempt table does not slow dashboard
- Alerts triggered correctly
- Commercial data hidden when module disabled
- Performance benchmarks met
