# Pull Request: STAGE_25_HIERARCHY_TREE

## Overview

This PR implements **STAGE_25_HIERARCHY_TREE** — a production-ready organizational hierarchy tree for Zidney workspaces.

The hierarchy is a self-referencing, unlimited-depth tree of named nodes used to model reporting structure, org chart representation, and managerial segmentation. It is a purely organizational construct with no impact on academic visibility, exam filtering, or student assignment.

---

## Changes Summary

| Category          | Deliverable                                                     | Status         |
| ----------------- | --------------------------------------------------------------- | -------------- |
| **Database**      | `hierarchy_nodes` table + migration (1.7.0 → 1.8.0)             | ✅ Complete    |
| **Domain Layer**  | Hierarchy domain package with recursive CTE + cycle detection   | ✅ Complete    |
| **API Surface**   | 7 REST endpoints under `/api/v1/backoffice/workspace/hierarchy` | ✅ Complete    |
| **Validation**    | Zod schemas for all inputs                                      | ✅ Complete    |
| **Tests**         | 15 unit + 15 integration tests (30 total)                       | ✅ All Passing |
| **Authorization** | RBAC gates under `PermissionModule.ACADEMIC_STRUCTURE`          | ✅ Enforced    |

---

## Endpoint Summary (7 Endpoints)

```
POST   /api/v1/backoffice/workspace/hierarchy-nodes
GET    /api/v1/backoffice/workspace/hierarchy-nodes
GET    /api/v1/backoffice/workspace/hierarchy-nodes/tree
GET    /api/v1/backoffice/workspace/hierarchy-nodes/:id
GET    /api/v1/backoffice/workspace/hierarchy-nodes/:id/subtree
PATCH  /api/v1/backoffice/workspace/hierarchy-nodes/:id
DELETE /api/v1/backoffice/workspace/hierarchy-nodes/:id
```

All endpoints:

- ✅ Implement tenant isolation via DbClient injection
- ✅ Require RBAC authorization (ACADEMIC_STRUCTURE module)
- ✅ Use structured error responses with HTTP status mapping
- ✅ Support idempotent operations where applicable

---

## Key Features

### Hierarchy Structure

- Unlimited-depth self-referencing tree (`parent_id` → `hierarchy_nodes.id`)
- Automatic `depth` computation for UI/analytics
- Support for root nodes (no parent) and arbitrarily nested children

### Data Integrity

- **Cycle Detection** — Prevents reparenting that would create cycles
- **Unique Names** — Per-parent scope uniqueness (same name allowed under different parents)
- **Deletion Guards** — Blocks deletion of nodes with children
- **Staff Assignment Guards** — Prepared for downstream STAGE_26 staff assignment (currently placeholder)

### Query Capabilities

- **Flat List** — Paginated offset-based list with optional status filter
- **Full Tree** — Nested JSON structure of entire hierarchy
- **Subtree** — Anchored subtree from any node for org chart slicing
- **Single Node** — With computed depth for UI rendering

### Concurrency Safety

- All mutations wrapped in transactions
- Deterministic dual-row locking for concurrent reparent operations
- Recursive CTE protected by app-level timeout (500ms)

---

## Files Changed

### Database

- `apps/api/src/db/tenant/migrations/20260319_002_hierarchy_nodes.ts` (new)
- `apps/api/src/db/tenant/migrations/20260319_003_add_hierarchy_node_id_to_users.ts` (new, placeholder for STAGE_26)

### Domain Layer

- `packages/domain-core/src/hierarchy/hierarchy.types.ts` (new)
- `packages/domain-core/src/hierarchy/hierarchy.errors.ts` (new)
- `packages/domain-core/src/hierarchy/hierarchy.repository.ts` (new)
- `packages/domain-core/src/hierarchy/hierarchy.service.ts` (new)
- `packages/domain-core/src/hierarchy/index.ts` (new)
- `packages/domain-core/package.json` (modified — added `.hierarchy` export)
- `packages/domain-core/src/index.ts` (modified — added hierarchy exports)

### Validation

- `packages/validation/src/backoffice/hierarchy.schemas.ts` (new)

### API Routes

