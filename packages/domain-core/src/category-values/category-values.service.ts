/**
 * Category Values — Service Layer
 *
 * File: packages/domain-core/src/category-values/category-values.service.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 *
 * Pure domain logic. No HTTP, no framework dependencies.
 * All write operations are wrapped in explicit BEGIN / COMMIT / ROLLBACK.
 * Server-authoritative time — NOW() used inside DB; never Date.now() here.
 */

import { createLogger } from '@zidney/logger'

import { checkValueDependencies } from './category-values.dependency-registry'
import { CategoryValueError } from './category-values.errors'
import {
  categoryValueCodeExists,
  countCategoryValues,
  deleteValueDivisionScope,
  deleteValueSubjectScope,
  divisionsExistBatch,
  findCategoryById,
  findCategoryDivisionScope,
  findCategorySubjectScope,
  findCategoryValueById,
  findCategoryValueForUpdate,
  findCategoryValues,
  findScopeForValues,
  findTranslationsForValues,
  findWorkspaceLanguageConfig,
  insertCategoryValue,
  insertValueDivisionScope,
  insertValueSubjectScope,
  mergeScopedRow,
  softDeleteCategoryValue,
  subjectsExistBatch,
  updateCategoryValueRow,
  upsertTranslations,
} from './category-values.repository'
import type {
  AuditContext,
  CategoryValueStatus,
  CreateCategoryValueInput,
  DbClient,
  DeleteCategoryValueResult,
  ListCategoryValuesInput,
  ListCategoryValuesResult,
  ScopedCategoryValueRow,
  UpdateCategoryValueInput,
} from './category-values.types'

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const logger = createLogger('category-values:service')

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Allowed status transitions map. */
const ALLOWED_TRANSITIONS: Record<CategoryValueStatus, CategoryValueStatus[]> = {
  COMPLETED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['APPROVED'],
  APPROVED: ['ENABLED', 'DISABLED'],
  ENABLED: ['DISABLED'],
  DISABLED: ['ENABLED'],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate a status transition. Throws INVALID_STATUS_TRANSITION if not allowed.
 * Pure function — no DB access.
 */
function validateStatusTransition(from: CategoryValueStatus, to: CategoryValueStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? []
  if (!allowed.includes(to)) {
    throw new CategoryValueError('INVALID_STATUS_TRANSITION')
  }
}

/**
 * Validate scope arrays against the parent category's scope sets.
 * If the parent set is empty → global scope, any IDs are valid.
 * If the parent set is non-empty → all child IDs must be ∈ parent set.
 */
function validateScopeContainment(
  childIds: string[],
  parentSet: Set<string>,
  errorCode: 'CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT'
): void {
  if (parentSet.size === 0) return // no restriction
  for (const id of childIds) {
    if (!parentSet.has(id)) {
      throw new CategoryValueError(errorCode)
    }
  }
}

/**
 * Fetch a single enriched category value row (scoped + translations).
 * Runs 3 queries in parallel. Throws CATEGORY_VALUE_NOT_FOUND if missing.
 */
async function fetchScopedRow(db: DbClient, id: string): Promise<ScopedCategoryValueRow> {
  const [row, { subjects, divisions }, translations] = await Promise.all([
    findCategoryValueById(db, id),
    findScopeForValues(db, [id]),
    findTranslationsForValues(db, [id]),
  ])
  if (!row) throw new CategoryValueError('CATEGORY_VALUE_NOT_FOUND')
  return mergeScopedRow(row, subjects, divisions, translations)
}

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

/** List category values with pagination and optional filters. */
export async function listCategoryValues(
  db: DbClient,
  input: ListCategoryValuesInput,
  audit: AuditContext
): Promise<ListCategoryValuesResult> {
  const page = Math.max(1, input.page)
  const limit = Math.min(100, Math.max(1, input.limit))

  // Guard: include_deleted requires classification_manage
  if (input.include_deleted === true) {
    if (!audit.caller_permissions.includes('classification_manage')) {
      throw new CategoryValueError('FORBIDDEN')
    }
  }
  const include_deleted = input.include_deleted === true

  // Validate that the parent category exists
  const category = await findCategoryById(db, input.category_id)
  if (!category) throw new CategoryValueError('CATEGORY_NOT_FOUND')

  const opts = {
    category_id: input.category_id,
    page,
    limit,
    status: input.status,
    search: input.search,
    language: input.language,
    include_deleted,
  }

  const [total, rows] = await Promise.all([
    countCategoryValues(db, opts),
    findCategoryValues(db, opts),
  ])

  if (rows.length === 0) {
    return { items: [], total, page, limit }
  }

  const ids = rows.map((r) => r.id)
  const [{ subjects, divisions }, translations] = await Promise.all([
    findScopeForValues(db, ids),
    findTranslationsForValues(db, ids),
  ])

  const items = rows.map((r) => mergeScopedRow(r, subjects, divisions, translations))
  return { items, total, page, limit }
}

/** Get a single category value with scope and translations. */
export async function getCategoryValue(db: DbClient, id: string): Promise<ScopedCategoryValueRow> {
  return fetchScopedRow(db, id)
}

// ---------------------------------------------------------------------------
// Write Operations
// ---------------------------------------------------------------------------

/** Create a new category value. */
export async function createCategoryValue(
  db: DbClient,
  input: CreateCategoryValueInput,
  audit: AuditContext
): Promise<ScopedCategoryValueRow> {
  // Validate required name in at least one translation (PRE-TX — no lock held yet)
  const langConfig = await findWorkspaceLanguageConfig(db)
  if (!langConfig) {
    throw new CategoryValueError('UNSUPPORTED_LANGUAGE')
  }
  const hasNameTranslation = (input.translations ?? []).some(
    (t) => t.field_name === 'name' && t.translated_value.trim().length > 0
  )
  if (!hasNameTranslation) {
    throw new CategoryValueError('CATEGORY_VALUE_NAME_REQUIRED')
  }

  // Validate all translation language codes against workspace config (PRE-TX)
  for (const t of input.translations ?? []) {
    if (!langConfig.supported_languages.includes(t.language_code)) {
      throw new CategoryValueError('UNSUPPORTED_LANGUAGE')
    }
  }

  await db.query('BEGIN')
  try {
    // --- Parent category validation (inside TX) ---
    const category = await findCategoryById(db, input.category_id)
    if (!category) throw new CategoryValueError('CATEGORY_NOT_FOUND')
    if (category.status === 'DISABLED') throw new CategoryValueError('CATEGORY_DISABLED')

    // --- Category immutability guard: APPROVED+ categories are locked ---
    const immutableStatuses = ['APPROVED', 'ENABLED', 'DISABLED']
    if (immutableStatuses.includes(category.status)) {
      throw new CategoryValueError('CATEGORY_VALUE_CATEGORY_IMMUTABLE')
    }

    // --- Code uniqueness ---
    if (await categoryValueCodeExists(db, input.category_id, input.code)) {
      throw new CategoryValueError('CATEGORY_VALUE_CODE_DUPLICATE')
    }

    // --- Subject validation ---
    if ((input.subject_ids ?? []).length > 0) {
      const subjectIds = input.subject_ids ?? []
      const invalidSubjects = await subjectsExistBatch(db, subjectIds)
      if (invalidSubjects.length > 0) {
        throw new CategoryValueError('CATEGORY_VALUE_SUBJECT_NOT_FOUND')
      }
      // Parent scope containment
      const parentSubjectScope = await findCategorySubjectScope(db, input.category_id)
      validateScopeContainment(
        subjectIds,
        parentSubjectScope,
        'CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT'
      )
    }

    // --- Division validation ---
    if ((input.division_ids ?? []).length > 0) {
      const divisionIds = input.division_ids ?? []
      const invalidDivisions = await divisionsExistBatch(db, divisionIds)
      if (invalidDivisions.length > 0) {
        throw new CategoryValueError('CATEGORY_VALUE_DIVISION_NOT_FOUND')
      }
      // Parent scope containment
      const parentDivisionScope = await findCategoryDivisionScope(db, input.category_id)
      validateScopeContainment(
        divisionIds,
        parentDivisionScope,
        'CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT'
      )
    }

    // --- Insert row ---
    const created = await insertCategoryValue(
      db,
      { category_id: input.category_id, code: input.code },
      audit
    )

    // --- Upsert translations ---
    if ((input.translations ?? []).length > 0) {
      await upsertTranslations(db, created.id, input.translations ?? [])
    }

    // --- Insert scope ---
    if ((input.subject_ids ?? []).length > 0) {
      await insertValueSubjectScope(db, created.id, input.subject_ids ?? [])
    }
    if ((input.division_ids ?? []).length > 0) {
      await insertValueDivisionScope(db, created.id, input.division_ids ?? [])
    }

    await db.query('COMMIT')

    logger.info('category-value.created', {
      category_value_id: created.id,
      category_id: input.category_id,
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
    })

    return fetchScopedRow(db, created.id)
  } catch (err) {
    await db.query('ROLLBACK')
    const pg = err as { code?: string }
    if (pg?.code === '23505') {
      throw new CategoryValueError('CATEGORY_VALUE_CODE_DUPLICATE')
    }
    if (pg?.code === '55P03') {
      throw new CategoryValueError('CATEGORY_VALUE_LOCK_CONFLICT')
    }
    throw err
  }
}

/** Update an existing category value (pessimistic lock). */
export async function updateCategoryValue(
  db: DbClient,
  id: string,
  input: UpdateCategoryValueInput,
  audit: AuditContext
): Promise<ScopedCategoryValueRow> {
  // Validate translation language codes PRE-TX if translations are provided
  if ((input.translations ?? []).length > 0) {
    const langConfig = await findWorkspaceLanguageConfig(db)
    if (!langConfig) throw new CategoryValueError('UNSUPPORTED_LANGUAGE')
    for (const t of input.translations ?? []) {
      if (!langConfig.supported_languages.includes(t.language_code)) {
        throw new CategoryValueError('UNSUPPORTED_LANGUAGE')
      }
    }
    // Name must remain present if translations are being replaced
    const hasNameTranslation = input.translations?.some(
      (t) => t.field_name === 'name' && t.translated_value.trim().length > 0
    )
    if (!hasNameTranslation) {
      throw new CategoryValueError('CATEGORY_VALUE_NAME_REQUIRED')
    }
  }

  await db.query('BEGIN')
  try {
    // --- Acquire row lock ---
    const locked = await findCategoryValueForUpdate(db, id)
    if (!locked) throw new CategoryValueError('CATEGORY_VALUE_NOT_FOUND')

    // --- Category_id immutability guard ---
    // category_id cannot be changed — the plan explicitly states this
    // (no category_id field in UpdateCategoryValueInput)

    // --- Status transition validation ---
    if (input.status !== undefined) {
      validateStatusTransition(locked.status, input.status)
    }

    // --- Code uniqueness (if code is changing) ---
    if (input.code !== undefined && input.code !== locked.code) {
      if (await categoryValueCodeExists(db, locked.category_id, input.code, id)) {
        throw new CategoryValueError('CATEGORY_VALUE_CODE_DUPLICATE')
      }
    }

    // --- Subject scope validation ---
    if (input.subject_ids !== undefined) {
      if (input.subject_ids.length > 0) {
        const invalidSubjects = await subjectsExistBatch(db, input.subject_ids)
        if (invalidSubjects.length > 0) {
          throw new CategoryValueError('CATEGORY_VALUE_SUBJECT_NOT_FOUND')
        }
        const parentSubjectScope = await findCategorySubjectScope(db, locked.category_id)
        validateScopeContainment(
          input.subject_ids,
          parentSubjectScope,
          'CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT'
        )
      }
    }

    // --- Division scope validation ---
    if (input.division_ids !== undefined) {
      if (input.division_ids.length > 0) {
        const invalidDivisions = await divisionsExistBatch(db, input.division_ids)
        if (invalidDivisions.length > 0) {
          throw new CategoryValueError('CATEGORY_VALUE_DIVISION_NOT_FOUND')
        }
        const parentDivisionScope = await findCategoryDivisionScope(db, locked.category_id)
        validateScopeContainment(
          input.division_ids,
          parentDivisionScope,
          'CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT'
        )
      }
    }

    // --- Update row ---
    const patch: { code?: string; status?: CategoryValueStatus } = {}
    if (input.code !== undefined) patch.code = input.code
    if (input.status !== undefined) patch.status = input.status

    if (Object.keys(patch).length > 0) {
      await updateCategoryValueRow(db, id, patch, audit)
    }

    // --- Upsert translations (if provided) ---
    if ((input.translations ?? []).length > 0) {
      await upsertTranslations(db, id, input.translations ?? [])
    }

    // --- Replace subject scope atomically (delete-then-insert) ---
    if (input.subject_ids !== undefined) {
      await deleteValueSubjectScope(db, id)
      if (input.subject_ids.length > 0) {
        await insertValueSubjectScope(db, id, input.subject_ids)
      }
    }

    // --- Replace division scope atomically ---
    if (input.division_ids !== undefined) {
      await deleteValueDivisionScope(db, id)
      if (input.division_ids.length > 0) {
        await insertValueDivisionScope(db, id, input.division_ids)
      }
    }

    await db.query('COMMIT')

    logger.info('category-value.updated', {
      category_value_id: id,
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
    })

    return fetchScopedRow(db, id)
  } catch (err) {
    await db.query('ROLLBACK')
    const pg = err as { code?: string }
    if (pg?.code === '23505') {
      throw new CategoryValueError('CATEGORY_VALUE_CODE_DUPLICATE')
    }
    if (pg?.code === '55P03') {
      throw new CategoryValueError('CATEGORY_VALUE_LOCK_CONFLICT')
    }
    throw err
  }
}

/** Soft-delete a category value (idempotent — already-deleted returns success). */
export async function deleteCategoryValue(
  db: DbClient,
  id: string,
  audit: AuditContext
): Promise<DeleteCategoryValueResult> {
  await db.query('BEGIN')
  try {
    // Acquire row lock — returns row even if deleted_at IS NOT NULL
    const locked = await findCategoryValueForUpdate(db, id)
    if (!locked) throw new CategoryValueError('CATEGORY_VALUE_NOT_FOUND')

    // Idempotency: already deleted → return success without any write
    if (locked.deleted_at !== null) {
      await db.query('ROLLBACK')
      return { deleted: true }
    }

    // Dependency check — reject if any registered checker finds references
    const depCount = await checkValueDependencies(db, id)
    if (depCount > 0) {
      throw new CategoryValueError('CATEGORY_VALUE_IN_USE')
    }

    await softDeleteCategoryValue(db, id, audit)

    await db.query('COMMIT')

    logger.info('category-value.deleted', {
      category_value_id: id,
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
    })

    return { deleted: true }
  } catch (err) {
    await db.query('ROLLBACK')
    const pg = err as { code?: string }
    if (pg?.code === '55P03') {
      throw new CategoryValueError('CATEGORY_VALUE_LOCK_CONFLICT')
    }
    throw err
  }
}
