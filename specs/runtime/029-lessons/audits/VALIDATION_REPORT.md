# Step 6 — Validation Report

**Stage:** Lessons  
**Branch:** `spec/029-lessons`  
**Validated:** 2026-03-21T03:30:00.000Z

---

## TypeScript Type-Check

**Command:** `bun run typecheck`  
**Result:** ✅ PASS — `TypeScript compilation completed` (exit 0)

---

## Test Suite

**Command:** `vitest run packages/domain-core/src/lessons/__tests__/lessons.service.test.ts apps/api/src/routes/backoffice/lessons/__tests__/lessons.integration.test.ts`  
**Result:** ✅ PASS — 37/37 tests passing

### Service Unit Tests (19 tests)

| Suite | Tests | Result |
|-------|-------|--------|
| listLessons | 2 | ✅ PASS |
| getLesson | 2 | ✅ PASS |
| getActiveLessons | 2 | ✅ PASS |
| createLesson | 4 | ✅ PASS |
| updateLesson | 6 | ✅ PASS |
| deleteLesson | 3 | ✅ PASS |

### Integration Tests (18 tests)

| Suite | Tests | Result |
|-------|-------|--------|
| listLessonsHandler | 3 | ✅ PASS |
| getActiveLessonsHandler | 3 | ✅ PASS |
| createLessonHandler | 3 | ✅ PASS |
| getLessonHandler | 3 | ✅ PASS |
| updateLessonHandler | 3 | ✅ PASS |
| deleteLessonHandler | 3 | ✅ PASS |

---

## Lint (Biome)

**Command:** `biome check .`  
**Result:** ⚠️ PRE-EXISTING BUG — not introduced by this stage

**Details:** `biome.json` overrides array uses `"includes"` (incorrect key). Should be `"include"`. The same error was observed on a clean branch before this stage's changes were applied (confirmed by stash test). This is a pre-existing infrastructure issue.

**Action required:** Fix in a dedicated INFRA stage (infra-004-biome area). Does not indicate any lint issue in this stage's code.

---

## Migration Validation

Migration file: `apps/api/src/db/tenant/migrations/20260321_007_lessons.ts`

- ✅ Forward-only migration (no `down` migration)
- ✅ Uses `sql` tagged template from drizzle-orm
- ✅ Sets `MIN_SCHEMA_VERSION = '1.13.0'`
- ✅ Creates `lessons` table with FK to `subjects(id)` and `users(id)`
- ✅ Adds `idx_lessons_subject_id` and `idx_lessons_status` indexes
- ✅ `lessonName_unique_per_subject` UNIQUE constraint

---

## Idempotency Validation

- ✅ POST /lessons: `lessonNameExistsInSubject` check before insert
- ✅ PATCH /lessons/:id: find-before-update + status guard checks
- ✅ DELETE /lessons/:id: find-before-update + ALREADY_DISABLED guard
- ✅ All mutations wrapped in BEGIN/COMMIT/ROLLBACK transactions
