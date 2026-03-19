# Research: Hierarchy Tree

**Stage**: STAGE_25_HIERARCHY_TREE  
**Phase**: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Created**: 2026-03-19  
**Status**: COMPLETE — all unknowns resolved

---

## Summary

All NEEDS CLARIFICATION items resolved through codebase inspection and pattern analysis. No
external library research required — all required technology is already in use in the codebase.

---

## Resolved Unknown 1: Migration File Name and Schema Version

**Question:** What is the next migration file name and schema version number?

**Investigation:** Inspected `apps/api/src/db/tenant/migrations/`. The most recent migration is:

```
20260319_001_groups.ts  →  schema_version: 1.6.0 → 1.7.0
```

**Decision:** Next migration file path:

```
apps/api/src/db/tenant/migrations/20260319_002_hierarchy_nodes.ts
```

Schema version bump: **1.7.0 → 1.8.0**

**Rationale:** Date-sequence naming convention matches all prior migrations. Same-day sequence
number `002` follows `001_groups.ts` which was also created on 2026-03-19.

---

## Resolved Unknown 2: Domain Package Location

**Question:** Where does business logic live? Is it `packages/domain-core` or another package?

**Investigation:** `packages/domain-core/src/` contains subdirectories:
`groups/`, `departments/`, `divisions/`, `rbac/`, `auth/`, etc.

The groups domain is the direct structural predecessor — it uses:

- `packages/domain-core/src/groups/groups.service.ts` — service functions
- `packages/domain-core/src/groups/groups.repository.ts` — raw SQL queries
- `packages/domain-core/src/groups/groups.types.ts` — TypeScript types
- `packages/domain-core/src/groups/groups.errors.ts` — error class + code map
- `packages/domain-core/src/groups/index.ts` — barrel re-export

**Decision:** Business logic resides in:

```
packages/domain-core/src/hierarchy/
```

Sub-files to create:

- `hierarchy.service.ts`
- `hierarchy.repository.ts`
- `hierarchy.types.ts`
- `hierarchy.errors.ts`
- `index.ts`

**Rationale:** Direct mirror of the groups domain pattern. Consistent package namespace
`@zidney/domain-core/hierarchy` matches the subpath export pattern in `packages/domain-core/package.json`.

---

## Resolved Unknown 3: Hono Router Pattern

**Question:** How are Backoffice Hono routers structured? Where are they registered?

**Investigation:** Inspected `apps/api/src/routes/backoffice/groups/`:

- `index.ts` — creates + exports `groupsRouter` using `createGroupsRouter()`
- One handler file per operation (e.g., `create-group.ts`, `list-groups.ts`)
- `helpers.ts` — shared utilities: `getDb()`, `buildAuditCtx()`, `successResponse()`, error mapper
- Handlers do NOT import business logic directly — they delegate to `@zidney/domain-core/groups`
- Handlers do NOT contain business logic — pure request parsing → service call → response shaping
- Logger created with `createLogger('backoffice-groups-<operation>')` pattern

**Decision:** Route module location:

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

Router function name: `createHierarchyRouter()`, exported instance: `hierarchyRouter`.

**Rationale:** One-to-one structural parity with `groups/` router. Route conflicts avoided by
registering exact routes (`/hierarchy-nodes/tree`, `/hierarchy-nodes/:id/subtree`) before
parameterized routes (`/hierarchy-nodes/:id`).

---

## Resolved Unknown 4: Validation Schema Location and Pattern

**Question:** Where do Zod validation schemas live? What pattern?

**Investigation:** `packages/validation/src/backoffice/` contains:

- `groups.schemas.ts` — uses `zod`, exports named schemas and inferred types
- Offset-based pagination is NOT used in groups (cursor-based), but the spec explicitly requires
  `page` / `per_page` offset pagination for hierarchy flat list

**Decision:** Validation schemas location:

```
packages/validation/src/backoffice/hierarchy.schemas.ts
```

Schemas to implement:

- `createHierarchyNodeBodySchema` — body validation for POST
- `updateHierarchyNodeBodySchema` — partial body validation for PATCH
- `hierarchyNodeParamsSchema` — path param `{ id: uuid }`
- `listHierarchyNodesQuerySchema` — `{ status?, page, per_page }`
- `treeQuerySchema` — `{ status? }`

**Rationale:** Mirrors groups schema file structure. Zod with `.trim()` on name fields to enforce
server-side trimming per FR-025.

---

## Resolved Unknown 5: Recursive CTE Pattern for Tree Traversal

