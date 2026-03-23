# Specification Quality Checklist: MCQ Baskets

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-03-23
**Feature**: [spec.md](../spec.md)
**Stage**: `STAGE_33_MCQ_BASKETS`
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`

---

## Content Quality

- [x] No implementation details (languages, frameworks, APIs beyond endpoint contracts)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders in User Scenarios; technical detail confined to Data Model and API sections
- [x] All mandatory sections completed (Overview, Constitutional Compliance, Isolation Impact, License & Version Enforcement, Data Model, API Endpoints, User Scenarios, Requirements, Business Rules, Validation Criteria, Out of Scope)

---

## Requirement Completeness

- [x] No `[NEEDS CLARIFICATION]` markers remain
- [x] Requirements are testable and unambiguous (each FR has a clear pass/fail condition)
- [x] Success criteria are measurable (Validation Criteria section covers all observable outcomes)
- [x] Success criteria are technology-agnostic where applicable (workflow transitions described behaviorally)
- [x] All acceptance scenarios are defined (5 user stories with scenarios, edge cases section present)
- [x] Edge cases are identified (cascade deletion, null max_questions, empty basket enable attempt, workflow engine failure)
- [x] Scope is clearly bounded (Out of Scope section enumerates 11 exclusions)
- [x] Dependencies and assumptions identified (MCQ Questions must exist, shared workflow engine must be operational, exam config tables must expose reference query)

---

## Feature Readiness

### Basket CRUD

- [x] FR-001 — Basket create with all fields specified
- [x] FR-002 — Code uniqueness enforced (BASKET_CODE_DUPLICATE)
- [x] FR-003 — Initial status = DRAFT
- [x] FR-008 — List with filters (type, status, search) and pagination
- [x] FR-009 — Get single basket by ID
- [x] FR-010 — Update metadata; type and status not updatable via CRUD endpoint
- [x] FR-011 — Delete with deletion guard
- [x] FR-012 — Cascade delete of mcq_basket_questions on basket delete

### Workflow Integration

- [x] FR-004 — Status managed by shared workflow engine only
- [x] FR-005 — Correct transition chain enforced
- [x] FR-006 — ENABLED blocked when basket is empty
- [x] FR-007 — ENABLED blocked when questionCount > max_questions

### Basket-Question Linking

- [x] FR-013 — Link question to basket; uniqueness enforced at DB level
- [x] FR-014 — Link rejected when max_questions cap reached
- [x] FR-015 — Unlink question from basket
- [x] FR-016 — List questions in basket with pagination
- [x] FR-017 — Cascade removal when MCQ question is deleted

### Infrastructure & Contracts

- [x] FR-018 — License middleware on all routes; SOFT_LOCKED → 423, ARCHIVED → 403
- [x] FR-019 — Server-authoritative timestamps; client timestamps rejected
- [x] FR-020 — Indexed subquery for auto-selection filter; no N+1
- [x] FR-021 — All writes in explicit transactions
- [x] FR-022 — All responses conform to `{ success, data, error }` contract

### Business Rules

- [x] BR-01 — Code unique per workspace
- [x] BR-02 — Question may belong to multiple baskets
- [x] BR-03 — Basket spans multiple lessons/subjects/divisions
- [x] BR-04 — LINKED type advisory classification
- [x] BR-05 — UNLINKED type free container
- [x] BR-06 — Basket does not override question-level classification
- [x] BR-07 — Only ENABLED baskets usable in exam config / auto-selection
- [x] BR-08 — Empty basket cannot be ENABLED
- [x] BR-09 — Basket over max_questions cap cannot be ENABLED
- [x] BR-10 — Deletion blocked when referenced
- [x] BR-11 — Duplicate link forbidden at DB constraint
- [x] BR-12 — Indexed subquery for auto-selection; N+1 forbidden
- [x] BR-13 — All operations tenant-scoped
- [x] BR-14 — Server-authoritative timestamps

### Constitutional Compliance

- [x] No cross-tenant access
- [x] No middleware bypass
- [x] No grading outside worker
- [x] No direct DB instantiation
- [x] Snapshot integrity preserved
- [x] All writes transactional
- [x] Forward-only migrations
- [x] Server-authoritative time
- [x] No console.log
- [x] Division boundary preserved
- [x] Idempotency enforced on link operations
- [x] Rate limiting declared

### Index & Data Model

- [x] `UNIQUE(code)` index defined on mcq_baskets
- [x] `idx_mcq_baskets_type` index defined
- [x] `idx_mcq_baskets_status` index defined
- [x] `UNIQUE(basket_id, question_id)` constraint on mcq_basket_questions
- [x] `idx_mcq_basket_questions_basket_id` index defined
- [x] `idx_mcq_basket_questions_question_id` index defined
- [x] CASCADE rules defined for both FK columns in mcq_basket_questions

### Error Code Coverage

- [x] `BASKET_CODE_DUPLICATE` — 409
- [x] `BASKET_NOT_FOUND` — 404
- [x] `BASKET_QUESTION_DUPLICATE` — 409
- [x] `BASKET_QUESTION_NOT_FOUND` — 404
- [x] `BASKET_MAX_QUESTIONS_REACHED` — 422
- [x] `BASKET_EXCEEDS_MAX_QUESTIONS` — 422
- [x] `BASKET_EMPTY_CANNOT_ENABLE` — 422
- [x] `BASKET_REFERENCED_IN_EXAM_CONFIG` — 422
- [x] `BASKET_REFERENCED_IN_AUTO_SELECTION` — 422
- [x] `INVALID_STATE_TRANSITION` — 400
- [x] `QUESTION_NOT_FOUND` — 404
- [x] `VALIDATION_ERROR` — 422
- [x] `FORBIDDEN` — 403

### Out of Scope Coverage

- [x] Division-scoped basket visibility excluded
- [x] Bulk operations excluded
- [x] Basket versioning excluded
- [x] Analytics/reporting excluded
- [x] Frontoffice exposure excluded
- [x] License caps per basket excluded
- [x] Traditional question basket support excluded
- [x] Soft-delete excluded
- [x] Backward workflow transitions excluded
- [x] Basket question reordering excluded
- [x] Cross-tenant basket templates excluded

---

## Notes

- All checklist items reflect the spec as written on 2026-03-23.
- Items marked incomplete require spec updates before `/speckit.clarify` or `/speckit.plan`.
- Dependency on `020-status-workflow-engine` must be verified as COMPLETED before implementation begins.
- Dependency on MCQ Questions table/schema must be confirmed active before migration authoring.
- The `BASKET_REFERENCED_IN_EXAM_CONFIG` and `BASKET_REFERENCED_IN_AUTO_SELECTION` deletion guards
  require the exam configuration and auto-selection rule table schemas to be queryable at delete
  time; confirm those stage specs are at minimum DRAFT-with-schema before implementation.
