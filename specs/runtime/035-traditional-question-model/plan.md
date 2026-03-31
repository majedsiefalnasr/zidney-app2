# Technical Plan — Traditional Question Model

**Stage:** STAGE_35_TRADITIONAL_QUESTION_MODEL  
**Phase:** 03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE  
**Spec:** `specs/runtime/035-traditional-question-model/spec.md`  
**Author:** AI Orchestrator  
**Date:** 2026-03-31

---

## 1. Overview

This plan implements the Traditional Question Model — a dedicated question engine for
paper-style exam questions (TRUE_FALSE, FILL_BLANK, SHORT_ANSWER). The implementation
follows the exact MCQ Question Model (Stage 034) structural pattern for consistency
but with type-specific adaptations for JSONB-based correct answer storage.

**Pattern Reference:** Stage 034 (MCQ Question Model) — same layering, same file
structure, same domain-core → API → validation architecture.

---

## 2. Architecture Layers

| Layer            | Changes                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| DB Tenant        | 1 migration: 5 tables (2 stub + 1 core + 2 join), indexes, constraints    |
| Domain Core      | New `packages/domain-core/src/traditional-questions/` module — 8 files    |
| Validation       | New `packages/validation/src/backoffice/traditional-questions.schemas.ts` |
| API Routes       | New `apps/api/src/routes/backoffice/traditional-questions/` — 12 files    |
| Drizzle Schema   | New `apps/api/src/db/tenant/schemas/traditional-questions.schema.ts` + 2  |
| App Registration | `apps/api/src/app.ts` — register `traditionalQuestionsRouter`             |
| Workflow Engine  | Add `traditional_question` to `ENTITY_TABLE_MAP` (already declared)       |

**Layers NOT touched:**

- Worker (no background jobs)
- Frontend (backoffice UI deferred)
- DB Master (no master schema changes)
- Redis (no caching in v1)

---

## 3. Data Model

### 3.1 Stub Tables (Stage 37 dependency resolution)

**Table: `traditional_exam_sections`** (stub — Stage 37 adds full columns)

| Column     | Type        | Constraints                   |
| ---------- | ----------- | ----------------------------- |
| id         | UUID        | PK, DEFAULT gen_random_uuid() |
| exam_id    | UUID        | NOT NULL                      |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()       |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()       |

**Table: `traditional_exam_subsections`** (stub — Stage 37 adds full columns)

| Column     | Type        | Constraints                   |
| ---------- | ----------- | ----------------------------- |
| id         | UUID        | PK, DEFAULT gen_random_uuid() |
| section_id | UUID        | NOT NULL, FK → sections.id    |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()       |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()       |

### 3.2 Core Table

**Table: `traditional_questions`**

| Column            | Type         | Constraints                                               |
| ----------------- | ------------ | --------------------------------------------------------- |
| id                | UUID         | PK, DEFAULT gen_random_uuid()                             |
| subject_id        | UUID         | NOT NULL, FK → subjects.id (RESTRICT)                     |
| division_id       | UUID         | NULL, FK → divisions.id (RESTRICT) — migration-owned      |
| subsection_id     | UUID         | NOT NULL, FK → subsections.id (RESTRICT)                  |
| question_type     | VARCHAR(20)  | NOT NULL, CHECK IN (TRUE_FALSE, FILL_BLANK, SHORT_ANSWER) |
| language          | VARCHAR(10)  | NOT NULL                                                  |
| content           | TEXT         | NOT NULL                                                  |
| correct_answer    | JSONB        | NOT NULL                                                  |
| explanation       | TEXT         | NULL                                                      |
| score             | NUMERIC(8,2) | NOT NULL, CHECK > 0                                       |
| is_revision_only  | BOOLEAN      | NOT NULL, DEFAULT false                                   |
| is_exam_only      | BOOLEAN      | NOT NULL, DEFAULT false                                   |
| difficulty_level  | VARCHAR(20)  | NULL                                                      |
| status            | VARCHAR(30)  | NOT NULL, DEFAULT 'DRAFT'                                 |
| deleted_at        | TIMESTAMPTZ  | NULL (soft delete)                                        |
| created_at        | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                                   |
| updated_at        | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                                   |
| created_by        | UUID         | NULL                                                      |
| updated_by        | UUID         | NULL                                                      |
| status_updated_at | TIMESTAMPTZ  | NULL                                                      |
| status_updated_by | UUID         | NULL                                                      |

**Indexes:**

