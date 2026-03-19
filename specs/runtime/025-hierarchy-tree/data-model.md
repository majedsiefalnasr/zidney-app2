# Data Model: Hierarchy Tree

**Stage**: STAGE_25_HIERARCHY_TREE  
**Phase**: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Created**: 2026-03-19  
**Basis**: spec.md FR-001 – FR-009, FR-018 – FR-020; research.md Resolved Unknowns 1, 7

---

## Table: `hierarchy_nodes` (Tenant DB)

Self-referencing organizational tree node. One table per tenant workspace. No shared global table.

### Column Definitions

| Column        | SQL Type       | Nullable | Default             | Notes                                        |
| ------------- | -------------- | -------- | ------------------- | -------------------------------------------- |
| `id`          | `UUID`         | NO       | `gen_random_uuid()` | Primary key                                  |
| `name`        | `VARCHAR(255)` | NO       | —                   | Trimmed by API layer before storage          |
| `parent_id`   | `UUID`         | YES      | `NULL`              | Self-referencing FK; NULL = root node        |
| `description` | `TEXT`         | YES      | `NULL`              |                                              |
| `status`      | `VARCHAR(20)`  | NO       | `'ENABLED'`         | CHECK: `IN ('ENABLED', 'DISABLED')`          |
| `created_at`  | `TIMESTAMPTZ`  | NO       | `NOW()`             | Server-set only; never accepted from client  |
| `updated_at`  | `TIMESTAMPTZ`  | NO       | `NOW()`             | Server-set; updated on every write operation |

**Note on `status` column type:** `VARCHAR(20) + CHECK` rather than a PostgreSQL `ENUM` type,
consistent with the project-wide convention established in the groups migration (see
`20260319_001_groups.ts` — groups uses `VARCHAR + CHECK` not `pg ENUM`).

---

### Constraints

```sql
-- Primary Key
CONSTRAINT hierarchy_nodes_pkey
  PRIMARY KEY (id)

-- Self-referencing FK — parent deletion blocked when children exist
CONSTRAINT hierarchy_nodes_parent_id_fkey
  FOREIGN KEY (parent_id)
  REFERENCES hierarchy_nodes(id)
  ON DELETE RESTRICT

-- Prohibit self-reference at DB layer (backstop; API validates first)
CONSTRAINT hierarchy_nodes_no_self_ref
  CHECK (parent_id <> id)

-- Status values whitelist
CONSTRAINT hierarchy_nodes_status_check
  CHECK (status IN ('ENABLED', 'DISABLED'))
```

---

### Indexes

```sql
-- Tree traversal: fast lookup of all children of a given parent
CREATE INDEX idx_hierarchy_nodes_parent_id
  ON hierarchy_nodes (parent_id)

-- Status filtering: fast scan for ENABLED / DISABLED subsets
CREATE INDEX idx_hierarchy_nodes_status
  ON hierarchy_nodes (status)

-- Case-insensitive unique name per non-root parent scope (parent_id IS NOT NULL)
CREATE UNIQUE INDEX hierarchy_nodes_parent_name_unique
  ON hierarchy_nodes (parent_id, lower(name))
  WHERE parent_id IS NOT NULL

-- Case-insensitive unique name among all root nodes (parent_id IS NULL)
-- Standard UNIQUE cannot enforce NULL = NULL, so a partial index is required
CREATE UNIQUE INDEX hierarchy_nodes_root_name_unique
  ON hierarchy_nodes (lower(name))
  WHERE parent_id IS NULL
```

**Why two partial indexes instead of one unique constraint:**  
PostgreSQL treats `NULL` values as not equal in standard `UNIQUE` constraints, meaning two root
nodes with the same name would not be caught. The two partial indexes correctly enforce
case-insensitive uniqueness in both scopes.

---

### Full DDL (representative — authoritative version is in migration file)

```sql
CREATE TABLE IF NOT EXISTS hierarchy_nodes (
  id            UUID          NOT NULL DEFAULT gen_random_uuid(),
  name          VARCHAR(255)  NOT NULL,
  parent_id     UUID,
  description   TEXT,
  status        VARCHAR(20)   NOT NULL DEFAULT 'ENABLED'
                  CONSTRAINT hierarchy_nodes_status_check
                    CHECK (status IN ('ENABLED', 'DISABLED')),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT hierarchy_nodes_pkey
    PRIMARY KEY (id),

  CONSTRAINT hierarchy_nodes_parent_id_fkey
    FOREIGN KEY (parent_id)
    REFERENCES hierarchy_nodes(id)
    ON DELETE RESTRICT,

  CONSTRAINT hierarchy_nodes_no_self_ref
    CHECK (parent_id <> id)
);
```

---

## Interface Contract: `users` Table FK (Downstream Stage)

This stage does NOT modify the `users` table. The following is the interface contract that the
downstream staff assignment stage MUST satisfy:

```sql
-- In the downstream migration (STAGE_26 or equivalent):
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS hierarchy_node_id UUID;

ALTER TABLE users
  ADD CONSTRAINT users_hierarchy_node_id_fkey
    FOREIGN KEY (hierarchy_node_id)
    REFERENCES hierarchy_nodes(id)
    ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_users_hierarchy_node_id
  ON users (hierarchy_node_id);
```

**Enforcement rules for the downstream stage:**

- `hierarchy_node_id` is nullable during bootstrap; staff need not be assigned at workspace creation.
- Assignment must reference a node with `status = 'ENABLED'`.
- Assignment to a `DISABLED` node must be rejected with `HIERARCHY_NODE_DISABLED` at the API layer.
- `ON DELETE RESTRICT` ensures no node can be deleted while staff reference it.

