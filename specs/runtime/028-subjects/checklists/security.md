# Security Checklist: Stage 28 — Subjects

**Purpose**: Validate that all security requirements in the Subjects spec are specified with
sufficient completeness, clarity, consistency, and measurability to be implemented and verified
without ambiguity.
**Created**: 2026-03-20
**Feature**: [specs/runtime/028-subjects/spec.md](../spec.md)
**Audience**: Reviewer (PR gate)
**Depth**: Standard — covers all constitutional security rules applicable to this stage.

> **Note**: This checklist is a _unit test for requirements quality_, not an implementation
> verification checklist. Each item asks whether a security requirement is _well-specified_, not
> whether the code passes.

---

## Tenant Isolation Requirements

- [ ] CHK001 — Are the tenant-scoping rules for the `subjects` table stated unambiguously (tenant
      DB only, no shared rows, no cross-tenant joins)? [Completeness, Spec §Isolation Impact Analysis]

- [ ] CHK002 — Is the requirement that `subjects.division_id` and `subjects.semester_id` FKs only
      resolve within the same tenant DB explicitly stated? [Clarity, Spec §Isolation Impact Analysis]

- [ ] CHK003 — Is the cross-tenant 404 pattern (return 404, not 403, to prevent information
      leakage when a resource from another tenant is referenced) documented for every endpoint that
      accepts a resource ID? [Completeness, Spec §User Stories 1.6, 3.3]

- [ ] CHK004 — Is isolation under concurrent load addressed as a verifiable requirement (parallel
      requests from two tenant contexts must produce disjoint datasets)? [Measurability, Spec §Success
      Criteria 8, §Test Strategy]

- [ ] CHK005 — Is the prohibition on passing tenant context via request body documented? No
      `tenant_id` override from the request body is permitted. [Gap — not explicitly stated in spec;
      verify constitutional rule is inherited]

---

## License Middleware Requirements

- [ ] CHK006 — Are all HTTP status codes for non-ACTIVE license states specified with exact values
      (`SOFT_LOCKED → 423`, `ARCHIVED → 403`, `NOT_FOUND → 404`)? [Clarity, Spec §License &
      Version Enforcement]

- [ ] CHK007 — Is the requirement that license middleware executes before _any_ subject business
      logic (not just before DB access) explicitly stated? [Clarity, Spec §License & Version
      Enforcement]

- [ ] CHK008 — Is schema version enforcement (`schema_version >= MIN_SCHEMA_VERSION → 409
SCHEMA_VERSION_MISMATCH`) specified as a middleware-layer gate, not an application-layer
      check? [Clarity, Spec §License & Version Enforcement]

- [ ] CHK009 — Is `product_version` enforcement defined with a specific error response when the
      constraint fails? [Gap — spec states it is enforced but does not define the error code or HTTP
      status for a product version violation]

- [ ] CHK010 — Are rate limit enforcement and license middleware ordered requirements defined?
      (i.e., does license middleware execute before rate-limit checks, or vice versa?) [Gap —
      ordering not stated; ambiguity could affect abuse protection design]

---

## RBAC & Permission Requirements

- [ ] CHK011 — Is the unified `subjects:manage` permission scope unambiguously defined to cover
      all subject operations (CRUD + workflow transitions + soft-delete)? [Clarity, Spec §FR-15,
      §Clarifications 2026-03-20]

- [ ] CHK012 — Is the HTTP status and error code returned for unauthorized users consistently
      specified as `403 Forbidden` across all protected endpoints (create, update, transition,
      delete)? [Consistency, Spec §User Stories 1.9, 5.5, 6.5]

- [ ] CHK013 — Is there a requirement that authenticated users without workspace membership
      (valid JWT, wrong tenant) receive 403 or 404? [Gap — spec defines cross-tenant FK 404 but
      does not address cross-tenant authenticated session access]

- [ ] CHK014 — Is the permission check ordering (tenant resolve → license → RBAC) documented,
      ensuring RBAC never executes before tenant and license are validated? [Completeness, Spec
      §Isolation Impact Analysis, §License & Version Enforcement]

- [ ] CHK015 — Does the spec define what happens when a valid JWT token has expired mid-request
      during a long-running write operation? [Gap — not addressed; potential inconsistency between
      RBAC check at entry and session validity at commit]

