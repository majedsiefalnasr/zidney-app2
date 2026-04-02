# Contract: Auto Criteria Validation for Save and Publish

Scope:

- Backoffice MCQ exam configuration validation for AUTOMATIC and hybrid selection.
- Applies on criteria save/update and workflow transitions that publish/enable exam configs.

## Inbound Operations

Applies to:

- create/update automatic criteria blocks
- exam publish/enable transitions where criteria integrity must be revalidated

Versioned endpoints (v1):

- PUT /api/v1/workspace/:slug/exams/:examId/auto-criteria
- POST /api/v1/workspace/:slug/exams/:examId/auto-criteria/validate
- POST /api/v1/workspace/:slug/exams/:examId/publish

## Validation Rules

1. Each criteria block must define exactly one counting mode:
   - percentage, or
   - fixed_count
2. Aggregated selected count across criteria must match exam total_questions.
3. Overlap risk must be analyzed before publish:
   - If overlap can undersize final unique selected set, publish is blocked.
4. Criteria referencing optional filter dimensions must use tenant-valid IDs.
5. Validation must run server-side only and must not trust UI prechecks.

## Success Response

HTTP 200

Body:
{
success: true,
data: {
exam_id: string,
validation_status: "VALID",
criteria_block_count: number,
expected_total_questions: number,
computed_total_questions: number
},
error: null
}

## Failure Response

HTTP 422 or 409

Body:
{
success: false,
data: null,
error: {
code: string,
message: string
}
}

Validation error codes:

- AUTO_SELECTION_INVALID_CRITERIA (422)
- AUTO_SELECTION_COUNT_MISMATCH (422)
- AUTO_SELECTION_OVERLAP_UNDERSIZED (409)
- AUTO_SELECTION_UNSUPPORTED_FILTER_REFERENCE (422)

Status mapping summary:

- 422: semantic criteria validation failures
- 409: overlap/uniqueness conflict failures that block publish

## Transaction Contract

- Save/publish mutation must be atomic with validation.
- If validation fails, no partial criteria status mutation is persisted.

## Audit and Logging Contract

Validation events include:

- correlation_id
- workspace_slug
- exam_id
- criteria_block_count
- overlap_risk_detected (boolean)
- blocking_reason_code (nullable)
