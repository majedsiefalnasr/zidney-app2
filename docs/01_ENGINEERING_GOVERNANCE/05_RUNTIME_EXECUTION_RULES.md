# Runtime Execution Rules

Phase Alignment: Runtime & Attempt Engine
Applies To: API, Worker, Frontoffice

This document defines non-negotiable runtime guarantees for Zidney.
All attempt execution must comply.

---

## Attempt Creation

When an attempt starts, the system must:

- Create attempt row immediately (status = IN_PROGRESS)
- Snapshot full configuration:
  - Question list
  - Question order
  - Mode (Relax / Chrono / Rush)
  - Time limits
  - Review flags
  - Hint flags
  - Result visibility configuration
  - Grading configuration
- Store server_start_time
- Generate submission_token

No live reference to exam configuration allowed after start.

Historical correctness must not depend on mutable configuration.

---

## Autosave Strategy

Primary model:

- Client stores answers locally during attempt
- Server receives answers on submit
- Optional incremental autosave when connection available

Rules:

- Server must validate attempt status before saving
- Autosave must not override submitted attempt
- Autosave payload must be validated
- Autosave must be idempotent

Answer data must always be associated with attempt_id.

---

## Time Authority

Server is authoritative for time.

Rules:

- server_start_time stored on creation
- server_end_time calculated for timed modes
- Client timer is visual only
- Submission after server_end_time must be rejected
- Auto-submit must be triggered server-side when required

Client-reported timestamps are never trusted.

---

## Scheduled Exam Enforcement

For scheduled exams:

- Server validates start window
- Server validates end window
- Grace period configurable
- Reconnection window allowed (configurable)

If connection lost:

- Attempt remains active until server_end_time
- If not reconnected within grace window → auto-submit

Scheduled enforcement must not rely on client clock.

---

## Concurrency Guard

System must enforce:

- One active attempt per user per exam
- No duplicate active attempts

Attempt start must be transactional.

Submission must:

- Acquire attempt-level lock
- Prevent double submission
- Reject if status != IN_PROGRESS

---

## Submission Flow

Submission endpoint must be idempotent.

Required:

- attempt_id
- submission_token

Submission must:

- Validate token
- Validate status
- Calculate grading
- Store final_score
- Store grading breakdown
- Update status = SUBMITTED
- Store submitted_at (server time)

Repeated submissions must return same result without side effects.

---

## Failure Handling

If submission fails:

- Attempt remains IN_PROGRESS
- Error logged with attempt_id
- Client may retry safely

No partial grading state allowed.

---

## Logging Requirements

All attempt lifecycle events must log:

- workspace_slug
- attempt_id
- user_id
- exam_id
- request_id

No raw answer payload logging allowed.

---

## Non-Negotiable Rules

Not allowed:

- Live exam configuration reference during attempt
- Trusting client time
- Partial submission writes
- Double submission side effects
- Cross-tenant attempt access

Runtime integrity protects institutional trust.