---

## TypeScript Type Definitions

Location: `packages/domain-core/src/hierarchy/hierarchy.types.ts`

```typescript
// Structural DB client (matches pg.Pool shape — no pg import in domain layer)
export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

// Audit context propagated from Hono middleware
export interface AuditContext {
  user_id: string;
  correlation_id: string;
  workspace_slug: string;
  workspace_id: string;
}

// Raw DB row — mirrors hierarchy_nodes columns
export interface HierarchyNodeRow {
  id: string;
  name: string;
  parent_id: string | null;
  description: string | null;
  status: "ENABLED" | "DISABLED";
  created_at: Date;
  updated_at: Date;
}

// Row extended with computed depth (from CTE query)
export interface HierarchyNodeFlatRow extends HierarchyNodeRow {
  depth: number;
}

// Nested tree node (assembled in-memory from flat CTE result)
export interface HierarchyNodeTree extends HierarchyNodeRow {
  depth: number;
  children: HierarchyNodeTree[];
}

// Service input/output types
export interface CreateHierarchyNodeInput {
  name: string; // pre-trimmed by validation layer
  parent_id?: string | null;
  description?: string | null;
  status?: "ENABLED" | "DISABLED";
}

export interface UpdateHierarchyNodeInput {
  name?: string;
  parent_id?: string | null; // undefined = don't change; null = promote to root
  description?: string | null;
  status?: "ENABLED" | "DISABLED";
}

export interface ListHierarchyNodesInput {
  page: number; // 1-based
  per_page: number; // max 100
  status?: "ENABLED" | "DISABLED";
}

export interface ListHierarchyNodesResult {
  items: HierarchyNodeFlatRow[];
  total: number;
  page: number;
  per_page: number;
}
```

---

## Migration Strategy

### File Path

```
apps/api/src/db/tenant/migrations/20260319_002_hierarchy_nodes.ts
```

### Naming Convention

Follows the date-sequence pattern established by all prior tenant migrations:
`YYYYMMDD_NNN_<description>.ts`

- Date: `20260319` (same day as groups migration `001`)
- Sequence: `002` (groups was `001` on the same date)
- Description: `hierarchy_nodes`

### Schema Version Bump

| From    | To      |
| ------- | ------- |
| `1.7.0` | `1.8.0` |

The groups migration (`20260319_001_groups.ts`) bumped to `1.7.0`. This migration bumps to `1.8.0`.

### Migration Steps (Ordered)

```
STEP 1: CREATE hierarchy_nodes table with all columns, CHECK constraints, FK
STEP 2: CREATE INDEX idx_hierarchy_nodes_parent_id
STEP 3: CREATE INDEX idx_hierarchy_nodes_status
STEP 4: CREATE UNIQUE INDEX hierarchy_nodes_parent_name_unique (partial: parent_id IS NOT NULL)
STEP 5: CREATE UNIQUE INDEX hierarchy_nodes_root_name_unique (partial: parent_id IS NULL)
STEP 6: UPDATE schema_version 1.7.0 → 1.8.0
```

All steps execute inside a single `BEGIN … COMMIT` transaction block.

### Forward-Only Policy

Per ADR-0008 and the Zidney constitution, the `down()` function throws `Error('Irreversible — restore from snapshot to rollback')`. Rollback is via snapshot restore only.

### Hard Dependencies

- `schema_version` table (baseline) — must exist
- No FK dependencies on other tables introduced in this migration (hierarchy_nodes is standalone)

### Idempotency

All DDL uses `IF NOT EXISTS` / `IF NOT EXISTS` guards to allow safe re-runs against a partially
applied state.

---

## Query Patterns Reference

### Full Tree (WITH RECURSIVE)

```sql
WITH RECURSIVE tree AS (
  SELECT id, name, parent_id, description, status, created_at, updated_at, 0 AS depth
  FROM hierarchy_nodes
  WHERE parent_id IS NULL
    AND ($1::text IS NULL OR status = $1)
  UNION ALL
  SELECT n.id, n.name, n.parent_id, n.description, n.status,
         n.created_at, n.updated_at, t.depth + 1
  FROM hierarchy_nodes n
  INNER JOIN tree t ON n.parent_id = t.id
  WHERE ($1::text IS NULL OR n.status = $1)
)
SELECT * FROM tree ORDER BY depth ASC, name ASC
```

Parameters: `[$1: status | null]`

### Subtree from Node (WITH RECURSIVE)

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

Parameters: `[$1: node_id, $2: status | null]`

### Flat List with Depth and Pagination (WITH RECURSIVE)

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
counted AS (SELECT COUNT(*)::int AS total FROM flat)
SELECT flat.*, counted.total
FROM flat, counted
ORDER BY flat.depth ASC, flat.name ASC
LIMIT $2 OFFSET $3
```

Parameters: `[$1: status | null, $2: per_page, $3: (page-1)*per_page]`

### Ancestor Walk for Cycle Detection

```sql
WITH RECURSIVE ancestors AS (
  SELECT id, parent_id
  FROM hierarchy_nodes
  WHERE id = $1
  UNION ALL
  SELECT n.id, n.parent_id
  FROM hierarchy_nodes n
  INNER JOIN ancestors a ON n.id = a.parent_id
)
SELECT id FROM ancestors WHERE id = $2
```

Parameters: `[$1: proposed_new_parent_id, $2: node_being_updated_id]`  
Returns a row if cycle detected → reject with `HIERARCHY_NODE_CYCLE_DETECTED`.
