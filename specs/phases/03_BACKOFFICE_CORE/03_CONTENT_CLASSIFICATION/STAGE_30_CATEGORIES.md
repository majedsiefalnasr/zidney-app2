# STAGE 30 – Categories (Classification Dimensions)

Phase: 03_BACKOFFICE_CORE  
Domain: 03_CONTENT_CLASSIFICATION  
Database: Tenant DB

---

## Stage Status

Status: DRAFT
Step: plan
Risk Level: HIGH
Last Updated: 2026-03-22T00:03:00.000Z

Scope Planned:

- Migration 008 (tenant DB, schema 1.13.0 → 1.14.0): categories, category_subjects, category_divisions
- Drizzle ORM schemas for all 3 tables
- Domain package: packages/domain-core/src/categories/ (7 files)
- Validation: packages/validation/src/backoffice/categories.schemas.ts
- API routes: 6 endpoints (GET list, POST create, GET tree, GET single, PATCH update, DELETE soft-delete)
- Unit tests: 31 cases | Integration tests: 22 cases

Deferred Scope:

- Category Values (STAGE_31)

Constitutional Compliance:

- Technical plan compliant — task generation authorized

Notes:
Technical plan complete. Task breakdown in progress.

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
