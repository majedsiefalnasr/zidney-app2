# Technical Plan — MCQ Exam Configuration

**Stage:** STAGE_36_MCQ_EXAM_CONFIG
**Phase:** 03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE
**Feature Branch:** `spec/036-mcq-exam-config`
**Created:** 2026-04-01

---

## 1. Executive Summary

Implement the MCQ Exam Configuration domain entity across all layers: database migration
(4 tenant-scoped tables), Drizzle ORM schemas, domain-core package (types, errors, repository,
service, validators, dependency-registry), Zod validation schemas, and 14 Hono API route handlers.
Register `mcq_exam` as a new entity type in the shared workflow engine.

---

## 2. Architecture Layers

### 2.1 Database — Tenant Schema

**Migration:** `apps/api/src/db/tenant/migrations/20260401_014_mcq_exams.ts`

- Schema version bump: 1.19.0 → 1.20.0
- Two-phase migration pattern (same as migration 012/013)
- Phase 1 (inside transaction): 4 tables + FK constraints + CHECK constraints + B-tree indexes
- Phase 2 (outside transaction): CONCURRENT partial unique index on `mcq_exams.code`

**Tables created:**

1. `mcq_exams` — core exam configuration entity
2. `mcq_exam_settings` — one-to-one delivery/result settings
3. `mcq_exam_questions` — manual question selection join table
4. `mcq_exam_auto_criteria` — automatic question selection criteria with uuid[] arrays

**Drizzle ORM Schemas:**

- `apps/api/src/db/tenant/schemas/mcq-exams.schema.ts`
- `apps/api/src/db/tenant/schemas/mcq-exam-settings.schema.ts`
- `apps/api/src/db/tenant/schemas/mcq-exam-questions.schema.ts`
- `apps/api/src/db/tenant/schemas/mcq-exam-auto-criteria.schema.ts`
- All registered in `apps/api/src/db/tenant/schemas/index.ts` barrel

### 2.2 Domain-Core Package

**Module:** `packages/domain-core/src/mcq-exams/`

| File                               | Responsibility                                              |
| ---------------------------------- | ----------------------------------------------------------- |
| `mcq-exams.types.ts`               | DbClient, AuditContext re-exports, domain enums, I/O types  |
| `mcq-exams.errors.ts`              | 17 error codes, HTTP status map, McqExamError class         |
| `mcq-exams.repository.ts`          | Pure SQL: CRUD, settings UPSERT, question links, criteria   |
| `mcq-exams.service.ts`             | TX orchestration, business rules, pre-enable validation     |
| `mcq-exams.validators.ts`          | Domain validators: criteria sum, delivery mode, count match |
| `mcq-exams.dependency-registry.ts` | Extensible deletion guard (pluggable by future stages)      |
| `index.ts`                         | Public API barrel                                           |

### 2.3 Validation Package

**File:** `packages/validation/src/backoffice/mcq-exams.schemas.ts`

Zod schemas for all 14 endpoints:

- Path param schemas (examId, questionId)
- Query schemas (list filters with pagination)
- Body schemas (create, update, settings, questions, criteria, transition, reorder)
- Registered in `packages/validation/src/backoffice/index.ts`

### 2.4 API Routes — Backoffice

**Router:** `apps/api/src/routes/backoffice/mcq-exams/`

| File                   | Method | Path                                     | FR     |
| ---------------------- | ------ | ---------------------------------------- | ------ |
| `index.ts`             | —      | Router registration + permission guards  | —      |
| `helpers.ts`           | —      | Shared: getDb, buildAuditCtx, responses  | —      |
| `create-exam.ts`       | POST   | /mcq-exams                               | FR-001 |
| `list-exams.ts`        | GET    | /mcq-exams                               | FR-002 |
| `get-exam.ts`          | GET    | /mcq-exams/:examId                       | FR-003 |
| `update-exam.ts`       | PATCH  | /mcq-exams/:examId                       | FR-004 |
| `delete-exam.ts`       | DELETE | /mcq-exams/:examId                       | FR-005 |
| `upsert-settings.ts`   | PUT    | /mcq-exams/:examId/settings              | FR-006 |
| `get-settings.ts`      | GET    | /mcq-exams/:examId/settings              | FR-012 |
| `add-questions.ts`     | POST   | /mcq-exams/:examId/questions             | FR-007 |
| `list-questions.ts`    | GET    | /mcq-exams/:examId/questions             | FR-013 |
| `remove-question.ts`   | DELETE | /mcq-exams/:examId/questions/:questionId | FR-008 |
| `reorder-questions.ts` | PUT    | /mcq-exams/:examId/questions/reorder     | FR-009 |
| `set-criteria.ts`      | PUT    | /mcq-exams/:examId/criteria              | FR-010 |
| `get-criteria.ts`      | GET    | /mcq-exams/:examId/criteria              | FR-014 |
| `transition-exam.ts`   | POST   | /mcq-exams/:examId/transition            | FR-011 |

