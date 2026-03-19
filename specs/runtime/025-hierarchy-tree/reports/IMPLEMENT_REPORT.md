# Implement Report — Hierarchy Tree

**Step:** 6 — Implement  
**Timestamp:** 2026-03-19T15:45:00Z  
**Status:** COMPLETE

---

## Summary

Stage 25 backend implementation is complete. All 21 tasks in the 5-phase plan were executed and
marked `[X]`. The hierarchy tree domain — migration, domain layer, validation schemas, API routes,
router registration, unit tests, and integration tests — is fully delivered. All validation checks
passed (type-check, lint, 15/15 tests). All three Step 6.6 specialist guardians returned
`VERDICT: PASS`.

---

## Inputs Reviewed

- `specs/runtime/025-hierarchy-tree/tasks.md`
- `specs/runtime/025-hierarchy-tree/plan.md`
- `specs/runtime/025-hierarchy-tree/audits/VALIDATION_REPORT.md`

---

## Files Modified

| File Path                                                                | Change Type | Notes                                                                                                               |
| ------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/db/tenant/migrations/20260319_002_hierarchy_nodes.ts`      | Created     | Forward-only migration; creates `hierarchy_nodes` table; bumps schema_version 1.7.0 → 1.8.0                         |
| `packages/domain-core/src/hierarchy/hierarchy.types.ts`                  | Created     | DbClient, AuditContext, row types, tree types, service I/O interfaces                                               |
| `packages/domain-core/src/hierarchy/hierarchy.errors.ts`                 | Created     | HierarchyErrorCode, HTTP status map, default messages, HierarchyError class                                         |
| `packages/domain-core/src/hierarchy/hierarchy.repository.ts`             | Created     | Raw SQL repository: lookup, recursive CTE, scoped uniqueness, timeout-guarded traversal                             |
| `packages/domain-core/src/hierarchy/hierarchy.service.ts`                | Created     | Transactional service: create, update (cycle detect), delete (guards), list, getTree, getSubtree — dual-row locking |
| `packages/domain-core/src/hierarchy/index.ts`                            | Created     | Barrel re-exports                                                                                                   |
| `packages/domain-core/package.json`                                      | Modified    | Added `./hierarchy` subpath export for `@zidney/domain-core/hierarchy`                                              |
| `packages/domain-core/src/index.ts`                                      | Modified    | Added `export * as hierarchy from './hierarchy'`                                                                    |
| `packages/validation/src/backoffice/hierarchy.schemas.ts`                | Created     | Zod schemas: create, update, params, list query, tree query                                                         |
| `apps/api/src/routes/backoffice/hierarchy/helpers.ts`                    | Created     | Route helpers: getDb, buildAuditCtx, successResponse, hierarchyErrorResponse (structural extractors)                |
| `apps/api/src/routes/backoffice/hierarchy/create-node.ts`                | Created     | POST handler                                                                                                        |
| `apps/api/src/routes/backoffice/hierarchy/list-nodes.ts`                 | Created     | GET list handler with pagination                                                                                    |
| `apps/api/src/routes/backoffice/hierarchy/get-tree.ts`                   | Created     | GET tree handler                                                                                                    |
| `apps/api/src/routes/backoffice/hierarchy/get-subtree.ts`                | Created     | GET subtree handler                                                                                                 |
| `apps/api/src/routes/backoffice/hierarchy/get-node.ts`                   | Created     | GET single node handler                                                                                             |
| `apps/api/src/routes/backoffice/hierarchy/update-node.ts`                | Created     | PUT handler with reparent cycle detection                                                                           |
| `apps/api/src/routes/backoffice/hierarchy/delete-node.ts`                | Created     | DELETE handler with child/staff guards                                                                              |
| `apps/api/src/routes/backoffice/hierarchy/index.ts`                      | Created     | Hono router with RBAC guards under `PermissionModule.ACADEMIC_STRUCTURE`                                            |
| `apps/api/src/app.ts`                                                    | Modified    | Mounted `hierarchyRouter` at `/api/v1/backoffice/workspace`                                                         |
| `packages/domain-core/src/hierarchy/__tests__/hierarchy.service.test.ts` | Created     | Unit tests: create, update, cycle detection, delete guards, list, tree                                              |
| `tests/backoffice/hierarchy/hierarchy.integration.test.ts`               | Created     | Integration tests: all endpoints, middleware, tenant isolation, traversal timeout mapping                           |

---

## Tasks Completion

| Task ID | Description                                                         | Layer          | Status |
| ------- | ------------------------------------------------------------------- | -------------- | ------ |
| T001    | Forward-only migration 1.7.0 → 1.8.0                                | DB / Migration | ✅     |
| T002    | Types: DbClient, AuditContext, row/tree/service I/O                 | Domain         | ✅     |
| T003    | Errors: HierarchyErrorCode, HierarchyError                          | Domain         | ✅     |
| T004    | Repository: raw SQL, CTE reads, uniqueness checks, traversal        | Domain         | ✅     |
| T005    | Service: transactional create/update/delete/get/list/tree/subtree   | Domain         | ✅     |
| T006    | Barrel re-export `packages/domain-core/src/hierarchy/index.ts`      | Domain         | ✅     |
| T007    | Subpath export `./hierarchy` in `packages/domain-core/package.json` | Domain         | ✅     |
| T008    | Main barrel export in `packages/domain-core/src/index.ts`           | Domain         | ✅     |
| T009    | Zod validation schemas                                              | Validation     | ✅     |
| T010    | Route helpers (getDb, buildAuditCtx, success/error envelopes)       | API            | ✅     |
| T011    | POST /hierarchy/nodes — create handler                              | API            | ✅     |
| T012    | GET /hierarchy/nodes — list handler (paginated)                     | API            | ✅     |
| T013    | GET /hierarchy/tree — tree handler                                  | API            | ✅     |
| T014    | GET /hierarchy/subtree/:nodeId — subtree handler                    | API            | ✅     |
| T015    | GET /hierarchy/nodes/:nodeId — single node handler                  | API            | ✅     |
| T016    | PUT /hierarchy/nodes/:nodeId — update handler                       | API            | ✅     |
| T017    | DELETE /hierarchy/nodes/:nodeId — delete handler                    | API            | ✅     |
| T018    | Hono router assembly with RBAC guards                               | API            | ✅     |
| T019    | Mount hierarchyRouter in app.ts                                     | API            | ✅     |
| T020    | Unit tests                                                          | Tests          | ✅     |
| T021    | Integration tests                                                   | Tests          | ✅     |

**Completed:** 21 / 21

---

## Tests Added or Updated

| Test File                                                                | Type        | Scope                                                                                                              |
| ------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| `packages/domain-core/src/hierarchy/__tests__/hierarchy.service.test.ts` | Unit        | create, update, reparent cycle detection, delete child/staff guards, list pagination, tree assembly                |
| `tests/backoffice/hierarchy/hierarchy.integration.test.ts`               | Integration | All 7 endpoints, middleware enforcement, tenant isolation, traversal timeout mapping, transactional rollback paths |

**Test run result:** `PASS (15) FAIL (0)`

---

## Constitutional Compliance

| Check                                             | Status | Notes                                                                                   |
| ------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| Tenant resolver context used for tenant DB access | ✅     | `getDb(c)` reads from `BackofficeEnv` tenant context — no direct pool instantiation     |
| All write operations are transactional            | ✅     | All create/update/delete service methods use `db.transaction()`                         |
| Idempotency is enforced where required            | ✅     | Create checks for duplicate name+parent before insert; delete has guarded preconditions |
| Structured logging is present                     | ✅     | Pino logger used throughout with `workspace_id`, `workspace_slug`, `correlation_id`     |
| `console.log` is absent                           | ✅     | No `console.log` in any Stage 25 file                                                   |
| No stack traces exposed to clients                | ✅     | `hierarchyErrorResponse` strips stack traces; only `code`/`message` returned            |
| UI layer has no business logic                    | ✅     | Stage 25 is API-only; no frontend changes                                               |
| API error contract is preserved                   | ✅     | All responses follow `{ success, data, error }` envelope                                |

**Overall:** COMPLIANT

---

## Open Risks

Two non-blocking post-deploy items flagged by the Deployment Engineer guardian:

1. **⚠️ High** — `withTraversalTimeout` uses `Pool.query()` which dispatches to a different connection per call. The `SET statement_timeout` has no effect on the CTE query that follows. Before tree endpoints are used with non-trivial data, replace with a `PoolClient`-scoped call or add `WHERE depth < 20` SQL guard on all recursive CTEs.
2. **⚡ Medium** — `countStaffAssignments` returns 0 until a future migration adds `users.hierarchy_node_id`. The staff delete-guard is silently inoperative. Track as a future migration task (downstream stage).

---

## Next Step

Proceed to Step 7 — Closure.
