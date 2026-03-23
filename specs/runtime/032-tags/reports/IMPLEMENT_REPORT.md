# IMPLEMENT_REPORT — Tags (STAGE_32_TAGS)

**Stage:** Tags  
**Phase:** 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION  
**Branch:** `spec/032-tags`  
**Completed:** 2026-03-23T11:50:00Z  
**Tasks:** 37 / 37 completed (0 deferred)

---

## Implementation Summary

Complete flat tagging system for content classification delivered across:

- Domain package (`packages/domain-core/src/tags/`)
- Validation schemas (`packages/validation/src/backoffice/tags.schemas.ts`)
- API route handlers (`apps/api/src/routes/backoffice/tags/`)
- Database migration (`apps/api/src/db/tenant/migrations/20260323_010_tags.ts`)
- Drizzle ORM schemas (`apps/api/src/db/tenant/schemas/`)

---

## Tasks Completed

### T001–T004: Domain Types & Errors

- [x] T001 — `tags.types.ts`: TagRow, TagRelationRow, TagStatus, TagEntityType, ListTagsInput, ListTagEntitiesInput
- [x] T002 — `tags.errors.ts`: TagError class with TAG_NOT_FOUND/TAG_DUPLICATE/TAG_DISABLED/TAG_RELATION_EXISTS/TAG_RELATION_NOT_FOUND/TAG_HAS_RELATIONS/TAG_ENTITY_TYPE_INVALID
- [x] T003 — `tags.repository.ts`: All 14 repository functions (read + write)
- [x] T004 — `tags.service.ts`: All 9 service functions with business logic

### T005–T006: Exports & DI

- [x] T005 — `packages/domain-core/src/tags/index.ts`: barrel exports
- [x] T006 — `tags.dependency-registry.ts`: DI registry

### T007: Validation Schemas

- [x] T007 — `packages/validation/src/backoffice/tags.schemas.ts`: 8 Zod schemas for all routes

### T008–T017: Migration & DB Schemas

- [x] T008 — `20260323_010_tags.ts`: Two-phase migration (Phase 1: TX with tags + tag_relations tables; Phase 2: CONCURRENT unique indexes)
- [x] T009 — `tags.schema.ts`: Drizzle ORM schema for `tags` table
- [x] T010 — `tag-relations.schema.ts`: Drizzle ORM schema for `tag_relations` table
- [x] T011 — `apps/api/src/db/tenant/schemas/index.ts`: exports updated

### T012–T020: Route Handlers

- [x] T012 — `create-tag.ts`: POST /tags — insert with normalizedName, 409 on dup
- [x] T013 — `get-tag.ts`: GET /tags/:id — 404 on missing
- [x] T014 — `list-tags.ts`: GET /tags — paginated, filterable by status/search
- [x] T015 — `update-tag.ts`: PATCH /tags/:id — name + status update, recomputes normalized_name
- [x] T016 — `delete-tag.ts`: DELETE /tags/:id — 422 guard if relations exist unless cascade_delete=true
- [x] T017 — `create-tag-relation.ts`: POST /tag-relations — 409 on dup, 404 on disabled tag
- [x] T018 — `delete-tag-relation.ts`: DELETE /tag-relations/:id
- [x] T019 — `list-entity-tags.ts`: GET /entities/:entityType/:entityId/tags
- [x] T020 — `list-tag-entities.ts`: GET /tags/:id/entities

### T021–T023: Router & App Registration

- [x] T021 — `helpers.ts`: getDb, buildAuditCtx, successResponse, tagsErrorResponse
- [x] T022 — `apps/api/src/routes/backoffice/tags/index.ts`: router with permission guard
- [x] T023 — `apps/api/src/app.ts`: tagsRouter mounted under backoffice workspace routes

### T024–T027: Tests

- [x] T024 — `tags.service.test.ts`: 25 unit tests (all pass)
- [x] T025 — `tags.repository.test.ts`: 41 unit tests (all pass)
- [x] T026–T033 — `tests/integration/tags.integration.test.ts`: 34 HTTP integration tests (all pass)
- [x] T034 — `apps/api/src/db/tenant/migrations/__tests__/010_tags.migration.test.ts`: 28 migration tests (all pass)

### T035–T037: Quality Gates

