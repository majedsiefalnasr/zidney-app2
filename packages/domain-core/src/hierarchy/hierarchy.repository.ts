/**
 * Hierarchy Domain — Repository
 */

import type { DbClient, HierarchyNodeFlatRow, HierarchyNodeRow } from './hierarchy.types'

interface HierarchyNodeDbRow extends Record<string, unknown> {
  id: string
  name: string
  parent_id: string | null
  description: string | null
  status: 'ENABLED' | 'DISABLED'
  created_at: Date
  updated_at: Date
  depth?: number | string
}

interface CountRow extends Record<string, unknown> {
  count: string
}

interface ExistsRow extends Record<string, unknown> {
  exists: boolean
}

type TransactionalClient = DbClient

function mapRow(row: HierarchyNodeDbRow): HierarchyNodeRow {
  return {
    id: row.id,
    name: row.name,
    parent_id: row.parent_id,
    description: row.description,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapFlatRow(row: HierarchyNodeDbRow): HierarchyNodeFlatRow {
  return {
    ...mapRow(row),
    depth: typeof row.depth === 'number' ? row.depth : Number(row.depth ?? 0),
  }
}

async function withTraversalTimeout<T extends Record<string, unknown>>(
  db: DbClient,
  sql: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  // Note: Recursive CTEs are depth-limited in SQL WHERE clauses (max_recursive_iterations safety).
  // This function sets a server-side timeout as an additional safeguard.
  // For PoolClient (connection-aware), the timeout persists for the query.
  // For Pool (connection-agnostic), the timeout may not apply uniformly to all queries,
  // so depth limits in the CTE are the primary protection mechanism.
  // See: hierarchy.repository.ts findAllNodes, findSubtree (WHERE depth < 20)
  await db.query('SET statement_timeout = 5000')
  try {
    return await db.query<T>(sql, params)
  } finally {
    await db.query('SET statement_timeout = DEFAULT')
  }
}

export async function findNodeById(db: DbClient, id: string): Promise<HierarchyNodeRow | null> {
  const result = await db.query<HierarchyNodeDbRow>(
    `SELECT id, name, parent_id, description, status, created_at, updated_at
       FROM hierarchy_nodes
      WHERE id = $1`,
    [id]
  )

  const row = result.rows[0]
  return row ? mapRow(row) : null
}

export async function findNodeWithDepth(
  db: DbClient,
  id: string
): Promise<HierarchyNodeFlatRow | null> {
  const result = await db.query<HierarchyNodeDbRow>(
    `WITH RECURSIVE ancestors AS (
       SELECT id, parent_id, 0::int AS depth
         FROM hierarchy_nodes
        WHERE id = $1
       UNION ALL
       SELECT parent.id, parent.parent_id, ancestors.depth + 1
         FROM hierarchy_nodes parent
         JOIN ancestors ON ancestors.parent_id = parent.id
     )
     SELECT n.id,
            n.name,
            n.parent_id,
            n.description,
            n.status,
            n.created_at,
            n.updated_at,
            COALESCE(MAX(ancestors.depth), 0) AS depth
       FROM hierarchy_nodes n
       LEFT JOIN ancestors ON ancestors.id = n.id
      WHERE n.id = $1
      GROUP BY n.id, n.name, n.parent_id, n.description, n.status, n.created_at, n.updated_at`,
    [id]
  )

  const row = result.rows[0]
  return row ? mapFlatRow(row) : null
}

export async function lockNodeForUpdate(
  db: TransactionalClient,
  id: string
): Promise<HierarchyNodeRow | null> {
  const result = await db.query<HierarchyNodeDbRow>(
    `SELECT id, name, parent_id, description, status, created_at, updated_at
       FROM hierarchy_nodes
      WHERE id = $1
      FOR UPDATE`,
    [id]
  )

  const row = result.rows[0]
  return row ? mapRow(row) : null
}

export async function insertNode(
  db: TransactionalClient,
  input: {
    name: string
    parent_id: string | null
    description: string | null
    status: 'ENABLED' | 'DISABLED'
  }
): Promise<HierarchyNodeRow> {
  const result = await db.query<HierarchyNodeDbRow>(
    `INSERT INTO hierarchy_nodes (name, parent_id, description, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING id, name, parent_id, description, status, created_at, updated_at`,
    [input.name, input.parent_id, input.description, input.status]
  )

  return mapRow(result.rows[0] as HierarchyNodeDbRow)
}

export async function updateNodeRow(
  db: TransactionalClient,
  id: string,
  input: {
    name?: string
    parent_id?: string | null
    description?: string | null
    status?: 'ENABLED' | 'DISABLED'
  }
): Promise<HierarchyNodeRow> {
  const setClauses: string[] = ['updated_at = NOW()']
  const params: unknown[] = []

  if (input.name !== undefined) {
    params.push(input.name)
    setClauses.push(`name = $${params.length}`)
  }
  if ('parent_id' in input) {
    params.push(input.parent_id ?? null)
    setClauses.push(`parent_id = $${params.length}`)
  }
  if ('description' in input) {
    params.push(input.description ?? null)
    setClauses.push(`description = $${params.length}`)
  }
  if (input.status !== undefined) {
    params.push(input.status)
    setClauses.push(`status = $${params.length}`)
  }

  params.push(id)

  const result = await db.query<HierarchyNodeDbRow>(
    `UPDATE hierarchy_nodes
        SET ${setClauses.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, name, parent_id, description, status, created_at, updated_at`,
    params
  )

  return mapRow(result.rows[0] as HierarchyNodeDbRow)
}

export async function deleteNodeRow(db: TransactionalClient, id: string): Promise<boolean> {
  const result = await db.query(`DELETE FROM hierarchy_nodes WHERE id = $1`, [id])
  return (result.rowCount ?? 0) > 0
}

export async function countChildren(db: DbClient, parentId: string): Promise<number> {
  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS count
       FROM hierarchy_nodes
      WHERE parent_id = $1`,
    [parentId]
  )

  return Number(result.rows[0]?.count ?? '0')
}

export async function hierarchyNodeColumnExistsOnUsers(db: DbClient): Promise<boolean> {
  const tableExists = await db.query<ExistsRow>(
    `SELECT EXISTS (
        SELECT 1
          FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'users'
      ) AS exists`
  )

  if (!tableExists.rows[0]?.exists) {
    return false
  }

  const columnExists = await db.query<ExistsRow>(
    `SELECT EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'users'
           AND column_name = 'hierarchy_node_id'
      ) AS exists`
  )

  return Boolean(columnExists.rows[0]?.exists)
}

export async function countStaffAssignments(db: DbClient, nodeId: string): Promise<number> {
  const hasColumn = await hierarchyNodeColumnExistsOnUsers(db)

  if (!hasColumn) {
    return 0
  }

  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS count
       FROM users
      WHERE hierarchy_node_id = $1`,
    [nodeId]
  )

  return Number(result.rows[0]?.count ?? '0')
}

