# STAGE 06 – Attempt Engine Foundation

Phase: 1 – Platform Foundation  
Status: Critical  
Scope: Unified attempt model, snapshot integrity, grading pipeline, concurrency safety

---

## Objective

Design and implement a unified Attempt Engine that:

- Supports MCQ and Traditional exams
- Snapshots exam configuration at start
- Stores per-question progress safely
- Enforces mode behavior server-side
- Uses worker-based grading
- Guarantees concurrency safety
- Is upgrade-safe and schema-version aware
- Integrates with License enforcement

The Attempt Engine is Zidney’s academic integrity layer.

---

### 1. Unified Attempt Model

All delivery types must use a single attempts table.

attempt_type:

- MCQ_ASSESSMENT
- MCQ_EXAM
- MCQ_SCHEDULED
- TOPIC_EXAM
- EXERCISE_EXAM
- TRADITIONAL_SCHEDULED

No separate attempt tables per module.

Attempt structure must be engine-agnostic.

---

### 2. Attempt Core Schema

Each attempt must store:

Identification:

- id (UUID)
- workspace_id
- user_id
- attempt_type
- exam_id (reference only for audit, not grading)

Snapshot Fields (immutable after start):

- question_snapshot (JSON)
- question_order (array)
- grading_config_snapshot (JSON)
- mode (RELAX | CHRONO | RUSH)
- flags_snapshot (review_allowed, hints_allowed, result_effects)
- time_limit_snapshot
- exam_version
- expected_schema_version
- expected_product_version

Timing:

- started_at
- submitted_at
- finalized_at
- server_start_time

State:

- status (IN_PROGRESS | SUBMITTED | FINALIZED | EXPIRED | ABORTED)
- score
- passed (boolean)
- result_snapshot (JSON)

No live reference to exam configuration allowed during grading.

---

### 3. Snapshot Integrity Rules

At attempt start:

System must snapshot:

- Fully resolved question set
- Final shuffled order
- Question metadata needed for grading
- Mode configuration
- Time limits
- Pass/fail logic
- Review/hint rules
- Exam metadata required for certificate

Grading must NEVER query:

- exam tables
- question tables
- configuration tables

Snapshot must be self-sufficient.

Snapshot guarantees:

- Product upgrade safety
- Schema upgrade safety
- Audit reconstruction
- Deterministic grading

---

### 4. Attempt Start Flow

On attempt start:

1. Validate license status (must be ACTIVE)
2. Validate subscription (Frontoffice only)
3. Validate user eligibility (division, group, etc.)
4. Validate exam availability window (scheduled exams)
5. Check no active IN_PROGRESS attempt for same exam (if single-attempt rule)
6. Create attempt row inside transaction
7. Persist snapshot
8. Commit

Attempt creation must be transactional.

No attempt row may exist without snapshot.

---

### 5. Concurrency & Locking Rules

Rules:

- One IN_PROGRESS attempt per user per exam (unless exam allows multiple)
- Enforce via DB constraint or transactional guard
- Submission must lock attempt row FOR UPDATE
- Grading must lock attempt row FOR UPDATE
- No race condition between submission and timeout

Timeout job must verify:

status == IN_PROGRESS before marking EXPIRED.

---

### 6. Mode Enforcement (Server Authoritative)

RELAX:

- No server timer
- Free navigation
- Manual submission only

CHRONO:

- Global timer
- Back navigation allowed
- Server enforces expiration
- Auto-submit on timeout

RUSH (MCQ only):

- Per-question timer
- No back navigation
- Auto-next enforced by client
- Server validates total allowed time window

Client timers are visual only.

Server time is authoritative.

---

### 7. Scheduled Enforcement

For scheduled exams:

Server must validate:

- Current time >= start_time
- Current time <= end_time (+ optional tolerance)

If connection lost:

- 30-second reconnect grace window
- After grace → auto-submit

Reconnect must verify:

- attempt still IN_PROGRESS
- time not exceeded

---

### 8. Per-Question Progress Storage

Progress must store:

- attempt_id
- question_id
- user_answer (JSON)
- answered_at
- flagged (boolean)

Progress saving strategy:

- Save incrementally via API
- Also autosave on navigation
- All writes idempotent

Autosave must:

- Upsert answer
- Not create duplicate rows
- Never alter snapshot

Progress must survive:

- Page refresh
- Network interruption
- Backend restart

---

### 9. Submission Flow

Submission endpoint must:

1. Lock attempt row
2. Validate status == IN_PROGRESS
3. Validate not expired
4. Mark status = SUBMITTED
5. Set submitted_at
6. Enqueue grading job
7. Commit
8. Return acknowledgement

Submission must be idempotent.

If already FINALIZED:
→ Return existing result.

---

### 10. Worker Grading Pipeline

Worker must:

1. Lock attempt row
2. Validate status == SUBMITTED
3. Read snapshot only
4. Compute score deterministically
5. Write:
   - score
   - passed
   - result_snapshot
   - finalized_at
   - status = FINALIZED
6. Commit

If status already FINALIZED:
→ Exit safely.

Grading must be idempotent.

---

### 11. Certificate Trigger

If:

- status == FINALIZED
- passed == true
- certificate_enabled in snapshot

Worker must enqueue:

generate_certificate job

Certificate must store:

- attempt_id
- certificate_template_version
- issued_at

Certificate validity must not depend on future exam changes.

---

### 12. Expiration Handling

Background job must:

- Find IN_PROGRESS attempts exceeding time_limit_snapshot
- Lock row
- Mark status = EXPIRED
- Enqueue grading job

Expiration must be server-enforced.

Client cannot control expiration.

---

### 13. Version Compatibility Enforcement

On attempt start:

Reject if:

- tenant.current_schema_version != expected_schema_version
- license.expected_product_version incompatible

Attempt must never start under incompatible schema.

---

### 14. Auditability Requirements

Attempt must be fully reconstructible from:

- Snapshot
- Answer records
- Result snapshot

Audit must allow:

- Reconstruct question order
- Reconstruct grading config
- Recompute score independently
- Inspect timestamps

No external dependency allowed for audit reconstruction.

---

### 15. What Is Forbidden

- Grading inside API thread
- Live exam configuration lookup during grading
- Multiple attempt tables per module
- Client-side-only timer enforcement
- Submission without snapshot
- Non-transactional submission
- Non-idempotent grading

---

### 16. Validation Criteria

Stage complete when:

- Attempt created with full snapshot
- Snapshot independent from exam tables
- License + subscription enforced before start
- Mode logic enforced server-side
- Real-time progress saved idempotently
- Submission idempotent
- Worker grading deterministic
- Finalization writes result correctly
- Certificate job triggered
- Expiration enforced by server
- Concurrency conflicts tested
- Snapshot verified upgrade-safe

---

## Stability Principle

The Attempt Engine defines academic credibility.

If snapshot logic fails, grading becomes unreliable.  
If locking fails, concurrency corrupts scores.  
If version checks fail, upgrades break attempts.

No Phase 2 expansion allowed until Attempt Engine integrity is verified.
