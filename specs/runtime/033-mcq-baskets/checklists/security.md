# Security Checklist: MCQ Baskets

**Purpose**: Validate security requirement quality — completeness, clarity, consistency, and coverage of all security-relevant requirements in the MCQ Baskets specification.
**Created**: 2026-03-23
**Feature**: [spec.md](../spec.md)
**Stage**: `STAGE_33_MCQ_BASKETS`
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`

> **Perspective**: These items are **unit tests for the security requirements as written** — they validate whether the spec adequately specifies security properties, not whether the implementation passes security tests.

---

## Tenant Isolation Requirements

- [ ] CHK001 - Are tenant isolation requirements explicitly stated for every individual endpoint (CRUD, link/unlink, workflow transition, deletion guard), or only asserted globally at the feature level? [Clarity, Spec §Isolation Impact Analysis]
- [ ] CHK002 - Is the requirement that basket ID path parameters (`:id`) are always resolved within the requesting tenant's DB — never by cross-workspace ID lookup — explicitly stated, or only implied by "structurally impossible"? [Clarity, Spec §Isolation Impact Analysis]
- [ ] CHK003 - Are the deletion guard queries (exam config reference check and auto-selection rule reference check) explicitly required to be scoped to the tenant DB, not the master DB? [Completeness, Spec §DELETE /workspace/:slug/mcq-baskets/:id]
- [ ] CHK004 - Is the requirement that a basket ID belonging to another tenant returns `404 BASKET_NOT_FOUND` (not `403 FORBIDDEN`) specified to prevent information disclosure across tenant boundaries? [Gap]
- [ ] CHK005 - Are basket-question link operations required to validate that `questionId` belongs to the same tenant DB pool as the basket, rather than any globally unique UUID? [Completeness, Spec §POST /questions]

---

## Authorization & RBAC Requirements

- [ ] CHK006 - Are permission requirements specified individually for each of the 8 API endpoints, with explicit RBAC permission name(s) listed? [Completeness, Spec §API Endpoints]
- [ ] CHK007 - Are workflow transition permission requirements specified per individual transition step (not just globally), and are these mappings registered as spec-level requirements or only as implementation hints? [Completeness, Spec §Clarifications — Session 2026-03-23]
- [ ] CHK008 - Is the requirement that `status` cannot be mutated via the PATCH endpoint framed as an authorization/security constraint (not just a business rule), to ensure the enforcement cannot be bypassed? [Coverage, Spec §FR-004]
- [ ] CHK009 - Is the ordering of middleware execution (tenant resolver → license middleware → permission check → handler) specified as a hard requirement, ensuring that authorization cannot precede tenant resolution? [Completeness, Spec §API Overview]
- [ ] CHK010 - Is it specified whether permission checks occur before or after basket existence checks — and which failure takes precedence when both apply simultaneously (to prevent permission-oracle disclosure)? [Clarity, Gap]
- [ ] CHK011 - Are permission requirements for the `GET /workspace/:slug/mcq-baskets/:id/questions` endpoint consistent with the basket list endpoint's permission model? [Consistency, Spec §GET /questions vs. GET /mcq-baskets]
- [ ] CHK012 - Are backward workflow transition attempts (e.g., `ENABLED → APPROVED`) specified to return `400 INVALID_STATE_TRANSITION` consistently, and is the rejection enforced at the workflow engine — not only at the application layer — stated as a requirement? [Completeness, Spec §FR-005, Clarifications]

---

## Input Validation Requirements

- [ ] CHK013 - Is the `code` field fully validated beyond "non-empty": are maximum length (VARCHAR(100)), allowed character set, and disallowed patterns (e.g., whitespace-only, SQL metacharacters) specified? [Clarity, Spec §Data Model — code VARCHAR(100)]
- [ ] CHK014 - Is the `name` field validated beyond "non-empty": is the maximum length (VARCHAR(255)) enforced at the API layer as a validation rule, not only at the DB constraint layer? [Clarity, Spec §Data Model]
- [ ] CHK015 - Are injection attack prevention requirements specified for the `search` query parameter, which performs a partial match (ILIKE) on `name` and `code` columns? [Gap]
- [ ] CHK016 - Is UUID format validation required for all UUID-typed path parameters (`:id` on baskets, `:questionId` on unlink), returning `422 VALIDATION_ERROR` rather than a raw DB error for malformed UUIDs? [Gap]
- [ ] CHK017 - Is the rejection of `maxQuestions = 0` or negative integers specified with a clear lower-bound rule (`maxQuestions` MUST be a positive integer when provided), and does the spec define the exact validation error case? [Completeness, Spec §Acceptance Scenarios — Story 1, Scenario 3]
- [ ] CHK018 - Are `page` and `per_page` query parameters validated with bounds (e.g., `page >= 1`, `1 <= per_page <= 100`), and are the error responses for out-of-range values defined? [Gap]
- [ ] CHK019 - Is client-supplied timestamp rejection (FR-019) specified as a strict input validation rule with `422 VALIDATION_ERROR` on any request body containing `createdAt` or `updatedAt` fields? [Clarity, Spec §FR-019]
- [ ] CHK020 - Are requirements specified to strip or reject unexpected additional fields in request bodies (strict schema validation), to prevent parameter pollution or mass-assignment vulnerabilities? [Gap]
- [ ] CHK021 - Is the `type` field required to reject any value other than `LINKED` or `UNLINKED` at the API validation layer (not only at the DB CHECK constraint), with a defined error code? [Completeness, Spec §Acceptance Scenarios — Story 1, Scenario 5]

---

## Rate Limiting Requirements

- [ ] CHK022 - Are rate limit thresholds specified for both the write tier (≤ 30 req/min) and the read tier (≤ 120 req/min) with explicit mapping of which endpoints belong to which tier? [Clarity, Spec §Constitutional Compliance, Clarifications]
- [ ] CHK023 - Is the rate limiting scope defined as per-workspace (not per-user or per-IP) for all basket endpoints, and is this scope consistent with other platform API rate limit scoping? [Completeness, Spec §Constitutional Compliance — "per workspace"]
- [ ] CHK024 - Are `429 Too Many Requests` responses included in the error cases tables for basket endpoints, and is the error response shape compliant with the Zidney error contract? [Coverage, Gap]
- [ ] CHK025 - Is the workflow transition endpoint (`POST /workflow/transition`) classified under the write rate limit tier (≤ 30 req/min), given its state-mutating nature? [Completeness, Gap]

---

## License Enforcement Requirements

- [ ] CHK026 - Are all three non-ACTIVE license state mappings specified unambiguously: `SOFT_LOCKED → 423`, `ARCHIVED → 403`, `NOT_FOUND → 404`? [Completeness, Spec §License & Version Enforcement]
- [ ] CHK027 - Is it explicitly required that license middleware executes BEFORE the route handler — not inline within handler logic — for all 8 basket endpoints, including the workflow transition endpoint? [Clarity, Spec §License & Version Enforcement]
- [ ] CHK028 - Is schema version mismatch handling (`409 SCHEMA_VERSION_MISMATCH`) specified for all basket routes when the tenant's DB schema is below `MIN_SCHEMA_VERSION` for this stage? [Completeness, Spec §License & Version Enforcement]
- [ ] CHK029 - Is the error response shape for license rejection errors (423, 403, 409 from middleware) required to conform to the Zidney error contract `{ success, data, error }`? [Consistency, Spec §FR-022]

---

## Error Contract & Information Disclosure

- [ ] CHK030 - Is the error contract `{ success: boolean, data: object | null, error: { code, message } | null }` applied consistently across all endpoints, including middleware-rejected responses (license, rate limit, schema version)? [Consistency, Spec §FR-022]
- [ ] CHK031 - Are requirements specified to ensure error messages do not expose internal system details (e.g., raw SQL error messages, internal stack traces, or pool identifiers) in any error response? [Gap]
- [ ] CHK032 - Is the distinction between `404 BASKET_NOT_FOUND` and `403 FORBIDDEN` clearly specified for all endpoints — ensuring that a valid basket in another tenant always returns `404`, not `403`? [Clarity, Gap]
- [ ] CHK033 - Are structured logging requirements defined for all security-relevant events: failed authorization, invalid workflow transitions, deletion guard rejections, duplicate code conflicts, and license rejections? [Gap]
- [ ] CHK034 - Are audit trail requirements specified for workflow state transitions, capturing at minimum: actor (user ID), source state, target state, timestamp, and basket ID? [Gap]

---

## Deletion Guard Security Requirements

- [ ] CHK035 - Are the deletion guard queries required to be strictly tenant-scoped — explicitly preventing cross-tenant exam config or auto-selection rule lookups that could produce false negatives? [Completeness, Spec §DELETE /workspace/:slug/mcq-baskets/:id]
- [ ] CHK036 - Is the requirement that ALL reference statuses (including DRAFT) block deletion explicitly stated as a security-correctness requirement, not merely a business rule? [Completeness, Spec §FR-011, Clarifications]
- [ ] CHK037 - Is race condition handling specified for a concurrent delete + new exam config creation that references the same basket ID within the same transaction window? [Gap]
- [ ] CHK038 - Is the atomicity requirement for basket deletion (basket row + mcq_basket_questions rows removed together) specified with explicit transaction boundary requirements? [Completeness, Spec §FR-021]

---

## Idempotency & Duplicate Handling

- [ ] CHK039 - Is the duplicate link behavior (`409 BASKET_QUESTION_DUPLICATE`) specified as enforced at BOTH the application pre-check layer AND the database `UNIQUE(basket_id, question_id)` constraint, to prevent TOCTOU race conditions? [Completeness, Spec §Clarifications — Session 2026-03-23]
- [ ] CHK040 - Is the basket code uniqueness enforcement specified as enforced at BOTH the application layer AND the database `UNIQUE(code)` constraint, to prevent concurrent creation of duplicate codes? [Completeness, Spec §FR-002]
- [ ] CHK041 - Is the `409 BASKET_CODE_DUPLICATE` error response required for concurrent create/update requests that race to register the same code, not only for sequential duplicate attempts? [Gap]
