# Tasks — Tags

**Stage:** Tags  
**Phase:** 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION  
**Branch:** spec/032-tags  
**Generated:** 2026-03-23  
**Total Tasks:** 37

---

## Phase 0 — Database Migration & Schema

- [ ] T001 [US0] Create Drizzle schema file for tags table: `apps/api/src/db/tenant/schemas/tags.schema.ts` — define `tags` pgTable with `id`, `name`, `normalized_name`, `status` (VARCHAR(20)+CHECK ENABLED/DISABLED, default ENABLED), `created_at`, `updated_at`, `created_by`, `updated_by`; export `Tag` and `NewTag` types via `$inferSelect`/`$inferInsert`
- [ ] T002 [US0] Create Drizzle schema file for tag_relations table: `apps/api/src/db/tenant/schemas/tag-relations.schema.ts` — define `tagRelations` pgTable with `id`, `tag_id`, `entity_type` (VARCHAR(40)+CHECK MCQ_QUESTION/TRADITIONAL_QUESTION/LIBRARY_FILE), `entity_id`, `created_at`; export `TagRelation` and `NewTagRelation` types
- [ ] T003 [US0] Create two-phase tenant DB migration: `apps/api/src/db/tenant/migrations/20260323_010_tags.ts` — Phase 1 (BEGIN/COMMIT): CREATE TABLE tags, CREATE TABLE tag_relations, FK tag_relations.tag_id → tags.id ON DELETE CASCADE, FK tags.created_by → users.id (nullable), FK tags.updated_by → users.id (nullable), B-tree indexes (idx_tags_status, idx_tag_relations_tag_id, idx_tag_relations_entity), schema version 1.15.0 → 1.16.0; Phase 2 (outside transaction): CREATE UNIQUE INDEX CONCURRENTLY unique_tags_normalized_name ON tags(normalized_name); down() drops tag_relations then tags CASCADE

---

## Phase 1 — Domain Package

- [ ] T004 [US0] Create domain error definitions: `packages/domain-core/src/tags/tags.errors.ts` — DomainError subclasses for TAG_NOT_FOUND (404), TAG_DUPLICATE (409), TAG_DISABLED (422), TAG_HAS_RELATIONS (422), TAG_RELATION_NOT_FOUND (404), TAG_RELATION_DUPLICATE (409), TAG_RELATION_ENTITY_NOT_FOUND (422), TAG_RELATION_INVALID_ENTITY_TYPE (422)
- [ ] T005 [US0] Create domain types: `packages/domain-core/src/tags/tags.types.ts` — DbClient, AuditContext, TagRow, TagRelationRow, CreateTagInput, UpdateTagInput, ListTagsInput, ListTagsResult, CreateTagRelationInput, ListEntityTagsInput, ListEntityTagsResult, ListTagEntitiesInput, ListTagEntitiesResult — all pure; no framework imports
- [ ] T006 [US0] Create tags repository: `packages/domain-core/src/tags/tags.repository.ts` — raw SQL via db.query() for: findTagByNormalizedName(db, normalizedName), findTagById(db, id), insertTag(db, input), updateTagById(db, id, input), countTagRelationsByTagId(db, tagId), deleteTagById(db, id), findTagRelationByComposite(db, tagId, entityType, entityId), findTagRelationById(db, id), insertTagRelation(db, input), deleteTagRelationById(db, id), listTags(db, input) with optional status filter + search on name ILIKE + pagination, listEntityTags(db, input) join tag_relations→tags, listTagEntities(db, input) with optional entityType filter + pagination, checkEntityExists(db, entityType, entityId) — handles PG error 42P01
- [ ] T007 [US0] Create tags service: `packages/domain-core/src/tags/tags.service.ts` — implements createTag (BEGIN→normalizedName uniqueness→INSERT→COMMIT, catches 23505→TAG_DUPLICATE), listTags (no TX), getTag (no TX, TAG_NOT_FOUND if null), updateTag (BEGIN→exist check→normalizedName self-excluding uniqueness check→UPDATE→COMMIT), deleteTag (BEGIN→exist check→COUNT relations→TAG_HAS_RELATIONS if >0→DELETE→COMMIT), createTagRelation (BEGIN→tag exist+enabled check→entityType validation→entity exist via checkEntityExists→duplicate check→INSERT→COMMIT, catches 23505→TAG_RELATION_DUPLICATE), deleteTagRelation (BEGIN→exist check→DELETE→COMMIT), listEntityTags (no TX), listTagEntities (no TX) — structured logging via @zidney/logger on all write operations
- [ ] T008 [US0] Create dependency registry: `packages/domain-core/src/tags/tags.dependency-registry.ts` — declares that tags package has no external service dependencies; pure in-tenant-DB operations only
- [ ] T009 [US0] Create domain package index: `packages/domain-core/src/tags/index.ts` — re-export all public types, errors, and service functions
- [ ] T010 [US0] Register domain package in monorepo index: modify `packages/domain-core/src/index.ts` — add `export * from './tags'` after category-values export line

