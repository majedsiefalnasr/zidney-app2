# PHASE 4 – Runtime Layer

## Purpose

This phase defines the real-time execution engine of Zidney.

It governs how exams are executed after configuration is complete.  
This layer is responsible for preserving academic integrity, grading determinism, and runtime safety under load.

Phase 4 is where institutional trust is operationalized.

---

## Scope

Phase 4 includes:

- Attempt schema design
- Attempt start lifecycle
- Snapshot enforcement
- Answer autosave logic
- Submission pipeline
- Reconnection handling
- Concurrency guards
- Server-side time authority
- Idempotency guarantees

Phase 4 explicitly does NOT include:

- UI rendering logic
- Backoffice configuration interfaces
- Product or license configuration logic
- Content authoring logic

This phase consumes configuration. It does not define it.

---

## Architectural Invariants

The following rules are non-negotiable:

1. Exam configuration must be snapshotted at attempt start.
2. Grading configuration must never mutate during an active attempt.
3. All grading must occur server-side.
4. Autosave must never trigger grading.
5. Submission must be idempotent.
6. Scheduled exams must rely on server time authority.
7. Attempt records must survive temporary network interruption.
8. No client-provided score or timing data may be trusted.

Violation of any invariant invalidates academic integrity.

---

## Runtime Safety Requirements

The engine must guarantee:

- No duplicate submission processing
- No concurrent duplicate attempts for the same scheduled exam
- No grading inconsistencies
- No time manipulation from client
- No race conditions during autosave
- No double-finalization of attempts

All critical transitions must be transactional.

---

## Snapshot Model

At attempt start, the system must persist:

- Question list (ordered)
- Question configuration
- Grading rules
- Mode (Relax / Chrono / Rush)
- Time limits
- Feature flags (review allowed, hints allowed, result effects)

After snapshot creation:

- Original exam configuration changes must not affect the active attempt.
- Attempt grading must reference only snapshot data.

This guarantees version stability.

---

## Time Authority Model

For scheduled exams:

- Server time is authoritative.
- Attempt start window must be validated server-side.
- Chrono and Rush timers must rely on server timestamps.
- Auto-submission on expiration must be enforced server-side.

Client clocks must never be trusted.

---

## Concurrency Model

The runtime must prevent:

- Multiple active scheduled attempts per student
- Duplicate submission requests
- Concurrent grading of same attempt

Recommended enforcement:

- Unique DB constraints where applicable
- Transactional status transitions
- Submission idempotency keys

---

## Failure & Recovery Model

The runtime must tolerate:

- Network interruption
- Browser refresh
- Temporary WebSocket disconnection

Reconnection rules must:

- Restore attempt state from database
- Recalculate remaining time from server timestamps
- Prevent extending time unfairly

If scheduled exam reconnection fails beyond tolerance window, auto-submit must trigger.

---

## Stateless Runtime Principle

Runtime services are stateless between requests except for:

- Attempt record
- Persisted answers
- Submission record
- Snapshot metadata

No in-memory attempt state may be treated as authoritative.

All authoritative state must reside in the database.

---

## Observability Requirements

Every runtime request must log:

- workspace_slug
- attempt_id (if applicable)
- user_id
- request_id
- runtime_event_type

Submission and grading must produce structured logs.

---

## Performance Target

The runtime must safely support:

- 500+ concurrent scheduled attempts per workspace
- 10k+ registered students per workspace
- Stable autosave under burst load

Load safety must be considered before UI optimization.

---

## Exit Criteria

Phase 4 is complete when:

- Snapshot model verified
- Idempotent submission validated
- Concurrency guards enforced
- Reconnection logic tested
- Scheduled time authority enforced
- No cross-attempt contamination possible

Only after these conditions are met may production traffic be allowed.
