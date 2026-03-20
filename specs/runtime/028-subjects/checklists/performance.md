# Performance Checklist: Stage 28 — Subjects

**Purpose**: Validate that all performance requirements in the Subjects spec are specified with
sufficient completeness, clarity, consistency, and measurability to be implemented and verified
without ambiguity.
**Created**: 2026-03-20
**Feature**: [specs/runtime/028-subjects/spec.md](../spec.md)
**Audience**: Reviewer (PR gate)
**Depth**: Standard — covers indexing, query efficiency, pagination, concurrency, and SLA
requirements.

> **Note**: This checklist is a _unit test for requirements quality_, not an implementation
> verification checklist. Each item asks whether a performance requirement is _well-specified_,
> not whether the code is fast.

---

## Response Time SLA Requirements

- [ ] CHK047 — Is the 500ms SLA for subject creation and retrieval (for workspaces up to 10,000
      subjects) defined as a P99 target, a P95 target, or an average? Without percentile specificity
      the requirement cannot be objectively measured. [Clarity, Spec §Success Criteria 1]

- [ ] CHK048 — Is the 500ms SLA scoped to "request receipt to response delivery" — does this
      include middleware processing time (tenant resolver, license check, RBAC), or only the handler
      execution time? [Clarity, Spec §Success Criteria 1]

- [ ] CHK049 — Are response time SLAs defined for all endpoint types (list, read, create, update,
      transition, delete), or only for creation and retrieval? [Completeness, Spec §Success Criteria
      1 — only covers create/retrieve; list with filters, transition, and delete SLAs are absent]

- [ ] CHK050 — Is the 10,000-subject workspace benchmark defined as the load condition for all
      SLA measurements, or is it the threshold at which the SLA must still hold? [Ambiguity, Spec
      §Success Criteria 1]

- [ ] CHK051 — Is there a degradation requirement for workspaces significantly exceeding 10,000
      subjects (e.g., 100,000)? [Gap — no upper bound or graceful degradation requirement is
      stated]

---

## Database Indexing Requirements

- [ ] CHK052 — Are all four required indexes (`idx_subjects_division_id`, `idx_subjects_semester_id`,
      `idx_subjects_status`, `uq_subjects_code_partial`) defined with their index type (B-tree),
      target column(s), and primary query pattern they serve? [Completeness, Spec §Data Model
      Changes — Indexes table]

- [ ] CHK053 — Is the partial unique index `UNIQUE(code) WHERE code IS NOT NULL` specified with
      its predicate and the query pattern it optimizes? A partial index does not accelerate
      non-covering queries; is it sufficient for code-lookup paths? [Clarity, Spec §Indexes]

- [ ] CHK054 — Is `uq_subjects_name_workspace` specified as a simple `UNIQUE(name)` (no
      `tenant_id` column because subjects is per-tenant), and is this rationale documented to
      prevent future accidental tenant_id column additions? [Clarity, Spec §Data Model Changes —
      Note on name uniqueness]

- [ ] CHK055 — Are indexes on `division_id` and `semester_id` sufficient for compound filter
      queries (e.g., `WHERE division_id = ? AND status = 'ACTIVE'`)? Is a composite index on
      `(division_id, status)` or `(semester_id, status)` required for runtime queries? [Gap —
      runtime endpoint always applies both a division/semester filter AND `status = ACTIVE`; single-
      column indexes may not fully cover this compound query]

- [ ] CHK056 — Are all indexes required to be created within the same forward-only migration
      that creates the `subjects` table (atomic with the table DDL), or can they be deferred? [Gap
      — migration atomicity for index creation is not specified]

- [ ] CHK057 — Is there a requirement to validate that indexes are actually used by the query
      planner (e.g., via `EXPLAIN ANALYZE` in CI or integration test assertions)? [Gap — indexes
      are defined but query plan validation is not a stated requirement]

---

## List Query & Pagination Requirements

- [ ] CHK058 — Are pagination requirements (cursor-based or offset-based, page size limits,
      default page size) defined for `GET /subjects`? [Gap — spec shows pagination response fields
      (`items`, `total`) but does not specify pagination strategy, max page size, or enforcement
      of a page size cap]

- [ ] CHK059 — Is a maximum `limit` value enforced for the list endpoint to prevent clients from
      requesting all records in a single response (which would cause full table scans on large
      workspaces)? [Gap — no max page size stated; a client requesting `limit=10000` could cause
      unbounded query results]

- [ ] CHK060 — Is the count query (`total`) in list responses required to be a separate optimized
      query (e.g., `SELECT COUNT(*)` with same WHERE clause) rather than loading all records to
      count them? [Gap — `total` field in response implies a count but the query strategy is not
      specified]

- [ ] CHK061 — Is the `search` query parameter (case-insensitive name/code matching) required to
      use an index-compatible operator (e.g., `ILIKE 'term%'` prefix match rather than `%term%`
      full scan) for large datasets? [Gap — spec defines the search behavior but not the performance
      constraint on the matching strategy]

- [ ] CHK062 — Are sort order options for the list endpoint defined (default sort, allowed sort
      columns, sort direction)? Undefined sort order leads to unpredictable pagination behavior and
      potential full-table sort operations. [Gap — not specified in the spec]

---

## N+1 Query Prevention Requirements

- [ ] CHK063 — Is there an explicit requirement that list responses do not generate N+1 queries
      (e.g., one query per subject to check translation coverage or resolve division names)? [Gap —
      spec describes list response fields that could trigger N+1 patterns if not explicitly required
      to be batch-loaded]