**Question:** How to implement WITH RECURSIVE CTE queries in this codebase? Raw SQL or Drizzle?

**Investigation:** The codebase uses raw `pg` queries via `DbClient.query()` throughout the domain
layer (repository files use template literals with parameterized queries). There is no evidence of
Drizzle ORM being used in the tenant domain layer — all queries are hand-written SQL executed via
the `pg` PoolClient.

**Decision:** Use raw SQL with `WITH RECURSIVE` CTE for tree traversal queries. No Drizzle ORM.

**Full-tree CTE pattern:**

```sql
WITH RECURSIVE tree AS (
  -- Anchor: root nodes
  SELECT
    id, name, parent_id, description, status,
    created_at, updated_at,
    0 AS depth
  FROM hierarchy_nodes
  WHERE parent_id IS NULL
    AND ($1::text IS NULL OR status = $1)

  UNION ALL

  -- Recursive: children of already-found nodes
  SELECT
    n.id, n.name, n.parent_id, n.description, n.status,
    n.created_at, n.updated_at,
    t.depth + 1
  FROM hierarchy_nodes n
  INNER JOIN tree t ON n.parent_id = t.id
  WHERE ($1::text IS NULL OR n.status = $1)
)
SELECT * FROM tree
ORDER BY depth ASC, name ASC
```

**Cycle detection pattern (ancestor walk inside transaction):**

```sql
WITH RECURSIVE ancestors AS (
  SELECT id, parent_id
  FROM hierarchy_nodes
  WHERE id = $1   -- proposed new parent_id

  UNION ALL

  SELECT n.id, n.parent_id
  FROM hierarchy_nodes n
  INNER JOIN ancestors a ON n.id = a.parent_id
)
SELECT id FROM ancestors WHERE id = $2  -- $2 = node being updated
```

If this returns a row, a cycle would be created → reject with `HIERARCHY_NODE_CYCLE_DETECTED`.

**Subtree CTE pattern (anchored at a specific node):**

```sql
WITH RECURSIVE subtree AS (
  SELECT id, name, parent_id, description, status, created_at, updated_at, 0 AS depth
  FROM hierarchy_nodes
  WHERE id = $1
    AND ($2::text IS NULL OR status = $2)

  UNION ALL

  SELECT n.id, n.name, n.parent_id, n.description, n.status,
         n.created_at, n.updated_at, s.depth + 1
  FROM hierarchy_nodes n
  INNER JOIN subtree s ON n.parent_id = s.id
  WHERE ($2::text IS NULL OR n.status = $2)
)
SELECT * FROM subtree ORDER BY depth ASC, name ASC
```

**Flat list with depth CTE (for paginated offset):**

```sql
WITH RECURSIVE flat AS (
  SELECT id, name, parent_id, description, status, created_at, updated_at, 0 AS depth
  FROM hierarchy_nodes
  WHERE parent_id IS NULL
    AND ($1::text IS NULL OR status = $1)

  UNION ALL

  SELECT n.id, n.name, n.parent_id, n.description, n.status,
         n.created_at, n.updated_at, f.depth + 1
  FROM hierarchy_nodes n
  INNER JOIN flat f ON n.parent_id = f.id
  WHERE ($1::text IS NULL OR n.status = $1)
),
counted AS (
  SELECT COUNT(*) AS total FROM flat
)
SELECT flat.*, counted.total
FROM flat, counted
ORDER BY flat.depth ASC, flat.name ASC
LIMIT $2 OFFSET $3
```

**Rationale:** Database-native recursive CTE is the safest strategy for arbitrary-depth trees and
avoids application-level stack overflows (FR spec edge case). Drizzle ORM does not expose
`WITH RECURSIVE` as a first-class API in the version used by this project, making raw SQL the
correct choice consistent with all other tenant domain repositories.

---

## Resolved Unknown 6: In-Memory Tree Assembly

**Question:** How to assemble the flat CTE result into a nested JSON tree?

**Decision:** After querying all rows with the recursive CTE (sorted by depth ASC), assemble the
nested structure in application memory using a Map keyed by node `id`:

```typescript
function assembleTree(rows: HierarchyNodeFlatRow[]): HierarchyNodeTree[] {
  const map = new Map<string, HierarchyNodeTree>();
  const roots: HierarchyNodeTree[] = [];

  for (const row of rows) {
    map.set(row.id, { ...row, children: [] });
  }

  for (const row of rows) {
    const node = map.get(row.id)!;
    if (row.parent_id === null) {
      roots.push(node);
    } else {
      const parent = map.get(row.parent_id);
      if (parent) parent.children.push(node);
    }
  }

  return roots;
}
```

