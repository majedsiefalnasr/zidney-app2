# Traditional Exam Configuration — Technical Plan

**Stage:** STAGE_37_TRADITIONAL_EXAM_CONFIG  
**Phase:** 03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE  
**Spec:** specs/runtime/037-traditional-exam-config/spec.md  
**Date:** 2026-04-02

---

## 1. Architecture Overview

Traditional Exam Configuration follows the exact same layered architecture as MCQ Exam Configuration (Stage 36):

```
Route Handler → Domain Service → Repository → Raw SQL (Tenant DB)
```

**Layers:**

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Validation | `packages/validation/src/backoffice/traditional-exams.schemas.ts` | Zod schemas for request parsing |
| Routes | `apps/api/src/routes/backoffice/traditional-exams/` | HTTP handlers, RBAC guards, error mapping |
| Domain Service | `packages/domain-core/src/traditional-exams/traditional-exams.service.ts` | Business logic, transactions, workflow |
| Repository | `packages/domain-core/src/traditional-exams/traditional-exams.repository.ts` | Raw SQL queries, row mapping |
| Types | `packages/domain-core/src/traditional-exams/traditional-exams.types.ts` | Shared interfaces, DTOs, enums |
| Errors | `packages/domain-core/src/traditional-exams/traditional-exams.errors.ts` | Error codes, HTTP mapping, error class |
| Validators | `packages/domain-core/src/traditional-exams/traditional-exams.validators.ts` | Domain validation rules |
| Dependency Registry | `packages/domain-core/src/traditional-exams/traditional-exams.dependency-registry.ts` | Deletion guard extensibility |
| Schema (Drizzle) | `apps/api/src/db/tenant/schemas/traditional-exams.schema.ts` | Drizzle table definition (type generation) |
| Migration | `apps/api/src/db/tenant/migrations/20260402_015_traditional_exams.ts` | Forward-only tenant DB migration |

---

## 2. Data Model

### 2.1 New Table: `traditional_exams`

```sql
CREATE TABLE traditional_exams (
  id                 UUID           NOT NULL DEFAULT gen_random_uuid(),
  subject_id         UUID           NOT NULL,
  division_id        UUID,
  semester_id        UUID,
  template_id        UUID           NOT NULL,
  name               VARCHAR(500)   NOT NULL,
  code               VARCHAR(100)   NOT NULL,
  description        TEXT,
  duration_minutes   INTEGER,
  pass_percentage    NUMERIC(5,2)   NOT NULL
                       CHECK (pass_percentage > 0 AND pass_percentage <= 100),
  module_type        VARCHAR(20)    NOT NULL
                       CHECK (module_type IN ('TOPIC', 'EXERCISE')),
  status             VARCHAR(30)    NOT NULL DEFAULT 'DRAFT'
                       CHECK (status IN ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ENABLED', 'DISABLED')),
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  created_by         UUID,
  updated_by         UUID,
  CONSTRAINT traditional_exams_pkey PRIMARY KEY (id)
);
```

**Indexes:**
- `idx_traditional_exams_subject_id` on `(subject_id)` — FK lookup
- `idx_traditional_exams_division_id` on `(division_id)` — division-scoped queries
- `idx_traditional_exams_status` on `(status)` — filter by workflow status
- `idx_traditional_exams_module_type` on `(module_type)` — filter by module type
- `idx_traditional_exams_template_id` on `(template_id)` — template reference lookup
- `uq_traditional_exams_code` UNIQUE on `(code)` WHERE `deleted_at IS NULL` — CONCURRENT

**FK constraints:**
- `subject_id → subjects(id)` — validate subject existence
- No FK on `template_id` — treated as opaque UUID; validated at application level
- No FK on `semester_id` — opaque UUID per clarification Q2

**Column naming note:** The column is named `status` (not `workflow_status`) to follow the MCQ exam convention and remain compatible with the shared workflow engine entity table map if future integration is desired.

### 2.2 New Table: `traditional_exam_settings`

```sql
CREATE TABLE traditional_exam_settings (
  id                        UUID        NOT NULL DEFAULT gen_random_uuid(),
  exam_id                   UUID        NOT NULL,
  allow_relax_mode          BOOLEAN     NOT NULL DEFAULT true,
  allow_chrono_mode         BOOLEAN     NOT NULL DEFAULT false,
  allow_review_answers      BOOLEAN     NOT NULL DEFAULT true,
  allow_review_hints        BOOLEAN     NOT NULL DEFAULT false,
  allow_result_effects      BOOLEAN     NOT NULL DEFAULT true,
  show_results_after_submit BOOLEAN     NOT NULL DEFAULT true,
  show_correct_answers      BOOLEAN     NOT NULL DEFAULT false,
  show_explanations         BOOLEAN     NOT NULL DEFAULT false,
  enable_certificate        BOOLEAN     NOT NULL DEFAULT false,
  message_template_id       UUID,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT traditional_exam_settings_pkey PRIMARY KEY (id)
);
```