- `apps/api/src/routes/backoffice/hierarchy/helpers.ts` (new)
- `apps/api/src/routes/backoffice/hierarchy/create-node.ts` (new)
- `apps/api/src/routes/backoffice/hierarchy/list-nodes.ts` (new)
- `apps/api/src/routes/backoffice/hierarchy/get-tree.ts` (new)
- `apps/api/src/routes/backoffice/hierarchy/get-subtree.ts` (new)
- `apps/api/src/routes/backoffice/hierarchy/get-node.ts` (new)
- `apps/api/src/routes/backoffice/hierarchy/update-node.ts` (new)
- `apps/api/src/routes/backoffice/hierarchy/delete-node.ts` (new)
- `apps/api/src/routes/backoffice/hierarchy/index.ts` (new)
- `apps/api/src/app.ts` (modified — router registration)

### Tests

- `packages/domain-core/src/hierarchy/__tests__/hierarchy.service.test.ts` (new, 15 tests)
- `tests/backoffice/hierarchy/hierarchy.integration.test.ts` (new, 15 tests)

### Staging & Spec Artifacts

- `specs/runtime/025-hierarchy-tree/spec.md`
- `specs/runtime/025-hierarchy-tree/plan.md`
- `specs/runtime/025-hierarchy-tree/tasks.md`
- `specs/runtime/025-hierarchy-tree/data-model.md`
- `specs/runtime/025-hierarchy-tree/research.md`
- `specs/runtime/025-hierarchy-tree/checklists/requirements.md`
- `specs/runtime/025-hierarchy-tree/reports/*.md` (all reports)
- `specs/runtime/025-hierarchy-tree/audits/*.md` (all audit reports)
- `specs/runtime/025-hierarchy-tree/guides/TESTING_GUIDE.md`
- `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_25_HIERARCHY_TREE.md`

---

## Testing

### Automated Tests ✅ All Passing

```bash
# Unit tests (15 tests)
bun test packages/domain-core/src/hierarchy/__tests__/hierarchy.service.test.ts

# Integration tests (15 tests)
bun test tests/backoffice/hierarchy/hierarchy.integration.test.ts

# All tests
bun run test
```

### Test Coverage

- **Create Node** — Valid input, duplicates, cycle detection
- **Read Operations** — Get single, list with pagination, full tree, subtree
- **Update Operations** — Name update, reparent with cycle detection
- **Delete Operations** — Successful delete, guards for children
- **Pagination** — Offset-based, stable ordering, boundary conditions
- **Status Filtering** — ENABLED/DISABLED filtering
- **Tenant Isolation** — Cross-workspace data isolation
- **Middleware Behavior** — Tenant resolver, license validation, RBAC

### Manual Testing

See `specs/runtime/025-hierarchy-tree/guides/TESTING_GUIDE.md` for detailed scenarios:

- Scenario 1: Simple 3-level hierarchy
- Scenario 2: Unique name constraint
- Scenario 3: Cycle detection
- Scenario 4: Pagination
- Scenario 5: Status filtering
- Scenario 6: Tenant isolation
- Scenario 7: Delete guards
- Scenario 8: Error handling

---

## Validation Results

| Check                  | Result        | Evidence                                          |
| ---------------------- | ------------- | ------------------------------------------------- |
| **Lint**               | ✅ PASS       | biome check: 0 errors                             |
| **Type Safety**        | ✅ PASS       | tsc --noEmit: 0 errors                            |
| **Architecture Guard** | ✅ PASS       | ai-guard validation passed                        |
| **Unit Tests**         | ✅ 15/15 PASS | All domain service tests passing                  |
| **Integration Tests**  | ✅ 15/15 PASS | All API endpoint tests passing                    |
| **Drift Analysis**     | ✅ PASS       | spec.md ↔ plan.md ↔ tasks.md consistency verified |
| **Guardian Audits**    | ✅ 9/9 PASS   | All guardian verdicts: PASS                       |

**Guardian verdicts:**

- ✅ Zidney Architecture Checker: PASS (9/9 criteria)
- ✅ Zidney API Designer: PASS (7/7 criteria)
- ✅ Zidney QA Engineer: PASS
- ✅ Zidney Security Auditor: PASS
- ✅ Zidney Performance Optimizer: PASS
- ✅ Zidney Deployment Engineer: PASS
- ✅ Zidney CI/CD Automation: PASS
- ✅ Zidney Code Reviewer: PASS
- ✅ Zidney Docker Specialist: PASS

---

## Constitutional Compliance ✅

