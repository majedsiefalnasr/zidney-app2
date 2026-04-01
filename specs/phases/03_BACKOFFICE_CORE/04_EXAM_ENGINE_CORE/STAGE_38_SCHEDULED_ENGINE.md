# STAGE 38 – Scheduled Exam Engine

Phase: 04_EXAM_ENGINE_CORE  
Database: Tenant DB  
Runtime: Backend + Redis + Worker

---

## Stage Status

Status: BACKEND CLOSED
Step: implement
Risk Level: HIGH
Last Updated: 2025-07-30T18:00:00Z

Implementation: COMPLETE
Tasks: 40 / 40 completed

Scope Closed:

- Migration 016: scheduled_exams table (20 cols, 5 indexes + concurrent unique)
- Migration 017: 6 new columns on attempts + 3 partial indexes
- Drizzle schemas: scheduled-exams.schema.ts, attempts.schema.ts
- Domain core: types, errors, hash, time, workflow, repository, service barrel
- Validation schemas: createScheduledExam, update, list, workflow-transition, re-approve
- API handlers: create, list, get, update, delete, workflow-transition, re-approve, start-attempt, heartbeat, submit-attempt
- Router factory: createScheduledExamsRouter() mounted at /api/v1/backoffice/workspace
- Job queue: AutoSubmitScheduledAttemptJob + ScheduledExamDispatcherJob
- Worker: auto-submit-scheduled-attempt.ts (Redis SET NX lock), scheduled-exam-dispatcher.ts (per-tenant)
- Tests: 3 unit suites, 1 integration suite, 1 worker unit test, 1 migration idempotency test
- Governance: tsc 0 errors, biome 0 errors, ai:guard 1670/1670 (100%), arch:audit 100/100

Deferred Scope:

- Reminder dispatch job
- Per-exam enrollment

Architecture Governance Compliance:

- ADR-0001 database-per-tenant isolation enforced
- ADR-0002 snapshot integrity enforced — startScheduledAttempt calls createAttempt()
- ADR-0006 server-authoritative time enforced — NOW() in SQL only
- All writes transactional; advisory lock for concurrent attempt starts
- Idempotent submit (HTTP 200 {autoSubmitted:true} on re-submit)
- AI Guard: 1670/1670 passed (100%)
- Architecture Audit: Score 100/100, 0 violations

Notes:
Backend implementation complete. No structural backend modifications allowed.
Pre-Closure Review Gate pending — Step 7 Closure not yet initiated.

---

## Objective

Implement scheduled exam layer for:

- MCQ Exams
- Traditional Exams (Topics)
- Not Assessments
- Not Exercises

Scheduled exam = immutable base exam snapshot + enforced time window.

This stage enforces strict server-side authority over time, reconnection, and submission.

---

## Scope Boundaries

Scheduled exams:

- Wrap existing ENABLED base exams
- Do not duplicate question configuration
- Do not allow runtime config overrides
- Do not modify grading logic

Assessments and Exercises are explicitly excluded.

---

## Table Structure

scheduled_exams:

- id
- base_exam_id (FK → mcq_exams.id OR traditional_exams.id)
- exam_type (MCQ | TRADITIONAL)
- name
- code (unique per workspace)
- start_datetime (UTC)
- end_datetime (UTC)
- late_tolerance_minutes (default 5)
- allow_single_attempt (boolean)
- reminder_before_start (boolean)
- reminder_before_end (boolean)
- workflow_status (APPROVED | ENABLED)
- created_at
- updated_at

Indexes required:

- base_exam_id
- start_datetime
- end_datetime
- workflow_status
- code (unique)

---

## Immutability Rules

After workflow_status = ENABLED:

The following fields become immutable:

- base_exam_id
- exam_type
- start_datetime
- end_datetime
- late_tolerance_minutes

If attempts exist:

- No structural field modification allowed
- No deletion allowed

---

## Server-Side Time Authority

All time validation must use:

- Server UTC time
- Never client time
- Never frontend timer

Time validation must occur during:

- Attempt start
- Submission
- Auto-submit worker execution
- Reconnection
- Attempt resume

No time-based decision may rely on client payload.

---

## Start Rules

User may start scheduled exam only if:

current_time >= (start_datetime - late_tolerance_minutes) AND current_time <= end_datetime

If:

current_time < (start_datetime - tolerance)  
→ return 403 (Not Started)

current_time > end_datetime  
→ return 403 (Closed)

If beyond late_tolerance boundary  
→ deny access

Late tolerance applies only to start window, not submission window.

---

## Attempt Binding

When attempt is created for scheduled exam:

attempt row must include:

- is_scheduled = true
- scheduled_exam_id
- snapshot of base exam config
- attempt_end_time = min( start_time + exam_duration, scheduled_exam.end_datetime )

No attempt may exceed scheduled end_datetime.

---

## Reconnection Logic

If connection lost during scheduled attempt:

- Server tracks last_heartbeat timestamp
- 30 second grace window allowed

If:

current_time - last_heartbeat > 30 seconds  
→ Force submit attempt  
→ auto_submitted = true  
→ forced_submission_reason = CONNECTION_TIMEOUT

Frontend timer has no authority.

---

## Auto-Submit Worker

Worker must monitor:

- Active scheduled attempts
- Attempt-level end time
- Scheduled exam global end time

Auto-submit conditions:

1. Attempt duration exceeded
2. Scheduled end_datetime reached
3. Reconnection grace expired

Worker must:

- Submit transactionally
- Prevent duplicate submission
- Log forced submission reason

Worker must never trust frontend state.

---

## Attempt Table Requirements

attempts table must include:

- is_scheduled (boolean)
- scheduled_exam_id (nullable)
- auto_submitted (boolean default false)
- forced_submission_reason (nullable)
- last_heartbeat_at (timestamp)
- scheduled_end_time (timestamp)

All submission operations must be idempotent.

---

## Single Attempt Enforcement

If allow_single_attempt = true:

Before creating new attempt:

- Count existing attempts for:
  - user_id
  - scheduled_exam_id

If count > 0  
→ return 403 (Already Attempted)

Must be enforced transactionally.

---

## Workflow Enforcement

Scheduled exam may be ENABLED only if:

- Base exam workflow_status = ENABLED
- Base exam not archived
- Base exam not modified after scheduling

If base exam changes after scheduling:

- Scheduling must be invalidated
- Manual re-approval required

---

## Observability Requirements

All scheduled runtime logs must include:

- workspace_slug
- scheduled_exam_id
- attempt_id
- request_id
- submission_reason

All forced submissions must be logged at WARN level.

---

## Validation Criteria

Stage complete when:

- Start window enforced strictly
- Late tolerance enforced correctly
- Auto-submit works via worker
- Reconnection window enforced
- Duplicate submission prevented
- Single attempt rule enforced
- Time authority verified server-side only
- No client-time dependency exists

---

## Not Allowed

- Client-controlled timing
- Editing time window after attempts exist
- Extending scheduled window during active session
- Manual override of forced submission
- Partial submission state

---

Scheduled Engine complete.

Next:

STAGE_39_AUTO_SELECTION_ENGINE