---

## Input Validation Requirements

- [ ] CHK016 — Are maximum length constraints specified for all string inputs (`name`: 255,
      `code`: 100, `description`: text, `default_language`: 10)? [Completeness, Spec §Data Model
      Changes — column types imply constraints but validation rules are not explicitly stated at the
      API layer]

- [ ] CHK017 — Is the `name` field validated as non-empty (not just `NOT NULL`)? A whitespace-
      only string would satisfy `NOT NULL` but represents an invalid subject name. [Clarity, Spec
      §FR-01; Gap for whitespace-only values]

- [ ] CHK018 — Is the `code` field validated for allowed character set (e.g., alphanumeric,
      no special characters, no leading/trailing spaces)? [Gap — spec defines uniqueness but not
      character set constraints]

- [ ] CHK019 — Is `default_language` validation against the workspace language settings list
      specified as an API-layer check (not just DB-level)? [Clarity, Spec §FR-03, §User Story
      7.5]

- [ ] CHK020 — Are validation error responses required to include field-level messages (not just
      a global `VALIDATION_ERROR` code), enabling clients to highlight specific invalid fields?
      [Clarity, Spec §User Story 1.4 — "descriptive field-level message" mentioned once but not
      universally required]

- [ ] CHK021 — Is the `division_id` format (UUID) validated before the DB lookup to prevent
      malformed IDs from reaching the query layer? [Gap — not stated; malformed UUIDs would surface
      as DB errors rather than clean 422 responses]

- [ ] CHK022 — Is `description` validated for maximum length or allowed encoding? Text columns
      without a max length can be exploited to insert oversized payloads. [Gap — spec shows `text`
      type but no upper bound or sanitization requirement]

---

## SQL Injection & Injection Prevention Requirements

- [ ] CHK023 — Is the requirement to use parameterized queries (via Drizzle ORM) stated as
      a non-negotiable constraint for all DB interactions, including search and filter parameters?
      [Gap — implied by ORM usage but not explicitly stated as a security requirement]

- [ ] CHK024 — Is the `search` query parameter (case-insensitive name/code matching) specified
      to use parameterized `ILIKE` or equivalent — never string concatenation into SQL? [Completeness,
      Spec §User Story 2.5; security constraint not enumerated]

- [ ] CHK025 — Is there a requirement that filter parameters (`division_id`, `semester_id`,
      `status`) are validated against an allowlist before being applied to queries? [Gap — raw query
      parameters mapped to DB columns without explicit sanitization requirement]

---

## Cross-Tenant 404 Pattern Requirements

- [ ] CHK026 — Is the cross-tenant 404 pattern consistently applied to _all_ ID-accepting
      operations (detail, update, transition, delete)? [Consistency, Spec §User Stories 1.6, 3.3;
      pattern stated in create and detail but not explicitly required on all mutation endpoints]

- [ ] CHK027 — Is the rationale for 404 (not 403) documented as an information-leakage
      prevention requirement, so future contributors understand it is a security decision and not
      an implementation oversight? [Clarity, Spec §User Story 3.3]

- [ ] CHK028 — Does the spec define whether soft-deleted subjects (within the same tenant) return
      404 or 410 Gone? Returning 403 for deleted subjects would leak existence information.
      [Ambiguity, Spec §FR-09, §User Stories 3.2, 6.6]

---

## Rate Limiting Requirements

- [ ] CHK029 — Are rate limit policies specified per endpoint with precise unit and scope
      (requests/minute per _user_, not per IP)? Is user-level enforcement preferred over IP-level
      to handle NAT/proxy scenarios? [Clarity, Spec §Rate Limiting & Abuse Protection]

- [ ] CHK030 — Is the response contract for rate limit exceeded (HTTP 429 + error code) specified?
      [Gap — rate limits are defined but the error response format is not stated]

- [ ] CHK031 — Is there a requirement that rate limit counters are tenant-scoped (not global),
      preventing one aggressive tenant from impacting others? [Gap — spec states "per user" but
      does not address inter-tenant isolation of rate limit state]

- [ ] CHK032 — Is the `GET /runtime/subjects` rate limit (600 req/min) justified relative to the
      admin endpoints? Is there a requirement for burst tolerance or sliding window specification?
      [Completeness, Spec §Rate Limiting & Abuse Protection]

