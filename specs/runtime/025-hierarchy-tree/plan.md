# Implementation Plan: Hierarchy Tree

**Stage**: STAGE_25_HIERARCHY_TREE  
**Phase**: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Created**: 2026-03-19  
**Branch**: `spec/025-hierarchy-tree`  
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md) | **Data Model**: [data-model.md](./data-model.md)

---

## Constitution Pre-Check

Validated against **Zidney Constitution v1.2.0** before plan generation.

**Result: NO VIOLATIONS DETECTED.**

| Rule                                | Status | Notes                                                                               |
| ----------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| No cross-tenant data access         | PASS   | `hierarchy_nodes` resides in tenant DB only; all access via tenant resolver context |
| No middleware bypass                | PASS   | Tenant resolver → license middleware mandatory before all hierarchy routes          |
| No direct DB instantiation          | PASS   | `DbClient` injected from `c.get('tenant').pool` via `getDb()` helper                |
| No grading logic outside Worker     | PASS   | Feature does not touch grading, attempts, or Worker                                 |
| No weakening of snapshot integrity  | PASS   | Feature does not touch attempt snapshots                                            |
| No weakening of version enforcement | PASS   | Migration bumps `schema_version` 1.7.0 → 1.8.0                                      |
| No layer boundary violation         | PASS   | Business logic in `packages/domain-core/src/hierarchy/`; no logic in Hono handlers  |
| Server-authoritative time only      | PASS   | `NOW()` used in migration DDL; all timestamps server-set                            |
| No console.log                      | PASS   | All logging via `@zidney/logger` structured logger                                  |

---

## Stage Alignment

- **Phase**: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE
- **Stage**: STAGE_25_HIERARCHY_TREE
- **Related Spec File**: `specs/runtime/025-hierarchy-tree/spec.md`
- **Related ADRs**: ADR-0001 (database-per-tenant), ADR-0006 (server-authoritative time), ADR-0008 (forward-only migrations)
- **Stage Status**: DRAFT — moves to IN PROGRESS upon plan approval

**Hard Dependencies** (must be deployed before this stage): Tenant DB provisioning, license middleware, tenant resolver middleware, RBAC/permission middleware (STAGE_21).

No dependencies on Divisions, Departments, or Groups.

Plan must not introduce architecture outside defined Stage scope.

---

## Architectural Scope Confirmation

- No cross-tenant data access — `hierarchy_nodes` is tenant-scoped; no global singleton
- No middleware bypass — all routes consume tenant resolver + license middleware
- No direct DB instantiation — `DbClient` is structurally typed and injected via Hono context
- No grading logic outside Worker — feature is Backoffice CRUD only
- No weakening of snapshot integrity — no attempt engine interaction
- No weakening of version enforcement — `schema_version` bumped; tenant compatibility enforced
- No layer boundary violation — Hono handlers are thin; all business logic in domain-core

No exceptions. No new ADR required.

---

## Pagination Design Decision

**Pagination strategy for `GET /hierarchy-nodes` (flat-list endpoint): offset-based.**

This is a deliberate deviation from the Zidney platform cursor-based pagination standard.

| Criterion                  | Decision                               | Rationale                                                                                                                                                                  |
| -------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pagination type            | Offset (`page` / `per_page`)           | Hierarchy node sets are workspace-scoped and bounded; no workspace is expected to exceed 10 000 nodes                                                                      |
| Cursor-based rejected      | Yes                                    | Cursor pagination adds non-trivial implementation complexity (opaque token encoding, decoding, validation) with no P99 latency or correctness benefit at this entity scale |
| Determinism guarantee      | `ORDER BY depth ASC, name ASC, id ASC` | Three-column sort ensures stable, reproducible pages without requiring a cursor                                                                                            |
| Platform standard override | Explicit assumption 9 in spec.md       | No ADR exception required for bounded internal entity sets                                                                                                                 |
| Scale threshold            | < 10 000 nodes/workspace               | Above this threshold a future stage MUST migrate to cursor-based pagination                                                                                                |

**Where this decision is documented:**

- `spec.md` — Assumption 9 (authoritative justification)
- `spec.md` — Rate Limiting section (implementation note)
- `spec.md` — Clarifications (Q5 answer)
- `plan.md` — this section (technical decision record)
- `plan.md` — `findFlatList` repository description (ORDER BY noted)

