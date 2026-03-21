# Accessibility Checklist: Lessons (API Consumer)

**Purpose**: Validates that consumer-facing API contract requirements in the Lessons spec are complete, unambiguous, and consistent — ensuring the API is usable and clearly specified. This is an API-only stage; there is no UI in scope.
**Created**: 2026-03-21
**Feature**: [specs/runtime/029-lessons/spec.md](../spec.md)

---

## Human-Readable Error Messages

- [ ] CHK001 — Are error messages required to be human-readable prose (not just machine codes)? The spec's error contract shows both `code` and `message` fields [Spec §Error Handling] — but is there a requirement on `message` content quality (e.g., descriptive, actionable)? [Clarity, Spec §Error Handling]
- [ ] CHK002 — Are `message` strings defined or exemplified for each error code in the registry? The registry lists codes and HTTP statuses [Spec §Error Code Registry] but does not specify message text — is this intentional or a gap? [Gap, Spec §Error Code Registry]
- [ ] CHK003 — Are field-level validation error messages specified to identify which field failed and why? The spec requires "descriptive field-level message" for `VALIDATION_ERROR` [Spec §US-01 SC-5] — is the structure of that field-level payload defined in the API contract? [Completeness, Spec §US-01 SC-5]
- [ ] CHK004 — Is the `LESSON_DISABLED` (422) message required to explain what action the consumer must take (re-enable before editing)? [Clarity, Spec §BR-04]

## Pagination Metadata in List Response

- [ ] CHK005 — Are all four pagination metadata fields (`items`, `total`, `page`, `limit`) defined as required in the success response envelope? [Completeness, Spec §GET /lessons Success Response]
- [ ] CHK006 — Is the `total` field specified as the count of all matching records (not just the current page) to allow clients to calculate page count? [Clarity, Spec §GET /lessons Success Response]
- [ ] CHK007 — Is the response structure for an empty result set specified (e.g., `items: []`, `total: 0`, `page: 1`, `limit: 20`)? [Gap]
- [ ] CHK008 — Is the response for `page` beyond the last available page defined? Should it return an empty `items` array with `total` unchanged, or a 404/422? [Gap]

## Consistent Field Naming in JSON Responses

- [ ] CHK009 — Are all JSON response field names consistently defined in the spec as `snake_case`? The response examples show `subject_id`, `created_at`, `updated_by` [Spec §GET /lessons Success Response] — is `snake_case` explicitly documented as the convention for this API, or are there fields that deviate? [Consistency, Spec §GET /lessons Success Response]
- [ ] CHK010 — Are date/time fields consistently required to be ISO 8601 format strings across all endpoints? The spec shows `"ISO8601"` [Spec §GET /lessons Success Response] — is the exact format defined (e.g., UTC, with milliseconds, with `Z` suffix)? [Clarity, Spec §GET /lessons Success Response]
- [ ] CHK011 — Is the `null` vs. omitted field behavior defined for optional fields (`code`, `description`, `created_by`, `updated_by`)? Should consumers treat absent fields and `null` identically, or is explicit `null` required in the response? [Clarity, Spec §GET /lessons Success Response]

## Response Envelope Consistency

- [ ] CHK012 — Is the top-level response envelope (`success`, `data`, `error`) applied consistently for all five endpoints (list, create, get, update, soft-delete)? The spec defines it for most [Spec §Error Handling] — is there a single normative statement ensuring no endpoint deviates? [Consistency]
- [ ] CHK013 — Is it specified that `error` is always `null` on success responses, and `data` is always `null` on error responses? [Clarity, Spec §Error Handling]
- [ ] CHK014 — Is the `data: { "deleted": true }` response for `DELETE /lessons/:id` consistent with the overall envelope pattern? Should this instead return the updated lesson row for auditability? [Consistency, Spec §DELETE /lessons/:id]

## API Discoverability and Consumer Usability

- [ ] CHK015 — Are the query parameter defaults (`page: 1`, `limit: 20`) required to be reflected in the response payload, so consumers know which defaults were applied? [Completeness, Spec §GET /lessons Success Response]
- [ ] CHK016 — Is the `search` parameter's matching behavior (case-insensitive partial match) explicitly documented in the API contract, not only in user story narrative? [Clarity, Spec §US-02 SC-3]
- [ ] CHK017 — Is the response behavior for unknown or extra query parameters (e.g., an unrecognized filter field) specified — should they be silently ignored or cause a 422? [Gap]
- [ ] CHK018 — Are the `ENABLED` and `DISABLED` status string values documented as the only permissible enum members in both request and response contexts? [Completeness, Spec §Data Model, Spec §updateLessonBodySchema]

## Notes

- Check items off as completed: `[x]`
- `[Gap]` = requirement is missing from the spec and should be added
- `[Clarity]` = requirement exists but needs more precise language
- `[Completeness]` = requirement is partially covered but scope is incomplete
- `[Consistency]` = requirement exists in one place but contradicts or omits another
- This is an API-only stage — no UI, keyboard navigation, or WCAG requirements are in scope.
