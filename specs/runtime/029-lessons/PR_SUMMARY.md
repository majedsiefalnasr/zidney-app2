# feat(029-lessons): Lessons domain and API

## Summary

Implements the **Lessons** domain — the smallest academic unit in the Zidney content hierarchy. A lesson belongs to exactly one subject. This stage delivers full CRUD management via the Backoffice API and establishes the domain foundation for downstream question-tagging stages.

**Stage:** 029 — Lessons  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Status:** PRODUCTION READY  
**Tasks:** 26 / 26 completed  
**Tests:** 37 / 37 passing

---

## What changed

### New: Database

- `apps/api/src/db/tenant/migrations/20260321_007_lessons.ts`
  - Creates `lessons` table with FK to `subjects(id)` and `users(id)`
  - Unique constraint `lessonName_unique_per_subject` (LOWER(name), subject_id)
  - Indexes: `idx_lessons_subject_id`, `idx_lessons_status`
  - `MIN_SCHEMA_VERSION = '1.13.0'`

### New: Domain Package (`packages/domain-core`)

- `src/lessons/lessons.types.ts` — `LessonRow`, `LessonStatus`, `CreateLessonInput`, `UpdateLessonInput`
- `src/lessons/lessons.errors.ts` — `LessonError` with 7 error codes
- `src/lessons/lessons.repository.ts` — 5 query functions (findLessonById, findLessons, findActiveLessons, createLessonRow, updateLessonRow)
- `src/lessons/lessons.service.ts` — 6 service functions (listLessons, getLesson, getActiveLessons, createLesson, updateLesson, deleteLesson)
- `src/lessons/lessons.dependency-registry.ts` — registry exports
- `src/lessons/index.ts` — barrel export
- `package.json` — `./lessons` subpath export added

### New: Validation (`packages/validation`)

- `src/backoffice/lessons.schemas.ts` — `CreateLessonSchema`, `UpdateLessonSchema`, `GetLessonsQuerySchema`

### New: API Handlers (`apps/api`)

- `src/routes/backoffice/lessons/helpers.ts` — `LESSONS_HTTP_STATUS` dispatch table
- `src/routes/backoffice/lessons/list-lessons.ts`
- `src/routes/backoffice/lessons/get-active-lessons.ts`
- `src/routes/backoffice/lessons/create-lesson.ts`
- `src/routes/backoffice/lessons/get-lesson.ts`
- `src/routes/backoffice/lessons/update-lesson.ts`
- `src/routes/backoffice/lessons/delete-lesson.ts`
- `src/routes/backoffice/lessons/index.ts` — `createLessonsRouter()` factory

### Modified

- `apps/api/src/app.ts` — added `lessonsRouter` import and `/api/v1/backoffice/workspace` mount
- `packages/domain-core/src/subjects/subjects.dependency-registry.ts` — added `countLessonsForSubject`

### New: Tests

- `packages/domain-core/src/lessons/__tests__/lessons.service.test.ts` — 19 service unit tests
- `apps/api/src/routes/backoffice/lessons/__tests__/lessons.integration.test.ts` — 18 integration tests

---

## API surface

| Method | Path                                                 | Description                             |
| ------ | ---------------------------------------------------- | --------------------------------------- |
| GET    | `/api/v1/backoffice/workspace/:slug/lessons`         | List lessons (paginated, filterable)    |
| GET    | `/api/v1/backoffice/workspace/:slug/lessons/runtime` | Active lessons (minimal — id/name/code) |
| POST   | `/api/v1/backoffice/workspace/:slug/lessons`         | Create lesson                           |
| GET    | `/api/v1/backoffice/workspace/:slug/lessons/:id`     | Get single lesson                       |
| PATCH  | `/api/v1/backoffice/workspace/:slug/lessons/:id`     | Update lesson                           |
| DELETE | `/api/v1/backoffice/workspace/:slug/lessons/:id`     | Soft-delete (status = DISABLED)         |

---

## Testing

Full testing guide: `specs/runtime/029-lessons/guides/TESTING_GUIDE.md`

Run automated tests:

```bash
bun run vitest run \
  packages/domain-core/src/lessons/__tests__/lessons.service.test.ts \
  apps/api/src/routes/backoffice/lessons/__tests__/lessons.integration.test.ts
```

---

## Related

- Blocked by: Stage 028 (Subjects) ✅
- Enables: Stage 030+ (Questions — MCQ/Traditional lesson tagging)
- Stage file: `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_29_LESSONS.md`