This section is the plan-level technical decision record for offset pagination. No further
justification is required.

---

## Implementation Layers

### 1. Database Migration Layer

**File**: `apps/api/src/db/tenant/migrations/20260319_002_hierarchy_nodes.ts`

All steps execute inside a single `BEGIN ... COMMIT` transaction block.

| Step | Operation                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------ |
| 1    | CREATE TABLE `hierarchy_nodes` — all columns, CHECK constraints, self-ref FK                                       |
| 2    | CREATE INDEX `idx_hierarchy_nodes_parent_id` on `(parent_id)`                                                      |
| 3    | CREATE INDEX `idx_hierarchy_nodes_status` on `(status)`                                                            |
| 4    | CREATE UNIQUE INDEX `hierarchy_nodes_parent_name_unique` on `(parent_id, lower(name)) WHERE parent_id IS NOT NULL` |
| 5    | CREATE UNIQUE INDEX `hierarchy_nodes_root_name_unique` on `(lower(name)) WHERE parent_id IS NULL`                  |
| 6    | UPDATE `schema_version` 1.7.0 → 1.8.0                                                                              |

`down()` throws `Error('Irreversible — restore from snapshot to rollback')` per ADR-0008.

---

### 2. Domain Package Layer — `packages/domain-core/src/hierarchy/`

All business logic. No HTTP/Hono dependencies. Pure functions accepting injected `DbClient`.

**File structure**:

```
packages/domain-core/src/hierarchy/
├── hierarchy.types.ts
├── hierarchy.errors.ts
├── hierarchy.repository.ts
├── hierarchy.service.ts
├── __tests__/hierarchy.service.test.ts
└── index.ts
```

#### hierarchy.errors.ts

Error codes and HTTP status map:

```
HIERARCHY_NODE_NOT_FOUND          → 404
HIERARCHY_NODE_NAME_DUPLICATE     → 409
HIERARCHY_NODE_PARENT_NOT_FOUND   → 422
HIERARCHY_NODE_SELF_REFERENCE     → 422
HIERARCHY_NODE_CYCLE_DETECTED     → 422
HIERARCHY_NODE_HAS_CHILDREN       → 422
HIERARCHY_NODE_HAS_STAFF          → 422
HIERARCHY_NODE_DISABLED           → 422
VALIDATION_ERROR                  → 422
HIERARCHY_TRAVERSAL_TIMEOUT       → 503
```

`HierarchyError` extends `Error` with a `code: HierarchyErrorCode` field.

#### hierarchy.repository.ts — Query Functions

| Function                                                  | Description                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `findNodeById(db, id)`                                    | SELECT single node by PK                                                                         |
| `insertNode(db, input)`                                   | INSERT; RETURNING full row                                                                       |
| `updateNodeRow(db, id, fields)`                           | UPDATE with `updated_at = NOW()`; RETURNING                                                      |
| `deleteNodeRow(db, id)`                                   | Hard DELETE                                                                                      |
| `lockNodeForUpdate(db, id)`                               | `SELECT id ... FOR UPDATE`                                                                       |
| `countChildren(db, parentId)`                             | `COUNT(*) WHERE parent_id = $1`                                                                  |
| `countStaffAssignments(db, nodeId)`                       | Conditional users.hierarchy_node_id check (safe-pass if column absent)                           |
| `nodeNameExists(db, name, parentId, excludeId?)`          | Pre-check before DB constraint fires                                                             |
| `findAllNodes(db, statusFilter?)`                         | WITH RECURSIVE full-tree CTE                                                                     |
| `findSubtree(db, nodeId, statusFilter?)`                  | WITH RECURSIVE anchored at nodeId                                                                |
| `findFlatList(db, page, perPage, statusFilter?)`          | WITH RECURSIVE + COUNT + LIMIT/OFFSET — ORDER BY depth ASC, name ASC, id ASC (stable pagination) |
| `walkAncestors(db, proposedParentId, nodeBeingUpdatedId)` | Cycle detection ancestor walk                                                                    |
| `hierarchyNodeColumnExistsOnUsers(db)`                    | information_schema check for downstream FK safe-pass                                             |

#### hierarchy.service.ts — Service Functions

