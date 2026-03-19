/**
 * Hierarchy Domain — Service
 */

import { createLogger } from '@zidney/logger'

import { HierarchyError } from './hierarchy.errors'
import {
  countChildren,
  countStaffAssignments,
  deleteNodeRow,
  findAllNodes,
  findFlatList,
  findNodeById,
  findNodeWithDepth,
  findSubtree,
  insertNode,
  lockNodeForUpdate,
  nodeNameExists,
  updateNodeRow,
  walkAncestors,
} from './hierarchy.repository'
import type {
  AuditContext,
  CreateHierarchyNodeInput,
  DbClient,
  DeleteHierarchyNodeResult,
  HierarchyNodeFlatRow,
  HierarchyNodeRow,
  HierarchyNodeTree,
  ListHierarchyNodesInput,
  ListHierarchyNodesResult,
  UpdateHierarchyNodeInput,
} from './hierarchy.types'

const logger = createLogger('hierarchy-service')

function normalizeName(name: string): string {
  return name.trim()
}

function isPgError(err: unknown): err is { code?: string; constraint?: string } {
  return typeof err === 'object' && err !== null && ('code' in err || 'constraint' in err)
}

function assembleTree(rows: HierarchyNodeFlatRow[]): HierarchyNodeTree[] {
  const map = new Map<string, HierarchyNodeTree>()

  for (const row of rows) {
    map.set(row.id, {
      ...row,
      children: [],
    })
  }

  const roots: HierarchyNodeTree[] = []

  for (const row of rows) {
    const node = map.get(row.id)
    if (!node) continue

    if (!row.parent_id) {
      roots.push(node)
      continue
    }

    const parent = map.get(row.parent_id)
    if (parent) {
      parent.children.push(node)
    }
  }

  return roots
}

async function lockPairForReparent(
  db: DbClient,
  nodeId: string,
  parentId: string
): Promise<{ current: HierarchyNodeRow | null; parent: HierarchyNodeRow | null }> {
  const orderedIds = [nodeId, parentId].sort((left, right) => left.localeCompare(right))
  const first = await lockNodeForUpdate(db, orderedIds[0] as string)
  const second = await lockNodeForUpdate(db, orderedIds[1] as string)

  return {
    current: orderedIds[0] === nodeId ? first : second,
    parent: orderedIds[0] === parentId ? first : second,
  }
}

function mapPgWriteError(err: unknown): never {
  if (isPgError(err) && err.code === '23505') {
    throw new HierarchyError('HIERARCHY_NODE_NAME_DUPLICATE')
  }

  throw err
}

export async function listHierarchyNodes(
  db: DbClient,
  input: ListHierarchyNodesInput
): Promise<ListHierarchyNodesResult> {
  const result = await findFlatList(db, input.page, input.per_page, input.status)

  return {
    items: result.items,
    total: result.total,
    page: input.page,
    per_page: input.per_page,
  }
}

export async function getHierarchyTree(
  db: DbClient,
  _audit: AuditContext,
  status?: 'ENABLED' | 'DISABLED'
): Promise<HierarchyNodeTree[]> {
  const rows = await findAllNodes(db, status)
  return assembleTree(rows)
}

export async function getHierarchySubtree(
  db: DbClient,
  id: string,
  _audit: AuditContext,
  status?: 'ENABLED' | 'DISABLED'
): Promise<HierarchyNodeTree[]> {
  const rows = await findSubtree(db, id, status)

  if (rows.length === 0) {
    throw new HierarchyError('HIERARCHY_NODE_NOT_FOUND')
  }

  return assembleTree(rows)
}

export async function getHierarchyNode(db: DbClient, id: string): Promise<HierarchyNodeFlatRow> {
  const node = await findNodeWithDepth(db, id)

  if (!node) {
    throw new HierarchyError('HIERARCHY_NODE_NOT_FOUND')
  }

  return node
}

