/**
 * Categories — Service Layer
 *
 * File: packages/domain-core/src/categories/categories.service.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * Pure domain logic. No HTTP, no framework dependencies.
 * All write operations are wrapped in explicit BEGIN / COMMIT / ROLLBACK.
 * Server-authoritative time — NOW() used inside DB; never Date.now() here.
 */

import { createLogger } from '@zidney/logger'

import { checkCategoryDependencies } from './categories.dependency-registry'
import { CategoryError } from './categories.errors'
import {
  categoryCodeExists,
  categoryNameExists,
  countCategories,
  countEnabledChildren,
  divisionExists,
  findAllCategoriesForTree,
  findAncestorIds,
  findCategories,
  findScopedCategoryById,
  insertCategory,
  insertCategoryScope,
  lockCategoryForUpdate,
  replaceCategoryScope,
  subjectExists,
  updateCategoryRow,
} from './categories.repository'
import { buildCategoryTree } from './categories.tree'
import type {
  AuditContext,
  CategoryTreeNode,
  CreateCategoryInput,
  DbClient,
  ListCategoriesInput,
  ListCategoriesResult,
  ScopedCategoryRow,
  UpdateCategoryInput,
} from './categories.types'

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const logger = createLogger('categories:service')

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum depth of the category hierarchy (root = depth 1). */
const MAX_CATEGORY_DEPTH = 3

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

/** List categories with pagination and optional filters. */
export async function listCategories(
  db: DbClient,
  input: ListCategoriesInput
): Promise<ListCategoriesResult> {
  const page = Math.max(1, input.page)
  const limit = Math.min(100, Math.max(1, input.limit))
  const offset = (page - 1) * limit

  const filters = {
    parent_id: input.parent_id,
    status: input.status,
    search: input.search,
  }

  const [total, items] = await Promise.all([
    countCategories(db, filters),
    findCategories(db, { offset, limit, ...filters }),
  ])

  return { items, total, page, limit }
}

/** Get a single category with scope arrays. Throws NOT_FOUND if missing. */
export async function getCategory(db: DbClient, id: string): Promise<ScopedCategoryRow> {
  const row = await findScopedCategoryById(db, id)
  if (!row) throw new CategoryError('CATEGORY_NOT_FOUND')
  return row
}

/** Get the full category tree (all enabled + disabled). */
export async function getCategoriesTree(db: DbClient): Promise<CategoryTreeNode[]> {
  const flat = await findAllCategoriesForTree(db)
  return buildCategoryTree(flat)
}

// ---------------------------------------------------------------------------
// Guards & Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the depth of a node by walking ancestors.
 * Root nodes (no parent) are at depth 1.
 */
async function _computeDepth(db: DbClient, parentId: string | null): Promise<number> {
  if (!parentId) return 1 // creating at root → depth 1

  // Walk up the ancestor chain to count hops from parent to root
  let depth = 2 // at minimum the child is depth 2 (parent is depth 1)
  let currentId: string | null = parentId

  // Walk parent → grandparent → great-grandparent (maximum 2 more hops relevant)
  for (let hops = 0; hops < MAX_CATEGORY_DEPTH; hops++) {
    // biome-ignore lint/style/noNonNullAssertion: currentId is non-null at loop entry and reassigned from non-null grandparent
    const ancestors = await findAncestorIds(db, currentId!, 1)
    if (ancestors.length === 0) break
    const parentRow = await db.query<{ parent_id: string | null }>(
      `SELECT parent_id FROM categories WHERE id = $1::uuid`,
      [currentId]
    )
    const grandparent = parentRow.rows[0]?.parent_id ?? null
    if (!grandparent) break
    depth++
    currentId = grandparent
  }

  return depth
}

/**
 * Determine the depth position that a **child** of `parentId` would occupy.
 * Uses a CTE recursive walk for accuracy.
 */
async function resolveChildDepth(db: DbClient, parentId: string | null): Promise<number> {
  if (!parentId) return 1 // root-level child is depth 1

  const result = await db.query<{ depth: string }>(
    `WITH RECURSIVE chain AS (
       SELECT id, parent_id, 1 AS depth
       FROM categories WHERE id = $1::uuid
       UNION ALL
       SELECT c.id, c.parent_id, chain.depth + 1
       FROM categories c JOIN chain ON chain.parent_id = c.id
     )
     SELECT MAX(depth)::text AS depth FROM chain`,
    [parentId]
  )
  // depth in chain = parent's depth; child is one level deeper
  const parentDepth = parseInt(result.rows[0]?.depth ?? '1', 10)
  return parentDepth + 1
}

