# Performance Requirements Quality Checklist: MCQ Question Model

**Purpose**: Validate completeness, clarity, and consistency of performance requirements in the MCQ Question Model spec
**Created**: 2026-03-30
**Feature**: [spec.md](../spec.md)
**Stage**: `STAGE_34_MCQ_QUESTION_MODEL`

## Query Performance & Indexing

- [ ] CHK001 - Are index requirements specified for ALL filterable columns used in list queries (subject_id, division_id, lesson_id, question_type, status)? [Completeness, Spec §Data Model Indexes]
- [ ] CHK002 - Are index requirements specified for ALL join table foreign keys used in classification filter subqueries (category_value_id, tag_id, basket_id)? [Coverage, Spec §Data Model Indexes]
- [ ] CHK003 - Is the "no sequential scans on large question pools" requirement quantified with a pool size threshold? [Clarity, Spec §GET mcq-questions]
- [ ] CHK004 - Is the "no N+1 queries" requirement defined for the list endpoint that joins across options and classification tables? [Completeness, Spec §GET mcq-questions]
- [ ] CHK005 - Are query performance requirements defined for the GET single question endpoint (which includes options, categories, tags, and baskets)? [Gap, Consistency]
- [ ] CHK006 - Is the `search` parameter's partial match query performance addressed (full-text index, LIKE pattern, or trigram index)? [Gap, Spec §GET mcq-questions]
- [ ] CHK007 - Are composite index requirements evaluated for common multi-filter query combinations (e.g., subject_id + status + question_type)? [Gap, Coverage]
- [ ] CHK008 - Are index requirements on `mcq_question_options.question_id` sufficient for the full option set retrieval pattern? [Completeness, Spec §Data Model Indexes]

## Response Time Targets

- [ ] CHK009 - Is the <1 second response time target for single-filter list queries defined with a specific pool size (10,000 questions)? [Clarity, Spec §SC-004]
- [ ] CHK010 - Are response time requirements defined for multi-filter combination queries (e.g., subject + type + status + tag)? [Gap, Coverage]
- [ ] CHK011 - Are response time requirements defined for question creation (SC-001 says "under 30 seconds" — is this a UX metric or API latency target)? [Clarity, Spec §SC-001]
- [ ] CHK012 - Are response time requirements defined for PATCH operations that involve full option replacement within a transaction? [Gap]
- [ ] CHK013 - Are response time requirements defined for workflow transition operations? [Gap]
- [ ] CHK014 - Are response time targets differentiated between read and write operations? [Gap, Consistency]

## Pagination & Resource Limits

- [ ] CHK015 - Is the maximum `perPage` value (100) explicitly specified to prevent unbounded result sets? [Completeness, Spec §GET mcq-questions]
- [ ] CHK016 - Are default pagination values defined (page: 1, perPage: 20)? [Completeness, Spec §GET mcq-questions]
- [ ] CHK017 - Is the total count query performance addressed for large datasets (COUNT vs. estimated count)? [Gap, Edge Case]
- [ ] CHK018 - Are requirements defined for maximum number of options per question (unbounded potential for MULTIPLE and ARRANGEMENT types)? [Gap, Edge Case]
- [ ] CHK019 - Are requirements defined for maximum number of classification links per question (categories, tags, baskets)? [Gap, Edge Case]

## Transaction Performance

- [ ] CHK020 - Are performance implications of the single atomic transaction for PATCH documented (lock duration on question + options rows)? [Gap, Spec §PATCH mcq-questions]
- [ ] CHK021 - Is the full option replacement strategy's performance impact assessed for questions with many options? [Gap, Spec §PATCH mcq-questions]
- [ ] CHK022 - Are optimistic concurrency control performance characteristics specified (comparison overhead is negligible, but retry behavior under contention is not defined)? [Gap, Spec §PATCH mcq-questions]
- [ ] CHK023 - Are transaction timeout requirements defined for the atomic PATCH operation? [Gap]

## Deletion Guard Performance

- [ ] CHK024 - Are performance requirements specified for the deletion guard check (querying exam configs, scheduled exams, and active attempts)? [Gap, Spec §DELETE mcq-questions]
- [ ] CHK025 - Are index requirements defined on the exam reference tables queried by the deletion guard? [Gap, Coverage]
- [ ] CHK026 - Is the performance impact of soft delete on list query performance addressed (filtering out soft-deleted records on every query)? [Gap, Edge Case]
- [ ] CHK027 - Are requirements defined for archiving or purging old soft-deleted questions to prevent table bloat? [Gap, Non-Functional]

## Classification Subquery Performance

- [ ] CHK028 - Is the subquery-based classification filter approach (`WHERE id IN (SELECT ...)`) performance-validated against JOIN-based alternatives? [Clarity, Spec §GET mcq-questions]
- [ ] CHK029 - Are performance requirements defined for combining multiple classification filters simultaneously (e.g., categoryValueId + tagId + basketId)? [Gap, Coverage]
- [ ] CHK030 - Are index requirements sufficient for reverse lookups (category → questions, tag → questions, basket → questions) used by the auto-selection engine? [Completeness, Spec §Data Model Indexes]

## Scalability Requirements

- [ ] CHK031 - Is the 10,000-question pool size target explicitly stated as the performance baseline? [Clarity, Spec §SC-004]
- [ ] CHK032 - Are scaling requirements defined beyond the 10,000-question baseline (50K, 100K questions per tenant)? [Gap, Non-Functional]
- [ ] CHK033 - Are performance requirements defined for tenants with high classification density (many categories/tags per question)? [Gap, Edge Case]
- [ ] CHK034 - Are connection pool sizing requirements addressed for concurrent question operations across multiple tenants? [Gap, Non-Functional]

## Tenant Isolation Performance (Constitutional Rule)

- [ ] CHK035 - Is the per-tenant connection pool strategy's performance impact documented (pool overhead per tenant)? [Gap, Spec §Isolation Impact Analysis]
- [ ] CHK036 - Are performance requirements consistent with database-per-tenant architecture (no cross-tenant query optimization possible)? [Consistency, Constitutional Rule]

## Rate Limiting Performance

- [ ] CHK037 - Are the specified rate limits (write ≤30 req/min, read ≤120 req/min) validated against expected content authoring throughput? [Clarity, Spec §Constitutional Compliance]
- [ ] CHK038 - Is bulk question creation addressed as a requirement, or is the per-question POST the only creation mechanism? [Gap, Scalability]

## Notes

- Constitutional rules validated: tenant isolation (per-tenant pool implications), transaction boundaries (PATCH atomicity), server-authoritative time (timestamp overhead negligible)
- Total items: 38
- Traceability: 33/38 items (86.8%) include spec section or gap markers
