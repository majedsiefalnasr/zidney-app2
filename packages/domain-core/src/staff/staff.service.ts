/**
 * Staff Domain — Service Layer (Business Logic)
 *
 * File: packages/domain-core/src/staff/staff.service.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 *
 * Business-logic entry points for staff management.
 * All write operations are wrapped in explicit transactions.
 * SERIALIZABLE isolation is used where concurrent limit enforcement is required.
 *
 * Constitutional Compliance:
 * ✓ No HTTP, no framework imports
 * ✓ No logging side-effects — callers are responsible for logging
 * ✓ All writes are transactional (BEGIN/COMMIT/ROLLBACK)
 * ✓ SERIALIZABLE isolation for limit-check + insert (createStaff)
 * ✓ Server-authoritative time (via DB NOW())
 * ✓ status and is_active always kept in sync
 * ✓ password_hash never returned to callers — only StaffRecord shapes
 */

import { hashStaffPassword } from '../auth/staff-password'
import { StaffError } from './staff.errors'
import {
  checkAuthoredContent,
  countActiveStaff,
  findStaffByEmailForUpdate,
  findStaffById,
  insertStaff,
  listStaff as listStaffRows,
  softDeleteStaff,
  updateStaff as updateStaffRow,
  updateStaffStatus,
} from './staff.repository'
import type {
  AuditContext,
  CreateStaffInput,
  DbClient,
  StaffBulkImportResult,
  StaffBulkImportRow,
  StaffListQuery,
  StaffListResult,
  StaffRecord,
  UpdateStaffInput,
} from './staff.types'

// ---------------------------------------------------------------------------
// createStaff
// ---------------------------------------------------------------------------

/**
 * Create a new staff member in the workspace.
 *
 * Uses SERIALIZABLE isolation to prevent phantom reads under concurrent
 * create requests. The limit check executes a direct COUNT(*) query; correctness
 * depends on the caller using SERIALIZABLE isolation for atomic enforcement.
 *
 * @param db          - Tenant database client (Pool)
 * @param input       - Staff creation input
 * @param staffLimit  - Maximum allowed ACTIVE staff for this workspace (from license)
 * @param audit       - Audit context (user_id, workspace_id, etc.)
 * @returns The created StaffRecord (no password_hash)
 * @throws StaffError STAFF_EMAIL_CONFLICT if email already registered
 * @throws StaffError STAFF_LIMIT_EXCEEDED if workspace is at capacity
 */