/**
 * Check circular reference:
 * If setting `proposedParentId` as parent of `categoryId` would result in
 * a cycle in the ancestor chain.
 */
async function wouldCreateCircularReference(
  db: DbClient,
  categoryId: string,
  proposedParentId: string
): Promise<boolean> {
  if (categoryId === proposedParentId) return true // self-reference is circular

  // Walk ancestors of proposedParentId — if categoryId is found, circular
  const ancestors = await findAncestorIds(db, proposedParentId, MAX_CATEGORY_DEPTH + 2)
  return ancestors.includes(categoryId)
}

// ---------------------------------------------------------------------------
// Write Operations
// ---------------------------------------------------------------------------

/** Create a new category. */
export async function createCategory(
  db: DbClient,
  input: CreateCategoryInput,
  audit: AuditContext
): Promise<ScopedCategoryRow> {
  await db.query('BEGIN')
  try {
    // --- Validate parent ---
    if (input.parent_id) {
      const parent = await findScopedCategoryById(db, input.parent_id)
      if (!parent) throw new CategoryError('CATEGORY_PARENT_NOT_FOUND')
    }

    // --- Check max depth ---
    const childDepth = await resolveChildDepth(db, input.parent_id ?? null)
    if (childDepth > MAX_CATEGORY_DEPTH) {
      throw new CategoryError('CATEGORY_MAX_DEPTH_EXCEEDED')
    }

    // --- Name uniqueness ---
    if (await categoryNameExists(db, input.name)) {
      throw new CategoryError('CATEGORY_NAME_DUPLICATE')
    }

    // --- Code uniqueness ---
    if (input.code && (await categoryCodeExists(db, input.code))) {
      throw new CategoryError('CATEGORY_CODE_DUPLICATE')
    }

    // --- Validate subject IDs ---
    for (const sid of input.subject_ids ?? []) {
      if (!(await subjectExists(db, sid))) {
        throw new CategoryError('CATEGORY_SUBJECT_NOT_FOUND')
      }
    }

    // --- Validate division IDs ---
    for (const did of input.division_ids ?? []) {
      if (!(await divisionExists(db, did))) {
        throw new CategoryError('CATEGORY_DIVISION_NOT_FOUND')
      }
    }

    // --- Insert ---
    const created = await insertCategory(db, input, audit)

    // --- Insert scope ---
    if ((input.subject_ids?.length ?? 0) > 0 || (input.division_ids?.length ?? 0) > 0) {
      await insertCategoryScope(db, created.id, input.subject_ids ?? [], input.division_ids ?? [])
    }

    await db.query('COMMIT')

    logger.info('category.created', {
      category_id: created.id,
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
    })

    const row = await findScopedCategoryById(db, created.id)
    if (!row) throw new CategoryError('CATEGORY_NOT_FOUND')
    return row
  } catch (err) {
    await db.query('ROLLBACK')
    const pg = err as { code?: string }
    if (pg?.code === '23505') {
      // Unique violation — determine which field
      const msg = (err as Error).message ?? ''
      if (msg.includes('unique_categories_code')) throw new CategoryError('CATEGORY_CODE_DUPLICATE')
      throw new CategoryError('CATEGORY_NAME_DUPLICATE')
    }
    throw err
  }
}

