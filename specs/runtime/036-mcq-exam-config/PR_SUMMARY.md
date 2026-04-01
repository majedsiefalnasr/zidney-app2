# MCQ Exam Configuration — Stage 36

## Summary

Implements the MCQ Exam Configuration entity — a reusable, backoffice-defined assessment configuration with full CRUD, workflow integration, and 14 REST API endpoints.

## What Changed

### Database (Migration 014)

- 4 new tenant-scoped tables: `mcq_exams`, `mcq_exam_settings`, `mcq_exam_questions`, `mcq_exam_auto_criteria`
- 7 foreign key constraints, 9 B-tree indexes, 1 CONCURRENT unique index
- Schema version: 1.19.0 → 1.20.0

### Domain Core (packages/domain-core/src/mcq-exams/)

- **Types:** 3 enums, 4 row types, 8 input DTOs, 2 output DTOs
- **Errors:** 17 typed error codes with HTTP status mapping
- **Repository:** ~460 lines of parameterized SQL for all CRUD operations
- **Validators:** Business rule validation (pass values, criteria sums, question limits)
- **Service:** 14 functions (5 read, 8 transactional write, 1 workflow)
- **Dependency Registry:** Extensible deletion guard pattern
- **Workflow:** `mcq_exam` registered in shared workflow engine

### Validation (packages/validation/src/backoffice/)

- 11 Zod schemas with camelCase input, inferred TypeScript types

### API Routes (apps/api/src/routes/backoffice/mcq-exams/)

- 14 endpoints with 3 permission guard tiers (read/write/transition)
- Error cascade: domain → workflow → validation → generic 500
- AD-002 permission bridge for workflow transitions

## Endpoints

| Method | Path                                     | Guard      |
| ------ | ---------------------------------------- | ---------- |
| POST   | /mcq-exams                               | write      |
| GET    | /mcq-exams                               | read       |
| GET    | /mcq-exams/:examId                       | read       |
| PATCH  | /mcq-exams/:examId                       | write      |
| DELETE | /mcq-exams/:examId                       | write      |
| PUT    | /mcq-exams/:examId/settings              | write      |
| GET    | /mcq-exams/:examId/settings              | read       |
| POST   | /mcq-exams/:examId/questions             | write      |
| GET    | /mcq-exams/:examId/questions             | read       |
| PUT    | /mcq-exams/:examId/questions/reorder     | write      |
| DELETE | /mcq-exams/:examId/questions/:questionId | write      |
| PUT    | /mcq-exams/:examId/criteria              | write      |
| GET    | /mcq-exams/:examId/criteria              | read       |
| POST   | /mcq-exams/:examId/workflow/transition   | transition |

## Key Design Decisions

- **Initial status:** COMPLETED (skip DRAFT — exam config starts ready for review)
- **subject_id immutable** after creation
- **selection_mode locked** after ENABLED status
- **Pre-enable validation:** Settings, questions/criteria, totals, criteria sum checked before ENABLED transition
- **Soft delete** with `deleted_at` timestamp
- **Extensible dependency registry** for deletion guards (future stages register checkers)

## Testing

See [TESTING_GUIDE.md](specs/runtime/036-mcq-exam-config/guides/TESTING_GUIDE.md) for detailed manual test scenarios.

## Validation

- ✅ TypeScript (tsconfig.json + tsconfig.test.json) — zero errors
- ✅ Biome lint + format — zero errors
- ✅ Migration structure validated
- ✅ 34/34 tasks completed

## Known Limitations

1. "After attempts exist" checks always return false — placeholder for Attempt Engine stage
2. Unit tests deferred to integration testing stage
