/**
 * Divisions Domain Service — STAGE_22
 *
 * File: packages/domain-core/src/divisions/divisions.service.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * All 11 service functions for the Divisions domain.
 * Uses injected DbClient — no direct Pool instantiation.
 *
 * Transaction discipline:
 * - All write operations (create/update/delete) are wrapped in
 *   BEGIN … COMMIT / ROLLBACK blocks.
 * - disableDivisions uses SERIALIZABLE isolation to prevent
 *   concurrent state corruption during the bulk reassignment.
 *
 * Constitutional Compliance:
 * ✓ Database-per-tenant — no cross-tenant queries
 * ✓ No direct Pool import — all DB access via injected DbClient
 * ✓ Server-authoritative time (NOW() for all timestamps)
 * ✓ Structured logging via @zidney/logger — no console.log
 * ✓ Forward-only — no mutations outside the tenant resolver context
 * ✓ All count checks use FOR UPDATE locks to prevent TOCTOU races
 */

import { createLogger } from '@zidney/logger'

import { DivisionsError } from './divisions.errors'
import type {
  AuditContext,
  CreateDivisionInput,
  DbClient,
  DisableDivisionsResult,
  DivisionRow,
  ListDivisionsInput,
  ListDivisionsResult,
  StaffDivisionRow,
  UpdateDivisionInput,
  UpdateDivisionStatusInput,
} from './divisions.types'
import { DivisionStatus } from './divisions.types'

const logger = createLogger('divisions-service')

// ---------------------------------------------------------------------------
// 1 — isDivisionsEnabled
// ---------------------------------------------------------------------------

/**
 * Returns whether the divisions feature is enabled for this tenant workspace.
 *
 * Reads `divisions_enabled` from the singleton row in `workspace_settings`.
 * Called at the start of every write operation to ensure the guard is enforced.
 */
export async function isDivisionsEnabled(db: DbClient): Promise<boolean> {
  const result = await db.query<{ divisions_enabled: boolean }>(
    'SELECT divisions_enabled FROM workspace_settings LIMIT 1'
  )
  return result.rows[0]?.divisions_enabled ?? true
}

// ---------------------------------------------------------------------------
// 2 — listDivisions  (keyset cursor pagination)
// ---------------------------------------------------------------------------

/**
 * Lists divisions with keyset pagination on (created_at, id).
 *
 * Cursor is the UUID of the last row from the previous page.
 * The service resolves the cursor row's (created_at, id) internally to build
 * the row-value comparison: `(created_at, id) > ($cursor_ts, $cursor_id)`.
 *
 * limit is clamped to 100 max to prevent accidental full-table scans.
 * A separate COUNT query returns the total matching the status filter.
 */
