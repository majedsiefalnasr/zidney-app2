# VALIDATION_REPORT — Tags (STAGE_32_TAGS)

**Stage:** Tags  
**Phase:** 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION  
**Branch:** `spec/032-tags`  
**Completed:** 2026-03-23T11:50:00Z

---

## Biome Lint

**Command:** `bun run lint`  
**Result:** ✅ PASS  
**Errors:** 0  
**Warnings:** 13 (non-blocking — unused variables in test files, acceptable)

Auto-fixes applied via `npx biome check --write` across all tags files before final run.

---

## TypeScript Type-Check

**Command:** `npx tsc --noEmit`  
**Result:** ✅ PASS  
**Errors:** 0

---

## Unit Tests — Service Layer

**File:** `packages/domain-core/src/tags/__tests__/tags.service.test.ts`  
**Command:** `bun test packages/domain-core/src/tags/__tests__/tags.service.test.ts`

**Result:** ✅ PASS — 25/25

| Group             | Tests | Status |
| ----------------- | ----- | ------ |
| createTag         | 5     | ✅     |
| getTag            | 3     | ✅     |
| listTags          | 3     | ✅     |
| updateTag         | 5     | ✅     |
| deleteTag         | 4     | ✅     |
| addTagRelation    | 4     | ✅     |
| removeTagRelation | 1     | ✅     |

---

## Unit Tests — Repository Layer

**File:** `packages/domain-core/src/tags/__tests__/tags.repository.test.ts`  
**Command:** `bun test packages/domain-core/src/tags/__tests__/tags.repository.test.ts`

**Result:** ✅ PASS — 41/41

| Group                   | Tests | Status |
| ----------------------- | ----- | ------ |
| findTagById             | 3     | ✅     |
| findTagByNormalizedName | 2     | ✅     |
| insertTagRow            | 4     | ✅     |
| updateTagRow            | 5     | ✅     |
| deleteTagRow            | 3     | ✅     |
| findTags                | 5     | ✅     |
| countTags               | 3     | ✅     |
| findTagRelationById     | 2     | ✅     |
| insertTagRelationRow    | 3     | ✅     |
| deleteTagRelationRow    | 2     | ✅     |
| findTagsByEntity        | 3     | ✅     |
| findEntitiesByTag       | 3     | ✅     |
| countEntitiesByTag      | 3     | ✅     |

**Fix applied:** `findTags`/`countTags` lowercase search before parameterizing (`input.search.toLowerCase()`). Repository test assertions updated to use `.toLowerCase()` when checking params.

---

## Migration Tests

**File:** `apps/api/src/db/tenant/migrations/__tests__/010_tags.migration.test.ts`  
**Command:** `bun test apps/api/src/db/tenant/migrations/__tests__/010_tags.migration.test.ts`

**Result:** ✅ PASS — 28/28

| Group                     | Tests | Status |
| ------------------------- | ----- | ------ |
| TX lifecycle              | 4     | ✅     |
| `tags` table DDL          | 7     | ✅     |
| `tag_relations` table DDL | 5     | ✅     |
| Foreign keys              | 3     | ✅     |
| B-tree indexes            | 3     | ✅     |
| Schema version bump       | 1     | ✅     |
| CONCURRENT unique indexes | 5     | ✅     |

---

## HTTP Integration Tests

**File:** `tests/integration/tags.integration.test.ts`  
**Command:** `bun test tests/integration/tags.integration.test.ts`

**Result:** ✅ PASS — 34/34

| Group                             | Tests | Status |
| --------------------------------- | ----- | ------ |
| T026 POST /tags: create tag       | 2     | ✅     |
| T026 GET /tags: list tags         | 2     | ✅     |
| T026 GET /tags/:id: get tag       | 2     | ✅     |
| T026 PATCH /tags/:id: update tag  | 2     | ✅     |
| T026 DELETE /tags/:id: delete tag | 3     | ✅     |
| T027 Uniqueness / conflicts       | 2     | ✅     |
| T028 Delete relation guard        | 2     | ✅     |
| T029 Tag relations lifecycle      | 4     | ✅     |
| T030 Entity tag listing           | 2     | ✅     |
| T031 Tag entities listing         | 3     | ✅     |
| T032 Permission enforcement       | 5     | ✅     |
| T033 Tenant isolation             | 3     | ✅     |

**Fix applied for PATCH update-name test:** `updateTagRow` SQL contains `normalized_name = $N` and `WHERE id = $2` but NOT `FROM tags`. Test `queryOverride` had `UPDATE tags` check after `normalized_name =` check — so the update query was matched by the dup-check branch (returning empty rows → TAG_NOT_FOUND). Fixed by moving `UPDATE tags` check before `normalized_name =`.

---

## Summary

| Check                | Status         |
| -------------------- | -------------- |
| Biome lint           | ✅ 0 errors    |
| TypeScript typecheck | ✅ 0 errors    |
| Unit — service       | ✅ 25/25       |
| Unit — repository    | ✅ 41/41       |
| Migration            | ✅ 28/28       |
| Integration          | ✅ 34/34       |
| **Total tests**      | **✅ 127/127** |
