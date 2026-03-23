# Performance Requirements Checklist: Tags (STAGE 32)

**Purpose**: Validate that performance requirements for the Tags feature are complete, measurable, and ready for implementation  
**Created**: 2026-03-23  
**Feature**: [spec.md](../spec.md)  
**Stage**: `STAGE_32_TAGS`  
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`

---

## Index Coverage Requirements

- [ ] CHK001 - Are all three required non-unique indexes (`idx_tags_status`, `idx_tag_relations_tag_id`, `idx_tag_relations_entity`) listed in the Data Model section with their purpose described? [Completeness, Spec §Data Model]
- [ ] CHK002 - Is `idx_tag_relations_entity` specified as a composite index on `(entity_type, entity_id)` (not two separate single-column indexes)? [Clarity, Spec §Data Model]
- [ ] CHK003 - Is the `UNIQUE (normalized_name)` constraint on `tags` specified as a DB-layer index (not solely an application-layer check)? [Completeness, Spec §Data Model, FR-004]
- [ ] CHK004 - Is the composite unique index on `(tag_id, entity_type, entity_id)` in `tag_relations` specified as a DB-layer constraint? [Completeness, Spec §Data Model, FR-009]
- [ ] CHK005 - Are index names used consistently between the Data Model table, the migration requirements, and the integration test assertions? [Consistency, Spec §Data Model, Test Requirements §Migration Tests]
- [ ] CHK006 - Is there a requirement that presence and correctness of all specified indexes are verified by migration tests? [Completeness, Spec §Test Requirements §Migration Tests]

---

## Query Efficiency Requirements

- [ ] CHK007 - Does FR-013 explicitly prohibit sequential table scans on `tags` and `tag_relations` at production data volumes? [Completeness, Spec §FR-013]
- [ ] CHK008 - Is the requirement that multi-tag AND filtering uses indexed joins (not N+1 queries — one query per tag) explicitly stated? [Completeness, Spec §FR-012, FR-013]
- [ ] CHK009 - Is the query strategy for multi-tag AND filtering (e.g., JOIN with HAVING COUNT) sufficiently constrained in the spec to prevent an unacceptable N+1 implementation? [Clarity, Spec §FR-012]
- [ ] CHK010 - Are entity-to-tag lookup queries (`GET /entities/:entityType/:entityId/tags`) required to use the `idx_tag_relations_entity` index path? [Completeness, Spec §FR-013]
- [ ] CHK011 - Is the tag-to-entity lookup (`GET /tags/:id/entities`) required to use the `idx_tag_relations_tag_id` index path? [Completeness, Spec §FR-013]
- [ ] CHK012 - Is the `name` search on the list endpoint required to operate against `normalized_name` (enabling index-compatible LIKE or prefix matching) rather than against raw `name`? [Completeness, Spec §FR-011, Data Model]
- [ ] CHK013 - Is the `status`-filtered tag list query required to use `idx_tags_status`? [Completeness, Spec §FR-011, Data Model]

---

## Pagination & Limits Requirements

- [ ] CHK014 - Is the maximum allowed `per_page` value for tag list queries specified (e.g., 100)? [Completeness, Spec §FR-011]
- [ ] CHK015 - Is the default `per_page` value (when the parameter is omitted) defined for the tag list endpoint? [Completeness, Gap]
- [ ] CHK016 - Is server-side enforcement of the `per_page` maximum explicitly required (not merely documented as a client-side recommendation)? [Completeness, Gap]
- [ ] CHK017 - Are pagination requirements for entity-tag read endpoints (`GET /tags/:id/entities`, `GET /entities/:entityType/:entityId/tags`) specified, or is pagination scope limited to the tag list? [Coverage, Gap]
- [ ] CHK018 - Is cursor-based or offset-based pagination explicitly designated for this stage, or is the choice left to the implementer? [Clarity, Spec §FR-011]

---

## Response Time & Scalability Requirements

- [ ] CHK019 - Is SC-004 ("acceptable interactive response times at production-scale entity counts") defined with a specific measurable threshold (e.g., p95 latency < X ms at Y rows)? [Measurability, Spec §SC-004]
- [ ] CHK020 - Are response time requirements differentiated between read endpoints (list, get) and write endpoints (create tag, assign tag)? [Completeness, Gap]
- [ ] CHK021 - Is the `ON DELETE CASCADE` behavior on `tag_relations.tag_id` evaluated for performance impact when a tag with a large number of relations is deleted, and are any mitigation requirements stated? [Completeness, Spec §Data Model, Gap]
- [ ] CHK022 - Is there a stated assumption or requirement about expected production row counts for `tags` and `tag_relations` per tenant that underpins index and pagination design decisions? [Completeness, Gap]

---

## Notes

- Items marked `[Gap]` require requirements to be added or explicitly declared out of scope before implementation proceeds.
- **Most significant gap**: SC-004 is not measurable without a specific latency threshold; this should be resolved before performance acceptance criteria can be tested.
- CHK007–CHK013 collectively gate the "multi-tag AND filtering uses indexed joins (not N+1 queries)" and "performance indexes created" mandatory requirements.
- CHK014–CHK016 collectively gate the "pagination max enforced (per_page max = 100)" mandatory requirement.