**Indexes:**
- `uq_traditional_exam_settings_exam_id` UNIQUE on `(exam_id)` — CONCURRENT (1:1 relationship)

**FK constraints:**
- `exam_id → traditional_exams(id)` ON DELETE CASCADE

**Note:** No `allow_rush_mode` column — rush mode is not supported for traditional exams per FR-2.

### 2.3 ALTER TABLE: `traditional_exam_sections`

Add columns to the existing stub (Stage 35):

```sql
ALTER TABLE traditional_exam_sections
  ADD COLUMN template_section_id UUID,
  ADD COLUMN header_content      TEXT,
  ADD COLUMN order_index         INTEGER NOT NULL DEFAULT 0;
```

**Index:**
- `idx_trad_exam_sections_exam_id` on `(exam_id)` — already has FK from stub, add B-tree index

### 2.4 ALTER TABLE: `traditional_exam_subsections`

Add columns to the existing stub (Stage 35):

```sql
ALTER TABLE traditional_exam_subsections
  ADD COLUMN template_subsection_id UUID,
  ADD COLUMN header_content         TEXT,
  ADD COLUMN order_index            INTEGER NOT NULL DEFAULT 0;
```

**Index:**
- `idx_trad_exam_subsections_section_id` on `(section_id)` — B-tree index for subsection lookups within a section

### 2.5 New Table: `traditional_exam_questions`

```sql
CREATE TABLE traditional_exam_questions (
  id              UUID           NOT NULL DEFAULT gen_random_uuid(),
  subsection_id   UUID           NOT NULL,
  question_id     UUID           NOT NULL,
  score           NUMERIC(10,2)  NOT NULL CHECK (score > 0),
  order_index     INTEGER        NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT traditional_exam_questions_pkey PRIMARY KEY (id)
);
```

**Indexes:**
- `idx_trad_exam_questions_subsection_id` on `(subsection_id)` — question list queries
- `uq_trad_exam_questions_subsection_question` UNIQUE on `(subsection_id, question_id)` — CONCURRENT (no duplicates within a subsection)

**FK constraints:**
- `subsection_id → traditional_exam_subsections(id)` ON DELETE CASCADE
- `question_id → traditional_questions(id)` — referential integrity

---

## 3. Migration Strategy

**File:** `apps/api/src/db/tenant/migrations/20260402_015_traditional_exams.ts`  
**Schema version:** 1.20.0 → 1.21.0

**Two-phase approach** (following MCQ exam migration convention):

- **Phase 1 (inside BEGIN/COMMIT):** All DDL (CREATE TABLE, ALTER TABLE), FK constraints, CHECK constraints, B-tree indexes, schema_version bump.
- **Phase 2 (outside transaction):** CONCURRENT unique indexes (cannot run inside a transaction).

**Rollback:** Provide a `down` function that drops tables and removes added columns in reverse order. Column removal uses `ALTER TABLE ... DROP COLUMN IF EXISTS`.

---

## 4. Drizzle Schema Updates

### 4.1 New File: `traditional-exams.schema.ts`

Drizzle schema definition for `traditional_exams` table with all columns, constraints, and type exports (`TraditionalExam`, `NewTraditionalExam`).

### 4.2 New File: `traditional-exam-settings.schema.ts`

Drizzle schema for `traditional_exam_settings` with FK reference to `traditionalExams`.

### 4.3 Update: `traditional-exam-sections.schema.ts`

Add `template_section_id`, `header_content`, `order_index` columns to the existing stub schema. Preserve existing columns.

### 4.4 Update: `traditional-exam-subsections.schema.ts`

Add `template_subsection_id`, `header_content`, `order_index` columns to the existing stub schema. Preserve existing columns.

### 4.5 New File: `traditional-exam-questions.schema.ts`

Drizzle schema for `traditional_exam_questions` with FK references to `traditionalExamSubsections` and `traditionalQuestions`.

---

## 5. Domain-Core Module

### 5.1 Module: `packages/domain-core/src/traditional-exams/`

