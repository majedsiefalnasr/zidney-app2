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
 * ✓ All writes are transactional (BEGIN/COMMIT/ROLLBACK)
 * ✓ SERIALIZABLE isolation for limit-check + insert (createStaff)
 * ✓ Server-authoritative time (via DB NOW())
 * ✓ status and is_active always kept in sync
 * ✓ password_hash never returned to callers — only StaffRecord shapes
 */

import { createLogger } from '@zidney/logger'
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
  StaffListQuery,
  StaffListResult,
  StaffRecord,
  UpdateStaffInput,
} from './staff.types'

const logger = createLogger('staff-service')

// ---------------------------------------------------------------------------
// createStaff
// ---------------------------------------------------------------------------

/**
 * Create a new staff member in the workspace.
 *
 * Uses SERIALIZABLE isolation to prevent phantom reads under concurrent
 * create requests. The FOR UPDATE lock in countActiveStaff prevents
 * concurrent inserts from bypassing the staff_limit check.
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
  staffLimit: number,
  audit: AuditContext
): Promise<StaffRecord> {
  await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
  try {
    // 1. Lock + check email uniqueness
    const existing = await findStaffByEmailForUpdate(db, input.workspace_id, input.email)
    if (existing) {
      throw new StaffError('STAFF_EMAIL_CONFLICT', `Email already registered: ${input.email}`)
    }

    // 2. Lock + check staff limit
    const activeCount = await countActiveStaff(db, input.workspace_id)
    if (activeCount >= staffLimit) {
      throw new StaffError(
        'STAFF_LIMIT_EXCEEDED',
        `Workspace has reached the staff limit of ${staffLimit}`
      )
    }

    // 3. Hash password (in-transaction — hash before insert)
    const passwordHash = await hashStaffPassword(input.password)

    // 4. Insert
    const record = await insertStaff(db, {
      workspace_id: input.workspace_id,
      email: input.email,
      name: input.name,
      password_hash: passwordHash,
      role_id: input.role_id ?? null,
      division_ids: input.division_ids ?? [],
    })

    await db.query('COMMIT')

    logger.info('Staff created', {
      staff_id: record.id,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return record
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
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
    throw new StaffError('STAFF_NOT_FOUND', `Staff not found: ${staffId}`)
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
  audit: AuditContext
): Promise<StaffRecord> {
  await db.query('BEGIN')
  try {
    // Check target exists
    const current = await findStaffById(db, workspaceId, staffId)
    if (!current) {
      throw new StaffError('STAFF_NOT_FOUND', `Staff not found: ${staffId}`)
    }

    // If email is being changed, check for conflict
    if (input.email && input.email !== current.email) {
      const conflict = await findStaffByEmailForUpdate(db, workspaceId, input.email)
      if (conflict && conflict.id !== staffId) {
        throw new StaffError('STAFF_EMAIL_CONFLICT', `Email already in use: ${input.email}`)
      }
    }

    const updated = await updateStaffRow(db, workspaceId, staffId, input)
    if (!updated) {
      throw new StaffError('STAFF_NOT_FOUND', `Staff not found after update: ${staffId}`)
    }

    await db.query('COMMIT')

    logger.info('Staff updated', {
      staff_id: staffId,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

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
  audit: AuditContext
): Promise<StaffRecord> {
  await db.query('BEGIN')
  try {
    const current = await findStaffById(db, workspaceId, staffId)
    if (!current) {
      throw new StaffError('STAFF_NOT_FOUND', `Staff not found: ${staffId}`)
    }
    if (current.status === 'INACTIVE') {
      throw new StaffError('STAFF_ALREADY_DISABLED', `Staff is already disabled: ${staffId}`)
    }

    const updated = await updateStaffStatus(db, workspaceId, staffId, 'INACTIVE', false)
    if (!updated) {
      throw new StaffError('STAFF_NOT_FOUND', `Staff not found after disable: ${staffId}`)
    }

    await db.query('COMMIT')

    logger.info('Staff disabled', {
      staff_id: staffId,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

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
  audit: AuditContext
): Promise<StaffRecord> {
  await db.query('BEGIN')
  try {
    const current = await findStaffById(db, workspaceId, staffId)
    if (!current) {
      throw new StaffError('STAFF_NOT_FOUND', `Staff not found: ${staffId}`)
    }
    if (current.status === 'ACTIVE') {
      throw new StaffError('STAFF_ALREADY_ACTIVE', `Staff is already active: ${staffId}`)
    }

    const updated = await updateStaffStatus(db, workspaceId, staffId, 'ACTIVE', true)
    if (!updated) {
      throw new StaffError('STAFF_NOT_FOUND', `Staff not found after enable: ${staffId}`)
    }

    await db.query('COMMIT')

    logger.info('Staff enabled', {
      staff_id: staffId,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return updated
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
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
  audit: AuditContext
): Promise<void> {
  await db.query('BEGIN')
  try {
    const current = await findStaffById(db, workspaceId, staffId)
    if (!current) {
      throw new StaffError('STAFF_NOT_FOUND', `Staff not found: ${staffId}`)
    }

    const hasContent = await checkAuthoredContent(db, workspaceId, staffId)
    if (hasContent) {
      throw new StaffError(
        'STAFF_HAS_AUTHORED_CONTENT',
        `Cannot delete staff with authored content: ${staffId}`
      )
    }

    await softDeleteStaff(db, workspaceId, staffId)

    await db.query('COMMIT')

    logger.info('Staff deleted (soft)', {
      staff_id: staffId,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}
