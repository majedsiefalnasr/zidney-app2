# TESTING STRATEGY

Applies To: Backend, Worker, Runtime, Tenant Resolver, License Engine

This document defines mandatory testing rules for Zidney.

Testing is not optional.

No feature is considered complete without required test coverage.

---

## Objective

Guarantee:

- Tenant isolation integrity
- Attempt engine correctness
- Grading determinism
- License enforcement reliability
- Concurrency safety
- Upgrade safety
- Runtime stability under load

Testing protects institutional trust.

---

## Testing Layers

### Unit Tests (Mandatory)

Required for:

- Grading algorithms (MCQ & Traditional)
- Score calculations
- Limit enforcement logic
- License state transitions
- Permission evaluation
- Workflow state transitions
- Snapshot serialization/deserialization
- Idempotency guards
- Concurrency locking logic

Rules:

- Must be deterministic
- No database dependency
- No network dependency
- Pure logic isolation

Coverage Target:
Minimum 80% for core runtime modules:

- attempt
- grading
- license
- tenant resolver
- subscription enforcement

---

### Integration Tests (Mandatory)

Required for:

- Attempt start flow
- Autosave flow
- Submission pipeline
- Scheduled exam time enforcement
- Soft lock enforcement
- Schema version mismatch blocking
- Limit enforcement under concurrency
- Tenant isolation (cross-tenant access must fail)

Integration tests must use:

- Test Postgres container
- Test Redis container
- Real migration execution

Mock-only integration tests are not allowed.

---

### Isolation Tests (Mandatory)

Must explicitly validate:

- Tenant A cannot access Tenant B data
- Cross-workspace token usage fails
- Resolver never falls back to default DB
- License middleware blocks ARCHIVED
- License middleware blocks SOFT_LOCKED

Isolation failure is critical severity.

---

### Idempotency Tests

Submission endpoint must be tested for:

- Double submission protection
- Retry safety
- Duplicate grading prevention
- Network interruption recovery

Idempotency must be validated with repeated request simulation.

---

### Concurrency Tests

Must simulate:

- Multiple simultaneous attempt starts
- Limit enforcement under race condition
- Concurrent submissions
- Scheduled exam simultaneous joins

Tests must confirm:

- No duplicate attempt records
- No limit bypass
- No partial grading state

---

### Load Tests (Pre-Release Mandatory)

Before production deployment:

Simulate:

- 200 concurrent scheduled exam participants
- 500 concurrent submissions
- 100 concurrent tenant resolver requests

Measure:

- Response time
- Error rate
- DB connection usage
- Worker queue latency

Release blocked if:

- Error rate > 1%
- Submission time > acceptable SLA
- Resolver fails under load

---

### Snapshot Integrity Tests

Must validate:

- Attempt snapshot immutability
- Question order preservation
- Config flags preserved
- Schema upgrade does not alter historical attempts

Historical grading must never change after submission.

---

### Migration Safety Tests

Every migration must:

- Apply cleanly on fresh DB
- Apply cleanly on previous version
- Not corrupt existing attempts
- Preserve schema_version accuracy

CI must test migrations against:

- Empty DB
- Existing DB with data

---

## CI Enforcement

Merge blocked if:

- Unit tests fail
- Integration tests fail
- Coverage below threshold
- Migration test fails
- Lint fails
- Type check fails

No bypass allowed.

---

## Test Data Policy

Test data must:

- Be synthetic
- Not include production exports
- Not include real student information

---

## Worker Testing

Worker must be tested for:

- Job retry logic
- Dead-letter handling
- Idempotent grading
- Failure logging

---

## Runtime Non-Negotiables

The following must always have tests:

- Attempt lifecycle
- License enforcement
- Tenant resolver
- Grading core
- Limit enforcement
- Submission flow
- Schema version mismatch handling

If these areas lack tests, feature is incomplete.

---

## Stability Principle

Zidney is an exam-centric, isolation-first system.

Testing must reflect that.

If isolation, grading, or license enforcement breaks,
the platform fails.

Testing is a structural requirement, not a quality enhancement.
