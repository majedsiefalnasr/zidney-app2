# Security Checklist: Category Values

**Purpose**: Validate security requirement quality — tenant isolation, access control, input validation, locking, and deletion guards are sufficiently specified for safe implementation
**Created**: 2026-03-22
**Feature**: [spec.md](../spec.md)
**Stage**: `STAGE_31_CATEGORY_VALUES`

---

## Tenant Isolation Requirements

- [ ] CHK001 — Are all category-value queries required to use the per-tenant pool from `c.get('tenant').pool`, with no fallback to a global singleton anywhere in the route chain? [Completeness, Spec §Isolation Impact Analysis]
- [ ] CHK002 — Is the "zero master DB access" requirement for `category_values`, `category_value_subjects`, and `category_value_divisions` explicitly stated and traceable to every query path? [Completeness, Spec §Isolation Impact Analysis]
- [ ] CHK003 — Is the tenant resolution path (subdomain AND path slug) documented as mandatory before any category-value handler executes? [Completeness, Spec §Isolation Impact Analysis]
- [ ] CHK004 — Is the 404 (not 403) information-leakage prevention requirement documented for cross-tenant ID lookups on GET and PATCH? [Clarity, Spec §US-03 scenario 3]
- [ ] CHK005 — Are scope table queries (`category_value_subjects`, `category_value_divisions`) required to be scoped to the resolved tenant, preventing cross-tenant subject/division ID collisions? [Coverage, Spec §Isolation Impact Analysis]
- [ ] CHK006 — Is there a requirement that `workspace_slug` is propagated from the URL, not accepted from the request body, to prevent tenant overriding attacks? [Gap]

## License & Authentication Requirements

- [ ] CHK007 — Are license middleware requirements explicitly specified for ALL five route methods (GET list, POST, GET single, PATCH, DELETE), not just "all category-value routes" in aggregate? [Completeness, Spec §License & Version Enforcement]
- [ ] CHK008 — Are the distinct rejection responses for each license state (`SOFT_LOCKED` → 423, `ARCHIVED` → 403) unambiguously mapped per state and not conflated? [Clarity, Spec §License & Version Enforcement]
- [ ] CHK009 — Is the schema version rejection (409 `SCHEMA_VERSION_MISMATCH` for tenants below `1.15.0`) specified to run before the route handler, not inside it? [Completeness, Spec §License & Version Enforcement]
- [ ] CHK010 — Is the middleware execution order (tenant resolver → license middleware → session auth → `requirePermission`) explicitly declared as the required sequence for all write routes? [Clarity, Spec §Access Control — Permission Check Implementation]

## Input Validation Requirements

- [ ] CHK011 — Is the `category_id` UUID format validation requirement defined with an explicit 422 `VALIDATION_ERROR` rejection, and is this consistently applied on both POST and GET list routes? [Completeness, Spec §Validation Rules]
- [ ] CHK012 — Is the `code` sanitization requirement (no leading/trailing whitespace, URL-safe characters only, max 100 chars) specified with criteria that are objectively testable? [Clarity, Spec §Validation Rules]
- [ ] CHK013 — Is `code` case-insensitive uniqueness requirement tied to a specific normalization rule (`LOWER(code)`) that matches the partial unique index definition? [Consistency, Spec §BR-01, Spec §Data Model]
- [ ] CHK014 — Are all valid status transition pairs enumerated in a machine-verifiable form, not just described narratively? [Completeness, Spec §Status Workflow — Valid Transitions]
- [ ] CHK015 — Is `language_code` validation defined as a runtime check against the workspace language list (not a static compile-time enum), ensuring unsupported languages are rejected with 422 `UNSUPPORTED_LANGUAGE`? [Clarity, Spec §Validation Rules]
- [ ] CHK016 — Are `subject_ids` and `division_ids` array fields specified with a maximum length/count constraint to bound the input size and prevent unbounded DB lookups? [Gap]
- [ ] CHK017 — Is `description` field max length (2000 chars) enforced at the validation layer before reaching the DB, and is this constraint documented as validation (not DB-level only)? [Completeness, Spec §Validation Rules]
- [ ] CHK018 — Is the `search` query parameter max length (100 chars) defined and required to be validated server-side before injecting into a LIKE/ILIKE predicate? [Clarity, Spec §GET /category-values]

## Permission Gating Requirements

- [ ] CHK019 — Is the "flat single-tier permission" decision (`question_manage OR classification_manage`) for ALL write operations, including status transitions, explicitly documented with the rationale that per-transition role gating is out of scope? [Clarity, Spec §Clarifications]
- [ ] CHK020 — Is the distinction between write-only permission requirements and read-only access (any authenticated session) specified clearly enough to prevent accidental permission middleware on GET routes? [Completeness, Spec §Access Control]
- [ ] CHK021 — Is the `include_deleted=true` administrative capability tied to a specific named permission (`classification_manage` or admin role) and not left as an undefined "admin permission"? [Clarity, Spec §Access Control]
- [ ] CHK022 — Is there a requirement that the 403 `FORBIDDEN` response is returned before any DB access occurs (i.e., permission check precedes DB query)? [Coverage, Gap]