- `idx_traditional_questions_subject_id` — B-tree on subject_id
- `idx_traditional_questions_division_id` — B-tree on division_id
- `idx_traditional_questions_subsection_id` — B-tree on subsection_id
- `idx_traditional_questions_question_type` — B-tree on question_type
- `idx_traditional_questions_status` — B-tree on status
- `idx_traditional_questions_deleted_at` — B-tree on deleted_at

**Check constraints:**

- `traditional_questions_type_check` — question_type IN ('TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER')
- `traditional_questions_status_check` — status IN ('DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')
- `traditional_questions_score_check` — score > 0

### 3.3 Join Tables

**Table: `traditional_question_categories`** (M:N → category_values)

| Column            | Type | Constraints                                       |
| ----------------- | ---- | ------------------------------------------------- |
| id                | UUID | PK, DEFAULT gen_random_uuid()                     |
| question_id       | UUID | NOT NULL, FK → traditional_questions.id (CASCADE) |
| category_value_id | UUID | NOT NULL                                          |

- UNIQUE (question_id, category_value_id)
- Index on question_id

**Table: `traditional_question_tags`** (M:N → tags)

| Column      | Type | Constraints                                       |
| ----------- | ---- | ------------------------------------------------- |
| id          | UUID | PK, DEFAULT gen_random_uuid()                     |
| question_id | UUID | NOT NULL, FK → traditional_questions.id (CASCADE) |
| tag_id      | UUID | NOT NULL                                          |

- UNIQUE (question_id, tag_id)
- Index on question_id

### 3.4 JSONB correct_answer Schemas

```
TRUE_FALSE:    { "value": boolean }
FILL_BLANK:    { "accepted_values": string[] }  // min 1, trimmed, unique
SHORT_ANSWER:  { "model_answer": string }        // min 1 char
```

Validation enforced at API layer via Zod discriminated union — no DB CHECK on JSONB structure.

---

## 4. Migration Plan

**File:** `apps/api/src/db/tenant/migrations/20260331_013_traditional_questions.ts`

**Naming:** Next sequential number after `20260330_012_mcq_questions.ts` → migration 013.

**Schema version bump:** 1.18.0 → 1.19.0

**Two-phase approach** (following MCQ pattern):

- **Phase 1** (inside BEGIN/COMMIT): All DDL, FK constraints, B-tree indexes, schema version bump
- **Phase 2** (outside transaction): CONCURRENT unique indexes on join tables

**Migration order within Phase 1:**

1. Create stub `traditional_exam_sections` (IF NOT EXISTS)
2. Create stub `traditional_exam_subsections` (IF NOT EXISTS) with FK → sections
3. Create `traditional_questions` with all FKs, CHECKs, B-tree indexes
4. Create `traditional_question_categories` with FK, B-tree index
5. Create `traditional_question_tags` with FK, B-tree index
6. Bump schema_version to 1.19.0

**Phase 2:** 7. CREATE UNIQUE INDEX CONCURRENTLY on `traditional_question_categories(question_id, category_value_id)` 8. CREATE UNIQUE INDEX CONCURRENTLY on `traditional_question_tags(question_id, tag_id)`

**Down migration:** DROP tables in reverse order. Stub tables (`traditional_exam_sections`, `traditional_exam_subsections`) are NOT dropped in down — Stage 37 owns their lifecycle.

---

## 5. Domain Core Module

**Location:** `packages/domain-core/src/traditional-questions/`

**Files (following MCQ pattern exactly):**

| File                                           | Purpose                                               |
| ---------------------------------------------- | ----------------------------------------------------- |
| `index.ts`                                     | Public barrel export                                  |
| `traditional-questions.types.ts`               | Domain types, enums, DbClient, AuditContext re-export |
| `traditional-questions.errors.ts`              | Error codes, HTTP status map, error class             |
| `traditional-questions.repository.ts`          | Pure SQL queries — no TX management                   |
| `traditional-questions.service.ts`             | Business logic, TX orchestration, workflow delegation |
| `traditional-questions.validators.ts`          | correct_answer JSONB validation per question type     |
| `traditional-questions.sanitize.ts`            | Rich text sanitization (reuse sanitizeRichText)       |
| `traditional-questions.dependency-registry.ts` | Pluggable deletion guard registry                     |

**Key Design Decisions:**