| File | Purpose |
|------|---------|
| `traditional-exams.types.ts` | DbClient, AuditContext, row types, input DTOs, enums |
| `traditional-exams.errors.ts` | Error codes, HTTP status map, `TraditionalExamError` class |
| `traditional-exams.repository.ts` | Raw SQL: CRUD, queries, counts, existence checks |
| `traditional-exams.service.ts` | Business logic, transactions, template initialization |
| `traditional-exams.validators.ts` | Pre-enable structural validation, pass_percentage validation |
| `traditional-exams.dependency-registry.ts` | Extensible deletion guard for external references |
| `index.ts` | Public barrel export |

### 5.2 Status Transition Logic

Traditional exams do NOT use the shared workflow engine because:
1. The shared engine uses DRAFT → COMPLETED → UNDER_REVIEW → ... (traditional exams skip COMPLETED)
2. Traditional exams add a DISABLED state not present in the shared engine

**Custom transition table in the domain service:**

```
From          → To             | Forward | Action Key  | Pre-condition
DRAFT         → UNDER_REVIEW   | ✓       | review      | —
UNDER_REVIEW  → APPROVED       | ✓       | approve     | —
APPROVED      → ENABLED        | ✓       | enable      | Structural validation must pass (FR-5)
ENABLED       → DISABLED       | ✓       | disable     | —
UNDER_REVIEW  → DRAFT          | ✗       | return      | Reason required
APPROVED      → UNDER_REVIEW   | ✗       | return      | Reason required
```

The transition function follows the same 10-step SELECT FOR UPDATE pattern used by the shared workflow engine but operates within the domain service.

### 5.3 Template Initialization (on exam creation)

When creating an exam, the service:

1. Validates subject exists, division exists (if provided), template_id is a valid UUID
2. Queries the template's sections from a hypothetical `template_sections` table
3. Queries the template's subsections from a hypothetical `template_subsections` table
4. If template has no sections → return 422 error
5. BEGIN transaction:
   a. INSERT `traditional_exams` row
   b. INSERT `traditional_exam_sections` rows (one per template section, copying template_section_id and order_index)
   c. INSERT `traditional_exam_subsections` rows (one per template subsection, copying template_subsection_id and order_index)
6. COMMIT

**Template table assumption:** The plan queries template sections/subsections using raw SQL against assumed table names (`template_sections`, `template_subsections`). Since template CRUD is out of scope (spec §7), the exact table names will be confirmed during implementation. The repository will use:
- `SELECT id, name, order_index FROM template_sections WHERE template_id = $1 ORDER BY order_index`
- `SELECT id, section_id, name, order_index FROM template_subsections WHERE section_id = ANY($1) ORDER BY order_index`

If template tables don't exist yet in the tenant DB, the template validation query will return empty results and the service will throw `TRAD_EXAM_TEMPLATE_NOT_FOUND`.

### 5.4 Structural Validation (Pre-ENABLED)

Before allowing APPROVED → ENABLED:

1. Count exam sections vs. template sections → must match
2. Count exam subsections per section vs. template subsections → must match
3. Every subsection must have ≥1 question
4. `pass_percentage` > 0
5. Sum of all question scores > 0
6. If `allow_chrono_mode` in settings → `duration_minutes` on exam must be > 0

Returns a detailed failure list if any check fails (FR-5).

### 5.5 Key Service Functions

| Function | Responsibility |
|----------|---------------|
| `createExam(db, input, audit)` | Validate + insert exam + init sections/subsections from template |
| `listExams(db, input, audit)` | Paginated list with filters, division-scoping |
| `getExam(db, examId, audit)` | Fetch exam with settings, section/subsection/question counts |
| `updateExam(db, examId, input, audit)` | PATCH update, status guard (DRAFT/UNDER_REVIEW only) |
| `deleteExam(db, examId, audit)` | Soft delete, status guard (DRAFT only), dependency check |
| `transitionExam(db, examId, to, audit)` | Custom status machine with SELECT FOR UPDATE |
| `getSettings(db, examId, audit)` | Fetch 1:1 settings |
| `upsertSettings(db, examId, input, audit)` | Create or replace settings atomically |
| `listSections(db, examId, audit)` | Sections with nested subsections |
| `updateSection(db, examId, sectionId, input, audit)` | Update header/order |
| `updateSubsection(db, examId, sectionId, subsectionId, input, audit)` | Update header/order |
| `listSubsectionQuestions(db, subsectionId, audit)` | Questions in a subsection |
| `assignQuestions(db, subsectionId, input, audit)` | Bulk assign with score snapshot |
| `removeQuestion(db, subsectionId, questionId, audit)` | Remove assignment |
| `reorderQuestions(db, subsectionId, input, audit)` | Exact array replacement of order |