---

## Phase 2 — Validation Schemas

- [ ] T011 [US0] Create Zod validation schemas: `packages/validation/src/backoffice/tags.schemas.ts` — tagParamsSchema (id: uuid), createTagBodySchema (name: string trim min(1) max(255)), updateTagBodySchema (name optional, status optional Enabled/Disabled enum), listTagsQuerySchema (status optional, search optional, page coerce int min(1) default(1), per_page coerce int min(1) max(100) default(20)), createTagRelationBodySchema (tagId uuid, entityType enum MCQ_QUESTION/TRADITIONAL_QUESTION/LIBRARY_FILE, entityId uuid), tagRelationParamsSchema (id uuid), entityTagsParamsSchema (entityType enum, entityId uuid), listTagEntitiesQuerySchema (entityType optional enum, page, per_page)

---

## Phase 3 — Route Handlers

- [ ] T012 [US1] Create route helpers: `apps/api/src/routes/backoffice/tags/helpers.ts` — computeNormalizedName(name: string): string = name.trim().toLowerCase(); toTagResponse(tag: TagRow): object; toTagRelationResponse(relation: TagRelationRow): object; buildListMeta(page: number, perPage: number, total: number): object
- [ ] T013 [US1] Create POST /tags handler: `apps/api/src/routes/backoffice/tags/create-tag.ts` — parse createTagBodySchema, compute normalizedName, call createTag service, return 201 { success: true, data: toTagResponse(tag), error: null }; on TAG_DUPLICATE return 409; on VALIDATION_ERROR return 422
- [ ] T014 [US1] Create GET /tags handler: `apps/api/src/routes/backoffice/tags/list-tags.ts` — parse listTagsQuerySchema from query params, call listTags service, return 200 { success: true, data: { items, meta }, error: null }
- [ ] T015 [US1] Create GET /tags/:id handler: `apps/api/src/routes/backoffice/tags/get-tag.ts` — parse tagParamsSchema, call getTag service, return 200; on TAG_NOT_FOUND return 404
- [ ] T016 [US2] Create PATCH /tags/:id handler: `apps/api/src/routes/backoffice/tags/update-tag.ts` — parse tagParamsSchema + updateTagBodySchema, compute normalizedName if name provided, call updateTag service, return 200; on TAG_NOT_FOUND 404; on TAG_DUPLICATE 409
- [ ] T017 [US3] Create DELETE /tags/:id handler: `apps/api/src/routes/backoffice/tags/delete-tag.ts` — parse tagParamsSchema, call deleteTag service, return 200 { success: true, data: { deleted: true }, error: null }; on TAG_NOT_FOUND 404; on TAG_HAS_RELATIONS 422
- [ ] T018 [US4] Create POST /tag-relations handler: `apps/api/src/routes/backoffice/tags/create-tag-relation.ts` — parse createTagRelationBodySchema, call createTagRelation service, return 201; on TAG_NOT_FOUND 404; on TAG_DISABLED 422; on TAG_RELATION_INVALID_ENTITY_TYPE 422; on TAG_RELATION_ENTITY_NOT_FOUND 422; on TAG_RELATION_DUPLICATE 409
- [ ] T019 [US4] Create DELETE /tag-relations/:id handler: `apps/api/src/routes/backoffice/tags/delete-tag-relation.ts` — parse tagRelationParamsSchema, call deleteTagRelation service, return 200 { success: true, data: { deleted: true }, error: null }; on TAG_RELATION_NOT_FOUND 404
- [ ] T020 [US5] Create GET /entities/:entityType/:entityId/tags handler: `apps/api/src/routes/backoffice/tags/list-entity-tags.ts` — parse entityTagsParamsSchema + pagination query params, validate entityType against enum, call listEntityTags service, return 200 paginated list
- [ ] T021 [US6] Create GET /tags/:id/entities handler: `apps/api/src/routes/backoffice/tags/list-tag-entities.ts` — parse tagParamsSchema + listTagEntitiesQuerySchema, call listTagEntities service, return 200 paginated list; on TAG_NOT_FOUND 404
- [ ] T022 [US0] Create router index: `apps/api/src/routes/backoffice/tags/index.ts` — createTagsRouter() factory returning Hono typed with BackofficeEnv; writeGuard = requireAnyPermission(['question_manage', 'content_manage']); mount static routes before parameterized; expose both /tags/_ and /tag-relations/_ and /entities/\* under single router; export createTagsRouter