1. **DbClient & AuditContext** — re-export from MCQ types (identical interface) or define locally
2. **correct_answer validation** — discriminated union based on `question_type`:
   - TRUE_FALSE → `{ value: boolean }` — must be a boolean
   - FILL_BLANK → `{ accepted_values: string[] }` — min 1, each trimmed, deduplicated
   - SHORT_ANSWER → `{ model_answer: string }` — min 1 char
3. **Workflow integration** — use `executeTransition` from `@zidney/domain-core/workflow` with entity type `traditional_question` (already in ENTITY_TABLE_MAP)
4. **Deletion guard** — same pattern as MCQ: pluggable `QuestionReferenceChecker` registry. In v1, checks only `traditional_exam_subsections` for question references (if linkage exists).
5. **Sanitization** — reuse the same `sanitizeRichText` function from MCQ module (or extract to shared utility)
6. **Transaction boundaries** — all write operations (create, update, delete, transition, link/unlink) wrapped in BEGIN/COMMIT/ROLLBACK
7. **Idempotency** — unique constraint on join tables prevents duplicate links. Create endpoint returns 409 on constraint violation.

---

## 6. Validation Schemas

**File:** `packages/validation/src/backoffice/traditional-questions.schemas.ts`

Following MCQ pattern with these adaptations:

| Schema                         | Purpose                                                 |
| ------------------------------ | ------------------------------------------------------- |
| `questionIdParamSchema`        | Path param: questionId UUID                             |
| `questionCategoryParamSchema`  | Path params: questionId + categoryValueId               |
| `questionTagParamSchema`       | Path params: questionId + tagId                         |
| `listQuestionsQuerySchema`     | Query: page, per_page, filters, search                  |
| `createQuestionBodySchema`     | Body: all fields + correct_answer (discriminated union) |
| `updateQuestionBodySchema`     | Body: partial update (no type/subject change)           |
| `transitionQuestionBodySchema` | Body: { to: WorkflowState, reason?: string }            |
| `linkCategoryBodySchema`       | Body: { categoryValueId: UUID }                         |
| `linkTagBodySchema`            | Body: { tagId: UUID }                                   |

**correct_answer validation** — Zod discriminated union:

```typescript
const correctAnswerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("TRUE_FALSE"), value: z.boolean() }),
  z.object({
    type: z.literal("FILL_BLANK"),
    accepted_values: z.array(z.string().trim().min(1)).min(1),
  }),
  z.object({ type: z.literal("SHORT_ANSWER"), model_answer: z.string().trim().min(1) }),
]);
```

Wait — the `correct_answer` JSONB doesn't include a `type` discriminator field. The type is
determined by `question_type` on the parent. So validation is conditional based on `question_type`:

```typescript
// In createQuestionBodySchema, use .superRefine() to validate correct_answer against questionType
```

---

## 7. API Routes

**Location:** `apps/api/src/routes/backoffice/traditional-questions/`

**Files (following MCQ pattern):**

| File                     | Route                                                                 | Method |
| ------------------------ | --------------------------------------------------------------------- | ------ |
| `index.ts`               | Router factory + export                                               | —      |
| `helpers.ts`             | getDb, buildAuditCtx, errorResponse, successResponse                  | —      |
| `list-questions.ts`      | GET /traditional-questions                                            | GET    |
| `create-question.ts`     | POST /traditional-questions                                           | POST   |
| `get-question.ts`        | GET /traditional-questions/:questionId                                | GET    |
| `update-question.ts`     | PATCH /traditional-questions/:questionId                              | PATCH  |
| `delete-question.ts`     | DELETE /traditional-questions/:questionId                             | DELETE |
| `transition-question.ts` | POST /traditional-questions/:questionId/workflow/transition           | POST   |
| `link-category.ts`       | POST /traditional-questions/:questionId/categories                    | POST   |
| `unlink-category.ts`     | DELETE /traditional-questions/:questionId/categories/:categoryValueId | DELETE |
| `link-tag.ts`            | POST /traditional-questions/:questionId/tags                          | POST   |
| `unlink-tag.ts`          | DELETE /traditional-questions/:questionId/tags/:tagId                 | DELETE |

**Route registration** in `apps/api/src/app.ts`:

```typescript
import { traditionalQuestionsRouter } from "./routes/backoffice/traditional-questions";
// ...
app.route("/api/v1/backoffice/workspace", traditionalQuestionsRouter);
```

**Permission guards** (same as MCQ):

- Read: `requireAnyPermission(['question_manage', 'content_manage', 'content_read'])`
- Write: `requireAnyPermission(['question_manage', 'content_manage'])`
- Transition: `requireAnyPermission(['question_manage', 'content_manage', 'content_review'])`

