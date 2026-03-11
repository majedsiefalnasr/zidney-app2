import { StudentStaffCounter } from '@zidney/domain-core/license'
import { createLogger } from '@zidney/logger'
import type { Pool, PoolClient } from 'pg'

const logger = createLogger('transaction-wrapper')

export interface UserCreationOptions {
  workspace_id: string
  user_id: string
  role: 'STUDENT' | 'STAFF'
  name: string
  email: string
  limit?: number | null
  license_id?: string
}

export interface TransactionResult {
  success: boolean
  user_id?: string
  error_code?: string
  http_status?: number
}

/**
 * Transaction wrapper for user creation with limit enforcement
 *
 * Ensures atomicity:
 * 1. SELECT FOR UPDATE on licenses row (lock)
 * 2. Count current students/staff (per role)
 * 3. Check against limit
 * 4. INSERT user if limit not exceeded
 * 5. UPDATE licenses.updated_at (bust cache)
 * 6. COMMIT
 *
 * Isolation: SERIALIZABLE prevents concurrent limit violations
 *
 * @param masterDb Master database connection
 * @param tenantDb Tenant database connection
 * @param options User creation parameters
 * @returns Transaction result with user_id or error
 */
export async function createUserWithLimitCheck(
  masterDb: Pool,
  tenantDb: Pool,
  options: UserCreationOptions
): Promise<TransactionResult> {
  const masterClient: PoolClient = await masterDb.connect()
  const tenantClient: PoolClient = await tenantDb.connect()

  try {
    // Begin transaction with SERIALIZABLE isolation on both DBs
    await masterClient.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
    await tenantClient.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

    // Step 1: Lock license row (prevents concurrent state changes)
    const licenseResult = await masterClient.query(
      'SELECT * FROM licenses WHERE workspace_id = $1 FOR UPDATE',
      [options.workspace_id]
    )

    if (!licenseResult.rows.length) {
      await masterClient.query('ROLLBACK')
      await tenantClient.query('ROLLBACK')
      return {
        success: false,
        error_code: 'LICENSE_NOT_FOUND',
        http_status: 404,
      }
    }

    const license = licenseResult.rows[0]

    // Verify license is ACTIVE
    if (license.status !== 'ACTIVE') {
      await masterClient.query('ROLLBACK')
      await tenantClient.query('ROLLBACK')

      let errorCode = 'LICENSE_SOFT_LOCKED'
      let httpStatus = 423

      if (license.status === 'ARCHIVED' || license.status === 'DELETED') {
        errorCode = 'LICENSE_ARCHIVED'
        httpStatus = 403
      }

      return {
        success: false,
        error_code: errorCode,
        http_status: httpStatus,
      }
    }

    // Step 2 & 3: Count current users and check limit
    const counter = new StudentStaffCounter()
    let currentCount: number
    let limit: number | null

    if (options.role === 'STUDENT') {
      currentCount = await counter.countStudents(tenantDb, options.workspace_id)
      limit = license.student_limit
    } else {
      currentCount = await counter.countStaff(tenantDb, options.workspace_id)
      limit = license.staff_limit
    }

    // Check if limit exceeded
    const canAdd = counter.canAddStudent(currentCount, limit)
    if (!canAdd && options.role === 'STUDENT') {
      await masterClient.query('ROLLBACK')
      await tenantClient.query('ROLLBACK')

      logger.warn('Student limit exceeded during user creation', {
        action: 'user_creation_limit_exceeded',
        workspace_id: options.workspace_id,
        role: options.role,
        current_count: currentCount,
        limit,
        error_code: 'LIMIT_EXCEEDED',
      })

      return {
        success: false,
        error_code: 'LIMIT_EXCEEDED',
        http_status: 402, // Payment Required (indicates upgrade needed)
      }
    }

    const canAddStaff = counter.canAddStaff(currentCount, limit)
    if (!canAddStaff && options.role === 'STAFF') {
      await masterClient.query('ROLLBACK')
      await tenantClient.query('ROLLBACK')

      logger.warn('Staff limit exceeded during user creation', {
        action: 'user_creation_limit_exceeded',
        workspace_id: options.workspace_id,
        role: options.role,
        current_count: currentCount,
        limit,
        error_code: 'LIMIT_EXCEEDED',
      })

      return {
        success: false,
        error_code: 'LIMIT_EXCEEDED',
        http_status: 402,
      }
    }

    // Step 4: Insert user into tenant DB
    const now = new Date()
    const insertResult = await tenantClient.query(
      `INSERT INTO users (
        id, workspace_id, name, email, role, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        options.user_id,
        options.workspace_id,
        options.name,
        options.email,
        options.role,
        'ENABLED',
        now,
        now,
      ]
    )

    const userId = insertResult.rows[0].id

    // Step 5: Update licenses.updated_at to bust resolver cache
    await masterClient.query('UPDATE licenses SET updated_at = $1 WHERE id = $2', [now, license.id])

    // Step 6: Commit both transactions
    await masterClient.query('COMMIT')
    await tenantClient.query('COMMIT')

    logger.info('User created with limit enforcement', {
      action: 'user_created_with_limit_check',
      workspace_id: options.workspace_id,
      user_id: userId,
      role: options.role,
      current_count: currentCount,
      limit,
    })

    return {
      success: true,
      user_id: userId,
    }
  } catch (error: unknown) {
    await masterClient.query('ROLLBACK').catch(() => {})
    await tenantClient.query('ROLLBACK').catch(() => {})

    logger.error('User creation transaction failed', {
      action: 'user_creation_transaction_error',
      workspace_id: options.workspace_id,
      role: options.role,
      error_message: error instanceof Error ? error.message : String(error),
    })

    return {
      success: false,
      error_code: 'INTERNAL_ERROR',
      http_status: 500,
    }
  } finally {
    masterClient.release()
    tenantClient.release()
  }
}

/**
 * Soft-delete a user (mark as DISABLED instead of deleting)
 *
 * @param tenantDb Tenant database connection
 * @param user_id User UUID
 * @returns Success or error
 */
export async function softDeleteUser(tenantDb: Pool, user_id: string): Promise<TransactionResult> {
  try {
    const result = await tenantDb.query(
      "UPDATE users SET status = 'DISABLED', updated_at = NOW() WHERE id = $1 RETURNING id",
      [user_id]
    )

    if (!result.rows.length) {
      return {
        success: false,
        error_code: 'USER_NOT_FOUND',
        http_status: 404,
      }
    }

    logger.info('User soft-deleted', {
      action: 'user_soft_deleted',
      user_id,
    })

    return {
      success: true,
      user_id,
    }
  } catch (error: unknown) {
    logger.error('User soft-delete failed', {
      action: 'user_soft_delete_error',
      user_id,
      error_message: error instanceof Error ? error.message : String(error),
    })

    return {
      success: false,
      error_code: 'INTERNAL_ERROR',
      http_status: 500,
    }
  }
}