export async function nodeNameExists(
  db: DbClient,
  name: string,
  parentId: string | null,
  excludeId?: string
): Promise<boolean> {
  if (parentId === null) {
    const params: unknown[] = [name]
    let sql = `SELECT 1
                 FROM hierarchy_nodes
                WHERE parent_id IS NULL
                  AND LOWER(name) = LOWER($1)`

    if (excludeId) {
      params.push(excludeId)
      sql += ` AND id <> $2`
    }

    const result = await db.query(sql, params)
    return result.rows.length > 0
  }

  const params: unknown[] = [name, parentId]
  let sql = `SELECT 1
               FROM hierarchy_nodes
              WHERE parent_id = $2
                AND LOWER(name) = LOWER($1)`

  if (excludeId) {
    params.push(excludeId)
    sql += ` AND id <> $3`
  }

  const result = await db.query(sql, params)
  return result.rows.length > 0
}

function buildStatusFilterClause(statusFilter?: 'ENABLED' | 'DISABLED'): {
  clause: string
  params: unknown[]
} {
  if (!statusFilter) {
    return { clause: '', params: [] }
  }

  return {
    clause: 'WHERE tree.status = $1',
    params: [statusFilter],
  }
}

export async function findAllNodes(
  db: DbClient,
  statusFilter?: 'ENABLED' | 'DISABLED'
): Promise<HierarchyNodeFlatRow[]> {
  const { clause, params } = buildStatusFilterClause(statusFilter)

  const result = await withTraversalTimeout<HierarchyNodeDbRow>(
    db,
    `WITH RECURSIVE tree AS (
       SELECT id, name, parent_id, description, status, created_at, updated_at, 0::int AS depth
         FROM hierarchy_nodes
        WHERE parent_id IS NULL
       UNION ALL
       SELECT child.id,
              child.name,
              child.parent_id,
              child.description,
              child.status,
              child.created_at,
              child.updated_at,
              tree.depth + 1
         FROM hierarchy_nodes child
         JOIN tree ON child.parent_id = tree.id
        WHERE tree.depth < 20
     )
     SELECT tree.id,
            tree.name,
            tree.parent_id,
            tree.description,
            tree.status,
            tree.created_at,
            tree.updated_at,
            tree.depth
       FROM tree
       ${clause}
      ORDER BY tree.depth ASC, tree.name ASC, tree.id ASC`,
    params
  )

  return result.rows.map(mapFlatRow)
}

