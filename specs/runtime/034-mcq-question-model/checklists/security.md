# Security Requirements Quality Checklist: MCQ Question Model

**Purpose**: Validate completeness, clarity, and consistency of security requirements in the MCQ Question Model spec
**Created**: 2026-03-30
**Feature**: [spec.md](../spec.md)
**Stage**: `STAGE_34_MCQ_QUESTION_MODEL`

## Tenant Isolation (Constitutional Rule)

- [ ] CHK001 - Are tenant isolation requirements explicitly stated for ALL five new tables (mcq_questions, mcq_question_options, mcq_question_categories, mcq_question_tags, mcq_question_baskets)? [Completeness, Spec §Isolation Impact Analysis]
- [ ] CHK002 - Is it specified that zero master DB access is permitted for any MCQ question operation? [Clarity, Spec §Isolation Impact Analysis]
- [ ] CHK003 - Are tenant resolution requirements defined for ALL API endpoints (CRUD + workflow + classification linking)? [Coverage, Spec §API Endpoints]
- [ ] CHK004 - Is the connection pool source explicitly constrained to `c.get('tenant').pool` with no fallback to a global singleton? [Clarity, Spec §Isolation Impact Analysis]
- [ ] CHK005 - Are cross-tenant access prevention mechanisms specified at the database level (separate DB per tenant), not just application level? [Completeness, Spec §Constitutional Compliance]
- [ ] CHK006 - Is it documented that soft-deleted question data remains tenant-scoped and cannot leak through audit trail access? [Gap, Edge Case]

## License & Middleware Enforcement (Constitutional Rule)

- [ ] CHK007 - Are license middleware enforcement requirements specified for ALL workspace question routes, not just a subset? [Coverage, Spec §License & Version Enforcement]
- [ ] CHK008 - Are HTTP response codes for each license state explicitly defined (ACTIVE→allow, SOFT_LOCKED→423, ARCHIVED→403, NOT_FOUND→404)? [Clarity, Spec §License & Version Enforcement]
- [ ] CHK009 - Is the middleware execution order (tenant resolver → license middleware → permission check → handler) consistently specified across all endpoints? [Consistency, Spec §API Endpoints]
- [ ] CHK010 - Is schema version mismatch rejection (409 SCHEMA_VERSION_MISMATCH) specified for tenants below minimum schema version? [Completeness, Spec §License & Version Enforcement]
- [ ] CHK011 - Are requirements defined to prevent middleware bypass via direct handler invocation or route aliasing? [Gap, Constitutional Rule]

## Authentication & Authorization

- [ ] CHK012 - Are permission requirements specified for every individual API endpoint (not just groups)? [Coverage, Spec §API Endpoints]
- [ ] CHK013 - Are the specific permission names (`question_manage`, `content_manage`, `content_review`, `content_read`) consistently used across all endpoint definitions? [Consistency]
- [ ] CHK014 - Are transition-specific permission requirements clearly mapped for each workflow transition step? [Clarity, Spec §Question Workflow Transitions]
- [ ] CHK015 - Is the 403 FORBIDDEN error response defined for every endpoint that requires authorization? [Completeness]
- [ ] CHK016 - Are requirements specified for what happens when a user's permissions change mid-session (e.g., role revoked while editing)? [Gap, Edge Case]
- [ ] CHK017 - Are requirements defined for audit logging of who performed each question operation (create, update, delete, transition, classification)? [Gap, Non-Functional]

## Input Sanitization & Validation

- [ ] CHK018 - Is the HTML whitelist approach for rich text sanitization specified with explicit allowed elements and attributes? [Clarity, Spec §Rich text content sanitization]
- [ ] CHK019 - Are sanitization requirements defined for ALL three rich text fields (question content, option content, explanation)? [Coverage, Spec §Rich text content sanitization]
- [ ] CHK020 - Is it specified that sanitization occurs BEFORE data reaches domain logic or database (at the validation layer)? [Clarity, Spec §Rich text content sanitization]
- [ ] CHK021 - Are XSS prevention requirements explicitly stated (script tag removal, event handler stripping)? [Completeness, Spec §Clarifications]
- [ ] CHK022 - Are input validation requirements defined for ALL non-rich-text fields (UUIDs, enums, booleans, integers)? [Coverage, Gap]
- [ ] CHK023 - Is the maximum content length defined for rich text fields (content, explanation, option content)? [Gap, Clarity]
- [ ] CHK024 - Are requirements specified for rejecting malformed UUIDs in path parameters (questionId, categoryValueId, tagId, basketId)? [Gap, Edge Case]
- [ ] CHK025 - Is it specified how SQL injection is prevented for the `search` query parameter (partial match on content)? [Gap, Spec §GET mcq-questions]
- [ ] CHK026 - Are validation requirements defined for `perPage` parameter boundaries (max: 100) to prevent resource exhaustion? [Completeness, Spec §GET mcq-questions]