---

## 8. Drizzle Schema Definitions

Three new schema files:

| File                                                                    | Table                               |
| ----------------------------------------------------------------------- | ----------------------------------- |
| `apps/api/src/db/tenant/schemas/traditional-exam-sections.schema.ts`    | traditional_exam_sections (stub)    |
| `apps/api/src/db/tenant/schemas/traditional-exam-subsections.schema.ts` | traditional_exam_subsections (stub) |
| `apps/api/src/db/tenant/schemas/traditional-questions.schema.ts`        | traditional_questions + join tables |

These are used for Drizzle type inference only — FK constraints are migration-owned (not Drizzle-managed).

---

## 9. Transaction Boundaries

| Operation           | TX Strategy                                      |
| ------------------- | ------------------------------------------------ |
| Create question     | BEGIN → insert question → COMMIT                 |
| Update question     | BEGIN → SELECT FOR UPDATE → update → COMMIT      |
| Delete question     | BEGIN → guard check → soft delete → COMMIT       |
| Workflow transition | Delegated to workflow engine (SELECT FOR UPDATE) |
| Link category       | BEGIN → check exists → insert → COMMIT           |
| Unlink category     | BEGIN → check exists → delete → COMMIT           |
| Link tag            | BEGIN → check exists → insert → COMMIT           |
| Unlink tag          | BEGIN → check exists → delete → COMMIT           |

All write operations use explicit BEGIN/COMMIT/ROLLBACK. Read operations (list, get) run without transactions.

---

## 10. Idempotency Strategy

| Operation           | Idempotency Approach                                                        |
| ------------------- | --------------------------------------------------------------------------- |
| Create question     | No natural key → each POST creates a new record                             |
| Link category       | UNIQUE constraint → catch 23505 → return 409                                |
| Link tag            | UNIQUE constraint → catch 23505 → return 409                                |
| Workflow transition | SELECT FOR UPDATE → check current state → reject if already in target state |
| Delete question     | Soft delete → if already deleted, return 404                                |

---

## 11. Error Code Registry

Following MCQ pattern with `TRAD_QUESTION_` prefix:

| Error Code                               | HTTP        | Description                      |
| ---------------------------------------- | ----------- | -------------------------------- |
| TRAD_QUESTION_NOT_FOUND                  | 404         | Question not found or deleted    |
| TRAD_QUESTION_DELETED                    | 404         | Question is soft-deleted         |
| TRAD_QUESTION_HAS_DEPENDENCIES           | 409         | Cannot delete — referenced       |
| TRAD_QUESTION_INVALID_TYPE               | 400         | Unknown question type            |
| TRAD_QUESTION_INVALID_CORRECT_ANSWER     | 400         | correct_answer validation failed |
| TRAD_QUESTION_SUBJECT_NOT_FOUND          | 404         | Subject FK doesn't exist         |
| TRAD_QUESTION_DIVISION_NOT_FOUND         | 404         | Division FK doesn't exist        |
| TRAD_QUESTION_SUBSECTION_NOT_FOUND       | 404         | Subsection FK doesn't exist      |
| TRAD_QUESTION_CATEGORY_NOT_FOUND         | 404         | Category value doesn't exist     |
| TRAD_QUESTION_TAG_NOT_FOUND              | 404         | Tag doesn't exist                |
| TRAD_QUESTION_CATEGORY_ALREADY_LINKED    | 409         | Duplicate link                   |
| TRAD_QUESTION_TAG_ALREADY_LINKED         | 409         | Duplicate link                   |
| TRAD_QUESTION_CATEGORY_NOT_LINKED        | 404         | Link doesn't exist               |
| TRAD_QUESTION_TAG_NOT_LINKED             | 404         | Link doesn't exist               |
| TRAD_QUESTION_WORKFLOW_TRANSITION_FAILED | 400/403/409 | Workflow engine rejection        |
| TRAD_QUESTION_SCORE_INVALID              | 400         | Score ≤ 0                        |
| TRAD_QUESTION_UPDATE_CONFLICT            | 409         | Concurrent update detected       |
| TRAD_QUESTION_TYPE_IMMUTABLE             | 400         | Cannot change question_type      |
| TRAD_QUESTION_SUBJECT_IMMUTABLE          | 400         | Cannot change subject_id         |

---

## 12. Logging Requirements

All service operations emit structured logs via `@zidney/logger`:

