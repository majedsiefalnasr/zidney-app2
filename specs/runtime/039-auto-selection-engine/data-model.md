# Data Model: Auto Selection Engine (Stage 39)

Generated: 2026-04-02
Branch: spec/039-auto-selection-engine

## Schema Impact Summary

Master DB:

- No changes.

Tenant DB (planned additive changes):

- attempts: add deterministic selection metadata support in immutable snapshot payload and diagnostics fields if needed.
- mcq_exam_auto_criteria: support dual counting mode (percentage or fixed_count) and additional optional filters.
- attempt_questions: ensure immutable per-attempt question persistence table exists with uniqueness guarantees.

## Entity: SelectionCriteriaBlock

Purpose:
Defines one automatic selection rule block under an exam configuration.

Fields:

- id: uuid
- exam_id: uuid (required)
- percentage: int nullable, range 0..100
- fixed_count: int nullable, min 1
- lesson_ids: uuid[] nullable
- category_ids: uuid[] nullable
- category_value_ids: uuid[] nullable
- tag_ids: uuid[] nullable
- basket_ids: uuid[] nullable
- semester_id: uuid nullable
- order_index: int required, min 0
- created_at: timestamptz
- updated_at: timestamptz

Validation rules:

- Exactly one counting mode must be set: percentage xor fixed_count.
- At least one block must exist for AUTOMATIC mode exams.
- Sum of criteria counts must match exam total_questions after normalization.
- Publish is blocked if overlap risk can undersize final unique set.

## Entity: EligibleQuestionPool (Derived)

Purpose:
Runtime candidate question IDs computed per criteria block after mandatory and optional filter application.

Derived fields:

- criteria_block_id: uuid
- candidate_ids: uuid[] sorted ascending
- candidate_count: int
- filtered_out_reason_summary: json object optional

Notes:

- Not persisted as primary table in Stage 39.
- Must be computed from tenant-scoped data only.

## Entity: SelectionExecution

Purpose:
Represents one deterministic auto-selection run for an attempt.

Fields:

- attempt_id: uuid
- exam_id: uuid
- selection_seed: string
- criteria_count: int
- selected_total_count: int
- duplicate_eliminations: int
- executed_at: timestamptz
- execution_duration_ms: int

Validation rules:

- Executed exactly once per attempt start flow.
- Aborted on any insufficiency or uniqueness mismatch.

## Entity: AttemptSelectionSnapshot

Purpose:
Immutable attempt-level record of final selected set and deterministic replay context.

Storage target:

- attempts.question_snapshot and related immutable snapshot fields.

Snapshot fields (minimum):

- selected_question_ids: uuid[]
- selection_seed: string
- criteria_summary: array of block-level counts/filters
- manual_question_ids: uuid[]
- auto_selected_question_ids: uuid[]

Immutability rule:

- Never recomputed or mutated after attempt is created.

## Entity: AttemptQuestionAssignment

Purpose:
Frozen row-level question assignments per attempt in final display order.

Fields:

- id: uuid
- attempt_id: uuid
- question_id: uuid
- order_index: int
- criteria_block_id: uuid nullable
- question_snapshot: jsonb optional (if question freezing requires row-level copy)
- created_at: timestamptz

Constraints:

- unique(attempt_id, question_id)
- unique(attempt_id, order_index)

## Entity: SelectionFailureEvent

Purpose:
Structured failure object returned/logged when selection cannot safely proceed.

Fields:

- code: string
- message: string
- exam_id: uuid
- attempt_id: uuid nullable
- correlation_id: string
- workspace_slug: string
- criteria_block_id: uuid nullable
- required_count: int nullable
- available_count: int nullable
- occurred_at: timestamptz

## Relationships

- One Exam -> many SelectionCriteriaBlock
- One Attempt -> one SelectionExecution
- One Attempt -> one AttemptSelectionSnapshot
- One Attempt -> many AttemptQuestionAssignment
- One SelectionExecution -> zero or many SelectionFailureEvent (only on failure path)

## State Transitions

Criteria lifecycle:

- DRAFT_CONFIGURED -> VALIDATED -> PUBLISH_BLOCKED or PUBLISH_READY

Attempt selection lifecycle:

- START_REQUESTED -> SELECTING -> FAILED or SNAPSHOT_PERSISTED -> ACTIVE

Rules:

- Transition to ACTIVE requires SNAPSHOT_PERSISTED success.
- FAILED transition must leave no partial AttemptQuestionAssignment rows.

## Index and Performance Notes

Required index coverage for selection queries:

- question subject scope and workflow status
- division visibility scope
- lesson/category/category_value mappings
- tag and basket junction mappings

Required index coverage for persistence:

- attempt_questions(attempt_id)
- attempt_questions(attempt_id, question_id) unique
- attempt_questions(attempt_id, order_index) unique
