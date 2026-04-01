# Traditional Exam Configuration — Specification

**Stage:** STAGE_37_TRADITIONAL_EXAM_CONFIG  
**Phase:** 03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE  
**Database:** Tenant DB  
**Generated:** 2026-04-01

---

## 1. Overview

This stage implements the Traditional Exam configuration system for the Zidney backoffice. A traditional exam is a structured paper-style assessment built on top of a predefined template (sections → subsections). Staff users configure an exam by binding questions to subsections, defining scoring, delivery settings, and managing workflow transitions.

The stage covers:

- **Core CRUD** for `traditional_exams` table
- **Delivery settings** for `traditional_exam_settings` (one-to-one with exam)
- **Exam content structure** — completing the stub schemas for `traditional_exam_sections` and `traditional_exam_subsections` with full columns
- **Question assignment** to subsections via `traditional_exam_questions` join table with snapshot scoring
- **Workflow status transitions** (DRAFT → UNDER_REVIEW → APPROVED → ENABLED → DISABLED)
- **Structural validation** before ENABLED status
- **Division-scoped access control** (staff sees only own division's exams)
- **Zod validation schemas** for all API inputs
- **Domain-core service layer** (pure functions, no HTTP)

---

## 2. Functional Requirements

### FR-1: Exam CRUD

- **Create exam**: POST body includes name, code, subject_id, division_id (optional), semester_id (optional), description (optional), duration_minutes (optional), pass_percentage, module_type (TOPIC | EXERCISE), template_id.
- **List exams**: Paginated, filterable by subject_id, division_id, module_type, workflow_status. Division-scoped for staff.
- **Get exam**: By ID. Include settings and section/subsection/question counts.
- **Update exam**: PATCH — only allowed when status is DRAFT or UNDER_REVIEW. Cannot change template_id once created. Cannot change subject_id once questions are assigned.
- **Delete exam**: Soft delete (set `deleted_at`). Only if status is DRAFT.

### FR-2: Delivery Settings

- **Get settings**: GET by exam ID. Returns the one-to-one settings row.
- **Upsert settings**: PUT replaces all settings atomically for the exam.
- Constraints:
  - At least one mode must be enabled (`allow_relax_mode` OR `allow_chrono_mode`).
  - Rush mode is NOT supported — no `allow_rush_mode` column.
  - `allow_chrono_mode = true` requires `duration_minutes > 0` on the exam.

### FR-3: Exam Content Structure (Section/Subsection/Questions)

- **Sections** are initialized from the template when the exam is created. Each section maps to a `template_section_id`. Staff can edit `header_content` and reorder sections.
- **Subsections** are initialized from the template. Each subsection maps to a `template_subsection_id`. Staff can edit `header_content` and reorder subsections within a section.
- **Questions** are assigned to subsections via `traditional_exam_questions`.
  - Each assignment copies the question's `score` as a snapshot at assignment time.
  - Questions must be ENABLED and share the same `subject_id` as the exam.
  - A question can only appear once per subsection (unique constraint).
  - Questions can be reordered within a subsection.
  - Removing a question assignment does not affect the source question.

### FR-4: Workflow Status Transitions

Valid transitions:

```
DRAFT → UNDER_REVIEW → APPROVED → ENABLED
ENABLED → DISABLED
```

Rules:

- Only `APPROVED → ENABLED` requires structural validation to pass.
- Cannot revert to DRAFT after ENABLED.
- DISABLED prevents new attempts but preserves existing data.
- Transition requires `exam_manage` or `content_manage` or `content_review` permission.

### FR-5: Structural Validation (for ENABLED transition)

Before allowing `APPROVED → ENABLED`:

1. All template sections must have corresponding exam sections.
2. All template subsections must have corresponding exam subsections.
3. Every subsection must have at least one question assigned.
4. `pass_percentage` must be defined and > 0.
5. Total score (sum of all question scores) must be > 0.
6. If `allow_chrono_mode = true` in settings, `duration_minutes` must be > 0.

A single failed check returns a detailed error listing all failures.

### FR-6: Division-Scoped Access

- Staff can only see and manage exams in their assigned divisions.
- Division scoping is enforced at the query layer via `division_id`.
- If `division_id` is null on the exam, it is visible to all staff in any division (fallback to default).

---

## 3. Data Model Changes

### 3.1 New Table: `traditional_exams`

Full column set as defined in the stage file (id, subject_id, division_id, semester_id, name, code, description, duration_minutes, pass_percentage, module_type, workflow_status, template_id, created_at, updated_at, created_by, updated_by, deleted_at).

### 3.2 New Table: `traditional_exam_settings`

One-to-one with `traditional_exams`. All boolean delivery flags + message_template_id.

### 3.3 ALTER: `traditional_exam_sections`

Add columns to the existing stub: `template_section_id`, `header_content`, `order_index`.

### 3.4 ALTER: `traditional_exam_subsections`

Add columns to the existing stub: `template_subsection_id`, `header_content`, `order_index`.

### 3.5 New Table: `traditional_exam_questions`

Join table linking subsections to questions with snapshot `score` and `order_index`.

---

## 4. API Endpoints

All under `/api/v1/backoffice/workspace/traditional-exams`.

| Method | Path                                                                                             | Guard           | Description                                           |
| ------ | ------------------------------------------------------------------------------------------------ | --------------- | ----------------------------------------------------- |
| GET    | `/traditional-exams`                                                                             | readGuard       | List exams (paginated, filtered)                      |
| POST   | `/traditional-exams`                                                                             | writeGuard      | Create exam + init sections/subsections from template |
| GET    | `/traditional-exams/:examId`                                                                     | readGuard       | Get exam detail with counts                           |
| PATCH  | `/traditional-exams/:examId`                                                                     | writeGuard      | Update exam                                           |
| DELETE | `/traditional-exams/:examId`                                                                     | writeGuard      | Soft delete exam                                      |
| POST   | `/traditional-exams/:examId/workflow/transition`                                                 | transitionGuard | Transition workflow status                            |
| GET    | `/traditional-exams/:examId/settings`                                                            | readGuard       | Get delivery settings                                 |
| PUT    | `/traditional-exams/:examId/settings`                                                            | writeGuard      | Upsert delivery settings                              |
| GET    | `/traditional-exams/:examId/sections`                                                            | readGuard       | List sections with subsections                        |
| PATCH  | `/traditional-exams/:examId/sections/:sectionId`                                                 | writeGuard      | Update section header/order                           |
| GET    | `/traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions`             | readGuard       | List questions in subsection                          |
| POST   | `/traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions`             | writeGuard      | Assign questions to subsection                        |
| DELETE | `/traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions/:questionId` | writeGuard      | Remove question from subsection                       |
| PUT    | `/traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions/reorder`     | writeGuard      | Reorder questions in subsection                       |
| PATCH  | `/traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId`                       | writeGuard      | Update subsection header/order                        |

Guards:

- readGuard: `requireAnyPermission(['exam_manage', 'content_manage', 'content_read'])`
- writeGuard: `requireAnyPermission(['exam_manage', 'content_manage'])`
- transitionGuard: `requireAnyPermission(['exam_manage', 'content_manage', 'content_review'])`

---

## 5. Non-Functional Requirements

- **Performance**: List endpoints paginated with cursor/offset. Index on subject_id, division_id, workflow_status, module_type.
- **Tenant isolation**: All DB access via tenant resolver context. No cross-tenant references.
- **Idempotency**: Question assignment uses unique constraint on (subsection_id, question_id), upsert semantics on conflict.
- **Transactions**: Exam creation (with section/subsection initialization) must be atomic.
- **Structured logging**: All mutations logged with correlation_id and workspace_id.
- **Error contract**: All responses follow `{ success, data, error }` format.

---

## 6. Dependencies

| Dependency                          | Status                       | Notes                                                                            |
| ----------------------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| `subjects` table                    | ✅ Exists                    | FK from traditional_exams                                                        |
| `traditional_questions` table       | ✅ Stage 35 delivered        | FK from traditional_exam_questions                                               |
| `traditional_exam_sections` stub    | ✅ Stage 35 created          | This stage completes the schema                                                  |
| `traditional_exam_subsections` stub | ✅ Stage 35 created          | This stage completes the schema                                                  |
| Template tables                     | ⚠️ Referenced by template_id | This stage treats template_id as opaque UUID — template CRUD is a separate stage |
| RBAC middleware                     | ✅ Exists                    | `requireAnyPermission`                                                           |
| Tenant resolver                     | ✅ Exists                    | `getDb(c)` pattern                                                               |

---

## 7. Out of Scope

- Template CRUD (templates are pre-existing; treated as opaque references)
- Attempt/delivery engine (separate scheduling/attempt stages)
- Student-facing exam views (Frontoffice)
- Certificate generation
- Import/export of exam structures
- Bulk question assignment

---

## 8. Constraints (from Zidney Constitution)

- Database-per-tenant isolation (ADR-0001)
- No cross-tenant joins
- License middleware on all workspace routes
- Server-authoritative time only
- All writes transactional
- Worker-only for async processing (not needed in this stage)
- Error contract: `{ success, data, error }`
- Snapshot integrity: score copied at assignment time, not live-referenced