```
logger.info('traditional-question.<event>', {
  question_id,
  workspace_id: audit.workspace_id,
  correlation_id: audit.correlation_id,
})
```

Events: `created`, `updated`, `deleted`, `transitioned`, `category.linked`, `category.unlinked`, `tag.linked`, `tag.unlinked`, `fetched`, `listed`

---

## 13. Self-Correction Model (Data Contract)

Stage 35 defines the `self_correction` data contract shape for future use:

```json
{
  "question_id": "uuid",
  "attempt_id": "uuid",
  "original_answer": "...",
  "is_correct": false,
  "correction_prompt": "Enter the correct answer",
  "student_correction": "...",
  "correction_evaluated": false,
  "correction_is_correct": null
}
```

This is a **data contract only** — no API or table is created. The attempt engine
(future stage) implements the runtime behavior.

---

## 14. Search Implementation

List endpoint supports `search` query parameter:

```sql
WHERE content ILIKE '%' || $search || '%'
```

- Applied additively after all other WHERE filters
- No GIN/trigram index — sufficient for < 50K questions per tenant
- `$search` is parameterized (no SQL injection)

---

## 15. Files to Create (Summary)

### Migration (1 file)

- `apps/api/src/db/tenant/migrations/20260331_013_traditional_questions.ts`

### Drizzle Schemas (3 files)

- `apps/api/src/db/tenant/schemas/traditional-exam-sections.schema.ts`
- `apps/api/src/db/tenant/schemas/traditional-exam-subsections.schema.ts`
- `apps/api/src/db/tenant/schemas/traditional-questions.schema.ts`

### Domain Core (8 files)

- `packages/domain-core/src/traditional-questions/index.ts`
- `packages/domain-core/src/traditional-questions/traditional-questions.types.ts`
- `packages/domain-core/src/traditional-questions/traditional-questions.errors.ts`
- `packages/domain-core/src/traditional-questions/traditional-questions.repository.ts`
- `packages/domain-core/src/traditional-questions/traditional-questions.service.ts`
- `packages/domain-core/src/traditional-questions/traditional-questions.validators.ts`
- `packages/domain-core/src/traditional-questions/traditional-questions.sanitize.ts`
- `packages/domain-core/src/traditional-questions/traditional-questions.dependency-registry.ts`

### Validation (1 file)

- `packages/validation/src/backoffice/traditional-questions.schemas.ts`

### API Routes (12 files)

- `apps/api/src/routes/backoffice/traditional-questions/index.ts`
- `apps/api/src/routes/backoffice/traditional-questions/helpers.ts`
- `apps/api/src/routes/backoffice/traditional-questions/list-questions.ts`
- `apps/api/src/routes/backoffice/traditional-questions/create-question.ts`
- `apps/api/src/routes/backoffice/traditional-questions/get-question.ts`
- `apps/api/src/routes/backoffice/traditional-questions/update-question.ts`
- `apps/api/src/routes/backoffice/traditional-questions/delete-question.ts`
- `apps/api/src/routes/backoffice/traditional-questions/transition-question.ts`
- `apps/api/src/routes/backoffice/traditional-questions/link-category.ts`
- `apps/api/src/routes/backoffice/traditional-questions/unlink-category.ts`
- `apps/api/src/routes/backoffice/traditional-questions/link-tag.ts`
- `apps/api/src/routes/backoffice/traditional-questions/unlink-tag.ts`

### App Registration (1 modification)

- `apps/api/src/app.ts` — add router import + route registration

### Domain Core Registration (1 modification)

- `packages/domain-core/src/index.ts` — export traditional-questions module (if barrel exists)

### Validation Registration (1 modification)

- `packages/validation/src/index.ts` — export traditional-questions schemas (if barrel exists)

**Total: 25 new files + 3 modifications**

---

## 16. Risk Assessment

| Risk                                     | Severity | Mitigation                                             |
| ---------------------------------------- | -------- | ------------------------------------------------------ |
| Stub table schema mismatch with Stage 37 | MEDIUM   | Minimal columns only. Stage 37 uses ALTER TABLE.       |
| JSONB validation bypass                  | LOW      | Zod validation at API boundary. DB stores raw JSON.    |
| Concurrent question creation             | LOW      | No natural uniqueness — parallel creates are safe.     |
| Migration ordering                       | LOW      | Single migration with IF NOT EXISTS on stubs.          |
| Search performance at scale              | LOW      | ILIKE sufficient for < 50K. Full-text search deferred. |