export async function createStaff(
  db: DbClient,
  input: CreateStaffInput,
  staffLimit: number | null,
  _audit: AuditContext
): Promise<StaffRecord> {
  const client = await db.connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

    // 1. Lock + check email uniqueness
    const existing = await findStaffByEmailForUpdate(client, input.workspace_id, input.email)
    if (existing) {
      throw new StaffError('STAFF_EMAIL_CONFLICT', {
        message: `Email already registered: ${input.email}`,
      })
    }

    // 2. Lock + check staff limit (only when a numeric limit is configured)
    if (staffLimit !== null) {
      const activeCount = await countActiveStaff(client, input.workspace_id)
      if (activeCount >= staffLimit) {
        throw new StaffError('STAFF_LIMIT_EXCEEDED', {
          message: `Workspace has reached the staff limit of ${staffLimit}`,
          limit_value: staffLimit,
          current_value: activeCount,
        })
      }
    }

    // 3. Hash password (in-transaction — hash before insert)
    const passwordHash = await hashStaffPassword(input.password)

    // 4. Insert
    const record = await insertStaff(client, {
      workspace_id: input.workspace_id,
      email: input.email,
      name: input.name,
      password_hash: passwordHash,
      role_id: input.role_id ?? null,
      division_ids: input.division_ids ?? [],
    })

    await client.query('COMMIT')

    return record
  } catch (err) {
    await client.query('ROLLBACK')
    // Detect serialization failure and convert to conflict for retry
    const pgErr = err as unknown as { code?: string }
    if (pgErr?.code === '40001') {
      throw new StaffError('STAFF_EMAIL_CONFLICT', {
        message: 'Request conflicted with concurrent operation; please retry',
      })
    }
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// listStaff
// ---------------------------------------------------------------------------

/**
 * List staff members with pagination and optional filters.
 *
 * @param db    - Tenant database client
 * @param query - Pagination and filter parameters
 * @returns Paginated StaffListResult
 */
export async function listStaff(db: DbClient, query: StaffListQuery): Promise<StaffListResult> {
  const { rows, total } = await listStaffRows(db, query)
  return {
    items: rows,
    total,
    page: query.page,
    limit: query.limit,
  }
}

// ---------------------------------------------------------------------------
// getStaffById
// ---------------------------------------------------------------------------

/**
 * Return a single staff record by ID.
 *
 * @throws StaffError STAFF_NOT_FOUND when the record doesn't exist in this workspace
 */
export async function getStaffById(
  db: DbClient,
  workspaceId: string,
  staffId: string
): Promise<StaffRecord> {
  const record = await findStaffById(db, workspaceId, staffId)
  if (!record) {
    throw new StaffError('STAFF_NOT_FOUND', { message: `Staff not found: ${staffId}` })
  }
  return record
}

// ---------------------------------------------------------------------------
// updateStaff
// ---------------------------------------------------------------------------

/**
 * Update a staff member's profile (name, email, division_ids, role_id).
 *
 * @throws StaffError STAFF_NOT_FOUND when the record doesn't exist
 * @throws StaffError STAFF_EMAIL_CONFLICT when the new email is already in use
 */
export async function updateStaff(
  db: DbClient,
  workspaceId: string,
  staffId: string,
  input: UpdateStaffInput,
  _audit: AuditContext
): Promise<StaffRecord> {
  await db.query('BEGIN')
  try {
    // Check target exists
    const current = await findStaffById(db, workspaceId, staffId)
    if (!current) {
      throw new StaffError('STAFF_NOT_FOUND', { message: `Staff not found: ${staffId}` })
    }

    // If email is being changed, check for conflict
    if (input.email && input.email !== current.email) {
      const conflict = await findStaffByEmailForUpdate(db, workspaceId, input.email)
      if (conflict && conflict.id !== staffId) {
        throw new StaffError('STAFF_EMAIL_CONFLICT', {
          message: `Email already in use: ${input.email}`,
        })
      }
    }

    const updated = await updateStaffRow(db, workspaceId, staffId, input)
    if (!updated) {
      throw new StaffError('STAFF_NOT_FOUND', {
        message: `Staff not found after update: ${staffId}`,
      })
    }

    await db.query('COMMIT')

    return updated
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// disableStaff
// ---------------------------------------------------------------------------

/**
 * Disable a staff member (status = INACTIVE, is_active = false).
 *
 * @throws StaffError STAFF_NOT_FOUND when not found
 * @throws StaffError STAFF_ALREADY_DISABLED when already INACTIVE
 */
export async function disableStaff(
  db: DbClient,
  workspaceId: string,
  staffId: string,
  _audit: AuditContext
): Promise<StaffRecord> {
  await db.query('BEGIN')
  try {
    const current = await findStaffById(db, workspaceId, staffId)
    if (!current) {
      throw new StaffError('STAFF_NOT_FOUND', { message: `Staff not found: ${staffId}` })
    }
    if (current.status === 'INACTIVE') {
      throw new StaffError('STAFF_ALREADY_DISABLED', {
        message: `Staff is already disabled: ${staffId}`,
      })
    }

    const updated = await updateStaffStatus(db, workspaceId, staffId, 'INACTIVE', false)
    if (!updated) {
      throw new StaffError('STAFF_NOT_FOUND', {
        message: `Staff not found after disable: ${staffId}`,
      })
    }

    await db.query('COMMIT')

    return updated
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// enableStaff
// ---------------------------------------------------------------------------

/**
 * Enable a staff member (status = ACTIVE, is_active = true).
 *
 * @throws StaffError STAFF_NOT_FOUND when not found
 * @throws StaffError STAFF_ALREADY_ACTIVE when already ACTIVE
 */
export async function enableStaff(
  db: DbClient,
  workspaceId: string,
  staffId: string,
  staffLimit: number | null,
  _audit: AuditContext
): Promise<StaffRecord> {
  const client = await db.connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
    const current = await findStaffById(client, workspaceId, staffId)
    if (!current) {
      throw new StaffError('STAFF_NOT_FOUND', { message: `Staff not found: ${staffId}` })
    }
    if (current.status === 'ACTIVE') {
      throw new StaffError('STAFF_ALREADY_ACTIVE', {
        message: `Staff is already active: ${staffId}`,
      })
    }

    if (staffLimit !== null) {
      const activeCount = await countActiveStaff(client, workspaceId)
      if (activeCount >= staffLimit) {
        throw new StaffError('STAFF_LIMIT_EXCEEDED', {
          message: `Workspace has reached the staff limit of ${staffLimit}`,
          limit_value: staffLimit,
          current_value: activeCount,
        })
      }
    }

    const updated = await updateStaffStatus(client, workspaceId, staffId, 'ACTIVE', true)
    if (!updated) {
      throw new StaffError('STAFF_NOT_FOUND', {
        message: `Staff not found after enable: ${staffId}`,
      })
    }

    await client.query('COMMIT')
    return updated
  } catch (err) {
    await client.query('ROLLBACK')
    // Detect serialization failure and convert to conflict for retry
    const pgErr = err as unknown as { code?: string }
    if (pgErr?.code === '40001') {
      throw new StaffError('STAFF_EMAIL_CONFLICT', {
        message: 'Request conflicted with concurrent operation; please retry',
      })
    }
    throw err
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// deleteStaff
// ---------------------------------------------------------------------------

/**
 * Soft-delete a staff member (status = INACTIVE, is_active = false).
 * Blocks if the staff has authored any content (exams, questions).
 *
 * @throws StaffError STAFF_NOT_FOUND when not found
 * @throws StaffError STAFF_HAS_AUTHORED_CONTENT when content exists
 */
export async function deleteStaff(
  db: DbClient,
  workspaceId: string,
  staffId: string,
  _audit: AuditContext
): Promise<void> {
  await db.query('BEGIN')
  try {
    const current = await findStaffById(db, workspaceId, staffId)
    if (!current) {
      throw new StaffError('STAFF_NOT_FOUND', { message: `Staff not found: ${staffId}` })
    }

    const hasContent = await checkAuthoredContent(db, workspaceId, staffId)
    if (hasContent) {
      throw new StaffError('STAFF_HAS_AUTHORED_CONTENT', {
        message: `Cannot delete staff with authored content: ${staffId}`,
      })
    }

    await softDeleteStaff(db, workspaceId, staffId)

    await db.query('COMMIT')
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// bulkImportStaff
// ---------------------------------------------------------------------------

/**
 * Bulk import staff via CSV payload.
 * Delegates to staff.bulk-import.ts for batch processing.
 */
export async function bulkImportStaff(
  db: DbClient,
  workspaceId: string,
  rows: StaffBulkImportRow[],
  staffLimit: number | null,
  audit: AuditContext
): Promise<StaffBulkImportResult> {
  const { processStaffBulkImport } = await import('./staff.bulk-import')
  return processStaffBulkImport(db, workspaceId, rows, staffLimit, audit)
}