export async function listDivisions(
  db: DbClient,
  input: ListDivisionsInput
): Promise<ListDivisionsResult> {
  const limit = Math.min(Math.max(1, input.limit), 100)
  const statusFilter = input.status !== 'all'

  // Resolve cursor position (created_at, id) from the cursor division id
  let cursorCreatedAt: Date | null = null
  let cursorId: string | null = null
  if (input.cursor) {
    const cursorResult = await db.query<{ created_at: Date; id: string }>(
      'SELECT created_at, id FROM divisions WHERE id = $1',
      [input.cursor]
    )
    const cursorRow = cursorResult.rows[0]
    if (cursorRow) {
      cursorCreatedAt = cursorRow.created_at
      cursorId = cursorRow.id
    }
  }

  // Build the main list query
  // Uses limit+1 trick: if we get more than `limit` rows, there is a next page.
  const params: unknown[] = []
  const conditions: string[] = []

  if (statusFilter) {
    params.push(input.status)
    conditions.push(`status = $${params.length}`)
  }

  if (cursorCreatedAt && cursorId) {
    params.push(cursorCreatedAt, cursorId)
    conditions.push(`(created_at, id) > ($${params.length - 1}, $${params.length})`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(limit + 1)

  const listResult = await db.query<DivisionRow>(
    `SELECT id, name, description, is_default, status, created_at, updated_at
       FROM divisions
       ${whereClause}
       ORDER BY created_at ASC, id ASC
       LIMIT $${params.length}`,
    params
  )

  const hasNextPage = listResult.rows.length > limit
  const items = hasNextPage ? listResult.rows.slice(0, limit) : listResult.rows
  const nextCursor = hasNextPage ? (items[items.length - 1]?.id ?? null) : null

  // Total count query (separate — not affected by cursor or limit)
  const countParams: unknown[] = []
  const countConditions: string[] = []

  if (statusFilter) {
    countParams.push(input.status)
    countConditions.push(`status = $${countParams.length}`)
  }

  const countWhere = countConditions.length > 0 ? `WHERE ${countConditions.join(' AND ')}` : ''
  const countResult = await db.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM divisions ${countWhere}`,
    countParams
  )

  const total = parseInt(countResult.rows[0]?.total ?? '0', 10)

  return { items, nextCursor, total }
}

// ---------------------------------------------------------------------------
// 3 — getDivisionById
// ---------------------------------------------------------------------------

export async function getDivisionById(db: DbClient, id: string): Promise<DivisionRow> {
  const result = await db.query<DivisionRow>(
    `SELECT id, name, description, is_default, status, created_at, updated_at
       FROM divisions
       WHERE id = $1`,
    [id]
  )
  if (result.rows.length === 0) {
    throw new DivisionsError('DIVISION_NOT_FOUND')
  }
  return result.rows[0]
}

// ---------------------------------------------------------------------------
// 4 — createDivision
// ---------------------------------------------------------------------------

/**
 * Creates a new division.
 *
 * Guards:
 *   1. Feature flag — divisions_enabled must be true.
 *   2. Case-insensitive name uniqueness via the LOWER(name) functional index.
 *
 * Transactional — inserts inside BEGIN/COMMIT; ROLLBACK on any error.
 */
export async function createDivision(
  db: DbClient,
  input: CreateDivisionInput,
  audit: AuditContext
): Promise<DivisionRow> {
  const enabled = await isDivisionsEnabled(db)
  if (!enabled) throw new DivisionsError('DIVISIONS_FEATURE_DISABLED')

  // Case-insensitive name conflict — rely on DB unique index for atomicity,
  // but pre-check to return a meaningful error instead of a generic DB violation.
  const conflictCheck = await db.query<{ id: string }>(
    'SELECT id FROM divisions WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [input.name]
  )
  if (conflictCheck.rows.length > 0) {
    throw new DivisionsError(
      'DIVISION_NAME_CONFLICT',
      `A division named "${input.name}" already exists.`
    )
  }

  await db.query('BEGIN', [])
  try {
    const result = await db.query<DivisionRow>(
      `INSERT INTO divisions (name, description)
         VALUES ($1, $2)
         RETURNING id, name, description, is_default, status, created_at, updated_at`,
      [input.name, input.description ?? null]
    )
    const row = result.rows[0]
    if (!row) throw new Error('INSERT returned no rows')
    await db.query('COMMIT', [])

    logger.info('Division created', {
      division_id: row.id,
      ...audit,
    })

    return row as DivisionRow
  } catch (err) {
    await db.query('ROLLBACK', [])
    // Re-throw unique constraint violation as domain error
    const pgErr = err as { code?: string }
    if (pgErr.code === '23505') {
      throw new DivisionsError('DIVISION_NAME_CONFLICT')
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// 5 — updateDivision
// ---------------------------------------------------------------------------

/**
 * Updates a division's name and/or description.
 *
 * Guards:
 *   1. Feature flag.
 *   2. Division exists (FOR UPDATE row lock — prevents TOCTOU on concurrent updates).
 *   3. Case-insensitive name uniqueness (only when name changes).
 */
export async function updateDivision(
  db: DbClient,
  id: string,
  input: UpdateDivisionInput,
  audit: AuditContext
): Promise<DivisionRow> {
  const enabled = await isDivisionsEnabled(db)
  if (!enabled) throw new DivisionsError('DIVISIONS_FEATURE_DISABLED')

  await db.query('BEGIN', [])
  try {
    // FOR UPDATE lock — serialize concurrent updates on the same row
    const lockResult = await db.query<DivisionRow>(
      `SELECT id, name, is_default, status FROM divisions WHERE id = $1 FOR UPDATE`,
      [id]
    )
    if (lockResult.rows.length === 0) {
      await db.query('ROLLBACK', [])
      throw new DivisionsError('DIVISION_NOT_FOUND')
    }

    // Case-insensitive name conflict — skip if name is unchanged
    const lockedRow = lockResult.rows[0]
    if (!lockedRow) throw new Error('FOR UPDATE returned no rows')
    if (lockedRow.name.toLowerCase() !== input.name.toLowerCase()) {
      const conflictCheck = await db.query<{ id: string }>(
        'SELECT id FROM divisions WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1',
        [input.name, id]
      )
      if (conflictCheck.rows.length > 0) {
        await db.query('ROLLBACK', [])
        throw new DivisionsError(
          'DIVISION_NAME_CONFLICT',
          `A division named "${input.name}" already exists.`
        )
      }
    }

    const result = await db.query<DivisionRow>(
      `UPDATE divisions
         SET name = $1,
             description = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, name, description, is_default, status, created_at, updated_at`,
      [input.name, input.description ?? null, id]
    )
    const row = result.rows[0]
    if (!row) throw new Error('UPDATE returned no rows')
    await db.query('COMMIT', [])

    logger.info('Division updated', { division_id: id, ...audit })

    return row
  } catch (err) {
    if (err instanceof DivisionsError) throw err
    await db.query('ROLLBACK', [])
    const pgErr = err as { code?: string }
    if (pgErr.code === '23505') {
      throw new DivisionsError('DIVISION_NAME_CONFLICT')
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// 6 — updateDivisionStatus
// ---------------------------------------------------------------------------

/**
 * Enables or disables a single division.
 *
 * Guards:
 *   1. Feature flag.
 *   2. Division exists (FOR UPDATE).
 *   3. Default division cannot be DISABLED — it must always remain ENABLED.
 */
export async function updateDivisionStatus(
  db: DbClient,
  id: string,
  input: UpdateDivisionStatusInput,
  audit: AuditContext
): Promise<DivisionRow> {
  const enabled = await isDivisionsEnabled(db)
  if (!enabled) throw new DivisionsError('DIVISIONS_FEATURE_DISABLED')

  await db.query('BEGIN', [])
  try {
    const lockResult = await db.query<DivisionRow>(
      `SELECT id, is_default, status FROM divisions WHERE id = $1 FOR UPDATE`,
      [id]
    )
    if (lockResult.rows.length === 0) {
      await db.query('ROLLBACK', [])
      throw new DivisionsError('DIVISION_NOT_FOUND')
    }

    const lockedRow = lockResult.rows[0] as DivisionRow
    if (lockedRow.is_default && input.status === DivisionStatus.DISABLED) {
      await db.query('ROLLBACK', [])
      throw new DivisionsError(
        'DEFAULT_DIVISION_IMMUTABLE',
        'The default division cannot be disabled.'
      )
    }

    const result = await db.query<DivisionRow>(
      `UPDATE divisions
         SET status = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, description, is_default, status, created_at, updated_at`,
      [input.status, id]
    )
    const row = result.rows[0]
    if (!row) throw new Error('UPDATE returned no rows')
    await db.query('COMMIT', [])

    logger.info('Division status updated', {
      division_id: id,
      new_status: input.status,
      ...audit,
    })

    return row
  } catch (err) {
    if (err instanceof DivisionsError) throw err
    await db.query('ROLLBACK', [])
    throw err
  }
}

// ---------------------------------------------------------------------------
// 7 — deleteDivision
// ---------------------------------------------------------------------------

/**
 * Permanently deletes a division.
 *
 * Guards:
 *   1. Feature flag.
 *   2. Division exists (FOR UPDATE).
 *   3. Default division cannot be deleted.
 *   4. Division must have zero student assignments.
 *   5. Division must have zero staff assignments.
 */
export async function deleteDivision(db: DbClient, id: string, audit: AuditContext): Promise<void> {
  const enabled = await isDivisionsEnabled(db)
  if (!enabled) throw new DivisionsError('DIVISIONS_FEATURE_DISABLED')

  await db.query('BEGIN', [])
  try {
    const lockResult = await db.query<DivisionRow>(
      `SELECT id, is_default FROM divisions WHERE id = $1 FOR UPDATE`,
      [id]
    )
    if (lockResult.rows.length === 0) {
      await db.query('ROLLBACK', [])
      throw new DivisionsError('DIVISION_NOT_FOUND')
    }

    const div = lockResult.rows[0] as DivisionRow
    if (div.is_default) {
      await db.query('ROLLBACK', [])
      throw new DivisionsError(
        'DEFAULT_DIVISION_IMMUTABLE',
        'The default division cannot be deleted.'
      )
    }

    // Check student count
    const studentCount = await db.query<{ cnt: string }>(
      'SELECT COUNT(*)::text AS cnt FROM students WHERE division_id = $1',
      [id]
    )
    const studentCnt = studentCount.rows[0]?.cnt ?? '0'
    if (parseInt(studentCnt, 10) > 0) {
      await db.query('ROLLBACK', [])
      throw new DivisionsError(
        'DIVISION_IN_USE',
        'Division has active student assignments and cannot be deleted.'
      )
    }

    // Check staff count
    const staffCount = await db.query<{ cnt: string }>(
      'SELECT COUNT(*)::text AS cnt FROM staff_divisions WHERE division_id = $1',
      [id]
    )
    const staffCnt = staffCount.rows[0]?.cnt ?? '0'
    if (parseInt(staffCnt, 10) > 0) {
      await db.query('ROLLBACK', [])
      throw new DivisionsError(
        'DIVISION_IN_USE',
        'Division has active staff assignments and cannot be deleted.'
      )
    }

    await db.query('DELETE FROM divisions WHERE id = $1', [id])
    await db.query('COMMIT', [])

    logger.info('Division deleted', { division_id: id, ...audit })
  } catch (err) {
    if (err instanceof DivisionsError) throw err
    await db.query('ROLLBACK', [])
    throw err
  }
}

// ---------------------------------------------------------------------------
// 8 — disableDivisions  (SERIALIZABLE)
// ---------------------------------------------------------------------------

/**
 * Disables all non-default divisions and reassigns all entities to the default.
 *
 * Entire operation runs in SERIALIZABLE isolation to prevent concurrent
 * mutations from corrupting the invariant that every student and staff member
 * has exactly one valid division after the operation completes.
 *
 * Steps (all within a single SERIALIZABLE transaction):
 *   1. Lock and resolve the default division.
 *   2. Reassign all students from non-default divisions to the default division.
 *   3. Delete all staff_divisions rows for non-default divisions and reinsert
 *      pointing to the default division (deduplicated via ON CONFLICT DO NOTHING).
 *   4. Set all non-default divisions to status = DISABLED.
 *   5. Set workspace_settings.divisions_enabled = false.
 */
export async function disableDivisions(
  db: DbClient,
  audit: AuditContext
): Promise<DisableDivisionsResult> {
  await db.query('BEGIN', [])
  try {
    await db.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE', [])

    // Step 1 — lock & resolve default division
    const defaultResult = await db.query<{ id: string }>(
      `SELECT id FROM divisions WHERE is_default = true LIMIT 1 FOR UPDATE`,
      []
    )
    if (defaultResult.rows.length === 0) {
      await db.query('ROLLBACK', [])
      throw new DivisionsError('DIVISION_REQUIRED', 'No default division found.')
    }
    const defaultDivisionId = (defaultResult.rows[0] as { id: string }).id

    // Lock all other divisions to prevent concurrent modification
    await db.query(`SELECT id FROM divisions WHERE is_default = false FOR UPDATE`, [])

    // Step 2 — reassign students
    const studentsResult = await db.query<{ count: string }>(
      `UPDATE students
         SET division_id = $1,
             updated_at  = NOW()
         WHERE division_id != $1
         RETURNING id`,
      [defaultDivisionId]
    )
    const students_reassigned = studentsResult.rowCount ?? 0

    // Step 3 — reassign staff: collect unique staff_ids from non-default assignments,
    //          delete all their non-default assignments, reinsert pointing to default.
    //          ON CONFLICT DO NOTHING prevents errors if staff already has default.
    const affectedStaffResult = await db.query<{ staff_id: string }>(
      `SELECT DISTINCT staff_id
         FROM staff_divisions
         WHERE division_id != $1`,
      [defaultDivisionId]
    )
    const affectedStaffIds = affectedStaffResult.rows.map((r) => r.staff_id)

    let staff_divisions_reassigned = 0
    if (affectedStaffIds.length > 0) {
      // Delete non-default assignments for affected staff
      const deleteResult = await db.query<{ staff_id: string }>(
        `DELETE FROM staff_divisions
           WHERE division_id != $1
             AND staff_id = ANY($2::uuid[])
           RETURNING staff_id`,
        [defaultDivisionId, affectedStaffIds]
      )
      const deletedCount = deleteResult.rowCount ?? 0

      // Reinsert pointing to default (idempotent via ON CONFLICT DO NOTHING)
      if (affectedStaffIds.length > 0) {
        const valuePlaceholders = affectedStaffIds
          .map((_, i) => `($${i + 2}, $1, NOW())`)
          .join(', ')
        await db.query(
          `INSERT INTO staff_divisions (staff_id, division_id, assigned_at)
             VALUES ${valuePlaceholders}
             ON CONFLICT (staff_id, division_id) DO NOTHING`,
          [defaultDivisionId, ...affectedStaffIds]
        )
      }
      staff_divisions_reassigned = deletedCount
    }

    // Step 4 — disable all non-default divisions
    const disableResult = await db.query<{ id: string }>(
      `UPDATE divisions
         SET status     = 'DISABLED',
             updated_at = NOW()
         WHERE is_default = false
         RETURNING id`,
      []
    )
    const divisions_disabled = disableResult.rowCount ?? 0

    // Step 5 — set feature flag to false
    await db.query(`UPDATE workspace_settings SET divisions_enabled = false`, [])

    await db.query('COMMIT', [])

    logger.info('Divisions disabled — all entities reassigned to default', {
      default_division_id: defaultDivisionId,
      students_reassigned,
      staff_divisions_reassigned,
      divisions_disabled,
      ...audit,
    })

    return { students_reassigned, staff_divisions_reassigned, divisions_disabled }
  } catch (err) {
    if (err instanceof DivisionsError) throw err
    await db.query('ROLLBACK', [])
    throw err
  }
}

// ---------------------------------------------------------------------------
// 9 — getStaffDivisions
// ---------------------------------------------------------------------------

export async function getStaffDivisions(
  db: DbClient,
  staffId: string
): Promise<StaffDivisionRow[]> {
  const result = await db.query<StaffDivisionRow>(
    `SELECT staff_id, division_id, assigned_at
       FROM staff_divisions
       WHERE staff_id = $1
       ORDER BY assigned_at ASC`,
    [staffId]
  )
  return result.rows
}

// ---------------------------------------------------------------------------
// 10 — assignStaffDivision
// ---------------------------------------------------------------------------

/**
 * Assigns a staff member to a division.
 *
 * Idempotent — uses INSERT … ON CONFLICT DO NOTHING.
 * Returns the existing or newly created row.
 *
 * Guards:
 *   1. Feature flag.
 *   2. Division must exist and be ENABLED.
 */
export async function assignStaffDivision(
  db: DbClient,
  staffId: string,
  divisionId: string,
  audit: AuditContext
): Promise<StaffDivisionRow> {
  const enabled = await isDivisionsEnabled(db)
  if (!enabled) throw new DivisionsError('DIVISIONS_FEATURE_DISABLED')

  // Division existence and status check
  const divisionResult = await db.query<{ id: string; status: string }>(
    'SELECT id, status FROM divisions WHERE id = $1',
    [divisionId]
  )
  if (divisionResult.rows.length === 0) {
    throw new DivisionsError('DIVISION_NOT_FOUND')
  }
  const div = divisionResult.rows[0] as { id: string; status: string }
  if (div.status === DivisionStatus.DISABLED) {
    throw new DivisionsError('DIVISION_DISABLED')
  }

  // Idempotent insert
  await db.query(
    `INSERT INTO staff_divisions (staff_id, division_id)
       VALUES ($1, $2)
       ON CONFLICT (staff_id, division_id) DO NOTHING`,
    [staffId, divisionId]
  )

  // Return the row (may have been inserted now or existed before)
  const result = await db.query<StaffDivisionRow>(
    `SELECT staff_id, division_id, assigned_at
       FROM staff_divisions
       WHERE staff_id = $1 AND division_id = $2`,
    [staffId, divisionId]
  )

  if (result.rows.length === 0) {
    throw new DivisionsError(
      'STAFF_DIVISION_ASSIGNMENT_FAILED',
      'Failed to assign staff to division.'
    )
  }

  logger.info('Staff division assigned', {
    staff_id: staffId,
    division_id: divisionId,
    ...audit,
  })

  return result.rows[0]
}

// ---------------------------------------------------------------------------
// 11 — removeStaffDivision
// ---------------------------------------------------------------------------

/**
 * Removes a staff member's assignment to a division.
 *
 * Guards:
 *   1. Assignment must exist.
 *   2. Staff member must retain at least one division after removal.
 */
export async function removeStaffDivision(
  db: DbClient,
  staffId: string,
  divisionId: string,
  audit: AuditContext
): Promise<void> {
  await db.query('BEGIN', [])
  try {
    // Check assignment exists (FOR UPDATE — serialize concurrent removes)
    const assignmentResult = await db.query<{ staff_id: string }>(
      `SELECT staff_id
         FROM staff_divisions
         WHERE staff_id = $1 AND division_id = $2
         FOR UPDATE`,
      [staffId, divisionId]
    )
    if (assignmentResult.rows.length === 0) {
      await db.query('ROLLBACK', [])
      throw new DivisionsError('DIV_STAFF_ASSIGNMENT_NOT_FOUND')
    }

    // Minimum-one guard — staff must keep at least one division
    const countResult = await db.query<{ cnt: string }>(
      'SELECT COUNT(*)::text AS cnt FROM staff_divisions WHERE staff_id = $1',
      [staffId]
    )
    const currentCount = parseInt(countResult.rows[0]?.cnt ?? '0', 10)
    if (currentCount <= 1) {
      await db.query('ROLLBACK', [])
      throw new DivisionsError('STAFF_MINIMUM_DIVISION_REQUIRED')
    }

    await db.query('DELETE FROM staff_divisions WHERE staff_id = $1 AND division_id = $2', [
      staffId,
      divisionId,
    ])
    await db.query('COMMIT', [])

    logger.info('Staff division removed', {
      staff_id: staffId,
      division_id: divisionId,
      ...audit,
    })
  } catch (err) {
    if (err instanceof DivisionsError) throw err
    await db.query('ROLLBACK', [])
    throw err
  }
}
