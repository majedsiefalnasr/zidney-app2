# STAGE 55 – ANSWER AUTOSAVE

Phase: 05_ATTEMPT_ENGINE  
Runtime: Backend API + Frontoffice Runtime

---

## Stage Status

Status: DRAFT

---

## Objective

Implement safe, controlled, and scalable answer autosave during an active attempt.

Autosave must:

- Prevent data loss
- Prevent write overload
- Prevent race conditions
- Maintain attempt integrity
- Never trigger grading

---

## Scope

Applies to:

- MCQ attempts
- Traditional attempts
- All runtime modes (Relax, Chrono, Rush where applicable)

Autosave only applies while:

attempt.status = IN_PROGRESS

---

## Autosave Strategy

Client-side behavior:

Answers must be saved:

- On question navigation (next / previous / jump)
- On blur event for text inputs
- On visibility change (tab hidden / app backgrounded)
- On timed interval debounce (5–10 seconds for text-heavy inputs)
- Immediately before submission

Must NOT save:

- On every keystroke
- More frequently than debounce window
- After submission
- After expiration

---

## API Contract

Endpoint:

POST /attempts/:attemptId/answers

Payload:

{
question_id: string,
answer_payload: JSON,
client_timestamp: ISO8601
}

answer_payload:

- MCQ: selected option(s)
- Traditional: structured answer object
- Self-correction fields if applicable

---

## Backend Validation Flow

On request:

1. Resolve tenant from middleware
2. Validate attempt exists
3. Validate attempt.status = IN_PROGRESS
4. Validate question belongs to attempt snapshot
5. Validate not expired
6. Upsert into attempt_answers table

If invalid:

- 403 if not in progress
- 404 if attempt not found
- 409 if expired
- 400 if question mismatch

---

## Data Model Rules

attempt_answers table must:

- Use composite unique index:
  (attempt_id, question_id)
- Store:
  - answer_payload
  - updated_at
  - client_timestamp

Must NOT store:

- score
- grading_result
- correctness flag

Grading happens only at submission.

---

## Concurrency Model

Use optimistic update strategy:

- Last write wins
- No version locking required
- No scoring during autosave

If two rapid writes occur:

- The later write overwrites previous state

This is acceptable because answer is user-owned state.

---

## Offline & Reconnection Behavior

Client may:

- Store answers locally if network lost
- Retry autosave on reconnect
- Send latest state only

Server must:

- Accept idempotent upserts
- Never duplicate rows
- Never create multiple entries for same question

---

## Performance Constraints

Autosave must support:

- 500+ concurrent users per workspace
- Without degrading submission endpoint

Rate limiting:

- Per attempt autosave requests may be throttled
- Excessive rapid calls should return 429

Autosave must be lightweight:

- Single row upsert
- No joins
- No grading logic

---

## Security Rules

Autosave must:

- Validate JWT workspace match
- Validate attempt ownership
- Never allow cross-tenant attempt write
- Never allow writing answers for another user

Workspace isolation applies fully.

---

## Failure Handling

If autosave fails:

- Client must retry safely
- No attempt state corruption allowed

If attempt already submitted:

- Reject with 409
- No mutation allowed

If attempt expired during autosave:

- Reject with 409
- Do not auto-submit here

Submission flow handles expiration finalization.

---

## Validation Criteria

Stage is complete when:

- Answers persist correctly
- No duplicate rows
- No scoring during autosave
- Works under concurrent load
- Works with reconnect logic
- Submission still calculates correct score
- Cannot write after submission
- Cannot write after expiration

---

## Forbidden

- Client-side grading
- Partial scoring during autosave
- Creating attempt rows during autosave
- Allowing autosave after submission
- Allowing autosave across tenants

Autosave is persistence only.  
Grading belongs exclusively to submission stage.