- [ ] CHK064 — Is the subject detail endpoint required to load all related data (translation
      coverage, division name, semester name) in a single query or a bounded number of queries?
      [Gap — spec defines the response shape but not the query count constraint]

- [ ] CHK065 — For the dependency-blocked deletion check (configurable registry), is it required
      that all dependency table checks are executed as a single batch query (or `UNION`) rather than
      N sequential queries — one per registered dependency? [Gap, Spec §FR-08, §Failure Modes —
      "configurable dependency check registry" is defined but query strategy is not]

---

## Write Operation Performance Requirements

- [ ] CHK066 — Are the uniqueness checks for `name` and `code` on create/update specified as
      being resolved by DB-level unique constraints (index scan at commit) rather than pre-check
      `SELECT` queries (which would create a TOCTOU window and add an extra roundtrip)? [Clarity,
      Spec §Idempotency Strategy, §Transaction Boundaries]

- [ ] CHK067 — Is the CAS transition pattern (`UPDATE WHERE status = <expected>`) specified to
      avoid a pre-check `SELECT` + subsequent `UPDATE` pattern (two roundtrips) in favour of a
      single atomic statement? [Clarity, Spec §Clarifications 2026-03-20, §Failure Modes]

- [ ] CHK068 — Are write operations (`POST`, `PATCH`, `DELETE`, `POST /transition`) required to
      complete within a specific time budget before the transaction times out? [Gap — no write-path
      SLA or query timeout requirement is defined]

- [ ] CHK069 — Is there a requirement for connection pooling configuration (min/max pool size,
      idle timeout, checkout timeout) to bound the performance impact of concurrent write requests
      per tenant? [Gap — spec states "tenant-scoped in-memory connection pool map" but defines no
      pool sizing parameters]

---

## Runtime Endpoint Performance Requirements

- [ ] CHK070 — Is `GET /runtime/subjects` (public-facing, 600 req/min limit) required to have
      a tighter response time SLA than the admin list endpoint, given its higher request rate and
      student-facing criticality? [Gap — same 500ms SLA implied but not separately specified for
      runtime]

- [ ] CHK071 — Is the `status = ACTIVE` server-enforced filter on the runtime endpoint required
      to be index-backed (`idx_subjects_status`), and is the query plan required to confirm index
      usage in integration tests? [Completeness, Spec §FR-19, §Test Strategy]

- [ ] CHK072 — When both `division_id` and `status = ACTIVE` filters are applied on the runtime
      endpoint, is there a requirement that this compound filter uses the most selective index
      available? [Gap — see also CHK055; the runtime compound filter performance requirement is
      not stated]

---

## Caching Requirements

- [ ] CHK073 — Is there a caching requirement for the `GET /runtime/subjects` endpoint (e.g.,
      short-lived Redis cache per tenant for ACTIVE subject lists)? [Gap — not addressed in spec;
      given the 600 req/min limit, a cache strategy may be needed at scale]

- [ ] CHK074 — If caching is introduced, is there a requirement defining cache invalidation
      triggers (subject transitions to ACTIVE/ARCHIVED, subject creation/update/soft-delete)? [Gap
      — no cache invalidation contract exists; this would need specification if caching is added]

---

## Migration Performance Requirements

- [ ] CHK075 — Is the migration confirmed to add the `subjects` table (new DDL only) without
      locking or rewriting any existing tables, and is this confirmed to produce zero downtime for
      concurrent tenant requests during migration? [Completeness, Spec §Migration Requirements —
      "Downtime risk: None" asserted but no test requirement validates this]

- [ ] CHK076 — Is there a requirement for the migration to complete within a specific time budget
      when applied to a tenant DB with existing data (divisions, semesters, departments populated)?
      [Gap — migration timing under realistic data volumes is not specified]

---

## Observability & Performance Measurement Requirements

- [ ] CHK077 — Are `duration_ms` log field requirements defined as wall-clock time from request
      receipt (after middleware) or total end-to-end time including middleware? [Ambiguity, Spec
      §Observability Requirements]

- [ ] CHK078 — Is there a requirement for slow-query detection (e.g., log a WARN when a subject
      query exceeds a configurable threshold)? [Gap — spec defines metrics but not slow-query
      alerting thresholds]

- [ ] CHK079 — Are the three defined metrics (creation rate, transition events, dependency-blocked
      deletions) required to be emitted as structured log entries, counters, or distributed tracing
      spans? The mechanism is not specified and affects observability tool integration. [Clarity,
      Spec §Observability Requirements — §Metrics critical path]

- [ ] CHK080 — Is there a requirement that P99 latency for `GET /subjects` (list with filters)
      under sustained load (e.g., 100 concurrent requests) is captured and compared against the
      500ms SLA? [Gap — load test conditions are not defined as part of the acceptance criteria]

---

## Notes

- Check items off as completed: `[x]`
- `[Gap]` = requirement is missing from the spec and must be added or explicitly scoped out.
- `[Ambiguity]` = requirement exists but is unclear or inconsistent.
- `[Completeness]` = requirement exists but is missing detail.
- `[Clarity]` = requirement exists but needs tighter specification.
- `[Consistency]` = requirement conflicts with or is inconsistent from another part of the spec.
- Items are numbered sequentially (continuing from security.md CHK046) for cross-reference
  in reviews.
