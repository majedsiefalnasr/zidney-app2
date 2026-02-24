# STAGE 56 – SUBMISSION_FLOW

Phase: 05_ATTEMPT_ENGINE  
Runtime: Backend API + Worker (for scheduled auto-submit)

---

## Stage Status

Status: DRAFT

---

## Objective

Implement a secure, server-authoritative submission flow.

Submission must:

- Finalize all answers
- Execute grading using snapshot data
- Lock the attempt permanently
- Prevent double submission
- Preserve transactional integrity
- Support manual and auto-submission

Submission is the only stage allowed to compute scores.

---

## Scope

Applies to:

- MCQ attempts
- Traditional attempts
- Scheduled attempts
- All runtime modes (Relax, Chrono, Rush)

Submission logic must be centralized in a single service.

---

## API Contract

Endpoint:

POST /attempts/:attemptId/submit

Optional body:

{
forced: boolean
}

Forced is used internally for scheduled auto-submit.

Client cannot override grading logic.

---

## Authoritative Submission Flow

On request:

1. Resolve tenant from middleware
2. Validate attempt exists
3. Validate attempt.status = IN_PROGRESS
4. Validate ownership (user_id match)
5. Validate license status ACTIVE
6. Validate not already submitted
7. Validate expiration window

For scheduled attempts:

- If now > scheduled_end + tolerance
  → reject manual submission
- Worker may force submission

---

## Expiration Handling

If attempt expired but not submitted:

- Worker must call submission flow
- forced_submission_reason = "TIME_EXPIRED"

Manual submission after expiration:

- Return 409
- Do not grade

Expiration does not bypass grading.
It only changes submission source.

---

## Final Autosave Reconciliation

Before grading:

- Load all attempt_answers
- Ensure all persisted answers included
- No client-side state trusted
- Ignore client payload at submission

Submission must rely exclusively on database state.

---

## Grading Execution

Grading must:

- Use snapshot stored in attempt row
- Never read live exam configuration
- Compute:
  - total_score
  - percentage
  - passed
  - grading_details (JSON)
- Support:
  - MCQ automatic scoring
  - Traditional scoring logic
  - Self-correction fields
  - Future AI scoring extension

Grading must be deterministic.

---

## Transaction Boundary

Submission must execute inside a single DB transaction:

BEGIN

- Validate status = IN_PROGRESS
- Lock attempt row FOR UPDATE
- Compute grading
- Update attempt:
  status = GRADED
  submitted_at = now
  graded_at = now
  total_score
  percentage
  passed
  forced_submission_reason (nullable)

COMMIT

If any failure:
ROLLBACK

No partial state allowed.

---

## Double Submission Protection

Update statement must include:

WHERE attempt_id = ?
AND status = 'IN_PROGRESS'

Rows affected must equal 1.

If 0 rows affected:

- Return 409
- Do not re-grade

Submission must be idempotent-safe.

---

## Post-Submission Behavior

After submission:

- Attempt becomes immutable
- Autosave endpoint must reject
- No answer modification allowed
- No status reversal allowed

Only allowed future state:
GRADED (terminal)

---

## Scheduled Auto-Submission

Worker must:

- Detect expired attempts
- Call internal submission service
- Mark:
  forced_submission_reason = "TIME_EXPIRED"

Auto-submit uses identical grading logic.

No separate grading path allowed.

---

## Concurrency Guarantees

Must support:

- 500+ concurrent submissions per workspace
- Without deadlocks
- Without race conditions

Row-level locking only.
No table locking.

---

## Logging Requirements

On submission:

Log structured event including:

- workspace_slug
- attempt_id
- user_id
- mode
- forced_submission_reason
- total_score
- passed
- request_id

Submission failures must log:

- reason
- attempt_id
- workspace_slug

---

## Validation Criteria

Stage complete when:

- Cannot submit twice
- Cannot submit after graded
- Cannot submit expired attempt manually
- Worker auto-submit works
- Grading matches snapshot
- Transaction rollback verified
- Autosave rejected after submission
- No race condition under concurrent submit

---

## Forbidden

- Client-side grading
- Reading live exam config during grading
- Partial grading writes
- Reopening graded attempt
- Submission without transaction
- Multiple grading passes

Submission is finalization.
After this stage, attempt is immutable.