---

## Phase 4 — API Wiring

- [ ] T023 [US0] Register tags router in API app: modify `apps/api/src/app.ts` — import createTagsRouter from routes/backoffice/tags/index; add `app.route('/api/v1/backoffice/workspace', tagsRouter)` with comment `// Tags endpoints — Stage 032, permission guard applied per write routes`; place immediately after the categoryValuesRouter mount line

---

## Phase 5 — Unit Tests

- [ ] T024 [P] [US0] Create tags service unit tests: `packages/domain-core/src/tags/__tests__/tags.service.test.ts` — mock repository; test cases: normalizedName computation (trim+lowercase), empty/whitespace name rejection, TAG_DUPLICATE on existing normalizedName, TAG_DUPLICATE on concurrent 23505 catch, self-exclusion on update (same name allowed), TAG_HAS_RELATIONS prevents delete, TAG_DISABLED prevents assignment, TAG_RELATION_INVALID_ENTITY_TYPE, TAG_RELATION_DUPLICATE on concurrent 23505, entity existence 42P01 → TAG_RELATION_ENTITY_NOT_FOUND, successful createTag returns correct fields, successful updateTag returns updated fields, listTags with status filter, listTags with search term

---

## Phase 6 — Integration Tests

- [ ] T025 [P] [US0] Create tags repository integration tests: `packages/domain-core/src/tags/__tests__/tags.repository.test.ts` — real tenant DB; test cases: insertTag persists correct normalized_name, unique constraint on normalized_name enforced (PG 23505), ON DELETE CASCADE: deleting tag cascades to tag_relations, UNIQUE(tag_id, entity_type, entity_id) enforced, index idx_tags_status present and used, index idx_tag_relations_entity present

- [ ] T026 [P] [US1] Create tags API integration tests — basic CRUD: `tests/tags.integration.test.ts` — POST /tags creates tag, returns 201 with normalized_name; GET /tags lists all tags default to 20 per_page; GET /tags?status=ENABLED filters; GET /tags/:id returns tag; PATCH /tags/:id updates name — normalizedName recomputed; PATCH /tags/:id updates status to DISABLED; DELETE /tags/:id deletes when no relations; GET /tags/:nonexistent-id → 404

- [ ] T027 [P] [US2] Extend integration tests — uniqueness & conflicts: `tests/tags.integration.test.ts` — POST /tags with name that normalizes to existing → 409 TAG_DUPLICATE; PATCH /tags/:id with name that normalizes to another tag → 409 TAG_DUPLICATE; PATCH /tags/:id with same name (no change) → 200 (self-exclude in uniqueness check)

