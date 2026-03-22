# STAGE 30 – Categories (Classification Dimensions)

Phase: 03_BACKOFFICE_CORE  
Domain: 03_CONTENT_CLASSIFICATION  
Database: Tenant DB

---

## Stage Status

Status: PRODUCTION READY
Step: stage_production_ready
Risk Level: HIGH
Closure Date: 2026-03-22T10:00:00.000Z

Implementation: COMPLETE
Tasks: 35 / 35 completed

Scope Delivered:

- ✅ Migration 008 (tenant DB, schema 1.13.0 → 1.14.0): categories, category_subjects, category_divisions tables with FK constraints, B-tree indexes, CONCURRENT unique indexes
- ✅ Permission seeds: classification:manage + question:manage for ADMIN role
- ✅ Drizzle ORM schemas for all 3 tables (barrel-exported from schemas/index.ts)
- ✅ Domain package packages/domain-core/src/categories/ (7 files): types, errors (14 codes), repository (18 fns), tree assembler (O(N)), dependency registry stub, service (6 fns with transactions + depth/circular guards)
- ✅ Validation: 5 Zod schemas in packages/validation/src/backoffice/categories.schemas.ts
- ✅ API routes: 6 handlers (list, create, tree, get, update, soft-delete) + router factory registered in app.ts
- ✅ Tests: 26 unit + 28 integration = 54 total, all passing
- ✅ Architecture: ai-guard PASS, infra-audit PASS (score 100/100)
- ✅ Quality: lint clean, typecheck clean

Deferred Scope:

- Category Values (STAGE_31) — explicitly deferred; categories provide the classification axis, category values provide the option list

Constitutional Compliance:

- ADR-0001 Database-per-tenant isolation enforced — all queries use tenant pool from Hono context
- ADR-0006 Server-authoritative time enforced — all timestamps via NOW() in SQL
- ADR-0007 Version compatibility enforced — MIN_SCHEMA_VERSION = '1.14.0' in router middleware
- ADR-0008 Semantic versioning enforced — schema bumped 1.13.0 → 1.14.0 in migration
- No middleware bypass — tenant resolver, license, schema version applied to all routes
- All writes transactional — createCategory, updateCategory, deleteCategory use BEGIN/COMMIT/ROLLBACK
- Idempotency enforced — permission seeds use ON CONFLICT DO NOTHING; indexes use IF NOT EXISTS
- Structured logging — logger.error on unhandled exceptions; correlation IDs via AuditContext
- Import boundaries enforced — packages/domain-core has no apps/ imports

Notes:
Stage is production ready. All 35 tasks complete. No structural backend modifications allowed.
Modifications to categories domain require a new stage.

---

## Objective

Implement Category as a structured academic classification dimension.

Categories are dynamic dimensions used to classify questions and content.

Examples:

- Difficulty
- Topic Type
- Bloom Level
- Question Source
- Cognitive Skill

Category is NOT a content hierarchy. Category is NOT a subject replacement. Category is NOT a
division structure.

Category represents a classification axis.

---

## Conceptual Model

Category (dimension) → Category Values (dimension values) → Assigned to questions

Categories define structure. Category Values define selectable options.

Example:

Category: Difficulty  
Values: Easy, Medium, Hard

---

## Data Model

### Table: categories

Columns:

- id (uuid, primary key)
- name (varchar, required)
- code (varchar, optional, unique per tenant)
- description (text, nullable)
- parent_id (uuid, nullable, FK → categories.id, ON DELETE RESTRICT)
- status (ENUM: ENABLED | DISABLED)
- created_at (timestamp)
- updated_at (timestamp)
- created_by (uuid, FK → users.id, nullable)
- updated_by (uuid, FK → users.id, nullable)

Indexes:

- idx_categories_status
- idx_categories_parent
- unique(name)

---

### Table: category_subjects (optional scope restriction)

Columns:

- id (uuid, primary key)
- category_id (uuid, FK → categories.id, ON DELETE CASCADE)
- subject_id (uuid, FK → subjects.id, ON DELETE CASCADE)

Unique constraint:

- unique(category_id, subject_id)

Purpose:

Restricts category availability to specific subjects. If empty → category applies globally to all
subjects.

---

### Table: category_divisions (optional scope restriction)

Columns:

- id (uuid, primary key)
- category_id (uuid, FK → categories.id, ON DELETE CASCADE)
- division_id (uuid, FK → divisions.id, ON DELETE CASCADE)

Unique constraint:

- unique(category_id, division_id)

Purpose:

Restricts category availability to specific divisions. If empty → category applies to all divisions.

---

## Structural Rules

1. Category name must be unique per tenant.
2. parent_id is optional.
3. Circular parent relationships are strictly prohibited.
4. Category cannot reference non-existing subject or division.
5. Deleting a category must be restricted if values or questions reference it.

---

## Hierarchy Support

Parent-child structure allowed for grouping only.

Example:

Main Category: Difficulty  
Child Category: Exam Difficulty  
Child Category: Practice Difficulty

Hierarchy must:

- Be validated against circular references.
- Be limited to reasonable depth (recommended max depth: 3).

Hierarchy does NOT affect grading logic automatically.

---

## Lifecycle Rules

Status = ENABLED:

- Category can be used in question creation.
- Category appears in filtering UI.
- Category values selectable.

Status = DISABLED:

- Cannot be used in new content.
- Existing question references remain valid.
- Historical attempts unaffected.

Hard deletion is NOT allowed if:

- Category has values.
- Category is referenced in questions.
- Category is referenced in auto-selection configuration.

Soft delete via status change recommended.

---

## Access Control

Creation, update, deletion requires:

- question_manage permission OR
- classification_manage permission

Division restrictions enforced via subject scope.

---

## Performance Requirements

Category queries must support:

- Filtering by subject
- Filtering by division
- Filtering by status
- Sorting by name

All foreign keys must be indexed.

---

## Validation Criteria

Stage is complete when:

- Category CRUD works.
- Subject scoping enforced.
- Division scoping enforced.
- Circular parent detection works.
- Unique constraint enforced.
- Deletion restrictions enforced.
- Cross-tenant isolation verified.

---

## Not Allowed

- Category without name.
- Circular parent relationships.
- Cross-tenant category sharing.
- Direct division linkage in question table.
- Hard deletion when referenced.

---

Next stage: STAGE_31_CATEGORY_VALUES
