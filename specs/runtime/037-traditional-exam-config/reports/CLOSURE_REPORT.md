# Closure Report — Traditional Exam Configuration

**Stage:** Traditional Exam Configuration  
**Phase:** 03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE  
**Branch:** `spec/037-traditional-exam-config`  
**Closure Date:** 2026-04-02  
**Status:** PRODUCTION READY

---

## Executive Summary

Stage 37 delivers the complete Traditional Exam Configuration system for the Zidney Backoffice. This stage enables exam administrators to create, manage, and publish traditional (paper-style) exams with full lifecycle state management. The implementation covers the full vertical slice: database schema, domain logic, validation, API routes, and RBAC enforcement.

---

## Scope Delivered

### Database (Migration 015)

| Object                         | Type      | Description                                                                                |
| ------------------------------ | --------- | ------------------------------------------------------------------------------------------ |
| `traditional_exams`            | New table | Core exam entity with FSM status, grading config, metadata                                 |
| `traditional_exam_settings`    | New table | Per-exam timing and limits (one-to-one with exam)                                          |
| `traditional_exam_questions`   | New table | Question-to-subsection assignments with ordering                                           |
| `traditional_exam_sections`    | ALTER     | Added `order_index`, `question_type_id`, `passing_score_percentage` columns                |
| `traditional_exam_subsections` | ALTER     | Added `order_index`, `question_count`, `points_per_question`, `time_limit_seconds` columns |

### Domain Package (`packages/domain-core/src/traditional-exams/`)

| File                                       | Description                                                      |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `traditional-exams.types.ts`               | All TypeScript types, interfaces, and enums                      |
| `traditional-exams.errors.ts`              | `TraditionalExamError` class with 19 error codes                 |
| `traditional-exams.validators.ts`          | Business rule validators (status transitions, structural checks) |
| `traditional-exams.dependency-registry.ts` | Module type tokens for DI resolvers                              |
| `traditional-exams.repository.ts`          | Raw SQL data access (17 functions)                               |
| `traditional-exams.service.ts`             | Business logic layer (14 exported functions, FSM transitions)    |
| `index.ts`                                 | Public barrel export                                             |

### Validation Package (`packages/validation/src/backoffice/`)

| File                           | Description                                            |
| ------------------------------ | ------------------------------------------------------ |
| `traditional-exams.schemas.ts` | 13 Zod schemas for all request bodies and query params |

### API Routes (`apps/api/src/routes/backoffice/traditional-exams/`)

| File                           | Endpoint                                                                                           | Method | Description                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------- |
| `create-exam.ts`               | `/api/v1/backoffice/workspace/traditional-exams`                                                   | POST   | Create exam                              |
| `list-exams.ts`                | `/api/v1/backoffice/workspace/traditional-exams`                                                   | GET    | List exams (paginated)                   |
| `get-exam.ts`                  | `/api/v1/backoffice/workspace/traditional-exams/:id`                                               | GET    | Get exam detail                          |
| `update-exam.ts`               | `/api/v1/backoffice/workspace/traditional-exams/:id`                                               | PUT    | Update exam metadata                     |
| `delete-exam.ts`               | `/api/v1/backoffice/workspace/traditional-exams/:id`                                               | DELETE | Soft delete exam                         |
| `transition-exam.ts`           | `/api/v1/backoffice/workspace/traditional-exams/:id/workflow/transition`                           | POST   | State transition                         |
| `get-settings.ts`              | `/api/v1/backoffice/workspace/traditional-exams/:id/settings`                                      | GET    | Get timing settings                      |
| `upsert-settings.ts`           | `/api/v1/backoffice/workspace/traditional-exams/:id/settings`                                      | PUT    | Upsert timing settings                   |
| `list-sections.ts`             | `/api/v1/backoffice/workspace/traditional-exams/:id/sections`                                      | GET    | List sections+subsections                |
| `update-section.ts`            | `/api/v1/backoffice/workspace/traditional-exams/:id/sections/:sectionId`                           | PUT    | Update section                           |
| `update-subsection.ts`         | `/api/v1/backoffice/workspace/traditional-exams/:id/sections/:sectionId/subsections/:subsectionId` | PUT    | Update subsection                        |
| `list-subsection-questions.ts` | `/api/v1/backoffice/workspace/traditional-exams/:id/…/questions`                                   | GET    | List assigned questions                  |
| `assign-questions.ts`          | `/api/v1/backoffice/workspace/traditional-exams/:id/…/questions`                                   | POST   | Assign questions                         |
| `remove-question.ts`           | `/api/v1/backoffice/workspace/traditional-exams/:id/…/questions/:questionId`                       | DELETE | Remove question                          |
| `reorder-questions.ts`         | `/api/v1/backoffice/workspace/traditional-exams/:id/…/questions/reorder`                           | PUT    | Reorder questions                        |
| `helpers.ts`                   | —                                                                                                  | —      | Shared helper: `requireExamForTenant`    |
| `router.ts`                    | —                                                                                                  | —      | Router factory (registers all 15 routes) |

