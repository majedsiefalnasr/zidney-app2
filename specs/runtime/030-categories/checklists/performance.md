# Performance Checklist — Categories (Classification Dimensions)

**Purpose**: Validate that performance properties — query strategy, index coverage, pagination bounds, hierarchy traversal cost, concurrency locking, scope aggregation, and migration safety — are sufficiently and clearly specified in the Categories spec to guide performant implementation.
**Created**: 2026-03-22
**Feature**: [spec.md](../spec.md)
**Stage**: STAGE_30_CATEGORIES
**Phase**: 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION

---

## Index Coverage Requirements

- [ ] CHK001 — Are all required indexes listed with their table, columns, index type, and stated query purpose? [Completeness, Spec §Indexes]
- [ ] CHK002 — Is it specified that every FK column (`parent_id`, `created_by`, `updated_by`, `category_id`, `subject_id`, `division_id`) is covered by an index to prevent sequential scans on joins/FKs? [Completeness, Spec §Indexes]
- [ ] CHK003 — Is the functional `LOWER(name)` index documented as serving both uniqueness enforcement and case-insensitive name queries, justifying its inclusion beyond uniqueness alone? [Clarity, Spec §Indexes]
- [ ] CHK004 — Is the rationale for not requiring a composite index on `(status, parent_id)` — a common multi-filter scan path for `GET /categories` — stated or explicitly excluded? [Gap]
- [ ] CHK005 — Are the partial unique index semantics (`WHERE code IS NOT NULL`) documented in terms of their query-planner impact (NULLs excluded from B-tree scan)? [Clarity, Spec §Data Model]

---

## Pagination Requirements

- [ ] CHK006 — Are pagination bounds quantified with exact values (default `page=1`, min `limit=1`, max `limit=100`, default `limit=20`) and validated schema constraints? [Completeness, Spec §GET /categories]
- [ ] CHK007 — Is the offset-based pagination formula (`offset = (page - 1) * limit`) documented with an acknowledgment of its known performance characteristic on large offsets, or is a cursor-based strategy considered? [Clarity, Spec §Non-Functional Requirements]
- [ ] CHK008 — Is the `total` count in the list response required to be computed in the same query or as a separate `COUNT(*)` — and is the cost of the count query acknowledged for large tenant datasets? [Gap]

---

## Hierarchy Traversal Performance Requirements

- [ ] CHK009 — Is the tree endpoint strategy (in-memory assembly vs recursive CTE) specified with an explicit rationale tied to the bounded max-depth-3 guarantee that makes in-memory assembly safe? [Completeness, Spec §Non-Functional Requirements]
- [ ] CHK010 — Is the ancestor chain traversal for depth and circular-reference validation bounded to a maximum of 3 hops, and is this bound documented as both a functional limit and a performance guarantee preventing unbounded query chaining? [Completeness, Spec §BR-03, BR-04]
- [ ] CHK011 — Is it specified how all enabled categories are fetched for the tree endpoint — single bulk query vs multiple per-node queries — to prevent N+1 patterns when assembling the nested structure? [Gap]
- [ ] CHK012 — Are requirements defined for re-parenting operations to bound the cost of validating descendant depths (traversal depth at most 3 from the new parent) rather than recursing the full subtree? [Clarity, Spec §BR-03]

---

## Scope Query Strategy Requirements (N+1 Prevention)

- [ ] CHK013 — Is the query strategy for fetching `subject_ids` and `division_ids` per category item in list responses explicitly specified (e.g., LEFT JOIN + aggregation, lateral join, or separate batched query) to prevent per-row round trips? [Gap]
- [ ] CHK014 — Is the same scope-fetching strategy specified for the single-category GET endpoint (`GET /categories/:id`) to ensure consistency with the list endpoint approach? [Gap]
- [ ] CHK015 — Are requirements defined for how scope data is included in POST/PATCH responses — re-fetching via the same query path or returning the constructed scope from in-memory state? [Gap]

---

## Concurrency & Locking Performance Requirements

- [ ] CHK016 — Is it explicitly required that read-only operations (GET /categories, GET /categories/tree, GET /categories/:id) must not acquire row-level locks, ensuring read throughput is unaffected by concurrent write lock contention? [Completeness, Spec §BR-14]
- [ ] CHK017 — Is the SELECT FOR UPDATE lock scope narrowed to only the specific row(s) required (parent row on create, target row on update/delete) rather than broader table-level locks? [Completeness, Spec §BR-14]
- [ ] CHK018 — Are performance implications of SELECT FOR UPDATE under concurrent hierarchy mutations (e.g., two concurrent creates with the same parent) acknowledged in the spec, or is this explicitly deferred? [Gap]

---

## Transaction Scope & Connection Pool Requirements

- [ ] CHK019 — Is it required that transaction scope (BEGIN to COMMIT/ROLLBACK) is kept as narrow as possible — specifically, that transactions are not held open across HTTP I/O or external calls? [Gap]
- [ ] CHK020 — Is it explicitly required that all operations use the per-tenant connection pool (`c.get('tenant').pool`) rather than opening new connections per request, preventing pool exhaustion? [Completeness, Spec §Isolation Impact Analysis]
- [ ] CHK021 — Are requirements defined for transaction timeout or maximum lock-hold duration to prevent slow write operations from blocking read queries on the same tenant DB? [Gap]

---

## Migration Performance Requirements

- [ ] CHK022 — Is `IF NOT EXISTS` on all DDL statements (table, index, FK) specified as a requirement ensuring safe, idempotent re-execution without locking errors? [Completeness, Spec §Migration Safety]
- [ ] CHK023 — Are requirements defined for safe migration execution on an active tenant DB — specifically whether indexes are created `CONCURRENTLY` or with a brief share lock? [Gap]
- [ ] CHK024 — Is the schema version increment atomicity requirement (version bump inside the same transaction as DDL) specified to prevent schema-version/schema-state divergence on partial failure? [Completeness, Spec §Migration File]

---

## Response Size & Throughput Requirements

- [ ] CHK025 — Is the tree endpoint response size implicitly bounded by the max-depth-3 constraint and the tenant's total category count, and is this boundary documented as the performance guarantee rather than an explicit size cap? [Completeness, Spec §US-03]
- [ ] CHK026 — Are response time SLA requirements defined for any category endpoints, or is their absence explicitly acknowledged as deferred to SLA/SLO stages? [Gap]
- [ ] CHK027 — Are throughput or concurrent-request requirements defined for the tree endpoint (which returns unbounded category counts with no pagination), or is this explicitly deferred? [Gap]
