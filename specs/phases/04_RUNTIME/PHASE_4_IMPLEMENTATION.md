# PHASE 4 – Implementation Plan

## Scope

Phase 4 implements the Runtime Attempt Engine.

This phase turns the exam configuration layer into a safe, scalable, production-ready execution engine.

No UI logic is implemented here.  
Only backend runtime, grading, safety, and concurrency guarantees.

---

## Recommended Implementation Order

STAGE_53_ATTEMPT_SCHEMA  
STAGE_54_ATTEMPT_START_FLOW  
STAGE_55_ANSWER_AUTOSAVE  
STAGE_56_SUBMISSION_FLOW  
STAGE_57_RECONNECTION_LOGIC  
STAGE_58_CONCURRENCY_GUARDS

The order is strict and must not be changed.

Each stage depends on structural guarantees from the previous one.

---

## Implementation Strategy

### Attempt Schema First (Structural Integrity)

Before any runtime logic:

- Define attempt table
- Define attempt_answers table
- Define attempt_events (optional audit trail)
- Define grading snapshot storage
- Add performance indexes:
  - student_id
  - exam_id
  - status
  - scheduled_exam_id
  - created_at

All runtime safety depends on correct schema design.

No partial schema allowed.

---

### Attempt Start Flow (Immutable Snapshot)

On attempt start:

- Validate license state
- Validate subscription state
- Validate schedule window (if scheduled)
- Prevent duplicate active attempt
- Snapshot:
  - question list
  - question order
  - exam configuration flags
  - grading configuration
  - timing rules
  - pass mark
  - product_version
  - schema_version

After snapshot:

Configuration must become immutable.

Runtime must never re-read exam configuration after start.

---

### Answer Autosave (Safe Persistence)

Autosave rules:

- Debounced writes
- Idempotent upsert
- Validate question ownership against snapshot
- Prevent cross-attempt contamination
- No grading in autosave
- No exam config reads

Autosave must survive:

- Page refresh
- Network jitter
- Reconnection

---

### Submission Flow (Deterministic Grading)

Submission must be:

- Idempotent
- Atomic
- Fully transactional

Flow:

1. Validate attempt status = IN_PROGRESS
2. Lock attempt row
3. Grade using snapshot only
4. Store:
   - final_score
   - grading_breakdown
   - pass_status
   - submission_timestamp
5. Change status → SUBMITTED
6. Release lock

Duplicate submissions must return same result without regrading.

No double grading allowed.

---

### Reconnection Logic (Network Safety)

System must handle:

- Temporary disconnect
- Browser refresh
- Scheduled exam expiry

Rules:

- If still within time → resume
- If timer expired → auto-submit
- If schedule window expired → force submit
- If license soft-locked mid-exam → allow finish

Reconnection must not:

- Reset timer
- Re-shuffle questions
- Change grading behavior

---

### Concurrency Guards (Hard Safety)

Runtime must enforce:

- One active attempt per student per scheduled exam
- No parallel active attempt rows
- Transactional student limit enforcement
- Safe row-level locking

Race conditions must be impossible.

All concurrency enforcement must happen inside DB transaction.

---

## Observability Requirements

All runtime events must log:

- workspace_slug
- attempt_id
- student_id
- exam_id
- request_id
- execution_time

Critical events:

- attempt_start
- autosave_write
- submission
- forced_submission
- grading_error

Logs must be structured.

---

## Load Testing Requirements

Before Phase 5:

- 500 concurrent submissions
- 500 concurrent attempt starts
- 200 concurrent scheduled exam reconnections
- Simulated network drops
- Double submission attempts
- Expired scheduled exam attempts

System must:

- Maintain consistent grading
- Not duplicate attempts
- Not corrupt answers
- Not leak cross-tenant data

---

## Hard Constraints

Not allowed:

- Live exam config reads after start
- Regrading on duplicate submit
- Non-transactional submission
- Shared attempt tables across tenants
- Long-running grading without timeout
- Timer controlled only by client

Runtime must trust server time only.

---

## Completion Criteria

Phase 4 is complete when:

- Attempt lifecycle fully deterministic
- Snapshot model verified
- Concurrency race tests pass
- Scheduled enforcement reliable
- Reconnection safe
- Idempotent submission verified
- Grading consistent across retries
- Logs structured and traceable

Only after this phase is stable:

Phase 5 – Frontoffice Runtime Integration can begin.
