# STAGE 54 – Attempt Start Flow

Phase: 04_RUNTIME  
Domain: 01_ATTEMPT_ENGINE  
Status: Critical  
Scope: Secure, deterministic, and snapshot-based attempt initialization

---

## Stage Status

Status: DRAFT

---

## Objective

Define a deterministic, secure, and idempotent attempt start process that:

- Validates all access rules
- Snapshots exam configuration
- Snapshots grading configuration
- Freezes question order
- Enforces concurrency limits
- Prevents race conditions
- Prevents client manipulation

An attempt must be immutable in structure after creation.

---

## High-Level Flow

Attempt start must follow this strict order:

Access validation  
Concurrency validation  
Question selection  
Snapshot freezing  
Transactional attempt creation  
Response generation

No step may be skipped.

---

## Access Validation

Before any DB write:

The system must validate:

- Valid JWT
- Valid workspace context
- License status = ACTIVE
- Subscription active (if required)
- Division visibility match
- Scheduled exam window valid (if scheduled)
- Attempt limit not exceeded (if exam configured with limit)

If any validation fails:

- Return appropriate error
- Do not create attempt row

Validation must use server time only.

---

## Concurrency Validation

System must ensure:

- No existing IN_PROGRESS attempt for same user + same exam (unless exam allows multiple concurrent attempts)
- No attempt started during soft-lock state
- No attempt started during ARCHIVED state

Concurrency validation must occur inside a transaction using row-level locks or unique constraints.

Race conditions must not allow duplicate attempts.

---

## Question Selection

Question list must be generated server-side only.

Two supported sources:

Manual selection  
Auto-selection engine

Selection rules:

- Respect subject filter
- Respect lesson filter
- Respect category filter
- Respect category value filter
- Respect tag filter
- Respect basket filter
- Respect division filter
- Respect exam configuration limits

If insufficient questions:

- Reject start
- Do not create attempt

---

## Snapshot Freezing

The following must be snapshotted and stored inside the attempt row:

- Exam configuration snapshot
- Grading configuration snapshot
- Mode (RELAX | CHRONO | RUSH)
- Time limits
- Review permissions
- Hint permissions
- Result visibility flags
- Random seed
- Question order
- Question ID list
- Per-question scoring weight

Snapshots must be JSON-based and immutable.

Runtime must never read live exam configuration after attempt starts.

---

## Attempt Creation (Transactional)

Attempt creation must occur inside a single transaction:

1. Insert attempt row with:
   - user_id
   - exam_id
   - status = IN_PROGRESS
   - started_at
   - expires_at (if applicable)
   - snapshot fields

2. Insert attempt_questions rows:
   - attempt_id
   - question_id
   - display_order
   - per-question metadata

3. Commit transaction

If any step fails:

- Rollback completely

No partial attempt allowed.

---

## Mode-Specific Behavior

Relax Mode:

- No expires_at
- No global timer
- Navigation unrestricted

Chrono Mode:

- Global timer
- expires_at = started_at + duration
- Auto-submit when expired

Rush Mode:

- Per-question timer
- No back navigation
- Auto-next on timeout or answer

Timer logic must be enforced server-side.

---

## Response Payload

Upon successful creation, return:

- attempt_id
- mode
- expires_at (if applicable)
- total_questions
- ordered_question_identifiers
- server_time_reference

Client must not calculate expiration independently.

---

## Idempotency Rule

If client retries attempt start request:

System must:

- Detect existing IN_PROGRESS attempt
- Return existing attempt_id
- Not create new attempt

Idempotency key recommended for safety.

---

## Logging Requirements

On attempt start:

Log structured entry containing:

- workspace_slug
- attempt_id
- user_id
- exam_id
- mode
- question_count
- started_at
- request_id

No exam content logged.

---

## Forbidden

- Creating attempt without snapshot
- Using live exam config after start
- Client-provided time limits
- Client-provided question list
- Multiple concurrent attempts unless explicitly configured
- Attempt creation outside transaction
- Relying solely on client-side timers

---

## Completion Criteria

Stage complete when:

- Attempt start enforces all validation rules
- Snapshot stored correctly
- Question order deterministic
- Duplicate attempt prevented
- Chrono expiration enforced
- Rush navigation rules enforced
- Transaction integrity verified
- Idempotency tested
- No race condition reproducible under load
