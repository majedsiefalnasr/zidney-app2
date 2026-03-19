# Testing Guide — STAGE_25_HIERARCHY_TREE

**For:** Developers, QA Engineers, and Test Automation  
**Stage:** Hierarchy Tree  
**Date:** 2026-03-19  
**Status:** Production Ready  
**Test Coverage:** 30 automated tests (15 unit + 15 integration)

---

## Quick Start

### Run All Tests

```bash
# Run hierarchy tests only
bun test packages/domain-core/src/hierarchy/__tests__/hierarchy.service.test.ts
bun test tests/backoffice/hierarchy/hierarchy.integration.test.ts

# Or run all tests (includes hierarchy)
bun run test
```

### Run Type-Check

```bash
bun run type-check
```

### Run Linting

```bash
bun run lint
```

### Boot Development Server

```bash
bun run dev
```

---

## What Was Tested

### Unit Tests (15 tests)

**File:** `packages/domain-core/src/hierarchy/__tests__/hierarchy.service.test.ts`

Domain-level behavior for hierarchy operations:

| Test                          | Purpose                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------- |
| Create node with valid input  | Verify node creation with correct defaults (version, timestamps)              |
| Create duplicate sibling name | Verify unique-name constraint enforced per parent scope                       |
| Create root node (no parent)  | Verify root creation without parent_id                                        |
| Create child of disabled node | Verify creation allowed; status filtering is query-level only                 |
| Get node by id                | Verify correct node retrieval with depth computation                          |
| Get non-existent node         | Verify error handling for missing nodes                                       |
| Update node name              | Verify name update with unique constraint re-check                            |
| Reparent to different parent  | Verify parent_id update with cycle detection                                  |
| Attempt reparent to self      | Verify cycle detection blocks self-reference                                  |
| Attempt reparent to child     | Verify cycle detection blocks ancestor-to-descendant reparent                 |
| List nodes with pagination    | Verify offset-based pagination, stable ordering (depth ASC, name ASC, id ASC) |
| List with status filter       | Verify optional status filter works                                           |
| Tree assembly (full tree)     | Verify nested structure assembly matches hierarchy                            |
| Tree assembly (subtree)       | Verify anchored subtree with pruning                                          |
| Delete node with no children  | Verify successful deletion                                                    |

**Coverage Goals:**

- ✅ Happy paths for all 7 operations (create, read, update, delete, list, tree, subtree)
- ✅ Error cases (duplicates, cycles, not-found)
- ✅ Boundary conditions (root nodes, empty results, pagination limits)

### Integration Tests (15 tests)

**File:** `tests/backoffice/hierarchy/hierarchy.integration.test.ts`

End-to-end API behavior for all 7 hierarchy endpoints:

| Test                                   | Purpose                                                       |
| -------------------------------------- | ------------------------------------------------------------- |
| POST /hierarchy-nodes (create)         | Verify HTTP 201 + node in DB                                  |
| POST with invalid body                 | Verify HTTP 400 + validation error details                    |
| GET /hierarchy-nodes (list)            | Verify HTTP 200 + pagination metadata                         |
| GET with page/per_page params          | Verify pagination logic                                       |
| GET with status filter                 | Verify filter applied to results                              |
| GET /hierarchy-nodes/tree              | Verify HTTP 200 + nested tree structure                       |
| GET tree empty workspace               | Verify HTTP 200 + empty array                                 |
| GET /hierarchy-nodes/:id (single node) | Verify HTTP 200 + node with depth                             |
| GET single node not found              | Verify HTTP 404 + error details                               |
| GET /hierarchy-nodes/:id/subtree       | Verify HTTP 200 + anchored subtree                            |
| PATCH /hierarchy-nodes/:id (update)    | Verify HTTP 200 + updated fields in DB                        |
| PATCH with reparent                    | Verify parent_id updated, cycle detection passed              |
| DELETE /hierarchy-nodes/:id            | Verify HTTP 204 + node removed from DB                        |
| DELETE with children (guard test)      | Verify HTTP 409 + error details (placeholder for staff count) |
| Tenant isolation (implicit)            | Verify all operations scoped to request tenant                |

**Coverage Goals:**

- ✅ All 7 endpoints implemented
- ✅ Happy paths (2xx responses)
- ✅ Error cases (4xx/5xx responses)
- ✅ Middleware behavior (tenant resolver, license, RBAC)
- ✅ Transactional rollback on error

---

## Manual Testing Checklist

Use these scenarios to verify the hierarchy works correctly in a live workspace.

### Scenario 1 — Create a Simple 3-Level Hierarchy

**Objective:** Build: Root → Dept → Team

