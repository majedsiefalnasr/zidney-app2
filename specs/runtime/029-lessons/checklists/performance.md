# Performance Checklist: Lessons

**Purpose**: Validates that performance-related requirements in the Lessons spec are complete, unambiguous, consistent, and measurable — not that the implementation is fast.
**Created**: 2026-03-21
**Feature**: [specs/runtime/029-lessons/spec.md](../spec.md)

---

## Index Requirements

- [ ] CHK001 — Are all three required indexes (`idx_lessons_subject_id`, `idx_lessons_status`, `lessons_subject_name_key`) defined with their type (B-tree), target columns, and stated purpose? [Completeness, Spec §Indexes]
- [ ] CHK002 — Is there a requirement that `idx_lessons_subject_id` is present in the migration DDL, not just documented in the spec? Is cross-referencing between the spec index table and the migration file `20260321_007_lessons.ts` required? [Completeness, Spec §Migration File]
- [ ] CHK003 — Is the `idx_lessons_status` single-column index justified in the spec? A low-cardinality status column (`ENABLED` / `DISABLED`) may not benefit from a B-tree index — is the performance requirement for status-only queries defined? [Clarity, Spec §Indexes]
- [ ] CHK004 — Is the `lessons_subject_name_key` unique index documented as serving dual purpose (uniqueness enforcement + query optimization)? Is its performance role distinct from its constraint role? [Clarity, Spec §Indexes]
- [ ] CHK005 — Are compound index requirements (e.g., `(subject_id, status)` for filtered list queries) evaluated and their absence documented as a deliberate decision? [Gap]

## Query Scope Requirements

- [ ] CHK006 — Is there an explicit requirement that all list and count queries in the lesson service are scoped exclusively to the tenant DB obtained from `c.get('tenant').pool`? [Completeness, Spec §Tenant Isolation]
- [ ] CHK007 — Is there a requirement that the `subject_id` filter in GET /lessons must resolve only within the current tenant DB (cross-tenant subject references cannot widen the query)? [Completeness, Gap]
- [ ] CHK008 — Is it explicitly required that the subjects existence check (before lesson creation) queries only the current tenant DB — and not a shared subjects registry? [Completeness, Spec §US-01 SC-3]

## Pagination Requirements

- [ ] CHK009 — Are both the default page size (`20`) and the maximum allowed page size (`100`) defined as requirements with min/max bounds? [Completeness, Spec §GET /lessons]
- [ ] CHK010 — Is the pagination parameter validation requirement (page ≥ 1, limit 1–100) traceable to an error response? The spec defines 422 `VALIDATION_ERROR` for invalid values [Spec §US-02 SC-5] — but is the specific limit on `limit` referenced in the validation schema table? [Consistency, Spec §listLessonsQuerySchema]
- [ ] CHK011 — Is the pagination metadata (`total`, `page`, `limit`) requirement defined as mandatory in the success response for all list results, including empty result sets? [Completeness, Spec §GET /lessons Success Response]
- [ ] CHK012 — Is the `total` count definition precise — does it count all matching rows (pre-pagination) using the same filter set, or only the current page rows? [Clarity, Spec §GET /lessons Success Response]

## Filter and COUNT Query Consistency

- [ ] CHK013 — Is there a requirement that the COUNT query for `total` uses the exact same filter predicates (`subject_id`, `status`, `search`) as the data query? [Gap]
- [ ] CHK014 — Is the `search` filter requirement defined with sufficient precision? "Case-insensitive partial match" [Spec §US-02 SC-3] — is `ILIKE '%term%'` the specified implementation strategy, or is full-text search also in scope? [Clarity, Spec §US-02 SC-3]
- [ ] CHK015 — Are performance implications of case-insensitive `search` queries on unindexed text columns documented? Is there a requirement to limit `search` query length (`max 100` [Spec §listLessonsQuerySchema]) as a mitigation? [Completeness, Spec §listLessonsQuerySchema]
- [ ] CHK016 — Is the behavior of applying multiple simultaneous filters (`subject_id` + `status` + `search`) specified? Are filter combinations required to use AND semantics? [Clarity, Gap]

## N+1 Query Prevention

- [ ] CHK017 — Is there an explicit requirement that the list endpoint returns all lesson fields in a single query without per-row sub-queries for subject name or user details? [Gap]
- [ ] CHK018 — Is the list response schema defined as excluding any nested/joined subject fields (e.g., no `subject.name` embedded per row)? If subject details are needed, must a separate endpoint be used? [Completeness, Spec §GET /lessons Success Response]
- [ ] CHK019 — If `created_by`/`updated_by` UUIDs are returned in list items, is there a requirement that user name resolution (if needed) must not be done per-row? [Gap]

## Transactional and Write Performance

- [ ] CHK020 — Is the transaction boundary requirement (BR-07) specified to apply to all three write operations (create, update, soft-delete)? Is the requirement that transactions are opened at the service layer (not repository) stated clearly? [Completeness, Spec §BR-07]
- [ ] CHK021 — Is there a requirement that uniqueness checks (`UNIQUE (subject_id, name)`) rely on the DB constraint as the authoritative check, with the application-layer pre-check being advisory only? This prevents TOCTOU race conditions. [Gap]

## Schema Version and Migration Performance

- [ ] CHK022 — Is the schema version minimum enforcement requirement (`schema_version < MIN_SCHEMA_VERSION → 409`) defined such that the version check occurs before any expensive query? [Completeness, Spec §Schema Version Enforcement]
- [ ] CHK023 — Is the DDL migration (`BEGIN / COMMIT`) performance risk documented — specifically whether the migration acquires `ACCESS EXCLUSIVE` locks on tenant DBs? [Gap, Spec §Migration File]

## Notes

- Check items off as completed: `[x]`
- `[Gap]` = requirement is missing from the spec and should be added
- `[Clarity]` = requirement exists but needs more precise language
- `[Completeness]` = requirement is partially covered but scope is incomplete
- `[Consistency]` = requirement exists in one place but contradicts or omits another
