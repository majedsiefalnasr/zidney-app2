# STAGE_57_RECONNECTION_LOGIC

Phase: 04_RUNTIME  
Module: Attempt Engine  
Scope: Network interruption handling and safe resume logic

---

## Objective

Define deterministic and secure reconnection behavior for in-progress attempts.

This stage guarantees:

- No time manipulation
- No duplicate submissions
- No attempt corruption
- No cross-device abuse
- Safe auto-submission when required

Applies to:

- MCQ (Assessment, Exam, Scheduled)
- Traditional (Topics, Exercises, Scheduled)
- Relax, Chrono, and Rush modes

---

## Core Principles

- Server is the single time authority.
- Attempt state is stored in database only.
- Client never recalculates expiration.
- Reconnection must be idempotent.
- Grace logic applies only to scheduled exams.

---

## Attempt State Requirements

An attempt eligible for reconnection must:

- status = IN_PROGRESS
- submission_locked = false
- expires_at > now (unless grace window applies)

If status != IN_PROGRESS:
Return 409.

If submission_locked = true:
Return 423.

If expired and no grace allowed:
Return 410.

---

## Reconnection Flow

When client reconnects:

1. Validate authentication and workspace.
2. Load attempt by attempt_id.
3. Validate ownership (user_id must match).
4. Validate status = IN_PROGRESS.
5. Validate license ACTIVE.
6. Compute remaining_time = expires_at - now.
7. Return:

- remaining_time
- snapshot_questions
- snapshot_order
- saved_answers
- grading_config
- mode
- config_flags

Frontend must fully rebuild runtime state from server response.

---

## Scheduled Exam Grace Rule

Applies only if:

- exam_type = SCHEDULED
- status = IN_PROGRESS

If connection is lost:

- Server records disconnect_timestamp.
- Start 30-second grace window.

If user reconnects within 30 seconds:

- Resume normally.

If user does not reconnect within 30 seconds:

- Worker triggers auto-submission.
- submission_locked = true.
- forced_submission_reason = DISCONNECTED_TIMEOUT.

Grace logic must be enforced by backend timer or worker job.
Never rely on client timeout.

---

## Chrono and Rush Behavior

Chrono:

- Global timer continues running during disconnect.
- No pause allowed.
- Remaining time calculated strictly by expires_at.

Rush:

- Per-question timers continue running.
- If question timer expires during disconnect:
  - Auto-progress logic applies.
- If final question timer expires:
  - Auto-submit triggered.

Relax:

- No time enforcement.
- Reconnection simply restores state.

---

## WebSocket Integration

If WebSocket disconnect detected:

- Mark attempt_connection_state = DISCONNECTED.
- Log disconnect event with timestamp.

If reconnect:

- Mark attempt_connection_state = RECONNECTED.
- Log reconnect event.

Connection state does not modify expires_at.

---

## Multi-Tab Protection

If second session attempts to reconnect same attempt:

Option A (Recommended): Single active session

- Invalidate previous session.
- Allow latest authenticated session only.
- Log session override event.

Duplicate parallel sessions must not be allowed.

---

## Auto-Submission Worker

Worker must:

- Periodically scan IN_PROGRESS attempts.
- Identify:
  - expires_at < now
  - grace window expired
- Lock attempt row.
- Finalize grading.
- Update status = SUBMITTED.
- Set forced_submission_reason if applicable.
- Emit notification event.

Submission must be atomic.

---

## Security Guarantees

Reconnection must prevent:

- Extending exam duration
- Reordering questions
- Changing grading rules
- Modifying snapshot content
- Cross-user attempt access
- Cross-tenant attempt access

All snapshot data must originate from attempt row only.

---

## Observability Requirements

Every reconnect must log:

- workspace_slug
- user_id
- attempt_id
- reconnect_timestamp
- remaining_time
- grace_applied (boolean)

Every forced submission must log:

- workspace_slug
- attempt_id
- forced_submission_reason
- submission_timestamp

---

## Validation Criteria

Stage complete when:

- Reconnect restores correct snapshot.
- Expired attempts cannot resume.
- Grace window enforced correctly.
- Worker auto-submit works reliably.
- No duplicate submission possible.
- No time manipulation possible.
- Multi-tab protection enforced.

---

## Forbidden

- Trusting frontend timer.
- Recalculating expires_at on reconnect.
- Allowing multiple active sessions for same attempt.
- Modifying attempt snapshot during reconnect.
- Allowing reconnect after final submission.