**Steps:**

1. **Create Root Node**
   - POST `/api/v1/backoffice/workspace/hierarchy-nodes`
   - Body: `{ "name": "Org Root", "description": "Organization top level" }`
   - **Expected:** HTTP 201, node returned, `parent_id: null`, `depth: 0`

2. **Create Department (child of Root)**
   - POST `/api/v1/backoffice/workspace/hierarchy-nodes`
   - Body: `{ "name": "Engineering", "parent_id": "<root-id>", "description": "Engineering Dept" }`
   - **Expected:** HTTP 201, `parent_id` = root node ID

3. **Create Team (child of Department)**
   - POST `/api/v1/backoffice/workspace/hierarchy-nodes`
   - Body: `{ "name": "Backend Team", "parent_id": "<eng-id>", "description": "Backend Eng Team" }`
   - **Expected:** HTTP 201, parent chain correct

4. **Retrieve Full Tree**
   - GET `/api/v1/backoffice/workspace/hierarchy-nodes/tree`
   - **Expected:** HTTP 200, nested structure:
     ```json
     {
       "name": "Org Root",
       "children": [
         {
           "name": "Engineering",
           "children": [{ "name": "Backend Team", "children": [] }]
         }
       ]
     }
     ```

5. **Retrieve Root Node Only**
   - GET `/api/v1/backoffice/workspace/hierarchy-nodes/<root-id>`
   - **Expected:** HTTP 200, `depth: 0`

6. **Retrieve Backend Team Only**
   - GET `/api/v1/backoffice/workspace/hierarchy-nodes/<team-id>`
   - **Expected:** HTTP 200, `depth: 2`

7. **Retrieve Subtree from Engineering**
   - GET `/api/v1/backoffice/workspace/hierarchy-nodes/<eng-id>/subtree`
   - **Expected:** HTTP 200, nested structure starting at Engineering level

**Validation:** Tree structure matches expectation, all `depth` values correct, timestamps present.

---

### Scenario 2 — Unique Name Constraint

**Objective:** Verify names are unique per parent scope (siblings with same name not allowed)

**Steps:**

1. Create Root node: "Root"
2. Create Child 1: "Finance" (parent = Root)
3. Create Child 2: "Finance" (parent = Root)
   - **Expected:** HTTP 409 (Conflict) — duplicate sibling name

4. Create Child 3 under Finance: "Team1"
5. Create Child 4 under another department: "Team1" (allowed, different parent)
   - **Expected:** HTTP 201 — different parents allow same name

**Validation:** Name uniqueness enforced per parent scope only, not globally.

---

### Scenario 3 — Cycle Detection (Reparent)

**Objective:** Verify reparent validation blocks cycles

**Steps:**

1. Create: Root → Dept → Team
2. **Try to reparent Dept to Team** (moving parent to child)
   - PATCH `/api/v1/backoffice/workspace/hierarchy-nodes/<dept-id>`
   - Body: `{ "parent_id": "<team-id>" }`
   - **Expected:** HTTP 400 (Bad Request) — cycle detected error message

3. **Try to reparent Team to itself**
   - PATCH `/api/v1/backoffice/workspace/hierarchy-nodes/<team-id>`
   - Body: `{ "parent_id": "<team-id>" }`
   - **Expected:** HTTP 400 — self-reference cycle error

4. **Reparent Team under Dept instead of Root** (valid reparent)
   - PATCH `/api/v1/backoffice/workspace/hierarchy-nodes/<team-id>`
   - Body: `{ "parent_id": "<dept-id>" }`
   - **Expected:** HTTP 200 — parent updated successfully

**Validation:** Cycle detection prevents invalid reparent operations; valid reparent succeeds.

---

### Scenario 4 — Pagination (List Nodes)

**Objective:** Verify offset-based pagination with stable ordering

**Steps:**

1. Create 15+ nodes across multiple parents
2. **Get page 1, 5 items per page**
   - GET `/api/v1/backoffice/workspace/hierarchy-nodes?page=1&per_page=5`
   - **Expected:** HTTP 200, first 5 nodes ordered (depth ASC, name ASC, id ASC)

3. **Get page 2, 5 items per page**
   - GET `/api/v1/backoffice/workspace/hierarchy-nodes?page=2&per_page=5`
   - **Expected:** HTTP 200, next 5 nodes, no overlap with page 1

4. **Get page 3+ (beyond available data)**
   - GET `/api/v1/backoffice/workspace/hierarchy-nodes?page=10&per_page=5`
   - **Expected:** HTTP 200, empty array (or last partial page)

**Validation:** Pagination offset works, ordering is deterministic and stable across pages.

