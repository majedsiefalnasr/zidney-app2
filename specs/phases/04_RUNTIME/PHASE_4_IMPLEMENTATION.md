# PHASE 4 – Runtime Implementation Sequence

Execution Layer: Backend + Worker  
Governance Level: Constitutional (Isolation + Snapshot + Determinism)

---

## Phase Objective

Phase 4 transforms configured exams into a deterministic, safe, and scalable Runtime Attempt Engine.

This phase does **not** build UI.

This phase guarantees:

- Snapshot immutability
- Deterministic grading
- Idempotent submission
- Concurrency safety
- Reconnection resilience
- Tenant isolation
- Worker-only grading enforcement

Only when this phase is stable may Frontoffice runtime UI integrate.

---

# IMPLEMENTATION SEQUENCE (Strict Order)

Execution must follow this exact order:

1. STAGE_53_ATTEMPT_SCHEMA
2. STAGE_54_ATTEMPT_START_FLOW
3. STAGE_55_ANSWER_AUTOSAVE
4. STAGE_56_SUBMISSION_FLOW
5. STAGE_57_RECONNECTION_LOGIC
6. STAGE_58_CONCURRENCY_GUARDS
7. STAGE_TEST_01_RUNTIME_SYSTEM_VALIDATION

Each stage depends on guarantees from the previous one.

No parallel skipping.

---

# Stage 53 – Attempt Schema (Structural Foundation)

Goal: Establish runtime-safe data model.

Required tables:

- attempts
- attempt_answers
- attempt_events (audit)
- grading_jobs (if async worker)

Indexes required:

- student_id
- exam_id
- scheduled_exam_id
- status
- created_at

Rules:

- Database-per-tenant only
- No shared runtime tables
- All timestamps server-authoritative
- Status enum strictly controlled

Validation:

- Unique active attempt constraint
- Foreign key integrity
- No nullable critical runtime fields

Do not proceed until schema integrity verified.

---

# Stage 54 – Attempt Start Flow (Snapshot Lock-In)

Goal: Freeze configuration at runtime start.

On attempt start:

Validate:

- License state
- Subscription state
- Schedule window
- Student eligibility
- No duplicate active attempt

Snapshot must store:

- Question IDs
- Question order
- Exam flags
- Timing rules
- Grading config
- Pass mark
- product_version
- schema_version

After snapshot:

Configuration must never be re-read.

Snapshot is immutable.

This is a constitutional rule.

---

# Stage 55 – Answer Autosave (Safe Persistence Layer)

Goal: Durable answer storage without grading.

Rules:

- Idempotent upsert
- Validate question belongs to snapshot
- No grading logic here
- No config reads
- No cross-attempt contamination

Must survive:

- Refresh
- Network jitter
- Temporary disconnect
- Reconnection

Autosave must not modify attempt status.

---

# Stage 56 – Submission Flow (Deterministic + Atomic)

Goal: Idempotent and transactional grading.

Submission flow:

1. Validate attempt IN_PROGRESS
2. Acquire row-level lock
3. Persist final answers
4. Enqueue grading job OR grade via worker
5. Store:
   - final_score
   - grading_breakdown
   - pass_status
   - submission_timestamp
6. Change status → SUBMITTED

Constraints:

- No double grading
- Duplicate submissions return identical result
- Entire flow transactional
- No grading inside API layer

Worker-only grading is mandatory.

---

# Stage 57 – Reconnection Logic (Runtime Safety)

System must support:

- Temporary disconnect
- Browser refresh
- Scheduled exam enforcement
- Timer expiration handling

Rules:

- Resume if time valid
- Auto-submit if expired
- Never reset timer
- Never reshuffle questions
- Never modify snapshot

If license soft-locked mid-exam:

Student may finish attempt.

Reconnection must not bypass deadline rules.

---

# Stage 58 – Concurrency Guards (Hard Safety Layer)

System must enforce:

- One active attempt per student per scheduled exam
- No parallel active rows
- Atomic student limit enforcement
- Row-level locking inside transactions
- Idempotent submission enforcement

Race conditions must be impossible.

If concurrency test fails → implementation invalid.

---

# Observability & Logging

All runtime events must log:

- workspace_slug
- attempt_id
- student_id
- exam_id
- request_id
- execution_time_ms

Critical events:

- attempt_start
- autosave_write
- submission_received
- grading_started
- grading_completed
- forced_submission
- grading_error

Logs must be structured.

No console.log.

---

# Load & Stress Validation

Before moving to Phase 5:

Simulate:

- 500 concurrent attempt starts
- 500 concurrent submissions
- 200 reconnections
- Network drops
- Duplicate submission replay
- Expired exam submission attempts

System must:

- Maintain deterministic grading
- Prevent duplicate attempts
- Avoid deadlocks
- Maintain isolation
- Keep lock contention < 10ms

Load tool recommended:

- k6 or Artillery

---

# Hard Runtime Constraints

Not allowed:

- Live exam config reads after snapshot
- Grading inside API layer
- Regrading duplicate submission
- Non-transactional submission
- Cross-tenant attempt access
- Client-side authoritative timers

Server time is authoritative.

Worker separation is mandatory.

Snapshot immutability is mandatory.

---

# Phase Completion Criteria

Phase 4 is complete when:

- Attempt lifecycle deterministic
- Snapshot immutability verified
- Concurrency stress tests pass
- Idempotent submission proven
- Worker-only grading enforced
- Reconnection safe
- Logs structured
- Isolation validated
- STAGE_TEST_01_RUNTIME_SYSTEM_VALIDATION passes fully

Only then may:

Phase 5 – Frontoffice Runtime Integration begin.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