---

## Error Contract & Information Leakage Requirements

- [ ] CHK033 — Is the error response contract `{ success: false, data: null, error: { code, message } }`
      required on _every_ error path including 409 conflicts, 422 validation, 404 not found, and
      5xx server errors? [Completeness, Spec §Observability Requirements — stated for errors but
      not for all HTTP status classes]

- [ ] CHK034 — Are stack traces and internal DB error messages explicitly prohibited from
      appearing in API responses? [Gap — spec does not state that raw DB errors must be sanitized
      before surfacing to clients]

- [ ] CHK035 — Is the error message field required to be human-readable without exposing internal
      identifiers (table names, column names, query fragments)? [Gap — information leakage via
      verbose DB error messages is not addressed]

---

## Concurrent Mutation & Race Condition Requirements

- [ ] CHK036 — Is the CAS (Compare-And-Swap) pattern for concurrent workflow transitions
      (`UPDATE WHERE status = <expected>`) specified with a clear conflict response (`409
SUBJECT_TRANSITION_CONFLICT`)? [Completeness, Spec §Clarifications 2026-03-20, §Failure
      Modes]

- [ ] CHK037 — Is the concurrent name-creation race (two simultaneous `POST /subjects` with
      the same name) handled by DB-level unique constraint rather than application-level pre-check
      only? [Completeness, Spec §Test Strategy — concurrent creation test; uniqueness requirements
      in §FR-01]

- [ ] CHK038 — Is idempotency of soft-delete specified? (Already-deleted subject → 404, not
      a second successful deletion or a silent no-op that could mask bugs.) [Clarity, Spec
      §Idempotency Strategy]

---

## Structured Logging & Audit Requirements

- [ ] CHK039 — Are all mandatory structured log fields (`request_id`, `workspace_slug`, `user_id`,
      `action`, `subject_id`, `status`, `duration_ms`) defined for every write operation, not just
      a representative set? [Completeness, Spec §Observability Requirements]

- [ ] CHK040 — Is `error_code` required in structured logs on all error responses (not just
      conditionally present)? [Clarity, Spec §Observability Requirements — listed as "Cond."]

- [ ] CHK041 — Is there a requirement that translation-gap warnings (fallback chain surfaced as
      log warnings) include the `workspace_slug`, `subject_id`, and the missing `language` field?
      [Gap, Spec §FR-17, §Clarifications 2026-03-20 — warns but does not specify log field
      requirements for translation gap events]

- [ ] CHK042 — Are security-relevant events (unauthorized access attempts, cross-tenant ID
      lookups, rate limit hits) required to be logged at `WARN` or `ERROR` level with sufficient
      context for incident investigation? [Gap — spec defines observability for normal operations
      but does not specify security event log levels]

---

## Zidney Constitutional Compliance Requirements

- [ ] CHK043 — Is the prohibition on accessing the DB before tenant resolver and license
      middleware has completed stated as a hard constraint (not a recommendation)? [Completeness,
      Spec §Constitutional Compliance Declaration]

- [ ] CHK044 — Is the prohibition on client-supplied timestamps (`created_at`, `updated_at`,
      `deleted_at`) enforced at the input validation layer, not just ignored silently? [Clarity,
      Spec §Authoritative Time Usage]

- [ ] CHK045 — Is the `console.log` prohibition enforced as a linting rule reference, or is it
      only stated as a narrative requirement? [Gap — spec states "No console.log allowed" but does
      not reference the specific linting rule that enforces it]

- [ ] CHK046 — Is the requirement for transactional all-or-nothing writes (no partial state
      after any failure) measurable via a specific test scenario (transaction rollback injection)?
      [Measurability, Spec §Transaction Boundaries, §Test Strategy]

---

## Notes

- Check items off as completed: `[x]`
- `[Gap]` = requirement is missing from the spec and must be added or explicitly scoped out.
- `[Ambiguity]` = requirement exists but is unclear or inconsistent.
- `[Completeness]` = requirement exists but is missing detail.
- `[Clarity]` = requirement exists but needs tighter specification.
- `[Consistency]` = requirement conflicts with or is inconsistent from another part of the spec.
- Items are numbered sequentially starting at CHK001 for cross-reference in reviews.
