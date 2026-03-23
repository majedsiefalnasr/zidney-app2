# Performance Checklist: MCQ Baskets

**Purpose**: Validate performance requirement quality — completeness, clarity, and coverage of index strategy, pagination, N+1 prevention, and query performance requirements in the MCQ Baskets specification.
**Created**: 2026-03-23
**Feature**: [spec.md](../spec.md)
**Stage**: `STAGE_33_MCQ_BASKETS`
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`

> **Perspective**: These items are **unit tests for the performance requirements as written** — they validate whether the spec adequately specifies performance properties, not whether the implementation is fast.

---

## Index Coverage Requirements

- [ ] CHK001 - Is the requirement for `UNIQUE(code)` index on `mcq_baskets` tied explicitly to both uniqueness enforcement and query performance for code-lookup operations, or only stated as a constraint? [Completeness, Spec §Data Model — mcq_baskets]
- [ ] CHK002 - Is the requirement for `idx_mcq_baskets_type` index specified with the query patterns it must serve (type-filtered basket list), with a stated requirement that it must be used by the planner for those queries? [Clarity, Spec §Data Model — mcq_baskets]
- [ ] CHK003 - Is the requirement for `idx_mcq_baskets_status` index specified with the query patterns it must serve (status-filtered basket list), and is a sequential scan on `status` explicitly prohibited for non-trivial datasets? [Clarity, Spec §Data Model — mcq_baskets]
- [ ] CHK004 - Is the requirement for `idx_mcq_basket_questions_basket_id` index tied directly to the auto-selection subquery (`WHERE basket_id = ?`) with an explicit prohibition on sequential scans for basket → question lookups? [Completeness, Spec §FR-020, Spec §Basket Filtering on Entity Lists]
- [ ] CHK005 - Is the requirement for `idx_mcq_basket_questions_question_id` index specified with its use case (reverse question → basket lookup, cascade consistency checks), and is it required in the migration alongside the forward index? [Completeness, Spec §Data Model — mcq_basket_questions]
- [ ] CHK006 - Are composite index requirements evaluated for multi-column filter combinations in the basket list endpoint — specifically `(type, status)` for combined type-and-status filter queries, or `(status, type)` — or is absence of a composite index a conscious documented decision? [Gap]
- [ ] CHK007 - Is a text-search index strategy specified for the `search` query parameter (partial match on `name` and `code`)? If `ILIKE '%query%'` is used, are the performance implications and acceptable scale limits documented? [Gap]
- [ ] CHK008 - Are all five required indexes (`UNIQUE(code)`, `idx_mcq_baskets_type`, `idx_mcq_baskets_status`, `idx_mcq_basket_questions_basket_id`, `idx_mcq_basket_questions_question_id`) listed explicitly in the Validation Criteria as migration verification requirements? [Completeness, Spec §Validation Criteria]

---

## Pagination Requirements

- [ ] CHK009 - Are pagination requirements (default page size, maximum page size) specified for the basket list endpoint (`GET /mcq-baskets`) with explicit values (`default: 20, max: 100`)? [Completeness, Spec §GET /workspace/:slug/mcq-baskets]
- [ ] CHK010 - Are pagination requirements specified for the basket-questions list endpoint (`GET /mcq-baskets/:id/questions`) with a defined default and maximum `per_page` value? [Completeness, Gap — spec defines `page`, `per_page` params but does not state max:100 for this endpoint]
- [ ] CHK011 - Are the default and maximum page size values consistent between the basket list endpoint and the basket-questions list endpoint? [Consistency, Spec §GET /mcq-baskets vs. Spec §GET /questions]
- [ ] CHK012 - Is the behavior for `per_page` exceeding the maximum (e.g., `per_page=500`) specified — does the API cap it silently, reject with `422`, or return all results? [Clarity, Gap]
- [ ] CHK013 - Is the behavior for `page=0`, negative `page`, or non-integer `page`/`per_page` values defined explicitly in the spec? [Coverage, Gap]
- [ ] CHK014 - Is the `total` count field in paginated responses required to reflect filtered results (not total rows before filtering), ensuring accurate pagination metadata when filters are applied? [Clarity, Spec §GET /mcq-baskets response shape]
- [ ] CHK015 - Is a cursor-based or keyset pagination alternative considered or explicitly excluded for large basket-question collections (e.g., baskets with thousands of questions)? [Gap]

---

## N+1 Query Prevention

- [ ] CHK016 - Is the prohibition on N+1 queries for the `questionCount` field in basket list responses explicitly stated? The spec states N+1 is forbidden for auto-selection (FR-020) but does not specify the aggregation strategy for `questionCount` in the list endpoint. [Completeness, Gap]
- [ ] CHK017 - Is the query strategy for computing `questionCount` in basket list and basket get responses specified (e.g., SQL COUNT subquery or aggregate JOIN in the basket list query, not a per-basket SELECT)? [Clarity, Gap]
- [ ] CHK018 - Is the no-N+1 requirement for the basket-questions list endpoint (`GET /mcq-baskets/:id/questions`) explicitly stated, or does the N+1 prohibition in FR-020 apply only to the auto-selection filter? [Coverage, Spec §FR-020]
- [ ] CHK019 - Is the no-N+1 requirement stated for the deletion guard queries — specifically that checking both the exam config reference and the auto-selection rule reference uses at most two queries (not one query per referenced record)? [Gap]
- [ ] CHK020 - Is a required query plan validation step (e.g., `EXPLAIN ANALYZE` verification in CI or migration audit) specified to confirm that N+1-prone query paths are caught before production? [Gap]

---

## Auto-Selection Subquery Performance

- [ ] CHK021 - Is the indexed subquery requirement for the basket filter `WHERE question_id IN (SELECT question_id FROM mcq_basket_questions WHERE basket_id = ?)` specified with an explicit prohibition on sequential scans for any reasonable basket size? [Completeness, Spec §FR-020, Spec §Basket Filtering on Entity Lists]
- [ ] CHK022 - Are performance requirements defined for the basket filter subquery at scale — e.g., for baskets containing hundreds or thousands of questions — or is the scaling boundary left undefined? [Coverage, Gap]
- [ ] CHK023 - Is the requirement that `idx_mcq_basket_questions_basket_id` is utilized by the query planner (not bypassed by a hash scan on small tables) documented as a verifiable migration/CI check? [Clarity, Gap]
- [ ] CHK024 - Is the use of a subquery strategy (`WHERE IN`) vs. a JOIN strategy for the basket filter explicitly evaluated and documented as a performance decision, with the chosen approach stated in the spec? [Clarity, Gap]

---

## Write Performance & Transaction Boundaries

- [ ] CHK025 - Is the transaction scope required for basket deletion (deletion guard check + basket delete + cascade) specified to minimize lock duration, given that the deletion guard must query across multiple tables? [Gap]
- [ ] CHK026 - Is the transaction scope for the link operation (`mcq_basket_questions` insert + `max_questions` cap validation) specified to prevent TOCTOU violations without holding unnecessary locks? [Gap]
- [ ] CHK027 - Is the transaction scope for workflow transitions (status update + workflow log entry write) specified to minimize contention under concurrent transition attempts on the same basket? [Gap]

---

## Deletion Guard Query Performance

- [ ] CHK028 - Are index requirements defined for the column in the exam configuration table that stores basket references — to ensure the deletion guard check does not perform a sequential scan of the entire exam config table? [Gap]
- [ ] CHK029 - Are index requirements defined for the column in the auto-selection rule table that stores basket references — to ensure the deletion guard check does not perform a sequential scan of the auto-selection rules table? [Gap]
- [ ] CHK030 - Is the deletion guard query strategy specified as a pair of `EXISTS` checks (stop at first match) rather than `COUNT(*)` or full-fetch queries, to avoid unnecessary full table scans? [Clarity, Gap]

---

## Non-Functional Performance Requirements

- [ ] CHK031 - Are response time SLAs or target latencies defined for read basket operations (list, get) and write basket operations (create, update, delete, transition) under typical tenant load? [Gap]
- [ ] CHK032 - Is the expected scale dimension documented — e.g., maximum expected number of baskets per workspace, maximum expected `mcq_basket_questions` rows per basket — to validate that the index strategy is appropriate? [Gap]
- [ ] CHK033 - Are database connection pool requirements or connection acquisition timeout requirements specified for basket operations to prevent connection starvation under concurrent tenant load? [Gap]
- [ ] CHK034 - Is the write rate limit (≤ 30 req/min per workspace) specified as a performance protection mechanism and not only as a security control, to prevent pool exhaustion from high-frequency basket mutations? [Completeness, Spec §Constitutional Compliance]
