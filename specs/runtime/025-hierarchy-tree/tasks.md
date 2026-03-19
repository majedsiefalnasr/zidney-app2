# Tasks — STAGE_25_HIERARCHY_TREE

**Stage:** STAGE_25_HIERARCHY_TREE  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Generated:** 2026-03-19  
**Status:** DRAFT  
**Depends on:** STAGE_21_ROLE_PERMISSION_SYSTEM

Tasks are ordered by execution dependency. Tasks marked `[P]` within a phase group are safe to
execute in parallel because they have no inter-task dependencies within that group. A parallel
group must fully complete before the next sequential task begins.

---

## Phase 0 — Infrastructure (DB Schema + Migration)

> T001 is the schema foundation for all later hierarchy implementation work.

- [x] T001 Write forward-only tenant migration 1.7.0 -> 1.8.0 to create `hierarchy_nodes`, indexes, partial unique indexes, and bump `schema_version` — `apps/api/src/db/tenant/migrations/20260319_002_hierarchy_nodes.ts`

---

## Phase 1 — Domain Layer

> T002 and T003 are parallel. T004 depends on T002+T003. T005 depends on T004. T006-T008 follow
> after the hierarchy domain surface is complete.

- [x] T002 [P] Define `DbClient`, audit context, row types, tree types, and service input/output interfaces for hierarchy operations — `packages/domain-core/src/hierarchy/hierarchy.types.ts`
- [x] T003 [P] Define `HierarchyErrorCode`, HTTP status mapping, default messages, and `HierarchyError` class — `packages/domain-core/src/hierarchy/hierarchy.errors.ts`
- [x] T004 Implement raw SQL repository functions for lookup, recursive CTE reads, scoped uniqueness checks, conditional staff checks, and timeout-guarded traversal queries — `packages/domain-core/src/hierarchy/hierarchy.repository.ts`
- [x] T005 Implement transactional hierarchy service functions for create, update, delete, get, list, tree, and subtree flows with deterministic dual-row locking — `packages/domain-core/src/hierarchy/hierarchy.service.ts`
- [x] T006 Re-export the hierarchy domain surface from a dedicated barrel — `packages/domain-core/src/hierarchy/index.ts`
- [x] T007 Add the `./hierarchy` subpath export so `@zidney/domain-core/hierarchy` resolves correctly — `packages/domain-core/package.json`
- [x] T008 Add hierarchy exports to the domain-core main barrel — `packages/domain-core/src/index.ts`

---

## Phase 2 — Validation Layer

- [x] T009 Define Zod schemas for hierarchy create, update, params, flat-list query, and tree query validation — `packages/validation/src/backoffice/hierarchy.schemas.ts`

---

## Phase 3 — API Routes

> T010 must complete before the handlers. T011-T017 are parallel after T010. T018 depends on all
> route handlers.

- [x] T010 Implement shared hierarchy route helpers for tenant DB access, audit context construction, success envelopes, and structured hierarchy error responses — `apps/api/src/routes/backoffice/hierarchy/helpers.ts`
- [x] T011 [P] [US1] Implement `POST /hierarchy-nodes` create handler with body parsing, validation, domain invocation, and 201 success envelope — `apps/api/src/routes/backoffice/hierarchy/create-node.ts`
- [x] T012 [P] [US4] Implement `GET /hierarchy-nodes` flat-list handler with `page`/`per_page`, stable ordering, and optional `status` filter — `apps/api/src/routes/backoffice/hierarchy/list-nodes.ts`
- [x] T013 [P] [US3] Implement `GET /hierarchy-nodes/tree` handler with timeout-aware recursive traversal and nested response assembly — `apps/api/src/routes/backoffice/hierarchy/get-tree.ts`
- [x] T014 [P] [US5] Implement `GET /hierarchy-nodes/:id/subtree` handler with anchored recursive traversal and subtree pruning semantics — `apps/api/src/routes/backoffice/hierarchy/get-subtree.ts`
- [x] T015 [P] [US6] Implement `GET /hierarchy-nodes/:id` single-node handler returning computed `depth` and structured 404 errors — `apps/api/src/routes/backoffice/hierarchy/get-node.ts`
- [x] T016 [P] [US6] Implement `PATCH /hierarchy-nodes/:id` update handler supporting partial updates, reparent validation, and structured conflict handling — `apps/api/src/routes/backoffice/hierarchy/update-node.ts`
- [x] T017 [P] [US7] Implement `DELETE /hierarchy-nodes/:id` delete handler with child/staff guard propagation and structured dependency failures — `apps/api/src/routes/backoffice/hierarchy/delete-node.ts`
- [x] T018 Assemble the hierarchy Hono router with exact-route ordering and per-route RBAC guards under `PermissionModule.ACADEMIC_STRUCTURE` — `apps/api/src/routes/backoffice/hierarchy/index.ts`

---

## Phase 4 — Router Registration

- [x] T019 Mount `hierarchyRouter` under `/api/v1/backoffice/workspace` in the application Backoffice registration block — `apps/api/src/app.ts`

---

## Phase 5 — Tests

> T020 and T021 are parallel once the implementation surface is complete.

- [x] T020 [P] Write hierarchy domain unit tests covering create, update, reparent cycle detection, delete guards, list pagination, and tree assembly behavior — `packages/domain-core/src/hierarchy/__tests__/hierarchy.service.test.ts`
- [x] T021 [P] Write Backoffice integration tests covering all hierarchy endpoints, middleware behavior, tenant isolation, traversal timeout mapping, and transactional rollback paths — `tests/backoffice/hierarchy/hierarchy.integration.test.ts`

---

Total tasks: 21