---

## 6. Validation Schemas

**File:** `packages/validation/src/backoffice/traditional-exams.schemas.ts`

Following the MCQ exam validation pattern:

| Schema | Purpose |
|--------|---------|
| `examIdParamSchema` | Path param `:examId` UUID validation |
| `sectionIdParamSchema` | Path params `:examId` + `:sectionId` |
| `subsectionIdParamSchema` | Path params `:examId` + `:sectionId` + `:subsectionId` |
| `questionIdParamSchema` | Path params for question removal |
| `listExamsQuerySchema` | Pagination + filters (page, per_page, subject_id, division_id, module_type, status, search) |
| `createExamBodySchema` | Create body: name, code, description, subjectId, divisionId, semesterId, templateId, durationMinutes, passPercentage, moduleType |
| `updateExamBodySchema` | Partial update body (at least one field required) |
| `upsertSettingsBodySchema` | All boolean delivery flags + messageTemplateId |
| `transitionBodySchema` | Target status string |
| `assignQuestionsBodySchema` | Array of `{ questionId, score }` entries |
| `reorderQuestionsBodySchema` | Array of `{ questionId }` entries (exact replacement) |
| `updateSectionBodySchema` | Optional headerContent + optional orderIndex |
| `updateSubsectionBodySchema` | Optional headerContent + optional orderIndex |

---

## 7. Route Architecture

**Directory:** `apps/api/src/routes/backoffice/traditional-exams/`

| File | Handler | Route |
|------|---------|-------|
| `index.ts` | Router factory `createTraditionalExamsRouter()` | All routes |
| `helpers.ts` | `getDb()`, `buildAuditCtx()`, `successResponse()`, `traditionalExamsErrorResponse()` | Shared |
| `create-exam.ts` | `createExamHandler` | POST `/traditional-exams` |
| `list-exams.ts` | `listExamsHandler` | GET `/traditional-exams` |
| `get-exam.ts` | `getExamHandler` | GET `/traditional-exams/:examId` |
| `update-exam.ts` | `updateExamHandler` | PATCH `/traditional-exams/:examId` |
| `delete-exam.ts` | `deleteExamHandler` | DELETE `/traditional-exams/:examId` |
| `transition-exam.ts` | `transitionExamHandler` | POST `/traditional-exams/:examId/workflow/transition` |
| `get-settings.ts` | `getSettingsHandler` | GET `/traditional-exams/:examId/settings` |
| `upsert-settings.ts` | `upsertSettingsHandler` | PUT `/traditional-exams/:examId/settings` |
| `list-sections.ts` | `listSectionsHandler` | GET `/traditional-exams/:examId/sections` |
| `update-section.ts` | `updateSectionHandler` | PATCH `/traditional-exams/:examId/sections/:sectionId` |
| `list-subsection-questions.ts` | `listSubsectionQuestionsHandler` | GET `.../:subsectionId/questions` |
| `assign-questions.ts` | `assignQuestionsHandler` | POST `.../:subsectionId/questions` |
| `remove-question.ts` | `removeQuestionHandler` | DELETE `.../:subsectionId/questions/:questionId` |
| `reorder-questions.ts` | `reorderQuestionsHandler` | PUT `.../:subsectionId/questions/reorder` |
| `update-subsection.ts` | `updateSubsectionHandler` | PATCH `.../:subsectionId` |

**Router registration in `apps/api/src/app.ts`:**

```typescript
import { traditionalExamsRouter } from './routes/backoffice/traditional-exams'
app.route('/api/v1/backoffice/workspace', traditionalExamsRouter)
```

---

## 8. Error Code Registry

