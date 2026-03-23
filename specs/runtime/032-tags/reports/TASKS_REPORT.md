# Tasks Report — Tags

**Step:** 4 — Tasks  
**Timestamp:** 2026-03-23T00:45:00Z  
**Status:** COMPLETE  
**Total Tasks Generated:** 37

---

## Summary

37 atomic tasks generated covering 9 implementation phases: DB migration, Drizzle schemas, domain package (errors/types/repository/service/tests), Zod validation schemas, Hono route handlers, API wiring, unit tests, integration tests, migration validation, lint/type-check, and final test execution.

Tasks follow the established Zidney task format: `- [ ] TNNN [P?] [USN?] Description with exact file path`.

---

## Task Map by User Story

| User Story                    | Tasks                           | Description                                            |
| ----------------------------- | ------------------------------- | ------------------------------------------------------ |
| US0 — Foundation              | T001–T012, T022–T024, T034–T037 | DB, domain, validation, wiring, testing infrastructure |
| US1 — Create/List/Read Tags   | T013–T015, T026                 | POST /tags, GET /tags, GET /tags/:id                   |
| US2 — Update Tags             | T016, T027                      | PATCH /tags/:id                                        |
| US3 — Delete Tags             | T017, T028                      | DELETE /tags/:id with relation guard                   |
| US4 — Tag Assignment          | T018–T019, T029                 | POST /tag-relations, DELETE /tag-relations/:id         |
| US5 — Entity Tag Listing      | T020, T030                      | GET /entities/:entityType/:entityId/tags               |
| US6 — Tag Entity Listing      | T021, T031                      | GET /tags/:id/entities                                 |
| US7 — Permissions & Isolation | T032–T033                       | Permission enforcement, tenant isolation               |

---

## Full Task List

### Phase 0 — Database Migration & Schema (T001–T003)

- [ ] T001 — `apps/api/src/db/tenant/schemas/tags.schema.ts`
- [ ] T002 — `apps/api/src/db/tenant/schemas/tag-relations.schema.ts`
- [ ] T003 — `apps/api/src/db/tenant/migrations/20260323_010_tags.ts`

### Phase 1 — Domain Package (T004–T010)

- [ ] T004 — `packages/domain-core/src/tags/tags.errors.ts`
- [ ] T005 — `packages/domain-core/src/tags/tags.types.ts`
- [ ] T006 — `packages/domain-core/src/tags/tags.repository.ts`
- [ ] T007 — `packages/domain-core/src/tags/tags.service.ts`
- [ ] T008 — `packages/domain-core/src/tags/tags.dependency-registry.ts`
- [ ] T009 — `packages/domain-core/src/tags/index.ts`
- [ ] T010 — `packages/domain-core/src/index.ts` (modify: add export)

### Phase 2 — Validation Schemas (T011)

- [ ] T011 — `packages/validation/src/backoffice/tags.schemas.ts`

### Phase 3 — Route Handlers (T012–T022)

- [ ] T012 — `apps/api/src/routes/backoffice/tags/helpers.ts`
- [ ] T013 — `apps/api/src/routes/backoffice/tags/create-tag.ts`
- [ ] T014 — `apps/api/src/routes/backoffice/tags/list-tags.ts`
- [ ] T015 — `apps/api/src/routes/backoffice/tags/get-tag.ts`
- [ ] T016 — `apps/api/src/routes/backoffice/tags/update-tag.ts`
- [ ] T017 — `apps/api/src/routes/backoffice/tags/delete-tag.ts`
- [ ] T018 — `apps/api/src/routes/backoffice/tags/create-tag-relation.ts`
- [ ] T019 — `apps/api/src/routes/backoffice/tags/delete-tag-relation.ts`
- [ ] T020 — `apps/api/src/routes/backoffice/tags/list-entity-tags.ts`
- [ ] T021 — `apps/api/src/routes/backoffice/tags/list-tag-entities.ts`
- [ ] T022 — `apps/api/src/routes/backoffice/tags/index.ts`

### Phase 4 — API Wiring (T023)

- [ ] T023 — `apps/api/src/app.ts` (modify: import + mount tagsRouter)

### Phase 5 — Unit Tests (T024)

- [ ] T024 [P] — `packages/domain-core/src/tags/__tests__/tags.service.test.ts`

### Phase 6 — Integration Tests (T025–T033)

- [ ] T025 [P] — `packages/domain-core/src/tags/__tests__/tags.repository.test.ts`
- [ ] T026–T033 [P] — `tests/tags.integration.test.ts` (8 test groups, built incrementally)

