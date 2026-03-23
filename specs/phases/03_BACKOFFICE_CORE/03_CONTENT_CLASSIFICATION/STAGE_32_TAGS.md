# STAGE 32 – Tags

Phase: 03_BACKOFFICE_CORE  
Domain: 03_CONTENT_CLASSIFICATION  
Database: Tenant DB

---

## Stage Status

Status: IN PROGRESS
Step: analyze
Risk Level: HIGH
Last Updated: 2026-03-23T01:00:00Z

Drift Analysis: PASSED (9/9 criteria)
Implementation: AUTHORIZED

Scope Authorized:

- Flat tagging system: tags + tag_relations tenant tables
- Full CRUD on tags (create, read list, read one, update, delete with guard)
- Tag relation lifecycle (create, delete, list by entity, list by tag)
- Two-phase migration: schema 1.15.0 → 1.16.0
- RBAC: question_manage / content_manage permission enforcement
- Entity existence validation with 42P01 forward-compatibility handling

Deferred Scope:

- Tag filtering on entity list endpoints (MCQ/traditional/library) — entity endpoints don't exist yet
- OR-logic multi-tag filtering
- Tag auto-suggestions
- Hierarchical tags (explicitly excluded)
- Frontend display layer

Constitutional Compliance:

- Tenant isolation: PASS — tenant DB only, no cross-tenant joins
- License middleware: PASS — BackofficeEnv platform-level middleware
- Transaction boundaries: PASS — all 5 writes wrapped in BEGIN/COMMIT/ROLLBACK
- Server-authoritative time: PASS — defaultNow() only, no client timestamps
- Idempotency: PASS — app-level check + DB UNIQUE backstop for both tables
- Version enforcement: PASS — schema 1.15.0 → 1.16.0 migration bump
- No business logic in routes: PASS — thin handlers, all logic in service
- No direct DB instantiation: PASS — c.get('db') pattern throughout
- Structured logging: PASS — @zidney/logger with correlation_id on all writes

Notes:
Full drift analysis passed. All 4 guardians returned PASS. Implementation gate open.

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
