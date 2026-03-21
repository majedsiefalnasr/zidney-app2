# Security Checklist: Lessons

**Purpose**: Validates that security-related requirements in the Lessons spec are complete, unambiguous, consistent, and measurable — not that the implementation is correct.
**Created**: 2026-03-21
**Feature**: [specs/runtime/029-lessons/spec.md](../spec.md)

---

## Tenant Isolation Requirements

- [ ] CHK001 — Is the tenant DB client binding requirement stated precisely enough? The spec names `c.get('tenant').pool` [Spec §Tenant Isolation] — does it explicitly prohibit falling back to a global singleton anywhere, including in the service layer? [Clarity, Spec §Tenant Isolation]
- [ ] CHK002 — Are tenant isolation requirements stated for ALL five route handlers (list, create, get, update, soft-delete), or only at the middleware level? Is per-handler mention necessary or is the middleware guarantee sufficient? [Completeness, Spec §Tenant Isolation]
- [ ] CHK003 — Does the spec forbid any direct import or use of a global DB singleton in the lesson domain packages? [Completeness, Gap]

## Cross-Tenant Information Leakage Prevention

- [ ] CHK004 — Is 404-masking explicitly required for cross-tenant `subject_id` lookups in POST /lessons (US-01, SC-4), GET /lessons/:id (US-03, SC-3), PATCH /lessons/:id, and DELETE /lessons/:id? Are all four write/read handlers covered, or only POST? [Completeness, Spec §US-01 SC-4, Spec §US-03 SC-3]
- [ ] CHK005 — Is the spec explicit that 404-masking must mask both "does not exist" and "belongs to another tenant" as the same response code, to prevent enumeration attacks? [Clarity, Spec §US-01 SC-4]
- [ ] CHK006 — Are requirements for cross-tenant `subject_id` leakage in the list endpoint defined? If `subject_id` is supplied that belongs to another tenant, is the expected response (empty list vs. 404) documented? [Gap, Spec §US-02]

## License Middleware Chain

- [ ] CHK007 — Are all four license states (`ACTIVE`, `SOFT_LOCKED`, `ARCHIVED`, `NOT_FOUND`) mapped to specific HTTP responses in the spec? [Completeness, Spec §License Middleware]
- [ ] CHK008 — Is the ordering requirement (tenant resolver → license middleware → permission check → handler) stated explicitly as an invariant that must not be altered? [Clarity, Spec §License Middleware]
- [ ] CHK009 — Is the `LICENSE_LOCKED` (423) response defined for read endpoints (GET) as well, or only write endpoints? The spec error table under POST shows 423 — is the same state documented for GET routes? [Completeness, Gap]

## Permission Validation Requirements

- [ ] CHK010 — Is the OR semantics of `question_manage` **OR** `subject_manage` unambiguously stated (not AND) for write endpoints? [Clarity, Spec §Permission Requirements]
- [ ] CHK011 — Is the permission requirement for read endpoints (GET) explicitly scoped to "any authenticated Backoffice user with workspace access" — and is "authenticated" defined (session token + license) and not left implicit? [Clarity, Spec §Permission Requirements]
- [ ] CHK012 — Is there a requirement that permission validation occurs in middleware (pre-handler) rather than inside the handler itself? The spec does not explicitly require this separation. [Gap]
- [ ] CHK013 — Is the 403 `FORBIDDEN` error code defined for PATCH and DELETE handlers in the error code registry? The registry includes it [Spec §Error Code Registry] — but is it traceable to both PATCH and DELETE error tables? [Consistency, Spec §PATCH /lessons/:id, Spec §DELETE /lessons/:id]

## Error Response Security

- [ ] CHK014 — Does the spec explicitly prohibit stack traces, file paths, or internal diagnostic data from appearing in error responses? The error contract shows `code + message` only [Spec §Error Handling] — is the prohibition on additional fields stated as a requirement? [Clarity, Gap]
- [ ] CHK015 — Is the maximum permissible content of the `message` field defined? Is there a requirement that messages are user-facing and do not embed query strings, table names, or environment details? [Gap]
- [ ] CHK016 — Is the `LESSON_HAS_DEPENDENT_CONTENT` (422) error code requirement scoped correctly? The spec notes it is for "if a hard-delete path is ever exposed" [Spec §Error Code Registry] — is this contingency requirement clearly gated and not ambiguously triggered? [Clarity, Spec §Error Code Registry]

## Input Validation Requirements

- [ ] CHK017 — Are maximum length constraints defined for all mutable fields? The spec defines `name` (255), `code` (100) [Spec §Validation Rules] — is `description` max length intentionally unbounded or is this a gap? [Completeness, Spec §Validation Rules]
- [ ] CHK018 — Is the `subject_id` immutability requirement (BR-01) stated as a security boundary (prevents subject reassignment across contexts) rather than only as a business rule? [Completeness, Spec §BR-01]
- [ ] CHK019 — Is the prohibition on `subject_id` in PATCH body documented as a schema-level rejection (field stripped or schema error) rather than a silent ignore? [Clarity, Spec §PATCH /lessons/:id, Spec §updateLessonBodySchema]
- [ ] CHK020 — Is the minimum presence requirement for PATCH (at least one field must be provided) stated clearly with its error response code? [Clarity, Spec §updateLessonBodySchema]
- [ ] CHK021 — Is UUID format validation for `id` path parameter and `subject_id` required explicitly, including the error response for malformed UUIDs (422 `VALIDATION_ERROR`)? [Completeness, Spec §lessonParamsSchema]

## Audit Field Integrity

- [ ] CHK022 — Is there an explicit requirement that `created_by` and `updated_by` are sourced exclusively from the authenticated session context, and that any `created_by`/`updated_by` supplied in the request body must be rejected? [Gap]
- [ ] CHK023 — Is `created_at`/`updated_at` server-authoritative requirement stated for all write paths? The spec declares this in the Constitutional Compliance Declaration [Spec §Constitutional Compliance] but not repeated in the validation schema — is this gap intentional? [Completeness, Spec §Constitutional Compliance]
- [ ] CHK024 — Is the `ON DELETE SET NULL` behavior for `created_by`/`updated_by` when a user is removed documented as a data-integrity requirement rather than only as a schema note? [Completeness, Spec §Data Model]

## SQL Injection Prevention

- [ ] CHK025 — Does the spec state parameterized queries or ORM-enforced query building as a mandatory requirement, or is it only implied by Drizzle ORM usage? [Gap]
- [ ] CHK026 — Is there a requirement that the `search` query parameter (partial case-insensitive match) is sanitized or handled via parameterized `ILIKE` — not string concatenation? [Gap, Spec §GET /lessons]

## Notes

- Check items off as completed: `[x]`
- `[Gap]` = requirement is missing from the spec and should be added
- `[Clarity]` = requirement exists but needs more precise language
- `[Completeness]` = requirement is partially covered but scope is incomplete
- `[Consistency]` = requirement exists in one place but contradicts or omits another
