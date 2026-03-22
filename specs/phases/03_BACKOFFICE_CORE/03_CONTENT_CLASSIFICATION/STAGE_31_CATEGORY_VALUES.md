# STAGE 31 – Category Values

Phase: 03_BACKOFFICE_CORE  
Domain: 03_CONTENT_CLASSIFICATION  
Database: Tenant DB

---

## Stage Status

Status: IN PROGRESS
Step: analyze
Risk Level: HIGH
Last Updated: 2026-03-22T15:30:00.000Z

Drift Analysis: PASSED (all criteria — Attempt 2)
Implementation: AUTHORIZED

Scope Authorized:

- All 7 user stories covered (US-01 Create, US-02 List, US-03 Get, US-04 Update, US-05 Status Transition, US-06 Soft-Delete, US-07 Translations)
- 5 REST endpoints with writeGuard RBAC enforcement
- DB migration schema_version 1.15.0 (3 tables, 8 indexes, CONCURRENTLY unique index)
- Full TX discipline: PRE-TX validation reads, write TX with FOR UPDATE NOWAIT
- 25 atomic tasks across 10 phases (T001–T025)

Deferred Scope:

- Frontoffice display of category values (not in this stage)
- Scoring/grading logic (explicit non-goal)
- Division logic embedded in values (explicit non-goal)

Constitutional Compliance:

- Structural drift auditor: PASS (Attempt 2, after 9 violations remediated)
- Security Auditor: PASS (SEC-1–SEC-8 all clear)
- Performance Optimizer: PASS (PERF-1–PERF-6 all clear)
- QA Engineer: PASS (QA-1–QA-8 all clear)
- Code Reviewer: PASS (CR-1–CR-8 all clear)

Notes:
Full drift analysis passed. All 9 Attempt 1 violations remediated. Implementation gate open.

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