**Router registration:** Add `createMcqExamsRouter()` to `apps/api/src/routes/backoffice/index.ts`

### 2.5 Workflow Engine Update

**File:** `packages/domain-core/src/workflow/workflow.engine.ts`

- Add `mcq_exam: 'mcq_exams'` to `ENTITY_TABLE_MAP`

**File:** `packages/domain-core/src/workflow/workflow.states.ts`

- Add `'mcq_exam'` to `WORKFLOW_ENTITY_TYPES` Set

---

## 3. Detailed Component Design

### 3.1 Migration Design

```
File: apps/api/src/db/tenant/migrations/20260401_014_mcq_exams.ts
Schema: 1.19.0 → 1.20.0

Phase 1 (inside BEGIN/COMMIT):
  ├── CREATE TABLE mcq_exams (+ CHECK constraints)
  ├── CREATE TABLE mcq_exam_settings
  ├── CREATE TABLE mcq_exam_questions (+ UNIQUE constraints)
  ├── CREATE TABLE mcq_exam_auto_criteria (+ CHECK constraint)
  ├── ADD FK: mcq_exams.subject_id → subjects(id) ON DELETE RESTRICT
  ├── ADD FK: mcq_exams.division_id → divisions(id) ON DELETE SET NULL
  ├── ADD FK: mcq_exam_settings.exam_id → mcq_exams(id) ON DELETE CASCADE
  ├── ADD FK: mcq_exam_questions.exam_id → mcq_exams(id) ON DELETE CASCADE
  ├── ADD FK: mcq_exam_questions.question_id → mcq_questions(id) ON DELETE RESTRICT
  ├── ADD FK: mcq_exam_auto_criteria.exam_id → mcq_exams(id) ON DELETE CASCADE
  ├── CREATE INDEX idx_mcq_exams_subject_id ON mcq_exams(subject_id)
  ├── CREATE INDEX idx_mcq_exams_division_id ON mcq_exams(division_id)
  ├── CREATE INDEX idx_mcq_exams_status ON mcq_exams(status)
  ├── CREATE INDEX idx_mcq_exams_selection_mode ON mcq_exams(selection_mode)
  ├── CREATE INDEX idx_mcq_exams_deleted_at ON mcq_exams(deleted_at)
  ├── CREATE UNIQUE INDEX idx_mcq_exam_settings_exam_id ON mcq_exam_settings(exam_id)
  ├── CREATE INDEX idx_mcq_exam_questions_exam_id ON mcq_exam_questions(exam_id)
  ├── CREATE INDEX idx_mcq_exam_questions_question_id ON mcq_exam_questions(question_id)
  ├── CREATE INDEX idx_mcq_exam_auto_criteria_exam_id ON mcq_exam_auto_criteria(exam_id)
  └── UPDATE _schema_versions SET version = '1.20.0'

Phase 2 (outside transaction):
  └── CREATE UNIQUE INDEX CONCURRENTLY mcq_exams_code_unique_active
       ON mcq_exams (LOWER(code)) WHERE deleted_at IS NULL
```

### 3.2 Domain Types