/** Update an existing category (pessimistic lock). */
export async function updateCategory(
  db: DbClient,
  id: string,
  input: UpdateCategoryInput,
  audit: AuditContext
): Promise<ScopedCategoryRow> {
  await db.query('BEGIN')
  try {
    // --- Acquire row lock (NOWAIT — throws 55P03 if locked) ---
    const locked = await lockCategoryForUpdate(db, id)
    if (!locked) throw new CategoryError('CATEGORY_NOT_FOUND')

    // --- Determine if any non-status field is changing ---
    const hasStructuralChange =
      input.name !== undefined || 'code' in input || 'description' in input || 'parent_id' in input

    // --- Disabled guard (can only update status, not structural fields) ---
    if (locked.status === 'DISABLED' && hasStructuralChange) {
      throw new CategoryError('CATEGORY_DISABLED')
    }

    // --- Status idempotency ---
    if (input.status === 'ENABLED' && locked.status === 'ENABLED') {
      throw new CategoryError('CATEGORY_ALREADY_ENABLED')
    }
    if (input.status === 'DISABLED' && locked.status === 'DISABLED') {
      throw new CategoryError('CATEGORY_ALREADY_DISABLED')
    }

    // --- Parent validation ---
    if ('parent_id' in input && input.parent_id !== undefined) {
      if (input.parent_id !== null) {
        const parent = await findScopedCategoryById(db, input.parent_id)
        if (!parent) throw new CategoryError('CATEGORY_PARENT_NOT_FOUND')

        // Circular reference check
        if (await wouldCreateCircularReference(db, id, input.parent_id)) {
          throw new CategoryError('CATEGORY_CIRCULAR_REFERENCE')
        }

        // Max depth check
        const childDepth = await resolveChildDepth(db, input.parent_id)
        if (childDepth > MAX_CATEGORY_DEPTH) {
          throw new CategoryError('CATEGORY_MAX_DEPTH_EXCEEDED')
        }
      }
    }

    // --- Name uniqueness ---
    if (input.name !== undefined && (await categoryNameExists(db, input.name, id))) {
      throw new CategoryError('CATEGORY_NAME_DUPLICATE')
    }

    // --- Code uniqueness ---
    if (input.code !== undefined && input.code !== null) {
      if (await categoryCodeExists(db, input.code, id)) {
        throw new CategoryError('CATEGORY_CODE_DUPLICATE')
      }
    }

    // --- Validate subject IDs ---
    for (const sid of input.subject_ids ?? []) {
      if (!(await subjectExists(db, sid))) {
        throw new CategoryError('CATEGORY_SUBJECT_NOT_FOUND')
      }
    }

    // --- Validate division IDs ---
    for (const did of input.division_ids ?? []) {
      if (!(await divisionExists(db, did))) {
        throw new CategoryError('CATEGORY_DIVISION_NOT_FOUND')
      }
    }

    // --- Update the category row ---
    await updateCategoryRow(db, id, input, audit.user_id)

    // --- Replace scope if provided ---
    if (input.subject_ids !== undefined || input.division_ids !== undefined) {
      // Load current scope to determine final arrays
      const currentScoped = await findScopedCategoryById(db, id)
      const newSubjectIds =
        input.subject_ids !== undefined ? input.subject_ids : (currentScoped?.subject_ids ?? [])
      const newDivisionIds =
        input.division_ids !== undefined ? input.division_ids : (currentScoped?.division_ids ?? [])

      await replaceCategoryScope(db, id, newSubjectIds, newDivisionIds)
    }

    await db.query('COMMIT')

    logger.info('category.updated', {
      category_id: id,
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
    })

    const row = await findScopedCategoryById(db, id)
    if (!row) throw new CategoryError('CATEGORY_NOT_FOUND')
    return row
  } catch (err) {
    await db.query('ROLLBACK')
    const pg = err as { code?: string }
    if (pg?.code === '55P03') {
      throw new CategoryError('CATEGORY_LOCK_CONFLICT')
    }
    if (pg?.code === '23505') {
      const msg = (err as Error).message ?? ''
      if (msg.includes('unique_categories_code')) throw new CategoryError('CATEGORY_CODE_DUPLICATE')
      throw new CategoryError('CATEGORY_NAME_DUPLICATE')
    }
    throw err
  }
}

/** Soft-delete (disable) a category. */
export async function deleteCategory(db: DbClient, id: string, audit: AuditContext): Promise<void> {
  await db.query('BEGIN')
  try {
    const locked = await lockCategoryForUpdate(db, id)
    if (!locked) throw new CategoryError('CATEGORY_NOT_FOUND')

    if (locked.status === 'DISABLED') {
      throw new CategoryError('CATEGORY_ALREADY_DISABLED')
    }

    // --- Cannot disable if active children exist ---
    const enabledChildCount = await countEnabledChildren(db, id)
    if (enabledChildCount > 0) {
      throw new CategoryError('CATEGORY_HAS_ENABLED_CHILDREN')
    }

    // --- Check downstream dependencies (exam content, etc.) ---
    const dependentCount = await checkCategoryDependencies(db, id)
    if (dependentCount > 0) {
      throw new CategoryError('CATEGORY_HAS_DEPENDENT_CONTENT')
    }

    await updateCategoryRow(db, id, { status: 'DISABLED' }, audit.user_id)

    await db.query('COMMIT')

    logger.info('category.deleted', {
      category_id: id,
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
    })
  } catch (err) {
    await db.query('ROLLBACK')
    const pg = err as { code?: string }
    if (pg?.code === '55P03') {
      throw new CategoryError('CATEGORY_LOCK_CONFLICT')
    }
    throw err
  }
}