---

### Scenario 5 — Status Filtering

**Objective:** Verify ENABLED/DISABLED status filtering

**Steps:**

1. Create nodes with status ENABLED
2. Update one node: status → DISABLED
   - PATCH `/api/v1/backoffice/workspace/hierarchy-nodes/<node-id>`
   - Body: `{ "status": "DISABLED" }`

3. **List all nodes**
   - GET `/api/v1/backoffice/workspace/hierarchy-nodes`
   - **Expected:** HTTP 200, includes both ENABLED and DISABLED nodes

4. **List only ENABLED nodes**
   - GET `/api/v1/backoffice/workspace/hierarchy-nodes?status=ENABLED`
   - **Expected:** HTTP 200, only ENABLED nodes in results

5. **List only DISABLED nodes**
   - GET `/api/v1/backoffice/workspace/hierarchy-nodes?status=DISABLED`
   - **Expected:** HTTP 200, only DISABLED nodes in results

**Validation:** Status filter works correctly; unfiltered list returns all statuses.

---

### Scenario 6 — Tenant Isolation (Multi-Workspace)

**Objective:** Verify hierarchy nodes are isolated per workspace

**Steps:**

1. **In Workspace A:**
   - Create Root → Dept → Team (3 nodes)
   - GET `/api/v1/backoffice/workspace/hierarchy-nodes` → 3 nodes

2. **Switch to Workspace B** (different subdomain/slug)
   - GET `/api/v1/backoffice/workspace/hierarchy-nodes` → empty (0 nodes)
   - Create different hierarchy (Root → Finance)

3. **Switch back to Workspace A**
   - GET `/api/v1/backoffice/workspace/hierarchy-nodes` → still 3 nodes (original data intact)

4. **Verify no cross-workspace leakage**
   - Node IDs from Workspace B should NOT appear in Workspace A results

**Validation:** Tenant isolation enforced; each workspace sees only its own hierarchy.

---

### Scenario 7 — Delete Guards

**Objective:** Verify deletion blocks when children exist

**Steps:**

1. Create: Root → Dept → Team
2. **Try to delete Root (has children)**
   - DELETE `/api/v1/backoffice/workspace/hierarchy-nodes/<root-id>`
   - **Expected:** HTTP 409 (Conflict) — "Cannot delete node with children"

3. **Delete Leaf (Team, no children)**
   - DELETE `/api/v1/backoffice/workspace/hierarchy-nodes/<team-id>`
   - **Expected:** HTTP 204 — node deleted successfully

4. **Verify Team is gone**
   - GET `/api/v1/backoffice/workspace/hierarchy-nodes/<team-id>`
   - **Expected:** HTTP 404 — not found

**Validation:** Deletion only allowed for leaf nodes; parent deletion blocked with clear error.

---

### Scenario 8 — Error Handling (Bad Input)

**Objective:** Verify validation and error responses

**Steps:**

1. **Create with invalid name (empty)**
   - POST `/api/v1/backoffice/workspace/hierarchy-nodes`
   - Body: `{ "name": "", "description": "Invalid" }`
   - **Expected:** HTTP 400, validation error explaining name is required

2. **Create with invalid parent ID (not a UUID)**
   - POST `/api/v1/backoffice/workspace/hierarchy-nodes`
   - Body: `{ "name": "Test", "parent_id": "not-a-uuid" }`
   - **Expected:** HTTP 400, validation error explaining UUID format

3. **Update with invalid status**
   - PATCH `/api/v1/backoffice/workspace/hierarchy-nodes/<id>`
   - Body: `{ "status": "INVALID" }`
   - **Expected:** HTTP 400, validation error listing allowed values

4. **Get non-existent node**
   - GET `/api/v1/backoffice/workspace/hierarchy-nodes/00000000-0000-0000-0000-000000000000`
   - **Expected:** HTTP 404, structured error response

**Validation:** All error responses include structured details and HTTP status codes.

---

## Automated Test Execution

### Run Tests with Coverage

```bash
# Run all tests with coverage report
bun run test -- --coverage

# View coverage for hierarchy specifically
bun run test packages/domain-core/src/hierarchy/__tests__/hierarchy.service.test.ts -- --coverage
```

### Run Integration Tests Only

```bash
# Run integration tests against test DB
bun run test tests/backoffice/hierarchy/hierarchy.integration.test.ts
```

### Continuous Testing (Watch Mode)

```bash
# Watch for file changes and re-run
bun run test -- --watch
```

---

## Performance Validation

### Recursive CTE Performance