```typescript
// mcq-exams.types.ts

export type McqExamSelectionMode = 'MANUAL' | 'AUTOMATIC'
export type McqExamPassType = 'PERCENTAGE' | 'SCORE'
export type McqExamStatus = 'DRAFT' | 'COMPLETED' | 'UNDER_REVIEW' | 'APPROVED' | 'ENABLED'

export interface CreateMcqExamInput {
  name: string
  code: string
  description?: string | null
  subject_id: string
  division_id?: string | null
  language: string
  total_questions: number
  duration_minutes?: number | null
  pass_type: McqExamPassType
  pass_value: number
  allow_multiple_attempts?: boolean
  selection_mode: McqExamSelectionMode
}

export interface UpdateMcqExamInput {
  name?: string
  code?: string
  description?: string | null
  division_id?: string | null
  language?: string
  total_questions?: number
  duration_minutes?: number | null
  pass_type?: McqExamPassType
  pass_value?: number
  allow_multiple_attempts?: boolean
  selection_mode?: McqExamSelectionMode
}

export interface UpsertExamSettingsInput { ... }  // all boolean fields + message_template_id
export interface AddExamQuestionsInput { questions: { question_id: string; order_index: number }[] }
export interface ReorderQuestionsInput { order: { question_id: string; order_index: number }[] }
export interface SetCriteriaInput { criteria: CriteriaEntry[] }
export interface CriteriaEntry {
  lesson_ids?: string[] | null
  category_value_ids?: string[] | null
  tag_ids?: string[] | null
  basket_ids?: string[] | null
  percentage: number
}
```

### 3.3 Error Codes

17 domain error codes mapped to HTTP statuses:

| Code                                | HTTP | Context                    |
| ----------------------------------- | ---- | -------------------------- |
| MCQ_EXAM_NOT_FOUND                  | 404  | Exam missing/soft-deleted  |
| MCQ_EXAM_CODE_EXISTS                | 409  | Duplicate code             |
| MCQ_EXAM_SUBJECT_IMMUTABLE          | 400  | subject_id change attempt  |
| MCQ_EXAM_SELECTION_LOCKED           | 400  | After attempts exist       |
| MCQ_EXAM_DELETION_BLOCKED           | 409  | Has dependencies           |
| MCQ_EXAM_INVALID_PASS_VALUE         | 400  | Out of range               |
| MCQ_EXAM_NO_DELIVERY_MODE           | 400  | No mode enabled            |
| MCQ_EXAM_CHRONO_NO_DURATION         | 400  | Chrono, no duration        |
| MCQ_EXAM_MANUAL_COUNT_MISMATCH      | 400  | Count ≠ total_questions    |
| MCQ_EXAM_AUTO_SUM_INVALID           | 400  | Sum ≠ 100                  |
| MCQ_EXAM_QUESTION_SUBJECT_MISMATCH  | 400  | Wrong subject              |
| MCQ_EXAM_QUESTION_DIVISION_MISMATCH | 400  | Wrong division             |
| MCQ_EXAM_QUESTION_NOT_ENABLED       | 400  | Question not ENABLED       |
| MCQ_EXAM_QUESTION_DUPLICATE         | 409  | Already linked             |
| MCQ_EXAM_SETTINGS_NOT_FOUND         | 404  | No settings record         |
| MCQ_EXAM_ENABLE_VALIDATION          | 400  | Generic pre-enable failure |
| MCQ_EXAM_STATUS_LOCKED              | 400  | Delete ENABLED exam        |

### 3.4 Service Layer Transaction Boundaries

| Operation                  | TX Required | Pattern                                                |
| -------------------------- | ----------- | ------------------------------------------------------ |
| createExam                 | Yes         | BEGIN → INSERT mcq_exams → COMMIT                      |
| updateExam                 | Yes         | BEGIN → SELECT FOR UPDATE → UPDATE → COMMIT            |
| deleteExam                 | Yes         | BEGIN → guard checks → UPDATE deleted_at → COMMIT      |
| upsertSettings             | Yes         | BEGIN → INSERT ON CONFLICT UPDATE → COMMIT             |
| addQuestions               | Yes         | BEGIN → validate all → INSERT batch → COMMIT           |
| removeQuestion             | Yes         | BEGIN → DELETE → COMMIT                                |
| reorderQuestions           | Yes         | BEGIN → DELETE all for exam → INSERT batch → COMMIT    |
| setCriteria                | Yes         | BEGIN → DELETE old → INSERT batch → COMMIT             |
| transitionStatus           | Yes         | pre-enable validation → executeTransition (has own TX) |
| getExam / listExams / etc. | No          | Direct query                                           |

### 3.5 Pre-Enable Validation Logic

Before allowing transition to ENABLED, the service must verify:

