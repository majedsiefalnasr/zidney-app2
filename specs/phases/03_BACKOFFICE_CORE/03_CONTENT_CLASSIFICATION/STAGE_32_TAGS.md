# STAGE 32 – Tags

Phase: 03_BACKOFFICE_CORE  
Domain: 03_CONTENT_CLASSIFICATION  
Database: Tenant DB

---

## Stage Status

Status: DRAFT
Step: plan
Risk Level: HIGH
Last Updated: 2026-03-23T00:30:00Z

Scope Planned:

- 2 new tenant DB tables: `tags`, `tag_relations` (migration 20260323_010_tags.ts)
- Schema version bump: 1.15.0 → 1.16.0
- Drizzle schemas: `tags.schema.ts`, `tag-relations.schema.ts`
- Domain package: `packages/domain-core/src/tags/` (errors, types, repo, service, tests)
- Validation: `packages/validation/src/backoffice/tags.schemas.ts`
- 9 Hono route handlers + router index in `apps/api/src/routes/backoffice/tags/`
- Integration tests: `tests/tags.integration.test.ts`

Deferred Scope:

- Tag filtering on entity list endpoints (MCQ, traditional, library) — entity endpoints don't exist yet
- OR-logic multi-tag filtering
- Tag auto-suggestions
- Hierarchical tags (explicitly excluded)
- Frontend display layer

Constitutional Compliance:

- Technical plan compliant — task generation authorized

Notes:
All specification ambiguities resolved. Ready for technical planning.

---

## Objective

Implement a lightweight, non-hierarchical tagging system for flexible content classification.

Tags are:

- Flat (no parent/child structure)
- Optional
- Search and filtering oriented
- Non-authoritative (do not control access or logic)

Tags must never replace structured classification such as:

- Subject
- Lesson
- Category
- Category Value
- Division

Tags are supplementary only.

---

## Data Model

### Table: tags

Columns:

- id (uuid, primary key)
- name (varchar, required)
- normalized_name (varchar, required, unique)
- status (ENUM: ENABLED | DISABLED)
- created_at (timestamp)
- updated_at (timestamp)
- created_by (uuid, FK → users.id, nullable)
- updated_by (uuid, FK → users.id, nullable)

Indexes:

- unique(normalized_name)
- idx_tags_status

normalized_name:

- Lowercased
- Trimmed
- No duplicates allowed
- Enforced unique at DB level

---

### Table: tag_relations

Polymorphic many-to-many relation.

Columns:

- id (uuid, primary key)
- tag_id (uuid, FK → tags.id, ON DELETE CASCADE)
- entity_type (ENUM: MCQ_QUESTION | TRADITIONAL_QUESTION | LIBRARY_FILE)
- entity_id (uuid)
- created_at (timestamp)

Indexes:

- idx_tag_relations_tag_id
- idx_tag_relations_entity
- unique(tag_id, entity_type, entity_id)

---

## Structural Rules

1. Tags are tenant-scoped only.
2. No cross-tenant tagging allowed.
3. Tag assignment must validate entity existence.
4. entity_type must be validated against allowed values.
5. Duplicate tag assignment to same entity is prohibited.

---

## Lifecycle Rules

Status = ENABLED:

- Available for assignment.
- Visible in filters.
- Usable in auto-selection.

Status = DISABLED:

- Cannot be assigned to new entities.
- Existing relations remain valid.
- Historical attempts unaffected.

Hard deletion:

- Allowed only if no relations exist.
- If relations exist → must disable instead.

---

## Access Control

Tag management requires:

- question_manage OR
- content_manage permission

Tag assignment requires:

- Permission to edit the target entity.

---

## Performance Requirements

Tag filtering must support:

- Filtering by single tag
- Filtering by multiple tags (AND logic)
- Pagination-safe queries
- Indexed lookups

All joins must be indexed.

---

## Isolation Guarantees

- tag_relations must never reference entity across tenants.
- All operations must use tenant DB connection from resolver.
- No global tag table allowed.

---

## Validation Criteria

Stage is complete when:

- Tag CRUD works.
- Unique constraint enforced.
- Tag assignment works for supported entity types.
- Duplicate assignment prevented.
- Tag filtering performs under index.
- Cross-tenant isolation verified.

---

## Not Allowed

- Hierarchical tags.
- Tags controlling access rules.
- Cross-tenant tag relations.
- Free-text tag duplication without normalization.

---

Next stage: STAGE_33_MCQ_BASKETS