- [x] T035 — Lint: 0 errors, 13 warnings (biome)
- [x] T036 — Typecheck: 0 TypeScript errors
- [x] T037 — Tests: 127/127 pass across 4 test files

---

## Files Changed

| File                                                                     | Action   |
| ------------------------------------------------------------------------ | -------- |
| `packages/domain-core/src/tags/tags.types.ts`                            | Added    |
| `packages/domain-core/src/tags/tags.errors.ts`                           | Added    |
| `packages/domain-core/src/tags/tags.repository.ts`                       | Added    |
| `packages/domain-core/src/tags/tags.service.ts`                          | Added    |
| `packages/domain-core/src/tags/tags.dependency-registry.ts`              | Added    |
| `packages/domain-core/src/tags/index.ts`                                 | Added    |
| `packages/domain-core/src/tags/__tests__/tags.service.test.ts`           | Added    |
| `packages/domain-core/src/tags/__tests__/tags.repository.test.ts`        | Added    |
| `packages/validation/src/backoffice/tags.schemas.ts`                     | Added    |
| `apps/api/src/db/tenant/migrations/20260323_010_tags.ts`                 | Added    |
| `apps/api/src/db/tenant/migrations/__tests__/010_tags.migration.test.ts` | Added    |
| `apps/api/src/db/tenant/schemas/tags.schema.ts`                          | Added    |
| `apps/api/src/db/tenant/schemas/tag-relations.schema.ts`                 | Added    |
| `apps/api/src/db/tenant/schemas/index.ts`                                | Modified |
| `apps/api/src/routes/backoffice/tags/helpers.ts`                         | Added    |
| `apps/api/src/routes/backoffice/tags/create-tag.ts`                      | Added    |
| `apps/api/src/routes/backoffice/tags/get-tag.ts`                         | Added    |
| `apps/api/src/routes/backoffice/tags/list-tags.ts`                       | Added    |
| `apps/api/src/routes/backoffice/tags/update-tag.ts`                      | Added    |
| `apps/api/src/routes/backoffice/tags/delete-tag.ts`                      | Added    |
| `apps/api/src/routes/backoffice/tags/create-tag-relation.ts`             | Added    |
| `apps/api/src/routes/backoffice/tags/delete-tag-relation.ts`             | Added    |
| `apps/api/src/routes/backoffice/tags/list-entity-tags.ts`                | Added    |
| `apps/api/src/routes/backoffice/tags/list-tag-entities.ts`               | Added    |
| `apps/api/src/routes/backoffice/tags/index.ts`                           | Added    |
| `apps/api/src/app.ts`                                                    | Modified |
| `tests/integration/tags.integration.test.ts`                             | Added    |

---

## Constitutional Compliance

| Rule                                      | Status                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| Tenant isolation (database-per-tenant)    | ✅ All routes use `getDb(c)` — no shared pool                                        |
| License middleware                        | ✅ Routes mounted under licensed backoffice router                                   |
| No direct DB instantiation                | ✅ Pool obtained exclusively via context                                             |
| All writes transactional                  | ✅ createTag/updateTag/deleteTag use BEGIN/COMMIT/ROLLBACK                           |
| Idempotency enforcement                   | ✅ Unique normalized_name constraint; duplicate errors surfaced as 409               |
| Server-authoritative time                 | ✅ `NOW()` in SQL, no client timestamps                                              |
| Error contract `{ success, data, error }` | ✅ All handlers use `successResponse` / `tagsErrorResponse`                          |
| Structured logging with correlation_id    | ✅ All service and handler functions log with correlation_id                         |
| No business logic in route layer          | ✅ Routes delegate to service; no business rules in handlers                         |
| RBAC permission guard                     | ✅ `requireAnyPermission(['question_manage', 'content_manage'])` on all write routes |

---

## Validation Summary

Full evidence in `audits/VALIDATION_REPORT.md`.

| Check                   | Result        |
| ----------------------- | ------------- |
| Unit tests (service)    | ✅ 25/25 pass |
| Unit tests (repository) | ✅ 41/41 pass |
| Integration tests       | ✅ 34/34 pass |
| Migration tests         | ✅ 28/28 pass |
| Biome lint              | ✅ 0 errors   |
| TypeScript typecheck    | ✅ 0 errors   |

**Commit:** `2a555b65`