## Idempotency (Constitutional Rule)

- [ ] CHK027 - Are idempotency requirements documented for all classification link operations (categories, tags, baskets)? [Completeness, Spec §Constitutional Compliance]
- [ ] CHK028 - Is the UNIQUE constraint behavior for duplicate links specified to return 409 (not 500) consistently across all three join tables? [Consistency, Spec §Constitutional Compliance]
- [ ] CHK029 - Are concurrent classification link operation requirements defined (UNIQUE constraint as the concurrency guard)? [Clarity, Spec §Edge Cases]
- [ ] CHK030 - Is idempotency behavior specified for the DELETE classification endpoints (deleting an already-removed link)? [Gap, Edge Case]

## Transaction Boundaries (Constitutional Rule)

- [ ] CHK031 - Is the single atomic transaction requirement for PATCH operations explicitly defined (metadata + option replacement + validation)? [Completeness, Spec §PATCH mcq-questions]
- [ ] CHK032 - Are rollback requirements specified for ALL failure types within the transaction (validation error, constraint violation, concurrency conflict)? [Coverage, Spec §PATCH mcq-questions]
- [ ] CHK033 - Are transaction boundary requirements defined for POST (create) operations, or only for PATCH? [Gap, Consistency]
- [ ] CHK034 - Are transaction isolation level requirements specified (to prevent dirty reads during concurrent operations)? [Gap, Non-Functional]

## Server-Authoritative Time (Constitutional Rule)

- [ ] CHK035 - Is the server-side timestamp requirement explicitly stated for ALL timestamp fields (created_at, updated_at, status_updated_at)? [Coverage, Spec §Constitutional Compliance]
- [ ] CHK036 - Is it explicitly stated that client-supplied timestamps are rejected (not just ignored)? [Clarity, Spec §FR-017]
- [ ] CHK037 - Is the optimistic concurrency control mechanism specified to use server-set `updated_at`, not client-controlled values? [Consistency, Spec §PATCH mcq-questions]

## Rate Limiting

- [ ] CHK038 - Are rate limit thresholds quantified for write routes (≤30 req/min) and read routes (≤120 req/min)? [Clarity, Spec §Constitutional Compliance]
- [ ] CHK039 - Is it specified that rate limiting applies per-tenant, per-user, or per-IP? [Gap, Clarity]
- [ ] CHK040 - Are rate limiting requirements defined for classification linking endpoints (POST/DELETE for categories, tags, baskets)? [Coverage, Gap]
- [ ] CHK041 - Are rate limit error response codes and format specified for question endpoints? [Gap]

## Deletion Security

- [ ] CHK042 - Are deletion guard requirements explicitly defined for ALL reference types (exam config, scheduled exam, active attempt)? [Coverage, Spec §FR-011]
- [ ] CHK043 - Is the deletion guard check order specified (check active attempts FIRST, then exam references)? [Clarity, Spec §DELETE mcq-questions]
- [ ] CHK044 - Are cascade deletion security implications documented (hard delete removes all options and classification links)? [Completeness, Spec §FR-012]
- [ ] CHK045 - Is it specified that soft-deleted questions are excluded from ALL query surfaces (list, filter, auto-selection, exam composition)? [Coverage, Spec §DELETE mcq-questions]

## Data Integrity

- [ ] CHK046 - Are FK constraint requirements specified for all foreign key references (subjects, divisions, lessons, categories, tags, baskets, users)? [Coverage, Spec §Data Model]
- [ ] CHK047 - Is the ON DELETE CASCADE behavior security-reviewed for all join tables (could cascade from category/tag/basket deletion cause unintended data loss)? [Gap, Edge Case]
- [ ] CHK048 - Are requirements specified for preventing orphaned records when referenced entities (subjects, divisions) are deleted? [Completeness, Spec §Edge Cases]

## Notes

- Constitutional rules validated: tenant isolation, license middleware, idempotency, transaction boundaries, server-authoritative time
- Total items: 48
- Traceability: 44/48 items (91.7%) include spec section or gap markers
