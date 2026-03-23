# Performance Checklist: Category Values

**Purpose**: Validate performance requirement quality — latency targets, index coverage, rate limits, transaction overhead, observability, and query design are sufficiently specified for safe implementation
**Created**: 2026-03-22
**Feature**: [spec.md](../spec.md)
**Stage**: `STAGE_31_CATEGORY_VALUES`

---

## Latency Requirements

- [ ] CHK001 — Is the P99 < 200ms target for the list endpoint defined with an explicit upper bound on result set size (up to 500 values with joined translations), making it objectively verifiable? [Clarity, Spec §Non-Functional Requirements]
- [ ] CHK002 — Is the P99 < 100ms target for the single-value GET endpoint specified with translation and scope data included in the response, not just the bare row? [Completeness, Spec §Non-Functional Requirements]
- [ ] CHK003 — Are latency targets defined for write endpoints (POST, PATCH, DELETE), or is their absence a documented intentional gap? [Gap]
- [ ] CHK004 — Are latency requirements defined under concurrent write conditions, specifically when `SELECT FOR UPDATE` lock contention may increase response time? [Gap]
- [ ] CHK005 — Is the interaction between translation JOIN latency and the 200ms P99 target specified (e.g., is the translation join cost budgeted within the 200ms, or measured independently)? [Clarity, Spec §Non-Functional Requirements]

## Index & Query Design Requirements

- [ ] CHK006 — Is the partial index `WHERE deleted_at IS NULL` specified as required on `category_values` to ensure active-value scans avoid full-table scans on soft-delete-heavy tables? [Completeness, Spec §Indexes]
- [ ] CHK007 — Is the composite index `(category_id, status)` specified as the primary index for the most common filtered list query (category + status filter), and is this the expected query path for the P99 < 200ms target? [Completeness, Spec §Indexes]
- [ ] CHK008 — Is there a requirement prohibiting N+1 query patterns when fetching translations for list results (e.g., batch or join required, not per-row subquery)? [Gap]
- [ ] CHK009 — Are translation table query requirements defined for the list path (e.g., single JOIN vs. separate query with `entity_id IN (...)`) to prevent unbounded query fanout? [Gap]
- [ ] CHK010 — Is the reverse scope lookup via `idx_cv_subjects_subject_id` and `idx_cv_divisions_division_id` explained as supporting a specific query pattern, not just declared as present? [Completeness, Spec §Indexes]
- [ ] CHK011 — Is there a requirement that scope-subset validation (value scope ⊆ parent Category scope) uses indexed lookups rather than in-memory set comparison on large scope sets? [Gap]

## Rate Limiting Requirements

- [ ] CHK012 — Are the write route rate limits (≤ 30 req/min) and read route rate limits (≤ 120 req/min) explicitly scoped **per workspace**, not per user or globally, in a way that is objectively enforceable? [Clarity, Spec §Rate Limiting & Abuse Protection]
- [ ] CHK013 — Is the HTTP response behavior when rate limits are exceeded (e.g., 429 Too Many Requests with a `Retry-After` header) defined, or is this implicitly delegated to the platform middleware without specification? [Gap]
- [ ] CHK014 — Are burst allowance or sliding window semantics for rate limiting specified, or are the limits strictly fixed-window per minute? [Gap]
- [ ] CHK015 — Is the separation between write routes (POST, PATCH, DELETE) and read routes (GET) for rate limiting clearly mapped in the spec so the middleware configuration is unambiguous? [Clarity, Spec §Rate Limiting & Abuse Protection]

## Transaction Performance Requirements

- [ ] CHK016 — Is the transaction scope for each write operation defined with the complete list of operations included (e.g., INSERT + translations INSERT + scope INSERT for create), enabling estimation of transaction duration? [Completeness, Spec §Transaction Boundaries]
- [ ] CHK017 — Is the atomic scope-replacement pattern (DELETE all scope rows + INSERT new scope rows) required to complete within a single transaction with no intermediate commit? [Completeness, Spec §BR-08]
- [ ] CHK018 — Are requirements for translation upsert batch efficiency defined (e.g., single multi-row upsert vs. one upsert per language), or is this left as an unspecified implementation detail? [Gap]
- [ ] CHK019 — Is there a requirement for maximum lock-wait timeout on `SELECT FOR UPDATE` operations, preventing indefinite stalls under high concurrency? [Gap]
- [ ] CHK020 — Is the translation upsert required to be included in the same transaction as the `category_values` row write (not a separate network round-trip), ensuring atomicity is measurable? [Completeness, Spec §BR-07, Spec §Transaction Boundaries]

## Observability & Logging Requirements

- [ ] CHK021 — Are all required structured log fields (`request_id`, `workspace_slug`, `user_id`, `action`, `category_value_id`, `category_id`, `status`, `duration_ms`) specified for every request handler, not just create/update operations? [Completeness, Spec §Observability Requirements]
- [ ] CHK022 — Is `duration_ms` logging required for both success and failure paths (not only on success), ensuring complete latency visibility? [Completeness, Spec §Observability Requirements]
- [ ] CHK023 — Is `category_value_id` logging specified as required on all non-create operations (GET single, PATCH, DELETE), and is its absence on list/create documented intentionally? [Clarity, Spec §Observability Requirements]
- [ ] CHK024 — Is the `status` before-and-after logging requirement on transition operations specified precisely enough to distinguish pre-transition and post-transition state in a single log entry? [Clarity, Spec §Observability Requirements]
- [ ] CHK025 — Are structured logging requirements consistent with platform-wide observability standards (e.g., correlation ID propagation from existing stages)? [Consistency]
- [ ] CHK026 — Is there a requirement that `console.log` is prohibited in favor of the structured logger, or is this only implied by the Constitutional Compliance Declaration? [Clarity, Spec §Constitutional Compliance Declaration]

## Pagination & Search Requirements

- [ ] CHK027 — Are pagination defaults (page = 1, limit = 20) and maximum limits (limit ≤ 100) defined as enforceable validation rules that return 422 on violation, not as documentation hints? [Completeness, Spec §GET /category-values]
- [ ] CHK028 — Is the `search` parameter case-insensitive matching defined with a specific mechanism (e.g., ILIKE, binary collation) and a character limit (max 100 chars) to prevent adversarial input causing slow DB scans? [Clarity, Spec §GET /category-values]
- [ ] CHK029 — Is the `total` count in paginated responses defined as the filtered result count (after status/search filters) rather than the gross table count, to ensure pagination math is correct? [Clarity, Spec §GET /category-values — Success Response]
- [ ] CHK030 — Are performance requirements for the translated-name search path defined (e.g., are translation table scans for `search` expected to use an index or a full-text-search mechanism)? [Gap]

## Notes

- CHK012: Must-have. Rate limiting at 30 write / 120 read per minute per workspace must be clearly specified.
- CHK021: Must-have. Structured logging with `request_id`, `workspace_slug`, `category_value_id` on all operations.
- CHK016–CHK020: Must-have category. Translation upsert in write transactions; SELECT FOR UPDATE transaction overhead.
- CHK001–CHK005: Gap items are deliberate — they flag that write-endpoint latency targets and concurrency latency are not specified.
- CHK008–CHK011: Gap items flag missing query design requirements that affect P99 achievability.