1. **Settings existence:** `mcq_exam_settings` record exists for the exam
2. **Delivery mode:** At least one mode enabled (relax OR chrono OR rush)
3. **Chrono/duration consistency:** If chrono enabled, `duration_minutes` is not null
4. **Manual mode:** Count of linked questions in `mcq_exam_questions` = `total_questions`
5. **Automatic mode:** Sum of `percentage` across `mcq_exam_auto_criteria` = 100

If any check fails, throw the corresponding domain error BEFORE calling `executeTransition()`.

### 3.6 Deletion Guard Design

Extensible pattern using `mcq-exams.dependency-registry.ts`:

```typescript
export interface ExamReferenceCheckResult {
  hasReferences: boolean
  isActiveAttempt: boolean
}

export type ExamReferenceChecker = (
  db: DbClient,
  examId: string
) => Promise<ExamReferenceCheckResult>

const checkers: ExamReferenceChecker[] = []
export function registerExamReferenceChecker(checker: ExamReferenceChecker): void { ... }
export async function checkExamReferences(db: DbClient, examId: string): Promise<ExamReferenceCheckResult> { ... }
```

Current checks at this stage:

- Status !== ENABLED (cannot delete enabled exams)
- TODO: check attempts table (future stage)
- TODO: check scheduled_exams table (future stage)

### 3.7 Immutability Enforcement

| Field            | Rule                                          | Enforced In                |
| ---------------- | --------------------------------------------- | -------------------------- |
| subject_id       | Cannot change after creation (ever)           | service.update             |
| selection_mode   | Cannot change after ENABLED or after attempts | service.update             |
| total_questions  | Cannot change after attempts exist            | service.update             |
| pass_type        | Cannot change after attempts exist            | service.update             |
| pass_value       | Cannot change after attempts exist            | service.update             |
| duration_minutes | Cannot change after attempts exist            | service.update             |
| manual questions | Cannot modify after attempts exist            | service.add/remove/reorder |
| auto criteria    | Cannot modify after attempts exist            | service.setCriteria        |

NOTE: "After attempts exist" check is a TODO guard for future stages — currently always
returns false (no attempts table exists yet).

---

## 4. Idempotency Strategy

| Endpoint                             | Strategy                                             |
| ------------------------------------ | ---------------------------------------------------- |
| POST /mcq-exams                      | `code` is natural key — duplicate returns 409        |
| PUT /mcq-exams/:id/settings          | UPSERT: INSERT ON CONFLICT (exam_id) DO UPDATE       |
| PUT /mcq-exams/:id/criteria          | Replace: DELETE all + INSERT all in single TX        |
| PUT /mcq-exams/:id/questions/reorder | Replace: DELETE all + INSERT all in single TX        |
| POST /mcq-exams/:id/questions        | Unique(exam_id, question_id) constraint → 409 on dup |
| POST /mcq-exams/:id/transition       | Workflow engine: SELECT FOR UPDATE prevents race     |

---

## 5. Concurrency Strategy

- **Workflow transitions:** SELECT FOR UPDATE row-level lock via workflow engine
- **Code uniqueness:** Partial unique index handles race conditions at DB level
- **Settings UPSERT:** INSERT ON CONFLICT handles concurrent settings writes
- **Question management:** TX with row-level locks prevents concurrent modifications
- **Criteria replacement:** Full atomic replacement prevents partial state

---

## 6. Logging Requirements

All service functions must log using `@zidney/logger` with structured fields:

- `correlation_id` (from x-correlation-id header)
- `workspace_slug` (from tenant resolver)
- `workspace_id` (from tenant resolver)
- `exam_id` (when applicable)

Log events:

- `mcq-exam.created`, `mcq-exam.updated`, `mcq-exam.deleted`
- `mcq-exam.settings.upserted`
- `mcq-exam.questions.added`, `mcq-exam.questions.removed`, `mcq-exam.questions.reordered`
- `mcq-exam.criteria.set`
- `mcq-exam.transition.pre-enable-validation` (with pass/fail)

---

## 7. File Manifest

### New Files

