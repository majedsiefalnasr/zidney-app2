# STAGE_TEST_01_RUNTIME_SYSTEM_VALIDATION

Phase: 04_RUNTIME  
Type: Validation Stage  
Layer: Backend + Worker + Database  
Status: DRAFT

---

## Purpose

This stage validates the full Runtime Attempt Engine in a production-like environment.

It ensures:

- Attempt lifecycle correctness
- Snapshot immutability enforcement
- Worker-only grading integrity
- Idempotent submission guarantees
- Concurrency safety
- Reconnection resilience
- Load stability under burst traffic
- Isolation integrity (tenant-level)

This stage does NOT introduce new features.

It validates that STAGE_53 → STAGE_58 operate safely together.

---

## Scope

Validation covers:

- Attempt start flow
- Autosave behavior
- Submission handling
- Worker grading pipeline
- Concurrency guards
- Reconnection logic
- Time authority enforcement
- Multi-tenant isolation boundaries

Out of scope:

- UI rendering correctness
- Backoffice configuration logic
- Commercial enforcement logic

---

## Validation Environment

Must be executed in:

- Staging environment
- Real database instance
- Worker process running
- Redis (if used) active
- Multiple tenant databases provisioned

Local-only validation is insufficient.

---

## Test Matrix

### 1. End-to-End Attempt Flow

Validate:

1. Start attempt
2. Snapshot created and stored
3. Autosave persists answers
4. Submit attempt
5. Worker grades
6. Result persisted
7. Result fetched via API

Acceptance Criteria:

- Score deterministic
- Snapshot unchanged after submission
- No grading executed in API layer

---

### 2. Idempotent Submission Test

Simulate:

- Duplicate POST /submit calls
- Network retry scenarios
- Concurrent submission attempts

Acceptance Criteria:

- Only one grading job enqueued
- Duplicate submissions return same response
- No double scoring
- No duplicate grading rows

---

### 3. Snapshot Mutation Protection Test

Scenario:

1. Student starts attempt
2. Instructor edits exam configuration
3. Student submits attempt

Expected:

- Grading uses original snapshot
- Updated configuration does not affect score
- Snapshot hash unchanged

---

### 4. Concurrency Stress Test

Simulate:

- 1000 concurrent submissions
- Burst autosave traffic
- Parallel attempts on same exam

Acceptance Criteria:

- No deadlocks
- No race condition state corruption
- Lock timeout respected
- No duplicate grading

---

### 5. Reconnection Abuse Test

Simulate:

- Network disconnect during exam
- Reconnect within allowed window
- Reconnect after deadline
- Multiple browser tabs

Acceptance Criteria:

- Valid reconnection resumes attempt
- Expired attempts blocked
- Multiple active sessions prevented if policy requires

---

### 6. Worker Failure Simulation

Simulate:

- Worker crash mid-grading
- DB connection loss
- Redis outage
- Partial grading write

Expected:

- Retry logic triggers
- No partial grade persisted
- Idempotent retry safe
- Dead-letter queue receives poison jobs

---

### 7. Time Authority Validation

Verify:

- Server time used for all deadlines
- Client time manipulation ineffective
- Expired submissions rejected
- Grace windows honored

---

### 8. Isolation Validation

Simulate:

- Two tenants running concurrent exams
- Cross-tenant ID probing
- Manual query attempts

Acceptance Criteria:

- No cross-tenant data access
- All queries scoped by tenant
- Worker jobs scoped correctly

---

## Performance Benchmarks

Minimum baseline:

- Autosave p95 < 50ms
- Submission enqueue < 100ms
- Worker grading < 500ms typical case
- Lock contention < 10ms
- No request error rate above 0.1%

Load test tool recommendation:

- k6 or Artillery

---

## Observability Requirements

Verify:

- request_id present
- workspace_slug logged
- attempt_id logged
- grading job ID logged
- Error responses follow RFC 7807
- Metrics emitted:
  - submission_rate
  - grading_latency
  - autosave_rate
  - lock_contention

---

## Failure Conditions

Stage fails if:

- Any grading occurs in API layer
- Snapshot can be mutated
- Duplicate grading observed
- Cross-tenant access detected
- Concurrency race causes inconsistent state
- Worker crash causes data corruption
- Time manipulation bypass succeeds

---

## Exit Criteria

Stage is complete when:

- All 8 validation categories pass
- Stress tests documented
- Load test report generated
- Observability logs verified
- No constitutional violations detected

Upon completion:

Stage status may be promoted to:

BACKEND CLOSED (Runtime stable)

Production promotion requires separate deployment validation stage.

---

Compliant with Zidney Constitution v1.2.0 — Runtime validation stage.