| Rule                          | Compliance                                             |
| ----------------------------- | ------------------------------------------------------ |
| Database-per-tenant isolation | ✅ `DbClient` injection, no global singleton           |
| No middleware bypass          | ✅ Tenant → license → route handler chain enforced     |
| No cross-tenant joins         | ✅ All queries scoped to tenant DB                     |
| Server-authoritative time     | ✅ `NOW()` in DDL, all timestamps server-set           |
| No direct DB instantiation    | ✅ Structurally typed `DbClient` via context injection |
| Transactional boundaries      | ✅ All CRUD wrapped in transactions                    |
| Forward-only migrations       | ✅ Migration marked forward-only; `down()` throws      |
| Version enforcement           | ✅ Schema version 1.7.0 → 1.8.0                        |
| No grading outside Worker     | ✅ Backoffice CRUD only                                |
| No console.log                | ✅ Structured logging via `@zidney/logger`             |

**Result:** ✅ FULLY COMPLIANT — No exceptions required.

---

## Known Limitations & Deferrals

### Deferred to Downstream Stage (STAGE_26)

- **Staff Assignment** — Adding `hierarchy_node_id` to `users` table
- This stage defines the stable hierarchy tree; downstream stage integrates staff assignment

### Post-Deployment Enhancements

- **Pool-Level Timeout Guards** — Recursive CTE timeout currently enforced at application level (500ms); pool-level guards planned as high-priority post-deploy item
- **Frontend Org-Chart UI** — Hierarchy API ready; UI rendering is frontoffice concern

### Design Decision

- **Pagination Strategy:** Offset-based (not cursor-based) due to bounded entity scale (< 10k nodes per workspace); future stages may upgrade to cursor-based if scale increases

---

## Merge Checklist

- [x] All 21 tasks completed and marked [X] in tasks.md
- [x] All tests passing (30/30)
- [x] Lint passing (0 errors)
- [x] Type-check passing (0 errors)
- [x] Architecture guard passing
- [x] Drift analysis approved
- [x] All guardian verdicts PASS
- [x] Constitutional compliance verified
- [x] Database migration forward-only validated
- [x] Stage file updated to PRODUCTION READY
- [x] All closure artifacts generated (reports, testing guide, PR summary)

---

## Deployment Notes

### Pre-Deployment

1. Verify target environment has PostgreSQL 13+ (for UUID support)
2. Ensure tenant DB backup exists (snapshots per ADR-0002)
3. Verify license middleware is deployed in target environment

### Deployment Steps

1. Deploy application code
2. Run tenant DB migration: `20260319_002_hierarchy_nodes.ts`
3. Verify schema_version updated to 1.8.0 in tenant DB
4. Verify indexes created: `idx_hierarchy_nodes_parent_id`, `idx_hierarchy_nodes_status`, `hierarchy_nodes_root_name_unique`, `hierarchy_nodes_parent_name_unique`
5. Monitor API logs for any errors in first hour

### Post-Deployment

1. Monitor API endpoint latency (target: < 500ms P99)
2. Verify no 5xx errors on hierarchy endpoints
3. Sample 5+ live workspaces; verify hierarchy isolation
4. Begin planning STAGE_26 (staff assignment)

---

## Related Issues & Documentation

- **Specification:** [specs/runtime/025-hierarchy-tree/spec.md](../../025-hierarchy-tree/spec.md)
- **Implementation Plan:** [specs/runtime/025-hierarchy-tree/plan.md](../../025-hierarchy-tree/plan.md)
- **Task List:** [specs/runtime/025-hierarchy-tree/tasks.md](../../025-hierarchy-tree/tasks.md)
- **Testing Guide:** [specs/runtime/025-hierarchy-tree/guides/TESTING_GUIDE.md](../../025-hierarchy-tree/guides/TESTING_GUIDE.md)
- **Closure Report:** [specs/runtime/025-hierarchy-tree/reports/CLOSURE_REPORT.md](../../025-hierarchy-tree/reports/CLOSURE_REPORT.md)
- **Data Model:** [specs/runtime/025-hierarchy-tree/data-model.md](../../025-hierarchy-tree/data-model.md)

---

## Reviewers

- [ ] Architecture Review
- [ ] QA Review
- [ ] Security Review
- [ ] Performance Review

---

**Branch:** `spec/025-hierarchy-tree`  
**Base:** `develop`  
**Commits:** Multiple (21 implementation tasks + 1 closure commit)  
**Status:** ✅ READY FOR MERGE

---

_Generated by Zidney Hard Mode Workflow — Step 7 Closure_  
*Date:\*\* 2026-03-19  
*Stage Status:\*\* PRODUCTION READY
