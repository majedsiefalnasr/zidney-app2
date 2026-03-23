# Security Requirements Checklist: Tags (STAGE 32)

**Purpose**: Validate that security requirements for the Tags feature are complete, unambiguous, consistently specified, and ready for implementation  
**Created**: 2026-03-23  
**Feature**: [spec.md](../spec.md)  
**Stage**: `STAGE_32_TAGS`  
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`

---

## Input Validation Requirements

- [ ] CHK001 - Are input validation requirements defined for all writable fields (`name` on create/update; `tagId`, `entityType`, `entityId` on assignment) across all tag write endpoints? [Completeness, Spec §FR-005, FR-007, FR-008]
- [ ] CHK002 - Is the maximum length for `name` explicitly specified, or is reliance on platform VARCHAR defaults documented as a conscious assumption? [Clarity, Spec §Assumptions]
- [ ] CHK003 - Are whitespace-only and empty-string rejection rules for `name` explicitly stated as occurring before normalization is applied? [Completeness, Spec §FR-005]
- [ ] CHK004 - Is the allowed value set for `entityType` exhaustively enumerated (`MCQ_QUESTION`, `TRADITIONAL_QUESTION`, `LIBRARY_FILE`), and is the structured error for invalid values (`TAG_RELATION_INVALID_ENTITY_TYPE` → 422) clearly mapped? [Completeness, Spec §FR-007, Error Code Registry]
- [ ] CHK005 - Are UUID format validation requirements defined for `tagId` and `entityId` input fields on the tag assignment endpoint? [Gap]
- [ ] CHK006 - Is the application-layer validation of `entityType` designated as PRIMARY and authoritative over the DB `CHECK` constraint, with the DB constraint documented as a safety backstop only? [Clarity, Spec §Clarifications]
- [ ] CHK007 - Are `VALIDATION_ERROR` responses required to include field-level error detail (not solely a top-level message)? [Completeness, Spec §Error Code Registry]
- [ ] CHK008 - Is the `normalized_name` derivation rule (lowercase + trim, server-side only, never client-supplied) unambiguously specified to prevent client injection of crafted normalized values? [Completeness, Spec §Data Model, FR-003]

---

## Error Contract Requirements

- [ ] CHK009 - Is the platform error envelope `{ success: false, data: null, error: { code, message } }` required without exception for ALL error responses, including 4xx and 5xx? [Completeness, Spec §Error Code Registry]
- [ ] CHK010 - Are all custom error codes (`TAG_DUPLICATE`, `TAG_DISABLED`, `TAG_HAS_RELATIONS`, `TAG_RELATION_DUPLICATE`, `TAG_RELATION_ENTITY_NOT_FOUND`, `TAG_RELATION_INVALID_ENTITY_TYPE`, `TAG_NOT_FOUND`, `TAG_RELATION_NOT_FOUND`) registered with correct HTTP status codes? [Coverage, Spec §Error Code Registry]
- [ ] CHK011 - Is the requirement to return `409 TAG_RELATION_DUPLICATE` (not a silent success or 200) for duplicate tag assignment explicitly stated? [Completeness, Spec §FR-009]
- [ ] CHK012 - Does the spec require that PostgreSQL `23505` unique constraint violations (concurrent collision during tag create or rename) are caught and translated to `409 TAG_DUPLICATE` — not exposed as raw DB errors? [Completeness, Spec §Clarifications]
- [ ] CHK013 - Does the spec require that PostgreSQL `23514` CHECK constraint violations (entity type bypass) are caught and translated to `422 TAG_RELATION_INVALID_ENTITY_TYPE` — not exposed as raw DB errors? [Completeness, Spec §Clarifications]
- [ ] CHK014 - Are license enforcement error responses (`423`, `403 ARCHIVED`, `404 NOT_FOUND`) specified with correct HTTP status codes and the platform error envelope format? [Coverage, Spec §License & Version Enforcement]
- [ ] CHK015 - Is the `401 Unauthorized` response required for unauthenticated requests explicitly specified for all tag routes, not left implicit? [Completeness, Spec §Access Control]

---

## Access Control Requirements

- [ ] CHK016 - Are permission requirements defined for every tag endpoint in the Access Control table, with no endpoint implicitly unguarded? [Completeness, Spec §Access Control]
- [ ] CHK017 - Is the permission boundary for assigning tags to `LIBRARY_FILE` entities (`content_manage`) clearly distinguished from the permission for assigning to question entities (`question_manage`)? [Clarity, Spec §Access Control]
- [ ] CHK018 - Are permission requirements for read-only endpoints (`GET /tags`, `GET /tags/:id`, list entity tags, list entities for tag) explicitly stated rather than assumed? [Completeness, Spec §Access Control]
- [ ] CHK019 - Is the requirement to enforce tenant scope at the resolver level (before permission checks) stated, preventing cross-tenant access even for users with valid permissions? [Completeness, Spec §Access Control]

---

## Rate Limiting Requirements

- [ ] CHK020 - Are rate limiting requirements defined for the tag creation endpoint (`POST /workspace/:slug/tags`)? [Gap]
- [ ] CHK021 - If rate limiting is required, are thresholds (requests per window duration) quantified with specific numbers? [Clarity, Gap]
- [ ] CHK022 - Is the error response for rate-limit exhaustion (expected HTTP status, error body format conforming to the platform envelope) specified? [Gap]
- [ ] CHK023 - Are rate limiting requirements for the tag assignment endpoint (`POST /workspace/:slug/tag-relations`) defined separately from tag creation? [Gap]

---

## Data Integrity & Lifecycle State Enforcement

- [ ] CHK024 - Is the requirement to enforce `normalized_name` uniqueness at the DB layer (unique index) specified in addition to the application-layer pre-insert check? [Completeness, Spec §Data Model, FR-004]
- [ ] CHK025 - Is the prohibition on assigning a `DISABLED` tag to new entities clearly stated with the required error code (`TAG_DISABLED` → 422), and does the spec confirm that existing relations on a disabled tag are unaffected? [Completeness, Spec §FR-006]
- [ ] CHK026 - Is the hard deletion guard (block `DELETE` when `tag_relations` count > 0) unambiguously specified with the required error code (`TAG_HAS_RELATIONS` → 422)? [Completeness, Spec §FR-010]
- [ ] CHK027 - Is entity existence validation before tag assignment (`TAG_RELATION_ENTITY_NOT_FOUND` → 422) required for all three entity types? [Completeness, Spec §FR-008]
- [ ] CHK028 - Is the self-exclusion rule for `normalized_name` uniqueness on `PATCH` (check must exclude own `id`) specified to prevent false duplicate rejection on a self-rename? [Completeness, Spec §Edge Cases, FR-004]
- [ ] CHK029 - Is it specified that all four tag assignment preconditions (tag exists, tag enabled, entity type valid, entity exists, no duplicate) execute INSIDE the write transaction to eliminate TOCTOU race conditions? [Completeness, Spec §Clarifications, FR-017]

---

## Structured Logging & Audit Requirements

- [ ] CHK030 - Are structured logging requirements defined for tag write operations, including mandatory fields (correlation ID, tenant ID, actor ID, operation name)? [Gap]
- [ ] CHK031 - Is the prohibition on `console.log` (all logging must use the structured logger) explicitly stated in the spec or the Constitutional Compliance table? [Completeness, Spec §Constitutional Compliance]
- [ ] CHK032 - Are the required log fields for error paths (correlation ID included in error-path log entries) specified? [Gap]

---

## Notes

- Items marked `[Gap]` require requirements to be added or explicitly declared out of scope before implementation proceeds.
- CHK029 gates the TOCTOU security requirement (preconditions inside transaction).
- CHK012–CHK013 gate the raw DB error exposure security requirement (catching `23505` / `23514`).
- CHK020–CHK023 are the most significant unresolved security gaps: rate limiting is referenced in the mandatory checklist but not addressed in the current spec.