| Code | HTTP | Meaning |
|------|------|---------|
| `TRAD_EXAM_NOT_FOUND` | 404 | Exam not found |
| `TRAD_EXAM_CODE_EXISTS` | 409 | Duplicate exam code |
| `TRAD_EXAM_TEMPLATE_NOT_FOUND` | 404 | Template ID references nonexistent template |
| `TRAD_EXAM_TEMPLATE_EMPTY` | 422 | Template has no sections |
| `TRAD_EXAM_SUBJECT_IMMUTABLE` | 400 | Cannot change subject_id after questions assigned |
| `TRAD_EXAM_TEMPLATE_IMMUTABLE` | 400 | Cannot change template_id after creation |
| `TRAD_EXAM_DELETION_BLOCKED` | 409 | External references prevent deletion |
| `TRAD_EXAM_STATUS_LOCKED` | 400 | Operation not allowed in current status |
| `TRAD_EXAM_INVALID_TRANSITION` | 400 | Invalid status transition |
| `TRAD_EXAM_NO_DELIVERY_MODE` | 400 | At least relax or chrono mode required |
| `TRAD_EXAM_CHRONO_NO_DURATION` | 400 | Chrono mode requires duration > 0 |
| `TRAD_EXAM_ENABLE_VALIDATION` | 400 | Pre-enable structural validation failed |
| `TRAD_EXAM_SECTION_NOT_FOUND` | 404 | Section not found |
| `TRAD_EXAM_SUBSECTION_NOT_FOUND` | 404 | Subsection not found |
| `TRAD_EXAM_QUESTION_SUBJECT_MISMATCH` | 400 | Question subject ≠ exam subject |
| `TRAD_EXAM_QUESTION_NOT_ENABLED` | 400 | Only ENABLED questions can be assigned |
| `TRAD_EXAM_QUESTION_DUPLICATE` | 409 | Question already assigned to this subsection |
| `TRAD_EXAM_SETTINGS_NOT_FOUND` | 404 | Settings not yet created |
| `TRAD_EXAM_RETURN_REASON_REQUIRED` | 400 | Backward transition requires reason |

---

## 9. Transaction Boundaries

| Operation | Strategy |
|-----------|----------|
| Create exam (with template init) | Single TX: insert exam → insert sections → insert subsections |
| Update exam | Single TX: SELECT FOR UPDATE → validate status → UPDATE |
| Delete exam | Single TX: check dependencies → soft delete |
| Transition status | Single TX: SELECT FOR UPDATE → validate transition → UPDATE status + timestamps |
| Assign questions | Single TX: validate each question → INSERT/ON CONFLICT IGNORE |
| Remove question | Single query (no TX needed — single DELETE) |
| Reorder questions | Single TX: DELETE all orders → re-INSERT with new order_index values |
| Upsert settings | Single TX: INSERT ... ON CONFLICT (exam_id) DO UPDATE |

---

## 10. Idempotency Strategy

| Operation | Approach |
|-----------|----------|
| Question assignment | UNIQUE(subsection_id, question_id) — ON CONFLICT returns existing row |
| Settings upsert | UNIQUE(exam_id) — INSERT ON CONFLICT DO UPDATE |
| Status transition | SELECT FOR UPDATE prevents concurrent transitions |
| Reorder | Exact-array replacement (client sends full order) |

---

## 11. Division-Scoped Access

Division filtering is applied at the SQL query layer:

- `listExams`: WHERE clause includes `(division_id = $divisionId OR division_id IS NULL)` when division context is present
- `getExam`: Same filter when fetching single exam
- Other child-resource endpoints (sections, questions) access through the exam first — exam ownership implicitly enforces division scope

No additional middleware — filtering is built into repository queries.

---

## 12. Testing Strategy

| Test Level | Coverage Area |
|------------|---------------|
| Unit tests | Domain validators (pass_percentage, structural validation, transition rules) |
| Unit tests | Error class and HTTP status mapping |
| Unit tests | Dependency registry |
| Integration tests | All 15 API endpoints with tenant isolation |
| Integration tests | Template initialization during create |
| Integration tests | Status transition flow (DRAFT → ... → ENABLED → DISABLED) |
| Integration tests | Division-scoped access enforcement |
| Integration tests | Idempotency (duplicate question assignment, settings upsert) |

---

## 13. Files to Create/Modify

### New Files (17)

