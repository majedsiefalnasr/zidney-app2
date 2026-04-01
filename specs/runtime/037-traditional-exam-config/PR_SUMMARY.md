## Stage 37 — Traditional Exam Configuration

**Branch:** `spec/037-traditional-exam-config`  
**Base:** `develop`  
**Phase:** 03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE

---

## Summary

Implements the complete Traditional Exam Configuration system for the Zidney Backoffice API. This stage delivers the entire vertical slice — database migration, domain logic, request validation, and RBAC-protected API routes — enabling exam administrators to create and manage traditional (paper-style) exams through a 7-state FSM lifecycle.

---

## What Changed

### Database (Migration 015 — tenant DB)

- **Created** `traditional_exams` — core exam entity (title, module type, grading config, pass score, FSM status, soft delete)
- **Created** `traditional_exam_settings` — per-exam timing/attempt limits (one-to-one, upsert-safe)
- **Created** `traditional_exam_questions` — question-to-subsection assignments with `display_order`
- **Altered** `traditional_exam_sections` — added `order_index`, `question_type_id`, `passing_score_percentage`
- **Altered** `traditional_exam_subsections` — added `order_index`, `question_count`, `points_per_question`, `time_limit_seconds`

### Domain Core (`packages/domain-core/src/traditional-exams/`)

- `traditional-exams.types.ts` — All TypeScript types, input interfaces, enums
- `traditional-exams.errors.ts` — `TraditionalExamError` with 19 error codes
- `traditional-exams.validators.ts` — FSM transition rules + structural validators
- `traditional-exams.dependency-registry.ts` — DI module type tokens
- `traditional-exams.repository.ts` — 17 raw SQL functions
- `traditional-exams.service.ts` — 14 business logic functions including transactional `createExam` and FSM `transitionExam` with enable validation
- `index.ts` — barrel export

### Validation (`packages/validation/src/backoffice/`)

- `traditional-exams.schemas.ts` — 13 Zod schemas for all request bodies and query params

### API Routes (`apps/api/src/routes/backoffice/traditional-exams/`)

15 endpoints registered at `/api/v1/backoffice/workspace/traditional-exams/…`:

| Method | Path                                                 | Description                        |
| ------ | ---------------------------------------------------- | ---------------------------------- |
| POST   | `/traditional-exams`                                 | Create exam                        |
| GET    | `/traditional-exams`                                 | List exams (paginated, filterable) |
| GET    | `/traditional-exams/:id`                             | Get exam detail                    |
| PUT    | `/traditional-exams/:id`                             | Update exam metadata               |
| DELETE | `/traditional-exams/:id`                             | Soft delete exam                   |
| POST   | `/traditional-exams/:id/workflow/transition`         | FSM state transition               |
| GET    | `/traditional-exams/:id/settings`                    | Get settings                       |
| PUT    | `/traditional-exams/:id/settings`                    | Upsert settings                    |
| GET    | `/traditional-exams/:id/sections`                    | List sections + subsections        |
| PUT    | `/traditional-exams/:id/sections/:sectionId`         | Update section                     |
| PUT    | `/…/subsections/:subsectionId`                       | Update subsection                  |
| GET    | `/…/subsections/:subsectionId/questions`             | List assigned questions            |
| POST   | `/…/subsections/:subsectionId/questions`             | Assign questions                   |
| PUT    | `/…/subsections/:subsectionId/questions/reorder`     | Reorder questions                  |
| DELETE | `/…/subsections/:subsectionId/questions/:questionId` | Remove question                    |

- `router.ts` — Hono router factory with three-tier RBAC (`read` / `write` / `transition`)
- `helpers.ts` — `requireExamForTenant` (tenant-scoped exam fetch + 404 guard)
- `apps/api/src/app.ts` — router registered at `/api/v1/backoffice/workspace`

---

## Architecture Compliance

- ✅ Database-per-tenant isolation — all queries use tenant `db` client passed from middleware
- ✅ License middleware — applied at workspace router level (inherited, not re-applied per route)
- ✅ RBAC via `guardRole` — three-tier enforcement
- ✅ No client timestamps — all time fields use `NOW()` server-side
- ✅ Idempotent upserts — `ON CONFLICT … DO UPDATE` (settings) and `ON CONFLICT … DO NOTHING` (questions)
- ✅ Soft delete — `deleted_at` timestamp, never physical delete
- ✅ Error contract — `{ success, data, error }` via `successResponse` / `traditionalExamsErrorResponse`
- ✅ Transactional `createExam` — `BEGIN` / `COMMIT` / `ROLLBACK`
- ✅ Forward-only migration — no destructive rollback

---

## Validation Summary

| Check                            | Result                     |
| -------------------------------- | -------------------------- |
| TypeScript (`bun run typecheck`) | ✅ PASS — 0 errors         |
| Biome lint (changed files)       | ✅ PASS — 0 errors         |
| Architecture guard               | ✅ PASS — 1641/1641 (100%) |
| Pre-commit hooks                 | ✅ PASS — all hooks passed |
| Governance gate                  | ✅ PASS — 8/8 guards       |
| Trivy dependency scan            | ✅ CLEAN                   |
| Trivy secret scan                | ✅ CLEAN                   |

---

## Tasks

45 / 45 tasks complete. 0 deferred.

---

## Testing

See [guides/TESTING_GUIDE.md](guides/TESTING_GUIDE.md) for manual testing scenarios covering all 15 endpoints, FSM transitions, tenant isolation, RBAC, and idempotency.

---

## Stage Artifacts

- [spec.md](spec.md) — Feature specification
- [plan.md](plan.md) — Technical implementation plan
- [tasks.md](tasks.md) — 45 tasks (all ✅)
- [reports/CLOSURE_REPORT.md](reports/CLOSURE_REPORT.md) — Final closure report
- [audits/ANALYZE_REPORT.md](audits/ANALYZE_REPORT.md) — Drift analysis
- [audits/VALIDATION_REPORT.md](audits/VALIDATION_REPORT.md) — Validation evidence
- [guides/TESTING_GUIDE.md](guides/TESTING_GUIDE.md) — QA testing guide