- [ ] T028 [P] [US3] Extend integration tests — delete with relations guard: `tests/tags.integration.test.ts` — DELETE /tags/:id when tag has relations → 422 TAG_HAS_RELATIONS; DELETE /tags/:id after relations removed → 200 deleted:true

- [ ] T029 [P] [US4] Extend integration tests — tag relations lifecycle: `tests/tags.integration.test.ts` — POST /tag-relations assigns tag to entity; POST /tag-relations duplicate → 409 TAG_RELATION_DUPLICATE; POST /tag-relations with DISABLED tag → 422 TAG_DISABLED; POST /tag-relations with invalid entityType → 422 TAG_RELATION_INVALID_ENTITY_TYPE; DELETE /tag-relations/:id removes relation; DELETE /tag-relations/:nonexistent → 404

- [ ] T030 [P] [US5] Extend integration tests — entity tag listing: `tests/tags.integration.test.ts` — GET /entities/MCQ_QUESTION/:id/tags returns assigned tags with pagination; GET /entities/MCQ_QUESTION/:id/tags returns empty list when no tags assigned

- [ ] T031 [P] [US6] Extend integration tests — tag entity listing: `tests/tags.integration.test.ts` — GET /tags/:id/entities lists all entity relations; GET /tags/:id/entities?entityType=MCQ_QUESTION filters by entity type; pagination honours per_page and page params

- [ ] T032 [P] [US7] Extend integration tests — permission enforcement: `tests/tags.integration.test.ts` — POST /tags without question_manage or content_manage → 403; PATCH /tags/:id without permission → 403; DELETE /tags/:id without permission → 403; GET /tags without permission → 403 (read also requires at least one of the two)

- [ ] T033 [P] [US7] Extend integration tests — tenant isolation: `tests/tags.integration.test.ts` — tag created in tenant A is NOT visible in tenant B; tag relation assigned in tenant A does NOT appear in tenant B queries

---

## Phase 7 — Migration Validation

- [ ] T034 [US0] Validate migration file: run migration against test tenant DB, verify tags table created with correct columns, constraints, and check constraints; verify tag_relations table created with FK (ON DELETE CASCADE), check constraint on entity_type, all 4 indexes (idx_tags_status, idx_tag_relations_tag_id, idx_tag_relations_entity, unique_tags_normalized_name) present; run down() and verify tables dropped; schema_version correctly set to 1.16.0

---

## Phase 8 — Lint, Type Check & Static Analysis

- [ ] T035 [P] [US0] Run Biome lint check on all new files: `biome check apps/api/src/db/tenant/migrations/20260323_010_tags.ts apps/api/src/db/tenant/schemas/tags.schema.ts apps/api/src/db/tenant/schemas/tag-relations.schema.ts packages/domain-core/src/tags/ packages/validation/src/backoffice/tags.schemas.ts apps/api/src/routes/backoffice/tags/` — must exit 0 with no ERRORs

- [ ] T036 [P] [US0] Run TypeScript type-check: `bun run typecheck` — must exit 0 with no TypeScript errors across all tsconfig targets

---

## Phase 9 — Final Validation

- [ ] T037 [US0] Run full test suite for impacted packages: `bun run test -- --reporter=verbose packages/domain-core tests/tags.integration.test.ts` — all tests pass; no skipped tests in tags suite

---

## Summary

| Phase                     | Tasks     | Parallel Eligible             |
| ------------------------- | --------- | ----------------------------- |
| 0 — DB Migration & Schema | T001–T003 | No                            |
| 1 — Domain Package        | T004–T010 | No (sequential by dependency) |
| 2 — Validation Schemas    | T011      | No                            |
| 3 — Route Handlers        | T012–T022 | No (sequential by dependency) |
| 4 — API Wiring            | T023      | No                            |
| 5 — Unit Tests            | T024      | Yes [P]                       |
| 6 — Integration Tests     | T025–T033 | Yes [P]                       |
| 7 — Migration Validation  | T034      | No                            |
| 8 — Lint & Type Check     | T035–T036 | Yes [P]                       |
| 9 — Final Validation      | T037      | No                            |

**Total: 37 tasks**