**`createHierarchyNode(db, input, audit)`**

```
1. Trim name; reject blank → VALIDATION_ERROR
2. BEGIN transaction
3. If parent_id provided: verify parent exists → HIERARCHY_NODE_PARENT_NOT_FOUND
4. Check name uniqueness in scope → HIERARCHY_NODE_NAME_DUPLICATE
5. INSERT row; COMMIT; return created node
```

(Self-reference guard not applicable at create time — id is DB-generated; DB CHECK is backstop.)

**`updateHierarchyNode(db, id, input, audit)`**

```
1. BEGIN transaction
2. SELECT FOR UPDATE on node → HIERARCHY_NODE_NOT_FOUND if absent
3. If input.parent_id === node.id → HIERARCHY_NODE_SELF_REFERENCE
4. If parent_id changing:
  a. Lock the proposed parent row in the same transaction (deterministic lock order: lower UUID,
    then higher UUID) → HIERARCHY_NODE_PARENT_NOT_FOUND if absent
   b. Walk ancestors of new parent_id looking for node.id
      → if found: HIERARCHY_NODE_CYCLE_DETECTED
5. If name changing: check uniqueness in target parent scope → HIERARCHY_NODE_NAME_DUPLICATE
6. UPDATE row + updated_at = NOW(); COMMIT; return updated node
```

Concurrency note: locking only the node being moved is insufficient. Two concurrent reciprocal
reparent operations (`A → B` and `B → A`) can both pass the ancestor walk before either commit.
To prevent that race, `updateHierarchyNode` must lock both the moving node and the proposed parent
row in deterministic order before running cycle detection.

**`deleteHierarchyNode(db, id, audit)`**

```
1. BEGIN transaction
2. SELECT FOR UPDATE on node → HIERARCHY_NODE_NOT_FOUND if absent
3. Count children; if > 0 → HIERARCHY_NODE_HAS_CHILDREN
4. Conditional staff check (if column exists AND count > 0) → HIERARCHY_NODE_HAS_STAFF
5. DELETE node; COMMIT; return { deleted: true }
```

Note: Step 2 uses `SELECT ... FOR UPDATE` (same as `updateHierarchyNode`) to serialise concurrent
delete attempts. Without the lock, two concurrent requests could both pass the children/staff
checks and then race to DELETE the same row — one would succeed and leave no error for the other
or the FK `ON DELETE RESTRICT` backstop would surface as an unstructured 500.

**Read functions (no transaction):**

- `getFullTree(db, statusFilter?)` — WITH RECURSIVE CTE → O(n) iterative Map-based nest
- `getSubtree(db, nodeId, statusFilter?)` — WITH RECURSIVE anchored → NOT_FOUND if empty
- `getFlatList(db, page, perPage, statusFilter?)` — WITH RECURSIVE + pagination; ORDER BY depth ASC, name ASC, id ASC
- `getNode(db, id)` — SELECT by PK + ancestor-count sub-query for `depth` field → NOT_FOUND if absent

**In-memory tree assembly** (iterative, no stack overflow risk):

```typescript
function assembleTree(rows: HierarchyNodeFlatRow[]): HierarchyNodeTree[] {
  const map = new Map(rows.map((r) => [r.id, { ...r, children: [] as HierarchyNodeTree[] }]));
  const roots: HierarchyNodeTree[] = [];
  for (const row of rows) {
    const node = map.get(row.id)!;
    if (!row.parent_id) roots.push(node);
    else map.get(row.parent_id)?.children.push(node);
  }
  return roots;
}
```

---

### 3. Validation Package Layer

**File**: `packages/validation/src/backoffice/hierarchy.schemas.ts`

| Schema                          | Validates                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `createHierarchyNodeBodySchema` | POST body: name (required, trim, min 1, max 255), parent_id (UUID or null), description, status literal union (`ENABLED` \| `DISABLED`) |
| `updateHierarchyNodeBodySchema` | PATCH body: all fields optional; same rules when present; parent_id nullable                                                            |
| `hierarchyNodeParamsSchema`     | Path `:id` — UUID                                                                                                                       |
| `listHierarchyNodesQuerySchema` | status?, page (int ≥ 1), per_page (1–100, default 20)                                                                                   |
| `treeQuerySchema`               | status?                                                                                                                                 |

