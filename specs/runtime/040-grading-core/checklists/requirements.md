# Requirements Checklist — Grading Core

## Functional Completeness

- [x] MCQ SINGLE grading — exact match, full or zero
- [x] MCQ MULTIPLE grading — exact set match, full or zero
- [x] MCQ TRUE_FALSE grading — boolean match
- [x] MCQ ARRANGEMENT grading — ordered sequence match
- [x] Traditional TRUE_FALSE — auto-graded
- [x] Traditional FILL_BLANK — exact match with case normalization
- [x] Traditional SHORT_ANSWER — self-evaluated with stored score
- [x] Score aggregation — sum, percentage, pass/fail
- [x] Pass type PERCENTAGE support
- [x] Pass type SCORE support
- [x] Forced submission handling (TIME_EXPIRED, CONNECTION_LOSS, ADMIN_FORCE)
- [x] Late submission rejection
- [x] Immutability after grading
- [x] Admin override with audit trail
- [x] Grading version tracking

## Architectural Compliance

- [x] Tenant isolation — workspace_id on all queries (ADR-0001)
- [x] Snapshot-only grading — no live config references (ADR-0002)
- [x] Server-authoritative time (ADR-0006)
- [x] Version compatibility (ADR-0007)
- [x] Transaction guarantee — full rollback on failure
- [x] Determinism guarantee — same input → same output
- [x] Idempotency — re-grading returns existing result
- [x] Concurrency safety — SELECT FOR UPDATE

## Data Model

- [x] grading_results table defined
- [x] grading_question_results table defined
- [x] grading_overrides table defined
- [x] attempts table grading_status column
- [x] All tables include workspace_id
- [x] Forward-only migration strategy

## Observability

- [x] Structured logging with correlation_id
- [x] Grading duration tracking
- [x] Error codes mapped to HTTP status

## Testing

- [x] Unit test strategy for all graders
- [x] Determinism test strategy
- [x] Transaction rollback test strategy
- [x] Concurrency test strategy
- [x] Edge case coverage defined
