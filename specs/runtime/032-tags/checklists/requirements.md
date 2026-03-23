# Specification Quality Checklist: Tags (STAGE 32)

**Purpose**: Validate specification completeness and quality before proceeding to planning  
**Created**: 2026-03-23  
**Feature**: [spec.md](../spec.md)  
**Stage**: `STAGE_32_TAGS`  
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`

---

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders (user scenarios) and technical reviewers (FRs)
- [x] All mandatory sections completed

---

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

---

## API Coverage

- [x] `POST /workspace/:slug/tags` — create tag
- [x] `GET /workspace/:slug/tags` — list tags with filter and pagination
- [x] `GET /workspace/:slug/tags/:id` — get single tag
- [x] `PATCH /workspace/:slug/tags/:id` — update tag name or status
- [x] `DELETE /workspace/:slug/tags/:id` — delete tag (guarded by relation check)
- [x] `POST /workspace/:slug/tag-relations` — assign tag to entity
- [x] `DELETE /workspace/:slug/tag-relations/:id` — remove tag from entity
- [x] `GET /workspace/:slug/entities/:entityType/:entityId/tags` — list tags on entity
- [x] `GET /workspace/:slug/tags/:id/entities` — list entities for tag
- [x] Tag filtering via `tagIds[]` query param on entity list endpoints documented

---

## Data Model Coverage

- [x] `tags` table columns fully specified
- [x] `tag_relations` table columns fully specified
- [x] All indexes documented (`unique(normalized_name)`, `idx_tags_status`, `idx_tag_relations_tag_id`, `idx_tag_relations_entity`, `unique(tag_id, entity_type, entity_id)`)
- [x] `normalized_name` derivation rules defined (lowercase + trim, server-side, unique enforced at DB level)
- [x] `status` ENUM as VARCHAR CHECK constraint documented (not PostgreSQL native ENUM)
- [x] `ON DELETE CASCADE` on `tag_relations.tag_id` documented
- [x] Polymorphic join rationale and FK limitation documented in Assumptions

---

## Business Rules Coverage

- [x] Tags are flat (no hierarchy) — explicitly stated
- [x] Tags are tenant-scoped — enforced in FRs and isolation section
- [x] No cross-tenant tagging — stated as a hard rule
- [x] `normalized_name` uniqueness enforcement — FR-004
- [x] Assignment validation (entity exists, entity type valid, tag enabled) — FR-006 to FR-009
- [x] Duplicate assignment prevention — FR-009
- [x] Hard delete guarded by relation count — FR-010
- [x] DISABLED tag blocks new assignments; existing relations remain valid — FR-006, User Story 5
- [x] Multi-tag AND filtering logic — FR-012
- [x] Self-exclusion on rename (normalize-unique check must exclude own ID) — Edge Cases

---

## Error Handling Coverage

- [x] All error codes registered with HTTP status and description
- [x] Platform error envelope format documented
- [x] `TAG_NOT_FOUND`, `TAG_DUPLICATE`, `TAG_DISABLED`, `TAG_HAS_RELATIONS` covered
- [x] `TAG_RELATION_NOT_FOUND`, `TAG_RELATION_DUPLICATE`, `TAG_RELATION_ENTITY_NOT_FOUND`, `TAG_RELATION_INVALID_ENTITY_TYPE` covered
- [x] `VALIDATION_ERROR`, `FORBIDDEN` covered
- [x] License enforcement errors (423, 403, 404) documented

---

## Access Control Coverage

- [x] Tag management requires `question_manage` OR `content_manage`
- [x] Tag assignment requires edit permission on target entity
- [x] Unauthenticated requests return 401
- [x] Permission failure returns 403
- [x] All endpoint permissions tabulated

---

## Isolation & Constitutional Coverage

- [x] Constitutional compliance table completed
- [x] Isolation impact analysis documented
- [x] Tenant resolver + license middleware mandatory on all routes
- [x] No global tag table allowed
- [x] No cross-tenant joins
- [x] Server-authoritative timestamps only

---

## Test Coverage

- [x] Unit tests specified (normalization, duplicate detection, entity validation, permission checks)
- [x] Integration tests specified (CRUD, normalization uniqueness, assignment scenarios, lifecycle, deletion guard, multi-tag filter, cascade, permission, isolation)
- [x] Migration tests specified (table creation, index presence, CASCADE enforcement)

---

## Out-of-Scope Clarity

- [x] Hierarchical tags explicitly excluded
- [x] Cross-tenant tagging explicitly excluded
- [x] Tags-as-access-control explicitly excluded
- [x] Frontoffice exposure not in scope for this stage
- [x] Bulk assignment, import/export, analytics deferred
- [x] Entity-level orphan cleanup deferred to entity domain stages

---

## Notes

All checklist items pass. No outstanding clarifications required.  
Specification is ready for `/speckit.plan`.