### App Registration (`apps/api/src/app.ts`)

- Added: `import { traditionalExamsRouter } from './routes/backoffice/traditional-exams/router'`
- Added: `app.route('/api/v1/backoffice/workspace', traditionalExamsRouter)`

---

## Implementation Statistics

| Metric                | Value                        |
| --------------------- | ---------------------------- |
| Tasks completed       | 45 / 45                      |
| Tasks deferred        | 0                            |
| Files created         | 33                           |
| Files modified        | 4                            |
| Lines inserted        | ~6,922                       |
| Endpoints implemented | 15                           |
| Error codes defined   | 19                           |
| Zod schemas           | 13                           |
| Repository functions  | 17                           |
| Service functions     | 14                           |
| FSM states            | 7                            |
| FSM transitions       | Valid state machine enforced |

---

## FSM Workflow States

```
DRAFT → UNDER_REVIEW → ENABLED
                      → DISABLED
ENABLED → ARCHIVED
DISABLED → ENABLED
DISABLED → ARCHIVED
UNDER_REVIEW → DRAFT (reject)
```

Enabling requires `performEnableValidation`: at least 1 section, each section with ≥ 1 subsection, each subsection with ≥ `question_count` assigned questions, all have numeric `points_per_question`.

---

## Architecture Compliance

| Rule                                      | Status                                                        |
| ----------------------------------------- | ------------------------------------------------------------- |
| Database-per-tenant isolation (ADR-0001)  | ✅ PASS — all queries use tenant `db` client                  |
| License middleware (all routes)           | ✅ PASS — middleware applied at workspace router level        |
| RBAC via `guardRole`                      | ✅ PASS — three-tier (read/write/transition)                  |
| Server-authoritative time                 | ✅ PASS — no client timestamps accepted                       |
| Idempotency — `upsert-settings`           | ✅ PASS — `ON CONFLICT … DO UPDATE`                           |
| Idempotency — `assign-questions`          | ✅ PASS — `ON CONFLICT … DO NOTHING`                          |
| Soft delete                               | ✅ PASS — `deleted_at` timestamp, never hard-delete           |
| Error contract `{ success, data, error }` | ✅ PASS — `successResponse` / `traditionalExamsErrorResponse` |
| No direct DB access from routes           | ✅ PASS — routes call service only                            |
| No business logic in routes               | ✅ PASS — all business rules in service                       |
| Transactional `createExam`                | ✅ PASS — `BEGIN` / `COMMIT` / `ROLLBACK`                     |
| Forward-only migration                    | ✅ PASS — no destructive rollback path                        |
| Import boundary (UI → DB schema)          | ✅ PASS — no cross-layer imports                              |

---

## Validation Results

| Check                                   | Result                                  |
| --------------------------------------- | --------------------------------------- |
| TypeScript (`bun run typecheck`)        | ✅ PASS — 0 errors                      |
| Biome lint (changed files)              | ✅ PASS — 0 errors                      |
| Architecture Guard (`bun run ai:guard`) | ✅ PASS — 1641/1641 (100%)              |
| Pre-commit hooks                        | ✅ PASS — all 9 hooks passed            |
| Governance gate                         | ✅ PASS — 8/8 guards passed             |
| Trivy dependency scan                   | ✅ CLEAN — 0 vulnerabilities            |
| Trivy secret scan                       | ✅ CLEAN — 0 secrets                    |
| Architecture brain validation           | ✅ PASS — 14 modules, 0 malformed edges |

---

## Deferred Scope

None.

---

## Notes

- The 13 pre-existing Biome lint errors reported by `bun run lint` (full monorepo) are not introduced by this stage. `npx biome check --changed --since=origin/develop` returns 0 errors.
- The 49 warnings in the dev CI guard about missing script references in `specs/` are pre-existing and concern script naming governance work from a prior stage.