## Concurrency & Locking Requirements

- [ ] CHK023 — Is `SELECT FOR UPDATE` specified to apply to ALL status-transition paths, including the bidirectional `ENABLED ↔ DISABLED` toggle, not just forward-progression transitions? [Completeness, Spec §BR-15]
- [ ] CHK024 — Is the `SELECT FOR UPDATE` requirement on the soft-delete path explicitly tied to the reference count check (i.e., lock acquired before the COUNT query, not after)? [Clarity, Spec §BR-15, Spec §Clarifications]
- [ ] CHK025 — Is the decision to use last-write-wins semantics for non-status PATCH operations (no version column or ETag) explicitly documented with justification, so it cannot be misread as a missing requirement? [Completeness, Spec §Clarifications]
- [ ] CHK026 — Are requirements defined for what happens when a `SELECT FOR UPDATE` lock wait times out (e.g., statement timeout → 503 or 409)? [Gap]
- [ ] CHK027 — Is the two-concurrent-DELETE race condition scenario (both pass reference check before either commits) specifically called out as the motivating case for soft-delete locking? [Completeness, Spec §Clarifications]

## Deletion & Referential Integrity Requirements

- [ ] CHK028 — Are the three downstream tables that block soft-delete (`mcq_questions`, `traditional_questions`, `exams`) explicitly enumerated (not just described as "downstream content")? [Completeness, Spec §Deletion Rules]
- [ ] CHK029 — Is the conditional reference-check behavior (skip FK pre-check if downstream table doesn't yet exist, defer to DB constraint) specified with enough precision to prevent accidental omission of the guard? [Clarity, Spec §Deletion Rules, Spec §Assumptions — Assumption 3]
- [ ] CHK030 — Is the 422 `CATEGORY_VALUE_IN_USE` error code consistent with the platform-wide error contract format (`{ success: false, data: null, error: { code, message } }`)? [Consistency, Spec §Error Contract]
- [ ] CHK031 — Is the `ON DELETE RESTRICT` FK constraint on `category_values.category_id → categories.id` documented as the **database-level** backup to the API-level deletion guard, ensuring both layers are present? [Completeness, Spec §BR-05, Spec §Data Model]

## Scope Validation Requirements

- [ ] CHK032 — Is the value-scope-must-be-subset-of-parent-scope rule (BR-06) applied to both the CREATE path and the UPDATE (PATCH) path explicitly? [Completeness, Spec §BR-06]
- [ ] CHK033 — Is the "snapshot" nature of scope validation (parent Category's scope checked at create/update time, not re-validated if parent later changes) explicitly documented as an assumption rather than an unstated behavior? [Completeness, Spec §Assumptions — Assumption 5]
- [ ] CHK034 — Is the behavior when the parent Category has an empty scope restriction (globally available) distinguished from a parent with an explicit scope restriction, in the validation requirement? [Clarity, Spec §BR-06]
- [ ] CHK035 — Is the cross-category `code` reuse policy (same code allowed across different categories, intentional) traceable to a written business rule rather than just a database constraint design? [Completeness, Spec §BR-01, Spec §Clarifications]

## Error Contract Requirements

- [ ] CHK036 — Is the error contract `{ success: boolean, data: object | null, error: { code, message } | null }` consistently required for ALL 5 endpoints across ALL error and success paths (not just listed in a single section)? [Completeness, Spec §Error Contract]
- [ ] CHK037 — Is the distinction between 422 (semantic/business rule failure) and 409 (uniqueness conflict) consistently applied across all error codes, with a documented policy? [Consistency, Spec §API Contracts]
- [ ] CHK038 — Are 404 responses for soft-deleted records specified to return the same error code as "not found" records (`CATEGORY_VALUE_NOT_FOUND`) with no status-leaking difference in the response body? [Clarity, Spec §US-03 scenario 4, Spec §US-06 scenario 3]
- [ ] CHK039 — Is there a stated requirement that the `message` field in error responses is non-empty and human-readable for all defined error codes? [Gap]

## Notes

- CHK001: Must-have. Confirms tenant isolation is unambiguously scoped to `workspace_slug` throughout.
- CHK007: Must-have. License middleware coverage for all 5 routes (GET list, POST, GET single, PATCH, DELETE).
- CHK011–CHK018: Must-have category. Input validation for `category_id`, `code`, and status transitions.
- CHK019–CHK022: Must-have category. Permission gating via `question_manage OR classification_manage`.
- CHK023–CHK027: Must-have category. `SELECT FOR UPDATE` on status transitions and soft-delete; last-write-wins decision on PATCH.
- CHK028–CHK031: Must-have category. Deletion blocked when referenced by questions or exams.
- CHK032–CHK035: Must-have category. Scope filter subset validation (value scope ⊆ parent scope).
- CHK036: Must-have. Error contract `{ success, data, error }` applied uniformly.
