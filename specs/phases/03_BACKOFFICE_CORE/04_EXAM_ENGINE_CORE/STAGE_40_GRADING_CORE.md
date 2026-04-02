# STAGE 40 – Grading Core

Phase: 04_EXAM_ENGINE_CORE  
Runtime: Backend  
Database: Tenant DB

---

## Stage Status

Status: IN PROGRESS
Step: analyze
Risk Level: LOW
Last Updated: 2026-04-02T00:00:00.000Z

Drift Analysis: PASSED (all 9/9 criteria)
Implementation: AUTHORIZED

Scope Defined:

- Grading engine for MCQ, Traditional, and Scheduled exams
- 19 atomic implementation tasks across 9 phases
- Full schema design with 3 new tables + 1 column addition
- Pure domain-core functions with deterministic grading logic
- Comprehensive test coverage (unit + integration)
- Migration 019: schema 1.24.0 → 1.25.0

Architecture Governance Compliance:

- ✅ Tenant isolation: workspace_id scoping enforced on all tables
- ✅ Snapshot immutability: all grading from attempt snapshot only
- ✅ Transactionality: SELECT FOR UPDATE + single transaction
- ✅ Idempotency: grading_status guard prevents re-grading
- ✅ Server-authoritative time: graded_at server-set via NOW()
- ✅ Version enforcement: grading_version stored per result
- ✅ Error contract: GradingError with codes + HTTP status mapping
- ✅ Structured logging: correlation_id + observability fields
- ✅ Concurrency safety: pessimistic locking via SELECT FOR UPDATE

Guardian Verdicts:

- Security Auditor: PASS
- Performance Optimizer: PASS
- QA Engineer: PASS
- Code Reviewer: PASS

Notes:
Drift analysis complete. Implementation gate open. Ready for implementation phase.

Notes:
Technical plan complete. Task breakdown in progress.

---

## Objective

Implement a unified grading engine supporting:

- MCQ
- Traditional
- Scheduled (MCQ & Traditional)
- Relax / Chrono / Rush modes

Grading must be:

- Server authoritative
- Snapshot-based
- Deterministic
- Immutable after finalization
- Fully auditable

This stage finalizes exam correctness logic before runtime submission flows.

---

## Grading Execution Model

Grading occurs:

- Exactly once per attempt
- Only after submission (manual or auto-submit)
- Inside a transaction
- Based exclusively on attempt snapshot

No grading logic may reference:

- Live exam configuration
- Live question configuration
- Updated pass criteria

All grading must use snapshot data captured at attempt start.

---

## Required Attempt Snapshot Fields

Each attempt must contain immutable snapshot data:

- question_ids (ordered)
- question_order
- question_score per question
- correct_answer snapshot per question
- grading_rules snapshot
- pass_type (PERCENTAGE | SCORE)
- pass_value
- total_possible_score
- random_seed (if applicable)

If snapshot incomplete → submission must fail.

---

## MCQ Grading Rules

Supported types:

SINGLE

- Exact match required
- Full score or zero

MULTIPLE

- Exact match required
- No partial scoring (v1)
- Full score or zero

TRUE_FALSE

- Boolean match

ARRANGEMENT

- Exact ordered match required

Score formula:

total_score = SUM(question_score WHERE correct)

No negative scoring in v1.

---

## Traditional Grading Rules

Supported types:

TRUE_FALSE

- Auto-graded

FILL_BLANK

- Exact match comparison
- Case normalization optional

SHORT_ANSWER

- Self-evaluated (v1)
- Student selects correct/incorrect based on criteria
- Awarded score stored explicitly
- Raw answer stored
- self_correction_flag stored

Future AI grading:

- Must append grading revision record
- Must not overwrite original score without audit entry
- Must preserve grading history

---

## Score Aggregation

For every attempt:

1. Calculate per-question score.
2. Sum to total_score.
3. Compute percentage:

   percentage = (total_score / total_possible_score) \* 100

4. Determine pass/fail:

If pass_type = PERCENTAGE: percentage >= pass_value

If pass_type = SCORE: total_score >= pass_value

5. Persist:

- total_score
- percentage
- passed (boolean)
- graded_at timestamp
- grading_version (engine version)

---

## Scheduled Exam Handling

If submission triggered by:

Manual submit → normal grading  
Auto-submit (time expired) → normal grading

Attempt must store:

- forced_submission (boolean)
- forced_reason (TIME_EXPIRED | CONNECTION_LOSS | ADMIN_FORCE)

Late submission must be rejected before grading begins.

---

## Immutability Rules

After grading completes:

- Attempt status → GRADED
- Answers locked
- Score locked
- Pass/fail locked

No mutation allowed except:

Future admin override with:

- override_reason
- override_user_id
- override_timestamp
- override_audit_entry

Direct score mutation is prohibited.

---

## Transactional Guarantee

Submission flow must:

1. Lock attempt row (SELECT FOR UPDATE)
2. Validate status = ACTIVE
3. Compute grading
4. Persist results
5. Change status to GRADED
6. Commit transaction

No partial grading state allowed.

---

## Determinism Guarantee

Given:

- Same snapshot
- Same answers
- Same grading rules

Result must always be identical.

No random logic allowed during grading.

---

## Observability Requirements

Each grading execution must log:

- workspace_slug
- attempt_id
- exam_id
- total_score
- passed
- grading_duration_ms
- correlation_id

Errors must be structured.

---

## Failure Conditions

Submission must fail if:

- Attempt already graded
- Snapshot corrupted
- Missing question mapping
- Score overflow
- Division access mismatch
- License invalid

Return structured error codes.

---

## Validation Checklist

Stage complete when:

- MCQ grading validated across all types
- Traditional grading validated
- Pass/fail consistent with snapshot
- Auto-submit correctly graded
- Regrading impossible without override
- Transaction rollback verified
- Load test validates concurrency safety

---

## Stability Principle

Grading determines academic trust.

If grading references live config, is non-deterministic, or mutable without audit, the platform
loses institutional credibility.

This stage must be verified before runtime submission flow (Phase 04_RUNTIME).

Next: STAGE_41_ATTEMPT_SCHEMA