| # | File Path | Purpose |
|---|-----------|---------|
| 1 | `apps/api/src/db/tenant/migrations/20260402_015_traditional_exams.ts` | Forward-only migration |
| 2 | `apps/api/src/db/tenant/schemas/traditional-exams.schema.ts` | Drizzle schema |
| 3 | `apps/api/src/db/tenant/schemas/traditional-exam-settings.schema.ts` | Drizzle schema |
| 4 | `apps/api/src/db/tenant/schemas/traditional-exam-questions.schema.ts` | Drizzle schema |
| 5 | `packages/domain-core/src/traditional-exams/traditional-exams.types.ts` | Types & DTOs |
| 6 | `packages/domain-core/src/traditional-exams/traditional-exams.errors.ts` | Error definitions |
| 7 | `packages/domain-core/src/traditional-exams/traditional-exams.repository.ts` | Repository layer |
| 8 | `packages/domain-core/src/traditional-exams/traditional-exams.service.ts` | Service layer |
| 9 | `packages/domain-core/src/traditional-exams/traditional-exams.validators.ts` | Domain validators |
| 10 | `packages/domain-core/src/traditional-exams/traditional-exams.dependency-registry.ts` | Deletion guard |
| 11 | `packages/domain-core/src/traditional-exams/index.ts` | Public barrel |
| 12 | `packages/validation/src/backoffice/traditional-exams.schemas.ts` | Zod validation |
| 13 | `apps/api/src/routes/backoffice/traditional-exams/index.ts` | Router factory |
| 14 | `apps/api/src/routes/backoffice/traditional-exams/helpers.ts` | Shared utilities |
| 15 | `apps/api/src/routes/backoffice/traditional-exams/create-exam.ts` | Create handler |
| 16 | `apps/api/src/routes/backoffice/traditional-exams/list-exams.ts` | List handler |
| 17 | `apps/api/src/routes/backoffice/traditional-exams/get-exam.ts` | Get handler |

(Route handler files 18–28 follow the same pattern — one file per endpoint)

| # | File Path | Purpose |
|---|-----------|---------|
| 18 | `apps/api/src/routes/backoffice/traditional-exams/update-exam.ts` | Update handler |
| 19 | `apps/api/src/routes/backoffice/traditional-exams/delete-exam.ts` | Delete handler |
| 20 | `apps/api/src/routes/backoffice/traditional-exams/transition-exam.ts` | Transition handler |
| 21 | `apps/api/src/routes/backoffice/traditional-exams/get-settings.ts` | Get settings handler |
| 22 | `apps/api/src/routes/backoffice/traditional-exams/upsert-settings.ts` | Upsert settings handler |
| 23 | `apps/api/src/routes/backoffice/traditional-exams/list-sections.ts` | List sections handler |
| 24 | `apps/api/src/routes/backoffice/traditional-exams/update-section.ts` | Update section handler |
| 25 | `apps/api/src/routes/backoffice/traditional-exams/list-subsection-questions.ts` | List questions handler |
| 26 | `apps/api/src/routes/backoffice/traditional-exams/assign-questions.ts` | Assign questions handler |
| 27 | `apps/api/src/routes/backoffice/traditional-exams/remove-question.ts` | Remove question handler |
| 28 | `apps/api/src/routes/backoffice/traditional-exams/reorder-questions.ts` | Reorder questions handler |
| 29 | `apps/api/src/routes/backoffice/traditional-exams/update-subsection.ts` | Update subsection handler |

### Modified Files (3)

| # | File Path | Change |
|---|-----------|--------|
| 30 | `apps/api/src/db/tenant/schemas/traditional-exam-sections.schema.ts` | Add template_section_id, header_content, order_index columns |
| 31 | `apps/api/src/db/tenant/schemas/traditional-exam-subsections.schema.ts` | Add template_subsection_id, header_content, order_index columns |
| 32 | `apps/api/src/app.ts` | Import and register `traditionalExamsRouter` |

---

## 14. Architectural Governance Compliance

| Check | Status | Notes |
|-------|--------|-------|
| No cross-tenant logic (ADR-0001) | ✅ | All queries scoped via tenant pool from resolver |
| All writes transactional | ✅ | BEGIN/COMMIT/ROLLBACK for all mutations |
| Server-authoritative time (ADR-0006) | ✅ | NOW() in SQL, no client timestamps |
| License middleware enforced | ✅ | Workspace route prefix applies license middleware |
| Import boundaries respected | ✅ | domain-core has no HTTP/app imports; routes import from packages only |
| No architecture redesign without ADR | ✅ | No new module patterns — follows MCQ exam precedent |
| Trust chain respected | ✅ | Tenant → License → Auth → RBAC → Handler |
| Error contract followed | ✅ | `{ success, data, error }` on all responses |
| Snapshot integrity | ✅ | Question score copied at assignment time |

---

## 15. Open Risks

| Risk | Mitigation |
|------|-----------|
| Template tables may not exist in tenant DB | Service returns TRAD_EXAM_TEMPLATE_NOT_FOUND if query returns empty. Tested in integration tests. |
| Large template initialization (many sections/subsections) | Single transaction ensures atomicity. N+1 avoided by bulk INSERT. |
| Concurrent status transitions | SELECT FOR UPDATE pattern prevents race conditions. |