export async function findSubtree(
  db: DbClient,
  nodeId: string,
  statusFilter?: 'ENABLED' | 'DISABLED'
): Promise<HierarchyNodeFlatRow[]> {
  const params: unknown[] = [nodeId]
  let filterClause = ''

  if (statusFilter) {
    params.push(statusFilter)
    filterClause = `WHERE subtree.status = $2`
  }

  const result = await withTraversalTimeout<HierarchyNodeDbRow>(
    db,
    `WITH RECURSIVE subtree AS (
       SELECT id, name, parent_id, description, status, created_at, updated_at, 0::int AS depth
         FROM hierarchy_nodes
        WHERE id = $1
       UNION ALL
       SELECT child.id,
              child.name,
              child.parent_id,
              child.description,
              child.status,
              child.created_at,
              child.updated_at,
              subtree.depth + 1
         FROM hierarchy_nodes child
         JOIN subtree ON child.parent_id = subtree.id
        WHERE subtree.depth < 20
     )
     SELECT subtree.id,
            subtree.name,
            subtree.parent_id,
            subtree.description,
            subtree.status,
            subtree.created_at,
            subtree.updated_at,
            subtree.depth
       FROM subtree
       ${filterClause}
      ORDER BY subtree.depth ASC, subtree.name ASC, subtree.id ASC`,
    params
  )

  return result.rows.map(mapFlatRow)
}

export async function findFlatList(
  db: DbClient,
  page: number,
  perPage: number,
  statusFilter?: 'ENABLED' | 'DISABLED'
): Promise<{ items: HierarchyNodeFlatRow[]; total: number }> {
  const offset = (page - 1) * perPage
  const params: unknown[] = []
  const countParams: unknown[] = []
  let whereClause = ''

  if (statusFilter) {
    params.push(statusFilter)
    countParams.push(statusFilter)
    whereClause = `WHERE tree.status = $1`
  }

  const countResult = await db.query<CountRow>(
    `WITH RECURSIVE tree AS (
       SELECT id, name, parent_id, description, status, created_at, updated_at, 0::int AS depth
         FROM hierarchy_nodes
        WHERE parent_id IS NULL
       UNION ALL
       SELECT child.id,
              child.name,
              child.parent_id,
              child.description,
              child.status,
              child.created_at,
              child.updated_at,
              tree.depth + 1
         FROM hierarchy_nodes child
         JOIN tree ON child.parent_id = tree.id
     )
     SELECT COUNT(*)::text AS count
       FROM tree
       ${whereClause}`,
    countParams.length > 0 ? countParams : undefined
  )

  params.push(perPage, offset)

  const limitParam = statusFilter ? 2 : 1
  const offsetParam = statusFilter ? 3 : 2

  const result = await db.query<HierarchyNodeDbRow>(
    `WITH RECURSIVE tree AS (
       SELECT id, name, parent_id, description, status, created_at, updated_at, 0::int AS depth
         FROM hierarchy_nodes
        WHERE parent_id IS NULL
       UNION ALL
       SELECT child.id,
              child.name,
              child.parent_id,
              child.description,
              child.status,
              child.created_at,
              child.updated_at,
              tree.depth + 1
         FROM hierarchy_nodes child
         JOIN tree ON child.parent_id = tree.id
     )
     SELECT tree.id,
            tree.name,
            tree.parent_id,
            tree.description,
            tree.status,
            tree.created_at,
            tree.updated_at,
            tree.depth
       FROM tree
       ${whereClause}
      ORDER BY tree.depth ASC, tree.name ASC, tree.id ASC
      LIMIT $${limitParam}
     OFFSET $${offsetParam}`,
    params
  )

  return {
    items: result.rows.map(mapFlatRow),
    total: Number(countResult.rows[0]?.count ?? '0'),
  }
}

export async function walkAncestors(db: DbClient, proposedParentId: string): Promise<string[]> {
  const result = await db.query<{ id: string }>(
    `WITH RECURSIVE ancestors AS (
       SELECT id, parent_id, 0::int AS depth
         FROM hierarchy_nodes
        WHERE id = $1
       UNION ALL
       SELECT parent.id, parent.parent_id, ancestors.depth + 1
         FROM hierarchy_nodes parent
         JOIN ancestors ON ancestors.parent_id = parent.id
        WHERE ancestors.depth < 20
     )
     SELECT id FROM ancestors`,
    [proposedParentId]
  )

  return result.rows.map((row) => row.id)
}