Name rule: `.trim().min(1, 'name must not be blank').max(255)` — enforces FR-025.

---

### 4. API Route Layer — `apps/api/src/routes/backoffice/hierarchy/`

```
apps/api/src/routes/backoffice/hierarchy/
├── index.ts
├── helpers.ts
├── create-node.ts
├── list-nodes.ts
├── get-tree.ts
├── get-node.ts
├── get-subtree.ts
├── update-node.ts
└── delete-node.ts
```

`index.ts` must export `hierarchyRouter` as `new Hono<BackofficeEnv>()` and be mounted in
`apps/api/src/app.ts` via:

```typescript
app.route("/api/v1/backoffice/workspace", hierarchyRouter);
```

This matches the existing Backoffice router registration pattern used by translations, workflow,
roles, divisions, departments, and groups.

**Route registration order** (exact routes BEFORE parameterized — prevents :id conflict):

```typescript
router.get("/hierarchy-nodes/tree", getTreeHandler); // BEFORE /:id
router.get("/hierarchy-nodes", listNodesHandler);
router.post("/hierarchy-nodes", createNodeHandler);
router.get("/hierarchy-nodes/:id/subtree", getSubtreeHandler); // BEFORE /:id
router.get("/hierarchy-nodes/:id", getNodeHandler);
router.patch("/hierarchy-nodes/:id", updateNodeHandler);
router.delete("/hierarchy-nodes/:id", deleteNodeHandler);
```

**`helpers.ts`**: `getDb(c)`, `buildAuditCtx(c)`, `successResponse(data)`, `hierarchyErrorResponse(c, err)`.

`hierarchyErrorResponse` maps known error codes INCLUDING PostgreSQL FK violations:

```
HierarchyError codes → status codes (as per hierarchy.errors.ts)
PG error code 23503 (FK violation):
  constraint = 'hierarchy_nodes_parent_id_fkey' → HIERARCHY_NODE_HAS_CHILDREN (422)
  constraint = 'users_hierarchy_node_id_fkey'   → HIERARCHY_NODE_HAS_STAFF (422)
  (fallback to 422 with code HIERARCHY_NODE_DEPENDENCY_VIOLATION)
All other pg/unknown errors → 500 INTERNAL_SERVER_ERROR
correlationId is extracted from c.get('correlationId') and included in every error response.
```

This ensures that even if the pre-check in steps 2–4 of deleteHierarchyNode misses a race and the
DB `ON DELETE RESTRICT` fires, the FK violation surfaces as a structured 422 rather than a 500.

Handler pattern (mirrors groups):

```typescript
export async function createNodeHandler(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const parsed = await createHierarchyNodeBodySchema.parseAsync(body);
    const db = getDb(c);
    const audit = buildAuditCtx(c);
    const node = await createHierarchyNode(db, parsed, audit);
    return c.json(successResponse(node), 201);
  } catch (err) {
    return hierarchyErrorResponse(c, err);
  }
}
```

**Inherited middleware chain** (applied in `apps/api/src/app.ts` before hierarchy routes):

```
correlationId (global) → tenantResolver → licenseEnforcementMiddleware → schemaVersionMiddleware
→ createRateLimitMiddleware(max:60) → validateJwtMiddleware → per-route
createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, action) → handler
```

Handler/helpers contract must align with the typed Backoffice surface already present in
`apps/api/src/routes/backoffice/types.ts`:

- `c.get('correlationId')` for trace propagation
- `c.get('tenant')` for tenant metadata and `tenant.pool`
- `c.get('staff_user')` for the authenticated staff user identity

`buildAuditCtx(c)` should derive `workspace_slug` and `workspace_id` from `tenant`, not from any
route-level workspace identifier.

---

### Worker Layer

Not applicable. All hierarchy CRUD is synchronous. No background jobs required.

### Frontend Layer

Not applicable in this stage. API endpoints are delivered; org-chart UI is a downstream concern.

---

## Endpoint Specifications

All endpoints mount under `/api/v1/backoffice/workspace/`.