export async function createHierarchyNode(
  db: DbClient,
  input: CreateHierarchyNodeInput,
  audit: AuditContext
): Promise<HierarchyNodeRow> {
  const name = normalizeName(input.name)

  if (!name) {
    throw new HierarchyError('VALIDATION_ERROR', 'name must not be blank')
  }

  await db.query('BEGIN')

  try {
    if (input.parent_id) {
      const parent = await findNodeById(db, input.parent_id)
      if (!parent) {
        throw new HierarchyError('HIERARCHY_NODE_PARENT_NOT_FOUND')
      }
    }

    const duplicate = await nodeNameExists(db, name, input.parent_id ?? null)
    if (duplicate) {
      throw new HierarchyError('HIERARCHY_NODE_NAME_DUPLICATE')
    }

    const created = await insertNode(db, {
      name,
      parent_id: input.parent_id ?? null,
      description: input.description ?? null,
      status: input.status ?? 'ENABLED',
    })

    await db.query('COMMIT')

    logger.info('Hierarchy node created', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      hierarchy_node_id: created.id,
    })

    return created
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof HierarchyError) throw err
    mapPgWriteError(err)
  }
}

export async function updateHierarchyNode(
  db: DbClient,
  id: string,
  input: UpdateHierarchyNodeInput,
  audit: AuditContext
): Promise<HierarchyNodeRow> {
  await db.query('BEGIN')

  try {
    let existing = await lockNodeForUpdate(db, id)

    if (!existing) {
      throw new HierarchyError('HIERARCHY_NODE_NOT_FOUND')
    }

    if (input.parent_id === id) {
      throw new HierarchyError('HIERARCHY_NODE_SELF_REFERENCE')
    }

    const targetParentId = input.parent_id !== undefined ? input.parent_id : existing.parent_id

    if (
      input.parent_id !== undefined &&
      input.parent_id !== null &&
      input.parent_id !== existing.parent_id
    ) {
      const locked = await lockPairForReparent(db, id, input.parent_id)
      existing = locked.current

      if (!existing) {
        throw new HierarchyError('HIERARCHY_NODE_NOT_FOUND')
      }
      if (!locked.parent) {
        throw new HierarchyError('HIERARCHY_NODE_PARENT_NOT_FOUND')
      }

      const ancestorIds = await walkAncestors(db, input.parent_id)
      if (ancestorIds.includes(id)) {
        logger.warn('Hierarchy cycle detection blocked reparent', {
          correlation_id: audit.correlation_id,
          workspace_slug: audit.workspace_slug,
          workspace_id: audit.workspace_id,
          user_id: audit.user_id,
          hierarchy_node_id: id,
          proposed_parent_id: input.parent_id,
        })
        throw new HierarchyError('HIERARCHY_NODE_CYCLE_DETECTED')
      }
    }

    if (input.name !== undefined) {
      const trimmedName = normalizeName(input.name)
      if (!trimmedName) {
        throw new HierarchyError('VALIDATION_ERROR', 'name must not be blank')
      }
      input = { ...input, name: trimmedName }
    }

    const nameChanged =
      input.name !== undefined && input.name.toLowerCase() !== existing.name.toLowerCase()
    const parentChanged = input.parent_id !== undefined && input.parent_id !== existing.parent_id

    if (nameChanged || parentChanged) {
      const nextName = input.name ?? existing.name
      const duplicate = await nodeNameExists(db, nextName, targetParentId ?? null, id)
      if (duplicate) {
        throw new HierarchyError('HIERARCHY_NODE_NAME_DUPLICATE')
      }
    }

    const updated = await updateNodeRow(db, id, input)

    await db.query('COMMIT')

    logger.info('Hierarchy node updated', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      hierarchy_node_id: id,
    })

    return updated
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof HierarchyError) throw err
    mapPgWriteError(err)
  }
}

export async function deleteHierarchyNode(
  db: DbClient,
  id: string,
  audit: AuditContext
): Promise<DeleteHierarchyNodeResult> {
  await db.query('BEGIN')

  try {
    const existing = await lockNodeForUpdate(db, id)

    if (!existing) {
      throw new HierarchyError('HIERARCHY_NODE_NOT_FOUND')
    }

    const childCount = await countChildren(db, id)
    if (childCount > 0) {
      throw new HierarchyError('HIERARCHY_NODE_HAS_CHILDREN')
    }

    const staffCount = await countStaffAssignments(db, id)
    if (staffCount > 0) {
      throw new HierarchyError('HIERARCHY_NODE_HAS_STAFF')
    }

    await deleteNodeRow(db, id)
    await db.query('COMMIT')

    logger.info('Hierarchy node deleted', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      hierarchy_node_id: id,
    })

    return { deleted: true }
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof HierarchyError) throw err
    throw err
  }
}
