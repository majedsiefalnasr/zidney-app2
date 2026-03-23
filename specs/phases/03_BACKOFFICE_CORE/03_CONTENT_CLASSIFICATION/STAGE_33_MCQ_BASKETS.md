# STAGE 33 – MCQ BASKETS

Phase: 03_BACKOFFICE_CORE Domain: 03_CONTENT_CLASSIFICATION Database: Tenant DB

---

## Stage Status

Status: IN PROGRESS
Step: analyze
Risk Level: HIGH
Last Updated: 2026-03-23T01:30:00.000Z
Initiated: 2026-03-23T00:00:00.000Z

Drift Analysis: PASSED (all criteria)
Implementation: AUTHORIZED

Scope Authorized:

- Basket CRUD (create, list, get, update, delete) — 22 FRs fully covered
- Workflow transitions: DRAFT → COMPLETED → UNDER_REVIEW → APPROVED → ENABLED
- Question linking/unlinking with UNIQUE constraint and max cap enforcement
- Deletion guard: exam config + auto-selection reference check
- License middleware enforced on all routes
- Database migration: schema version 1.16.0 → 1.17.0

Deferred Scope:

- Auto-selection engine implementation (depends on exam config stage)
- Exam config basket reference schema (separate stage)

Constitutional Compliance:

- All 22 FRs covered | All 14 BRs satisfied | Zero drift violations
- Tenant isolation: per-tenant pool only, no global singleton
- All write paths transactional | Idempotency enforced | Layer boundaries respected
- Security Auditor: PASS | Performance Optimizer: PASS | QA Engineer: PASS | Code Reviewer: PASS

Notes:
Full drift analysis passed. Implementation gate open.

---

## Objective

Implement Basket as a structured MCQ grouping tool used for exam composition and automatic question
selection.

Basket purpose:

- Group MCQ questions
- Control manual exam assembly
- Enable automatic question selection engine
- Provide optional logical segmentation layer

Basket is NOT a classification dimension like Category or Tag.

---

## Conceptual Model

Basket represents a curated or rule-bound container of questions.

There are two basket types:

LINKED

- Basket is logically tied to subject/division context
- Question inclusion must respect classification rules

UNLINKED

- Basket acts as free container
- No strict classification enforcement
- Used for marketing bundles or custom sets

Basket does not override question-level classification.

---

## Table Structure

mcq_baskets

- id (uuid)
- name
- code (unique per workspace)
- type (LINKED | UNLINKED)
- max_questions (nullable)
- description
- status (workflow-managed)
- created_at
- updated_at

Indexes:

- unique(code)
- index(type)
- index(status)

---

mcq_basket_questions

- id (uuid)
- basket_id (fk → mcq_baskets.id)
- question_id (fk → mcq_questions.id)
- created_at

Constraints:

- unique(basket_id, question_id)

Indexes:

- index(basket_id)
- index(question_id)

Cascade rules:

- Deleting question → remove relation row
- Deleting basket → remove relation rows

---

## Workflow Integration

Basket must use the shared status workflow engine.

Status progression:

COMPLETED → UNDER_REVIEW → APPROVED → ENABLED

Rules:

- Only ENABLED baskets can be used in exams
- Basket cannot be ENABLED if empty
- Basket cannot exceed max_questions (if defined)

---

## Business Rules

1. Basket code must be unique per workspace.
2. Question may belong to multiple baskets.
3. Basket may contain questions across multiple lessons.
4. Basket must not enforce subject override.
5. Basket deletion must be blocked if referenced in:
   - MCQ exam configuration
   - Auto-selection rules

---

## Automatic Selection Compatibility

When used in auto-selection engine:

Selection priority:

1. Subject filter
2. Division filter
3. Basket filter
4. Category / Tag filters

Basket filter must use indexed query:

WHERE question_id IN ( SELECT question_id FROM mcq_basket_questions WHERE basket_id = ? )

No N+1 queries allowed.

---

## Integrity Guarantees

System must prevent:

- Orphan basket references
- Duplicate question entries in same basket
- Enabling empty basket
- Using non-enabled basket in exam

---

## Validation Criteria

Stage complete when:

- Basket CRUD operational
- Workflow enforced
- Linking/unlinking questions works
- Basket used in exam config
- Basket used in auto-selection engine
- Deletion guard enforced
- Indexes verified

---

## Architectural Notes

Basket is runtime grouping layer. It must remain lightweight and indexed.

Basket must not introduce cross-tenant logic. All operations must remain tenant-scoped.