| Method | Path                           | Handler           | Auth Permission                                      | Success | Error Codes                     |
| ------ | ------------------------------ | ----------------- | ---------------------------------------------------- | ------- | ------------------------------- |
| POST   | `/hierarchy-nodes`             | createNodeHandler | `PermissionModule.ACADEMIC_STRUCTURE` + `can_create` | 201     | 409, 422, 403, 423/403/404      |
| GET    | `/hierarchy-nodes`             | listNodesHandler  | `PermissionModule.ACADEMIC_STRUCTURE` + `can_view`   | 200     | 403, 423/403/404                |
| GET    | `/hierarchy-nodes/tree`        | getTreeHandler    | `PermissionModule.ACADEMIC_STRUCTURE` + `can_view`   | 200     | 403, 423/403/404                |
| GET    | `/hierarchy-nodes/:id`         | getNodeHandler    | `PermissionModule.ACADEMIC_STRUCTURE` + `can_view`   | 200     | 404, 403, 423/403/404           |
| GET    | `/hierarchy-nodes/:id/subtree` | getSubtreeHandler | `PermissionModule.ACADEMIC_STRUCTURE` + `can_view`   | 200     | 404, 403, 423/403/404           |
| PATCH  | `/hierarchy-nodes/:id`         | updateNodeHandler | `PermissionModule.ACADEMIC_STRUCTURE` + `can_edit`   | 200     | 404, 409, 422, 403, 423/403/404 |
| DELETE | `/hierarchy-nodes/:id`         | deleteNodeHandler | `PermissionModule.ACADEMIC_STRUCTURE` + `can_delete` | 200     | 404, 422, 403, 423/403/404      |

All responses: `{ success: boolean, data: object | null, error: { code: string, message: string, correlationId: string } | null }` (FR-021).

**401 vs 403:** 401 is returned by `validateJwtMiddleware` (no valid staff JWT); 403 is returned by
`createPermissionGuard(..., PermissionModule.ACADEMIC_STRUCTURE, action)` when the authenticated
staff user lacks the required capability. Handlers never emit 401 or 403 directly.

---

## Database Impact

**Master DB**: No tables touched. No migration required.

**Tenant DB**:

- Table introduced: `hierarchy_nodes` (new, standalone — no FK deps on existing tables)
- Tables modified: None (`users.hierarchy_node_id` is downstream scope)
- Migration file: `apps/api/src/db/tenant/migrations/20260319_002_hierarchy_nodes.ts`
- schema_version: 1.7.0 → **1.8.0**
- Tenants on schema < 1.8.0 receive 426 at request boundary until migrated
- Migration is additive-only; no existing tables or columns modified

Ref: ADR-0008 (forward-only migrations, schema_version semantics).

---

## Transaction Design

| Operation             | Transaction | Isolation      | Concurrency Mechanism                                              | Rollback      |
| --------------------- | ----------- | -------------- | ------------------------------------------------------------------ | ------------- |
| `createHierarchyNode` | Yes         | READ COMMITTED | Unique index catches races                                         | Full rollback |
| `updateHierarchyNode` | Yes         | READ COMMITTED | Deterministic dual-row lock on node row + proposed parent row      | Full rollback |
| `deleteHierarchyNode` | Yes         | READ COMMITTED | `SELECT FOR UPDATE` on node row + FK `ON DELETE RESTRICT` backstop | Full rollback |
| All read operations   | No          | N/A            | N/A                                                                | N/A           |

**Cycle-detection transaction contract for `updateHierarchyNode`** — all inside one transaction:

1. `SELECT FOR UPDATE` on node being updated
2. `SELECT FOR UPDATE` on proposed parent row using deterministic UUID lock order
3. Ancestor walk CTE query
4. Name uniqueness check (if applicable)
5. `UPDATE` statement

No partial state is observable if any step fails.

---

## Idempotency Plan

- **Create** (`POST`): Non-idempotent by design (FR-023) — duplicate name in scope returns 409
- **Update** (`PATCH`): Effectively idempotent — same payload, same result (last-write wins)
- **Delete** (`DELETE`): Non-idempotent — second call returns 404 `HIERARCHY_NODE_NOT_FOUND`
- No idempotency key header required (no attempt/payment/provisioning pattern)

---

## Version Enforcement Strategy

- `schema_version` validated by existing version-check middleware at request boundary
- Tenants with `schema_version < 1.8.0` receive 426 Upgrade Required after migration deployment
- `product_version` validated by license middleware — no change to existing mechanism
- Migration is additive-only; existing tenants on 1.7.0 are unaffected until migration runs