### Phase 7 — Migration Validation (T034)

- [ ] T034 — Migration up/down validation against test DB

### Phase 8 — Lint & Type Check (T035–T036)

- [ ] T035 [P] — Biome lint check on all new files
- [ ] T036 [P] — TypeScript type-check (`bun run typecheck`)

### Phase 9 — Final Validation (T037)

- [ ] T037 — Full test suite for impacted packages

---

## Risk-Ranked Task Summary

| Task ID   | Risk      | Description                                                                                      |
| --------- | --------- | ------------------------------------------------------------------------------------------------ |
| T003      | 🔴 HIGH   | Two-phase migration creating tags + tag_relations tables, schema version bump                    |
| T007      | 🔴 HIGH   | Tags service — all transaction logic, concurrent collision handling, entity existence validation |
| T023      | 🔴 HIGH   | Router wiring in app.ts — incorrect mount position breaks existing routes                        |
| T034      | 🔴 HIGH   | Migration validation — ensures constraints, indexes, and cascade behavior are correct            |
| T001      | 🟡 MEDIUM | Drizzle schema — check constraints define DB-level validation backstop                           |
| T002      | 🟡 MEDIUM | tag_relations schema — composite unique constraint definition                                    |
| T006      | 🟡 MEDIUM | Tags repository — 42P01 handling for entity existence check                                      |
| T018      | 🟡 MEDIUM | createTagRelation handler — multiple failure modes, permission check                             |
| T033      | 🟡 MEDIUM | Tenant isolation integration test                                                                |
| T004      | 🟢 LOW    | Error definitions                                                                                |
| T005      | 🟢 LOW    | Type definitions                                                                                 |
| T008      | 🟢 LOW    | Dependency registry                                                                              |
| T011      | 🟢 LOW    | Zod validation schemas                                                                           |
| T012      | 🟢 LOW    | Route helpers                                                                                    |
| T013–T022 | 🟢 LOW    | Individual route handlers                                                                        |
| T024      | 🟢 LOW    | Unit tests                                                                                       |
| T025–T032 | 🟢 LOW    | Integration tests                                                                                |
| T035–T037 | 🟢 LOW    | Linting and type checking                                                                        |

---

## Tasks with External Dependencies

| Task ID   | Package         | Version Note                                                                                                     |
| --------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| T001–T002 | drizzle-orm     | Uses `pgTable`, `varchar()`, `uuid()`, `timestamp()`, `check()`, `index()` — verified against Drizzle v0.30+ API |
| T003      | pg (PoolClient) | Raw SQL migration pattern, verified against existing migration files                                             |
| T006–T007 | @zidney/logger  | Structured logging, in-house package — no external version concern                                               |
| T011      | zod             | Uses `z.coerce.number().int().min(1).max(100).default(20)` pattern — established in prior stages                 |

---

## High-Downstream-Impact Tasks

Tasks that modify shared entry points or architectural hotspots:

| Task ID | File                                | Downstream Risk                                                   | Description                                 |
| ------- | ----------------------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| T010    | `packages/domain-core/src/index.ts` | MEDIUM — all consumers of domain-core get the new export          | Add export \* from ./tags                   |
| T023    | `apps/api/src/app.ts`               | HIGH — incorrect route registration breaks all backoffice routing | Mount tagsRouter after categoryValuesRouter |

---

## Deferred Work (Not in This Stage)

| Item                                                | Deferred To                                            |
| --------------------------------------------------- | ------------------------------------------------------ |
| Tag filtering on MCQ question list endpoint         | MCQ Questions stage (entity endpoints don't exist yet) |
| Tag filtering on traditional question list endpoint | Traditional Questions stage                            |
| Tag filtering on library file list endpoint         | Library Files stage                                    |
| Backoffice UI for tag management                    | Future UI stage                                        |

---

## Phase Execution Order

Tasks must be executed in phase order (dependency chain):

```
T001 → T002 → T003 (Schemas before migration)
→ T004 → T005 → T006 → T007 → T008 → T009 → T010 (Domain — sequential)
→ T011 (Validation — can run after types)
→ T012 → T013-T022 → T022 (Routes — helpers before handlers, index last)
→ T023 (Wiring — after router index exists)
→ T024 [P], T025 [P] (Tests — after implementation)
→ T026-T033 [P] (Integration tests)
→ T034 (Migration validation)
→ T035 [P], T036 [P] (Lint + typecheck)
→ T037 (Final validation)
```