Time complexity: O(n). Space: O(n). No recursion, no stack overflow risk.

**Rationale:** Simple iterative Map-based assembly is standard for tree building from flat SQL
results. Consistent with the spec's Assumption 6 (depth computed at query time, not stored).

---

## Resolved Unknown 7: Name Uniqueness Enforcement Strategy

**Question:** PostgreSQL partial unique index for NULL-parent case?

**Decision:** Two partial unique indexes:

1. **Non-root nodes** (parent_id IS NOT NULL):

   ```sql
   CREATE UNIQUE INDEX hierarchy_nodes_parent_name_unique
     ON hierarchy_nodes (parent_id, lower(name))
     WHERE parent_id IS NOT NULL
   ```

2. **Root nodes** (parent_id IS NULL):
   ```sql
   CREATE UNIQUE INDEX hierarchy_nodes_root_name_unique
     ON hierarchy_nodes (lower(name))
     WHERE parent_id IS NULL
   ```

PostgreSQL standard `UNIQUE (parent_id, name)` does NOT catch `NULL` cases correctly (two NULLs
are not considered equal in a unique index). Both partial indexes are required.

**Rationale:** FR-002 explicitly requires case-insensitive uniqueness per parent scope. The spec
calls out this exact two-index pattern. The application layer also performs a pre-check for
`HIERARCHY_NODE_NAME_DUPLICATE` inside the transaction to return a structured error before the DB
constraint fires.

---

## Resolved Unknown 8: Delete Guard — Users FK (Downstream Stage)

**Question:** The `users.hierarchy_node_id` FK does not exist yet in this stage. How to check
for staff assignments in the delete guard?

**Decision:** The pre-delete staff assignment check uses a conditional query:

```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'users'
    AND column_name = 'hierarchy_node_id'
) AS column_exists
```

If the column does not yet exist (downstream stage not deployed), the check is skipped. If the
column exists, execute:

```sql
SELECT COUNT(*) FROM users WHERE hierarchy_node_id = $1
```

The DB-level `ON DELETE RESTRICT` FK (added in the downstream migration) provides the safety
backstop regardless.

**Rationale:** This stage must be deployable standalone without requiring the downstream staff
assignment stage. The safe-existence check pattern uses `information_schema.columns` to detect
whether the `hierarchy_node_id` column has been added to `users` by the downstream stage. This is
a different approach from the groups domain which uses SAVEPOINT guards for deferred FK exposure —
both achieve safe-pass behaviour when the downstream schema is absent, but via different mechanisms.
The `information_schema` column-existence check is preferred here because it is simpler to reason
about and does not require SAVEPOINT error handling.

---

## Resolved Unknown 9: Transaction Isolation for Cycle Detection

**Question:** What PostgreSQL isolation level for the cycle-check + update transaction?

**Decision:** Default `READ COMMITTED`. The cycle-detection check uses `SELECT FOR UPDATE` on the
node being updated and the proposed parent row (locked in deterministic UUID order) to prevent
concurrent reciprocal reparenting from racing. Ancestor walk uses a recursive CTE executing within
the same transaction, reading committed rows plus the locked rows.

**Rationale:** `READ COMMITTED` is the codebase standard (groups service pattern). `SELECT FOR
UPDATE` on both participating rows prevents the reciprocal reparent race condition without
requiring SERIALIZABLE isolation which would impact throughput.

---

## Alternatives Considered

| Decision                                   | Alternative                        | Why Rejected                                                                                                                                 |
| ------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw SQL CTE                                | Drizzle ORM recursive CTE          | Drizzle lacks first-class `WITH RECURSIVE` support; all existing domain repositories use raw SQL                                             |
| Iterative map-based tree assembly          | Recursive JS tree builder          | JS recursion risks stack overflow for deeply nested trees (spec edge case)                                                                   |
| Two partial unique indexes                 | Single composite UNIQUE constraint | NULL is not equal to NULL in standard UNIQUE; two separate indexes required for correctness                                                  |
| Deterministic dual-row `SELECT FOR UPDATE` | SERIALIZABLE isolation             | SERIALIZABLE adds overhead to all concurrent readers; dual-row locking serializes reciprocal reparenting without global isolation escalation |
| Offset-based pagination (page/per_page)    | Cursor-based pagination            | Spec and user request explicitly require page/per_page for flat list; cursor-based used by groups but not specified here                     |
| Hard delete                                | Soft delete (deleted_at)           | FR-009 explicitly mandates hard delete; spec Assumption 4 documents the rationale                                                            |