---

## Authoritative Time Handling

- All `created_at` / `updated_at` set by `NOW()` in SQL DML (repository layer)
- No client-supplied timestamps accepted; input schemas do NOT include timestamp fields
- `insertNode` and `updateNodeRow` use `updated_at = NOW()` directly in SQL
- Ref ADR-0006: server clock is authoritative; no client time used

---

## Observability & Logging

Logger: `createLogger('backoffice-hierarchy-<operation>')` per handler file.

**Required fields per FR-022**:
`timestamp`, `level`, `service`, `workspace_slug`, `workspace_id`, `user_id`, `correlation_id`, `hierarchy_node_id` (for node-specific ops).

**Log events**:

- `createNode`: `debug` on receive; `info` on success (with `hierarchy_node_id`); `error` on failure
- `updateNode`: `debug` on receive; `info` on success; `warn` on cycle detection attempt
- `deleteNode`: `debug` on receive; `info` on success; `warn` on blocked delete
- `getTree` / `getSubtree`: `debug` on receive; `info` on completion with `{ duration_ms }` (latency metric for tree traversal SLA monitoring; enables retroactive P99 analysis)
- Read operations: `debug` on receive only
- No `console.log` anywhere in production code

**Auth logging clarification:** HTTP 401 (unauthenticated — no valid JWT) is emitted by the auth
middleware before the handler runs. HTTP 403 (unauthorized — valid JWT but missing permission) is
emitted by the permission middleware. Handler code must never emit 401 or 403 directly — these
codes belong exclusively to the middleware chain.

---

## Rate Limiting

Hierarchy endpoints are Backoffice staff-only, protected by authentication. The existing
platform-wide per-IP rate limit applies.

**Traversal endpoint DB guard:** `getTreeHandler` and `getSubtreeHandler` execute `WITH RECURSIVE`
CTEs against the tenant DB. Each connection used by these handlers MUST set:

```sql
SET statement_timeout = '5000ms'
```

before executing the recursive query. This is applied at the repository layer
(`findAllNodes`, `findSubtree`) by prepending the SET command in the same query batch.
If the query exceeds 5 seconds, the DB throws an error that is caught by `hierarchyErrorResponse`
and returned as 503 with `HIERARCHY_TRAVERSAL_TIMEOUT`.

Write endpoints (POST, PATCH, DELETE) are naturally constrained by the tenant-scoped connection
pool and do not require additional per-endpoint rate limiting.

---

## Failure Modes

| Mode                        | Behavior                                                                                                              | Recovery                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Tenant DB unavailable       | `getDb()` throws → 500 with structured error                                                                          | pg pool retry; operator restores DB |
| schema_version mismatch     | Version middleware returns 426 before handler                                                                         | Run migration                       |
| License SOFT_LOCKED         | License middleware returns 423                                                                                        | Resolve license                     |
| License ARCHIVED            | License middleware returns 403                                                                                        | N/A                                 |
| License NOT_FOUND           | License middleware returns 404                                                                                        | N/A                                 |
| Cycle at high concurrency   | Deterministic dual-row locking on node + proposed parent serializes concurrent reciprocal reparenting; loser gets 422 | Client retries with fresh data      |
| Duplicate name race         | Unique index catches second writer → 409                                                                              | Client uses different name          |
| Partial transaction failure | Full rollback; no partial state visible                                                                               | Client receives structured error    |
| Deep tree CTE performance   | Expected under 2s for 500 nodes (success criterion 3)                                                                 | Add depth guard if P99 exceeds SLA  |

---

## Security Review

- RBAC enforced server-side via `createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, action)`
- No role checks in frontend — all access control is server-side
- No secrets exposed — credentials in environment; `.env` for local only; Docker secrets for production
- JWT workspace scope enforced by the shared Backoffice middleware chain before handler execution
- No sensitive data in logs — node names logged at `debug` only; no PII
- All SQL queries parameterized (`$1`, `$2`) — no string interpolation; injection-safe
- All UUID path params validated by Zod before reaching DB layer

---

## Test Strategy

### Unit Tests — `packages/domain-core/src/hierarchy/__tests__/hierarchy.service.test.ts`

