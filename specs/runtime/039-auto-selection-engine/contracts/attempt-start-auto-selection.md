# Contract: Attempt Start with Auto Selection

Scope:

- Runtime attempt start flow for automatic and hybrid question-selection exams.
- Applies before attempt status becomes ACTIVE.

## Inbound Trigger

Primary endpoint:

- POST /api/v1/workspace/:slug/attempts

Scheduled variant integration:

- POST /api/v1/workspace/:slug/scheduled-exams/:scheduledExamId/attempts

Preconditions:

- Tenant resolved and license validated.
- Authenticated user with runtime access.
- Exam is in a runtime-eligible status.
- schema_version and product_version compatibility checks already passed.
- `Idempotency-Key` header provided for mutation replay safety.

## Selection Behavior Contract

1. Selection executes exactly once per attempt creation request.
2. Request replay handling is idempotent:

- same `Idempotency-Key` + same payload returns the original success response
- same `Idempotency-Key` + different payload returns conflict

3. Selection executes inside the same transaction as attempt persistence.
4. Manual question IDs are fixed first (hybrid mode), auto-selected IDs must exclude them.
5. Candidate pool insufficiency aborts transaction and returns structured failure.
6. Final persisted set must have:
   - exactly configured total question count
   - no duplicate question IDs
   - deterministic replay seed persisted in snapshot data

## Success Response

HTTP 201

Body:
{
success: true,
data: {
attempt_id: string,
exam_id: string,
status: "IN_PROGRESS",
selected_question_count: number,
manual_question_count: number,
auto_question_count: number,
selection_seed: string,
started_at: string
},
error: null
}

## Failure Response

HTTP 4xx/5xx depending on class

Body:
{
success: false,
data: null,
error: {
code: string,
message: string
}
}

Selection-specific error codes:

- AUTO_SELECTION_INSUFFICIENT_POOL (422)
- AUTO_SELECTION_INVALID_CRITERIA (422)
- AUTO_SELECTION_OVERLAP_UNDERSIZED (409)
- AUTO_SELECTION_DUPLICATE_CONFLICT (409)
- AUTO_SELECTION_SELECTION_ABORTED (500)
- ATTEMPT_START_IDEMPOTENCY_CONFLICT (409)

Status mapping summary:

- 422: semantic validation or pool sufficiency failures
- 409: uniqueness, overlap, or idempotency conflict failures
- 500: unexpected internal selection abort

Compatibility and versioning:

- All attempt-start variants for this stage are under `/api/v1/workspace/:slug/...`.
- schema_version and product_version middleware checks execute before handler logic.

## Observability Contract

Each attempt selection execution emits structured logs with:

- correlation_id
- workspace_slug
- exam_id
- attempt_id (once created)
- selection_seed
- criteria diagnostics (required vs available counts)
- execution_duration_ms
- result (success or failure code)