- **Tree Retrieval (1000 nodes):** Should complete in < 500ms
- **Subtree Retrieval (100 nodes):** Should complete in < 200ms
- **Pagination (large offset):** Should complete in < 100ms

**Monitoring Command:**

```sql
-- Check recursive CTE execution time (in test workspace)
EXPLAIN ANALYZE
WITH RECURSIVE hierarchy_cte AS (
  SELECT id, name, parent_id, depth FROM hierarchy_nodes WHERE id = '<node-id>'
  UNION ALL
  SELECT h.id, h.name, h.parent_id, h.depth FROM hierarchy_nodes h
  JOIN hierarchy_cte ON h.parent_id = hierarchy_cte.id
)
SELECT * FROM hierarchy_cte;
```

### Index Coverage

- **Parent traversal:** `idx_hierarchy_nodes_parent_id` — used for child lookups
- **Status filtering:** `idx_hierarchy_nodes_status` — used for filter queries
- **Root uniqueness:** `hierarchy_nodes_root_name_unique` (partial) — used for CREATE validation
- **Sibling uniqueness:** `hierarchy_nodes_parent_name_unique` (partial) — used for duplicate detection

**Verify Index Usage:**

```sql
-- Show all indexes on hierarchy_nodes
SELECT indexname FROM pg_indexes WHERE tablename = 'hierarchy_nodes';
```

---

## Security Validation Checklist

- [ ] **RBAC Validation:** User without `ACADEMIC_STRUCTURE` permission cannot create/update/delete nodes (401/403)
- [ ] **Tenant Isolation:** Verify users can only see/modify hierarchy within their workspace
- [ ] **SQL Injection:** Verify parameterized queries block malicious input
- [ ] **Rate Limiting:** Verify hierarchy endpoints respect workspace rate limits
- [ ] **Audit Logging:** Verify all CRUD operations logged with user correlation ID

---

## Migration Validation

### Verify Migration Applied

```bash
# Connect to test workspace DB
# Run this query:
SELECT version FROM schema_version WHERE id = '00000000-0000-0000-0000-000000000001';
# Expected: 1.8.0
```

### Verify Tables Exist

```bash
# In test DB:
\dt hierarchy_nodes
# Expected: Relation shows hierarchy_nodes table with all columns
```

### Verify Indexes

```bash
# In test DB:
\di hierarchy_*
# Expected: All 4 indexes shown (parent_id, status, root_unique, sibling_unique)
```

---

## Known Limitations & Workarounds

| Limitation                                       | Impact                                                           | Workaround                                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Recursive CTE timeout not enforced at pool level | In very deep hierarchies, query might run long                   | App-level timeout (500ms) prevents runaway queries; post-deploy enhancement planned             |
| Staff count guard returns 0 until STAGE_26       | Cannot verify "node has no assigned staff" in this stage         | Known—interface contract documented; placeholder test for integration with downstream stage     |
| Pagination is offset-based, not cursor-based     | Potential performance issue at very high offsets with many nodes | Acceptable for bounded workspace scale (< 10k nodes); future stages may upgrade to cursor-based |

---

## Troubleshooting

### "Cannot delete node with children" on leaf node

**Cause:** Node has undetected children or staff count is non-zero.  
**Resolution:** Call GET `/hierarchy-nodes/:id/subtree` to verify no children. Check PostgreSQL directly: `SELECT COUNT(*) FROM hierarchy_nodes WHERE parent_id = '<node-id>'`

### "Cycle detected" on valid reparent

**Cause:** Reparent validation incorrectly flagged cycle.  
**Resolution:** Verify parent-child relationship doesn't create cycle. Try reparenting to root instead.

### "Unique constraint violation" on create with unique name

**Cause:** Sibling with same name already exists under same parent.  
**Resolution:** Choose different name or verify target parent before create.

### Pagination returns fewer results than expected

**Cause:** Large `per_page` value, or page number past available data.  
**Resolution:** Verify total count with GET `/hierarchy-nodes?page=1&per_page=1`; adjust page/per_page accordingly.

---

## Post-Deployment Monitoring

- **API Latency:** Alert if P99 > 1s for any endpoint
- **Error Rate:** Alert if 5xx errors > 0.1% of requests
- **Database Connections:** Alert if pool exhaustion occurs
- **Recursive CTE Duration:** Log query execution time; alert if P99 > 500ms

See `docs/monitoring/` for dashboards and alert configurations.

---

## Contact & Escalation

- **Implementation Owner:** [Development Team]
- **QA Owner:** [QA Team]
- **On-Call Escalation:** [SRE Team]

---

**Last Updated:** 2026-03-19  
**Status:** PRODUCTION READY