| Test Case                                                      | Description                                           |
| -------------------------------------------------------------- | ----------------------------------------------------- |
| createHierarchyNode — creates root node                        | parent_id = null; verify returned row                 |
| createHierarchyNode — creates child node                       | valid parent_id → FK reference created                |
| createHierarchyNode — rejects blank name                       | Trimmed empty string → VALIDATION_ERROR               |
| createHierarchyNode — rejects duplicate in root scope          | Same name, parent_id = null → NAME_DUPLICATE          |
| createHierarchyNode — rejects duplicate in child scope         | Same name, same parent_id → NAME_DUPLICATE            |
| createHierarchyNode — allows same name under different parents | 2 parents, same name → both succeed                   |
| createHierarchyNode — rejects non-existent parent              | Unknown parent_id → PARENT_NOT_FOUND                  |
| updateHierarchyNode — renames successfully                     | Name change, same parent                              |
| updateHierarchyNode — reparents with no cycle                  | Valid new parent_id → success                         |
| updateHierarchyNode — detects direct cycle                     | New parent_id = direct child → CYCLE_DETECTED         |
| updateHierarchyNode — detects indirect cycle                   | New parent_id = grandchild → CYCLE_DETECTED           |
| updateHierarchyNode — rejects self-reference                   | parent_id = node.id → SELF_REFERENCE                  |
| updateHierarchyNode — promotes to root                         | parent_id = null → success                            |
| deleteHierarchyNode — deletes leaf node                        | No children, no staff → deleted: true                 |
| deleteHierarchyNode — blocks delete with children              | Has children → HAS_CHILDREN                           |
| deleteHierarchyNode — blocks delete with staff                 | Staff assigned → HAS_STAFF                            |
| deleteHierarchyNode — rejects missing node                     | Unknown id → NOT_FOUND                                |
| getFullTree — returns nested structure                         | 3-level tree → correct nesting                        |
| getFullTree — returns empty array                              | No nodes → []                                         |
| getFullTree — filters by status                                | ENABLED filter excludes DISABLED nodes                |
| getSubtree — returns subtree only                              | Anchor → node + descendants, not siblings             |
| getSubtree — rejects unknown node                              | Unknown id → NOT_FOUND                                |
| getFlatList — returns depth field                              | Root → depth=0; child → depth=1; grandchild → depth=2 |
| getFlatList — paginates correctly                              | 25 nodes, per_page=10 → page 1 has 10, total=25       |

### Integration Tests — `tests/backoffice/hierarchy/hierarchy.integration.test.ts`

| Test                    | Description                                                |
| ----------------------- | ---------------------------------------------------------- |
| POST create + DB verify | Full round-trip — node persisted and retrievable           |
| 409 duplicate name      | Duplicate in same scope → 409 JSON error                   |
| GET list pagination     | page 1 vs page 2 return distinct, non-overlapping items    |
| GET /tree nested        | 3-level tree → correct nested JSON response                |
| GET /:id/subtree        | Returns only subtree, not siblings or ancestors            |
| PATCH reparent cycle    | Reparent to descendant → 422 CYCLE_DETECTED                |
| DELETE with children    | 422 HAS_CHILDREN; node still in DB                         |
| Tenant isolation        | Node in workspace A not visible in workspace B             |
| License SOFT_LOCKED     | All endpoints return 423                                   |
| Missing auth            | All endpoints return 401/403                               |
| Transaction rollback    | Inject fault after validation; verify no partial row in DB |

### Performance Tests

- Seed 500-node tree; `GET /tree` completes under 2 seconds (success criterion 3)
- Seed 10-level deep tree; verify no stack overflow on traversal

---

## File Inventory

### New Files

