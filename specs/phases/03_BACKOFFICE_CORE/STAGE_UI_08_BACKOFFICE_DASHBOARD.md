# STAGE_UI_08_BACKOFFICE_DASHBOARD

Phase: 03_BACKOFFICE_CORE  
Track: UI (apps/backoffice)

Backend Dependencies:

- STAGE_52_BACKOFFICE_DASHBOARD
- STAGE_41_STAFF_MANAGEMENT
- STAGE_42_STUDENT_MANAGEMENT
- STAGE_36_MCQ_EXAM_CONFIG
- STAGE_38_SCHEDULED_ENGINE
- STAGE_48_NOTIFICATIONS_ENGINE

UI Dependencies:

- STAGE_UI_01_BACKOFFICE_SHELL
- STAGE_UI_02_ACADEMIC_STRUCTURE
- STAGE_UI_03_EXAM_MANAGEMENT
- STAGE_UI_04_USER_MANAGEMENT
- STAGE_UI_07_COMMUNICATION

---

## Stage Status

Status: DRAFT

---

## Purpose

This stage implements the Backoffice Dashboard UI.

The dashboard provides:

- High-level institutional metrics
- Academic activity overview
- User statistics
- Exam activity insights
- Alerts and system notifications
- License usage snapshot

The dashboard is read-only and fully backend-driven.

No aggregation logic may exist in UI.

---

## Architectural Constraints

Dashboard UI must:

- Be tenant-scoped only
- Use centralized API client
- Fetch aggregated data from backend
- Never compute statistics locally
- Never merge multiple API datasets client-side for business logic
- Respect RBAC restrictions

Backend remains authoritative for:

- Metric aggregation
- Time-window calculations
- Exam statistics
- User activity metrics
- Alert severity classification

---

## Dashboard Sections

### 1️⃣ Institution Overview

UI must display:

- Total staff count
- Total student count
- Active exams count
- Scheduled exams count
- Recent activity summary

All values must come from a single dashboard endpoint if available.

No client-side counting of lists.

---

### 2️⃣ Academic Metrics

Display:

- Exams created (last 7/30 days)
- Exams completed
- Average completion rate
- Active vs archived exams
- Upcoming schedules

Time filtering must be backend-controlled.

UI may provide time-range selector, but backend computes metrics.

---

### 3️⃣ User Activity Metrics

Display:

- New students (last period)
- New staff
- Active users (last X days)
- Locked accounts
- Role distribution chart

Charts must consume aggregated backend data.

UI must not compute distribution from raw lists.

---

### 4️⃣ Alerts & Notifications Panel

Display:

- Critical alerts
- Warning alerts
- Recent notifications
- Unacknowledged system alerts

UI must:

- Link to communication module
- Allow acknowledge (backend-confirmed)
- Show severity visually

---

### 5️⃣ License & Usage Snapshot

Display:

- Plan name
- License status
- Student usage %
- Staff usage %
- Storage usage (if applicable)
- Renewal date

If license near limit:

- Show warning indicator
- Link to Commercial Layer

UI must not compute percentages locally unless backend provides raw limit + usage explicitly.

---

## Charting & Visualization Rules

If charts are used:

- Use lightweight chart library
- Do not load heavy analytics frameworks
- Lazy-load charts
- Avoid large dataset rendering
- Prefer aggregated numeric endpoints

Charts must be purely visual — no business logic.

---

## RBAC Enforcement

Different roles may see different dashboard modules.

UI must:

- Hide restricted sections
- Respect backend 403
- Not render empty data blocks for unauthorized roles

Example permissions:

- dashboard:view
- metrics:view
- alerts:view

---

## Performance Requirements

Dashboard must:

- Load within acceptable threshold (single aggregated request preferred)
- Avoid multiple waterfall requests
- Lazy-load secondary panels if needed
- Cache short-lived data per session

No blocking UI threads.

---

## Concurrency Handling

If dashboard data outdated:

- Provide refresh button
- Backend remains source of truth
- Do not auto-refresh aggressively

If backend returns partial data:

- Gracefully handle missing sections
- Display fallback placeholders

---

## Error Handling

Must handle:

- 403 (unauthorized)
- 404 (dashboard disabled)
- 409 (conflict state)
- 500 (server error)

Display:

- Clear user-friendly messages
- Retry option for transient errors

No stack traces shown.

---

## Observability Requirements

Client logs must include:

- dashboard_load
- dashboard_refresh
- dashboard_section_error

Include:

- workspace_slug
- correlation_id

No sensitive aggregated data logged.

---

## E2E Validation Scenarios

Mandatory tests:

1. Load dashboard successfully
2. Verify metrics display
3. Verify charts render
4. Simulate RBAC restriction
5. Simulate license near limit
6. Simulate alert presence
7. Acknowledge alert
8. Simulate backend partial response
9. Refresh dashboard
10. Error state rendering

All must pass before stage closure.

---

## Completion Criteria

Stage complete when:

- Dashboard loads successfully
- Metrics reflect backend values
- Charts render correctly
- Alerts actionable
- License snapshot accurate
- RBAC respected
- No console errors
- E2E scenarios pass

---

## Governance Rule

Backoffice Dashboard UI must never:

- Compute institutional metrics locally
- Cache stale analytics permanently
- Override backend-calculated values
- Merge datasets to simulate analytics

All analytics authority remains backend-controlled.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
