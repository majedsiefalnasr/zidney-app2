# STAGE 31 – Category Values

Phase: 03_BACKOFFICE_CORE  
Domain: 03_CONTENT_CLASSIFICATION  
Database: Tenant DB

---

## Stage Status

Status: DRAFT
Step: tasks
Risk Level: HIGH
Last Updated: 2026-03-22T14:40:00.000Z

Tasks Generated:

- Total: 25 atomic tasks across 9 phases
- Phase 0: DB migration (1 task)
- Phase 1: Drizzle ORM schema (4 tasks)
- Phase 2: Error catalog + types (2 tasks)
- Phase 3: Repository layer (1 task — 22 functions)
- Phase 4: Service layer + dependency registry (4 tasks)
- Phase 5: Zod validation schemas (1 task)
- Phase 6: Handler layer (6 tasks)
- Phase 7: Router + registration (2 tasks)
- Phase 8: Unit tests (2 tasks)
- Phase 9: Integration tests (1 task)

Deferred Scope:

- Frontoffice display of category values (not in this stage)
- Scoring/grading logic (explicit non-goal)
- Division logic embedded in values (explicit non-goal)

Constitutional Compliance:

- Task set compliant — drift analysis required before implementation
- Architecture Guardian: PASS (attempt 4)
- API Designer: PASS (attempt 4)

Notes:
Atomic task set generated. Drift analysis gate pending.

---

## Objective

Implement Category Values as structured dimension entries belonging to a Category.

Category Values represent selectable classification values used for:

- Question classification
- Exam filtering
- Automatic question selection
- Reporting and analytics

Example:

Category: Difficulty  
Values: Easy, Medium, Hard

Category: Bloom Level  
Values: Remember, Understand, Apply

Category Values must be structurally safe, strictly bound to their Category, and optimized for
filtering performance.

---

## Conceptual Model

Category → Many Category Values

Each Category Value:

- Must belong to exactly one Category
- Cannot exist independently
- Inherits the logical scope of its Category

Categories define classification dimension. Category Values define the actual selectable dimension
options.

---

## Table Structure

### category_values

Fields:

- id (UUID, PK)
- category_id (FK → categories.id, required, indexed)
- code (string, unique per category)
- status (COMPLETED | UNDER_REVIEW | APPROVED | ENABLED | DISABLED)
- created_at
- updated_at
- deleted_at (nullable, soft delete)

Constraints:

- Unique (category_id, code)
- Foreign key cascade restriction on delete

---

## Translations

Names and descriptions must NOT be stored directly in this table.

All display text must use the translation system:

translations table:

- entity_type = "CATEGORY_VALUE"
- entity_id = category_values.id
- language_code
- field_name (name | description)
- value

Fallback logic must follow workspace default language.

---

## Optional Scope Filters

If Category is scoped to:

- Specific Subjects
- Specific Divisions

Category Values must automatically respect the same scope.

Optional linking tables (only if required by filtering rules):

- category_value_subjects
- category_value_divisions

These tables must:

- Enforce foreign key integrity
- Be indexed for filtering

No cross-workspace reference allowed.

---

## Status Workflow

Category Values follow workspace workflow engine:

COMPLETED → UNDER_REVIEW → APPROVED → ENABLED

Rules:

- Only ENABLED values can be used in:
  - Question creation
  - Exam configuration
  - Auto-selection engine

- DISABLED values:
  - Cannot be assigned to new content
  - Remain attached to existing content for historical integrity

Status transitions must be enforced via Status Workflow Engine.

---

## Usage Boundaries

Category Values are used in:

- MCQ Question classification
- Traditional Question classification
- Automatic question selection filters
- Reporting dimensions

Category Values must NOT:

- Store scoring logic
- Store grading logic
- Store division logic directly
- Override exam configuration

They are classification metadata only.

---

## Deletion Rules

Hard delete is NOT allowed if value is referenced.

If referenced by:

- mcq_questions
- traditional_questions
- exams

Then:

- Deletion must be blocked
- Soft delete only allowed if not referenced

If category is deleted:

- Must block deletion if values exist

Referential integrity must be strictly enforced at DB level.

---

## Indexing Requirements

Required indexes:

- category_id
- status
- (category_id, status)

These are mandatory for:

- Auto-selection performance
- Filtering in Backoffice UI
- Reporting queries

---

## Validation Rules

- category_id required
- code required and unique per category
- Must have at least one translation in default language before moving to APPROVED
- Cannot move to ENABLED if no translation coverage in default language

Validation must be enforced in backend.

---

## Audit & Logging

All operations must log:

- workspace_id
- category_value_id
- action
- actor_user_id
- timestamp

Logs must be structured and traceable.

---

## Not Allowed

- Category Value without Category
- Cross-category reuse
- Cross-workspace reference
- Direct string name storage
- Bypassing workflow engine
- Hard delete when referenced

---

## Validation Criteria

Stage complete when:

- Category Value creation works
- Translation coverage enforced
- Workflow transitions validated
- Indexes exist
- Deletion restrictions enforced
- Auto-selection filters can query efficiently
- Referential integrity verified

---

Next: STAGE_32_TAGS
