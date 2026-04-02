# STAGE 39 – Auto Selection Engine

Phase: 04_EXAM_ENGINE_CORE  
Database: Tenant DB  
Runtime: Backend service

---

## Stage Status

Status: IN PROGRESS
Step: analyze
Risk Level: HIGH
Last Updated: 2026-04-02T14:30:00Z

Drift Analysis: PASSED (all 9 criteria)
Implementation: AUTHORIZED

Scope Authorized:

- Deterministic auto-selection for MCQ exams and assessments (54 atomic tasks)
- Hybrid manual + auto selection with duplicate prevention
- Idempotency-Key semantics for attempt-start replay safety
- Additive tenant-DB migration with all filter-support indexes
- Advisory lock + atomic transaction boundary for concurrent starts
- Full observability contract (10 required fields)

Deferred Scope:

- Advanced optimization path (materialized index/caching) remains out of v1

Architecture Governance Compliance:

- Task set compliant - drift analysis required before implementation

Notes:
Atomic task set generated. Drift analysis gate pending.

---

## Objective

Implement the automatic question selection engine for:

- MCQ Exams
- MCQ Assessments
- Traditional Exams (optional, same engine)

The engine must be:

- Deterministic per attempt
- Snapshot-compatible
- Indexed and performant
- Safe under concurrent load
- Validation-aware (fail fast on misconfiguration)

---

## Core Principles

1. Selection happens exactly once per attempt.
2. Selection is executed inside a transaction.
3. Selected question IDs are persisted immediately.
4. Selection is never recomputed after attempt start.
5. All filtering is server-side only.

The auto-selection engine is a preparation phase for the Attempt Engine.

---

## Execution Timing

Auto selection runs:

- During STAGE_53_ATTEMPT_START_FLOW
- Before attempt status becomes ACTIVE

If selection fails, attempt creation must be aborted.

---

## Supported Filters

Mandatory filters (always applied):

- subject_id
- workflow_status = ENABLED
- division visibility rules
- module type compatibility (MCQ / Traditional)

Optional filters (based on configuration):

- lesson_ids
- category_ids
- category_value_ids
- tag_ids
- basket_ids
- semester_id (if defined)
- manual inclusion list (optional hybrid mode)

All filters must be index-backed.

---

## Configuration Model

Each exam may define one or more criteria blocks:

Example structure:

criteria[]:

- percentage (0–100)
- fixed_count (optional alternative to percentage)
- filters:
  - lessons
  - categories
  - category_values
  - tags
  - baskets

Rules:

- Either percentage OR fixed_count must be defined.
- Total of all criteria must equal configured total_questions.
- Overlapping criteria must be validated to prevent duplicates.

Validation must happen at exam configuration time, not only runtime.

---

## Selection Algorithm (Deterministic)

For each criteria block:

1. Build base query:

   WHERE subject_id = :subject AND workflow_status = 'ENABLED' AND division visibility rules
   satisfied

2. Apply optional filters.

3. Select candidate pool IDs only (SELECT id).

4. Validate candidate pool size >= required_count.

5. Use deterministic randomization:
   - Generate random_seed at attempt start.
   - Use seeded pseudo-random ordering.
   - Never use plain ORDER BY random() in production scale.

6. Select required_count question IDs.

After processing all criteria:

7. Merge selected IDs.
8. Ensure no duplicates.
9. Ensure total count matches expected count.
10. Persist to attempt_questions table.

If any step fails → abort attempt creation.

---

## Deterministic Randomization

Requirements:

- Store random_seed in attempt snapshot.
- Selection must be reproducible for auditing.
- Given same seed and same pool, selection result must match.

Recommended approach:

- Fetch candidate IDs ordered by primary key.
- Apply deterministic shuffle in application layer using seed.
- Slice first N items.

This avoids heavy database-level random sorting.

---

## Attempt Snapshot Persistence

On success:

Insert into:

attempt_questions:

- attempt_id
- question_id
- order_index
- criteria_block_id (optional for analytics)

Also store inside attempt snapshot:

- selected_question_ids
- random_seed
- criteria_summary

After this point, question set is immutable.

---

## Manual + Auto Hybrid Mode

Engine must support:

- Manual question selection
- Auto selection
- Mixed mode

Rules:

- Manual questions inserted first (preserve order if required).
- Auto-selected questions must exclude manual IDs.
- Duplicate prevention required before final insert.

---

## Performance Requirements

Must support:

- 500 concurrent attempt starts
- 50k+ questions in subject pool
- Sub-200ms selection per attempt (target)

Required indexes:

- subject_id
- workflow_status
- division visibility key
- lesson_id
- category_value_id (junction table indexed)
- tag junction indexed
- basket junction indexed

No full-table scans allowed.

---

## Failure Conditions

Abort attempt creation if:

- Candidate pool insufficient
- Duplicate question conflict
- Misconfigured criteria sum
- Division visibility mismatch
- Database timeout
- Schema version mismatch

Errors must be structured and logged with:

- workspace_slug
- exam_id
- attempt_id (if generated)
- correlation_id

---

## Future Optimization Path (Not in v1)

If scale increases:

- Introduce question_search_index materialized table
- Precompute subject buckets
- Redis candidate ID caching
- Pre-shuffled pools per subject

These optimizations must preserve determinism.

---

## Validation Checklist

Stage is complete when:

- Auto selection works for MCQ Exams
- Auto selection works for MCQ Assessments
- Hybrid manual + auto works
- Duplicate questions impossible
- Deterministic replay validated
- Snapshot persistence verified
- Load test passes 500 concurrent attempts

---

## Stability Principle

Auto selection defines exam fairness.

If selection is non-deterministic, duplicated, or inconsistent, institutional trust is compromised.

This engine must be correct before grading logic proceeds.

Next: STAGE_40_GRADING_CORE