| File                                                                     | Description                                          |
| ------------------------------------------------------------------------ | ---------------------------------------------------- |
| `apps/api/src/db/tenant/migrations/20260319_002_hierarchy_nodes.ts`      | Forward-only migration; schema_version 1.7.0 → 1.8.0 |
| `packages/domain-core/src/hierarchy/hierarchy.types.ts`                  | TypeScript types and interfaces                      |
| `packages/domain-core/src/hierarchy/hierarchy.errors.ts`                 | HierarchyError class + error code map                |
| `packages/domain-core/src/hierarchy/hierarchy.repository.ts`             | Raw SQL query functions                              |
| `packages/domain-core/src/hierarchy/hierarchy.service.ts`                | Business logic service functions                     |
| `packages/domain-core/src/hierarchy/__tests__/hierarchy.service.test.ts` | Unit tests (24 cases)                                |
| `packages/domain-core/src/hierarchy/index.ts`                            | Barrel re-export                                     |
| `packages/validation/src/backoffice/hierarchy.schemas.ts`                | Zod validation schemas                               |
| `apps/api/src/routes/backoffice/hierarchy/helpers.ts`                    | Route utilities                                      |
| `apps/api/src/routes/backoffice/hierarchy/index.ts`                      | Hono router + route registration                     |
| `apps/api/src/routes/backoffice/hierarchy/create-node.ts`                | POST handler                                         |
| `apps/api/src/routes/backoffice/hierarchy/list-nodes.ts`                 | GET flat list handler                                |
| `apps/api/src/routes/backoffice/hierarchy/get-tree.ts`                   | GET full-tree handler                                |
| `apps/api/src/routes/backoffice/hierarchy/get-node.ts`                   | GET single node handler                              |
| `apps/api/src/routes/backoffice/hierarchy/get-subtree.ts`                | GET subtree handler                                  |
| `apps/api/src/routes/backoffice/hierarchy/update-node.ts`                | PATCH handler                                        |
| `apps/api/src/routes/backoffice/hierarchy/delete-node.ts`                | DELETE handler                                       |
| `tests/backoffice/hierarchy/hierarchy.integration.test.ts`               | Integration tests                                    |

### Modified Files

| File                                      | Change                                      |
| ----------------------------------------- | ------------------------------------------- |
| `packages/domain-core/src/index.ts`       | Add `export * from './hierarchy'`           |
| `packages/domain-core/package.json`       | Add `"./hierarchy"` subpath export entry    |
| `apps/api/src/routes/backoffice/index.ts` | Mount `hierarchyRouter` on workspace router |

---

## Implementation Order

```
Step 1  → Migration (20260319_002_hierarchy_nodes.ts) + run locally
Step 2  → hierarchy.types.ts
Step 3  → hierarchy.errors.ts
Step 4  → hierarchy.repository.ts
Step 5  → hierarchy.service.ts
Step 6  → hierarchy/index.ts + update domain-core barrel + package.json exports
Step 7  → hierarchy.schemas.ts (validation package)
Step 8  → hierarchy/helpers.ts (route utilities)
Step 9  → All 7 handler files
Step 10 → hierarchy/index.ts (router) + mount in backoffice router
Step 11 → Unit tests (24 cases)
Step 12 → Integration tests

CI gate after each step: bun run typecheck && bun run lint
Full gate after step 12: bun scripts/infra-audit.ts && bun run test
```

---

## Rollback Strategy

- **Migration rollback**: Restore tenant DB snapshot taken before migration run. `down()` throws per ADR-0008 — snapshot restore is the only rollback path.
- **Code rollback**: Revert git commit. Since `hierarchy_nodes` has no FK dependencies on existing tables in this stage, leaving the table after code rollback is safe (unused, no data integrity risk).
- **Data integrity**: Additive migration; no existing data modified.

---

## Non-Goals

- `users.hierarchy_node_id` column — added by downstream stage (STAGE_26)
- Staff assignment to hierarchy nodes — downstream stage responsibility
- Org-chart UI rendering — frontend concern; this plan delivers API only
- Soft delete / archiving — FR-009 mandates hard delete
- Division / Department FK integration — hierarchy is independent
- Global node count limits — not required per Assumption 2
- WebSocket real-time updates — not required
- Bulk import/export — single-node CRUD only
- Student access to hierarchy — staff-only entity; no frontoffice exposure

---

## Final Compliance Statement

Implementation plan compliant with **Zidney Constitution v1.2.0** — No violations detected.

All business logic resides in `packages/domain-core/src/hierarchy/`. Hono route handlers are
thin adapters only. Tenant isolation is enforced via injected `DbClient` from the tenant resolver.
License middleware is mandatory before any route handler executes. All writes are transactional.
Server-authoritative time used exclusively. No cross-tenant joins, no global DB singleton,
no row-based multi-tenancy. Migration is forward-only. Schema version bumped 1.7.0 → 1.8.0.