| #   | File Path                                                             | Layer      |
| --- | --------------------------------------------------------------------- | ---------- |
| 1   | `apps/api/src/db/tenant/migrations/20260401_014_mcq_exams.ts`         | Migration  |
| 2   | `apps/api/src/db/tenant/schemas/mcq-exams.schema.ts`                  | Schema     |
| 3   | `apps/api/src/db/tenant/schemas/mcq-exam-settings.schema.ts`          | Schema     |
| 4   | `apps/api/src/db/tenant/schemas/mcq-exam-questions.schema.ts`         | Schema     |
| 5   | `apps/api/src/db/tenant/schemas/mcq-exam-auto-criteria.schema.ts`     | Schema     |
| 6   | `packages/domain-core/src/mcq-exams/mcq-exams.types.ts`               | Domain     |
| 7   | `packages/domain-core/src/mcq-exams/mcq-exams.errors.ts`              | Domain     |
| 8   | `packages/domain-core/src/mcq-exams/mcq-exams.repository.ts`          | Domain     |
| 9   | `packages/domain-core/src/mcq-exams/mcq-exams.service.ts`             | Domain     |
| 10  | `packages/domain-core/src/mcq-exams/mcq-exams.validators.ts`          | Domain     |
| 11  | `packages/domain-core/src/mcq-exams/mcq-exams.dependency-registry.ts` | Domain     |
| 12  | `packages/domain-core/src/mcq-exams/index.ts`                         | Domain     |
| 13  | `packages/validation/src/backoffice/mcq-exams.schemas.ts`             | Validation |
| 14  | `apps/api/src/routes/backoffice/mcq-exams/index.ts`                   | Route      |
| 15  | `apps/api/src/routes/backoffice/mcq-exams/helpers.ts`                 | Route      |
| 16  | `apps/api/src/routes/backoffice/mcq-exams/create-exam.ts`             | Route      |
| 17  | `apps/api/src/routes/backoffice/mcq-exams/list-exams.ts`              | Route      |
| 18  | `apps/api/src/routes/backoffice/mcq-exams/get-exam.ts`                | Route      |
| 19  | `apps/api/src/routes/backoffice/mcq-exams/update-exam.ts`             | Route      |
| 20  | `apps/api/src/routes/backoffice/mcq-exams/delete-exam.ts`             | Route      |
| 21  | `apps/api/src/routes/backoffice/mcq-exams/upsert-settings.ts`         | Route      |
| 22  | `apps/api/src/routes/backoffice/mcq-exams/get-settings.ts`            | Route      |
| 23  | `apps/api/src/routes/backoffice/mcq-exams/add-questions.ts`           | Route      |
| 24  | `apps/api/src/routes/backoffice/mcq-exams/list-questions.ts`          | Route      |
| 25  | `apps/api/src/routes/backoffice/mcq-exams/remove-question.ts`         | Route      |
| 26  | `apps/api/src/routes/backoffice/mcq-exams/reorder-questions.ts`       | Route      |
| 27  | `apps/api/src/routes/backoffice/mcq-exams/set-criteria.ts`            | Route      |
| 28  | `apps/api/src/routes/backoffice/mcq-exams/get-criteria.ts`            | Route      |
| 29  | `apps/api/src/routes/backoffice/mcq-exams/transition-exam.ts`         | Route      |

### Modified Files

| #   | File Path                                              | Change                              |
| --- | ------------------------------------------------------ | ----------------------------------- |
| 1   | `apps/api/src/db/tenant/schemas/index.ts`              | Add 4 schema exports                |
| 2   | `packages/domain-core/src/workflow/workflow.engine.ts` | Add `mcq_exam: 'mcq_exams'`         |
| 3   | `packages/domain-core/src/workflow/workflow.states.ts` | Add `'mcq_exam'` to entity type set |
| 4   | `packages/validation/src/backoffice/index.ts`          | Add mcq-exams.schemas export        |
| 5   | `apps/api/src/routes/backoffice/index.ts`              | Register mcq-exams router           |

---

## 8. Constraints & Non-Goals

### Enforced Constraints

- Database-per-tenant — all 4 tables in tenant DB only
- Tenant resolver → license middleware → routes
- All writes transactional
- Server-authoritative time (NOW()) for all timestamps
- Structured logging via @zidney/logger
- Error contract: `{ success, data, error: { code, message } }`
- No direct DB Pool instantiation — injected DbClient only
- Workflow transitions via shared engine only

### Non-Goals for this Stage

- No scheduled exam engine (separate stage)
- No attempt engine integration (separate stage)
- No frontoffice UI
- No backoffice UI
- No worker jobs
- No real-time question pool computation for AUTOMATIC mode at runtime
- No GIN indexes on uuid[] arrays (optimization stage if needed)
- No message template FK enforcement (templates table does not yet exist)
