# Step 6 — Implement Report

**Stage:** Lessons  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Branch:** `spec/029-lessons`  
**Completed:** 2026-03-21T03:30:00.000Z

---

## Task Completion

**26 / 26 tasks completed** (0 deferred)

| Task  | Description                                            | File                                                                           |
| ----- | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| T001  | Tenant migration — lessons table                       | `apps/api/src/db/tenant/migrations/20260321_007_lessons.ts`                    |
| T002  | LessonRow / LessonStatus / LessonInput types           | `packages/domain-core/src/lessons/lessons.types.ts`                            |
| T003  | LessonError with all codes                             | `packages/domain-core/src/lessons/lessons.errors.ts`                           |
| T004  | lessons.dependency-registry.ts                         | `packages/domain-core/src/lessons/lessons.dependency-registry.ts`              |
| T005  | lessons.repository.ts — all 5 query functions          | `packages/domain-core/src/lessons/lessons.repository.ts`                       |
| T006  | listLessons service function                           | `packages/domain-core/src/lessons/lessons.service.ts`                          |
| T007  | getLesson service function                             | `packages/domain-core/src/lessons/lessons.service.ts`                          |
| T008  | getActiveLessons service function                      | `packages/domain-core/src/lessons/lessons.service.ts`                          |
| T009  | createLesson service function                          | `packages/domain-core/src/lessons/lessons.service.ts`                          |
| T010  | updateLesson service function                          | `packages/domain-core/src/lessons/lessons.service.ts`                          |
| T011  | deleteLesson (soft-delete) service function            | `packages/domain-core/src/lessons/lessons.service.ts`                          |
| T012  | Domain barrel export                                   | `packages/domain-core/src/lessons/index.ts`                                    |
| T013  | Validation schemas (Zod)                               | `packages/validation/src/backoffice/lessons.schemas.ts`                        |
| T014  | listLessonsHandler                                     | `apps/api/src/routes/backoffice/lessons/list-lessons.ts`                       |
| T015  | getActiveLessonsHandler                                | `apps/api/src/routes/backoffice/lessons/get-active-lessons.ts`                 |
| T016  | createLessonHandler                                    | `apps/api/src/routes/backoffice/lessons/create-lesson.ts`                      |
| T017  | getLessonHandler                                       | `apps/api/src/routes/backoffice/lessons/get-lesson.ts`                         |
| T018  | updateLessonHandler                                    | `apps/api/src/routes/backoffice/lessons/update-lesson.ts`                      |
| T019  | deleteLessonHandler                                    | `apps/api/src/routes/backoffice/lessons/delete-lesson.ts`                      |
| T020  | Route helpers / HTTP status dispatch table             | `apps/api/src/routes/backoffice/lessons/helpers.ts`                            |
| T021  | countLessonsForSubject in subjects dependency registry | `packages/domain-core/src/subjects/subjects.dependency-registry.ts`            |
| T022  | lessonsRouter factory (index.ts)                       | `apps/api/src/routes/backoffice/lessons/index.ts`                              |
| T023a | lessonsRouter import + mount in app.ts                 | `apps/api/src/app.ts`                                                          |
| T023b | ./lessons subpath export in domain-core package.json   | `packages/domain-core/package.json`                                            |
| T024  | Integration test — all 6 handlers                      | `apps/api/src/routes/backoffice/lessons/__tests__/lessons.integration.test.ts` |
| T025  | Service unit test — all 6 service functions            | `packages/domain-core/src/lessons/__tests__/lessons.service.test.ts`           |

---

## Deferred Tasks

None

---

## Validation Summary

See full evidence in `audits/VALIDATION_REPORT.md`.

| Check                 | Result                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| TypeScript type-check | ✅ PASS                                                                                                 |
| Unit tests (service)  | ✅ PASS — 19/19                                                                                         |
| Integration tests     | ✅ PASS — 18/18                                                                                         |
| Combined test suite   | ✅ PASS — 37/37                                                                                         |
| Biome lint            | ⚠️ pre-existing `biome.json` config bug (includes → include in overrides); not introduced by this stage |

---

## Files Changed

### New files (19)

- `apps/api/src/db/tenant/migrations/20260321_007_lessons.ts`
- `apps/api/src/routes/backoffice/lessons/create-lesson.ts`
- `apps/api/src/routes/backoffice/lessons/delete-lesson.ts`
- `apps/api/src/routes/backoffice/lessons/get-active-lessons.ts`
- `apps/api/src/routes/backoffice/lessons/get-lesson.ts`
- `apps/api/src/routes/backoffice/lessons/helpers.ts`
- `apps/api/src/routes/backoffice/lessons/index.ts`
- `apps/api/src/routes/backoffice/lessons/list-lessons.ts`
- `apps/api/src/routes/backoffice/lessons/update-lesson.ts`
- `apps/api/src/routes/backoffice/lessons/__tests__/lessons.integration.test.ts`
- `packages/domain-core/src/lessons/index.ts`
- `packages/domain-core/src/lessons/lessons.dependency-registry.ts`
- `packages/domain-core/src/lessons/lessons.errors.ts`
- `packages/domain-core/src/lessons/lessons.repository.ts`
- `packages/domain-core/src/lessons/lessons.service.ts`
- `packages/domain-core/src/lessons/lessons.types.ts`
- `packages/domain-core/src/lessons/__tests__/lessons.service.test.ts`
- `packages/validation/src/backoffice/lessons.schemas.ts`

### Modified files (3)

- `apps/api/src/app.ts` — added lessonsRouter import + mount
- `packages/domain-core/package.json` — added `./lessons` subpath export
- `packages/domain-core/src/subjects/subjects.dependency-registry.ts` — added `countLessonsForSubject`
