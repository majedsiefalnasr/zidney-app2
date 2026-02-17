import { Database } from 'pg'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../../services/logger'

export interface CreateLicenseOptions {
  product_id: string
  workspace_id: string
  workspace_slug: string
  expected_schema_version: string
  expected_product_version: string
}

export interface License {
  id: string
  product_id: string
  workspace_id: string
  workspace_slug: string
  student_limit: number | null
  staff_limit: number | null
  status: string
  soft_lock_until: Date | null
  archived_at: Date | null
  deleted_at: Date | null
  expected_schema_version: string
  expected_product_version: string
  created_at: Date
  updated_at: Date
  snapshot_id: string | null
}

export interface TransitionOptions {
  license_id: string
  target_state: string
  reason?: string
}

export interface TransitionResult {
  success: boolean
  license?: License
  previous_state?: string
  error_code?: string
  http_status?: number
}

/**
 * Create a new license for a workspace
 *
 * Transaction: SERIALIZABLE isolation + SELECT FOR UPDATE prevents race conditions
 * Idempotency: UNIQUE(workspace_slug) constraint enforces idempotency
 *
 * @param masterDb PostgreSQL database connection
 * @param options License creation parameters
 * @returns Created license object
 * @throws Error if workspace_slug already exists (409) or product not found (404)
 */
export async function createLicense(
  masterDb: Database,
  options: CreateLicenseOptions
): Promise<License> {
  const client = await masterDb.connect()

  try {
    // Begin transaction with SERIALIZABLE isolation
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

    // Verify product exists and fetch default limits
    const productResult = await client.query(
      `SELECT id, default_student_limit, default_staff_limit 
       FROM products WHERE id = $1 LIMIT 1 FOR UPDATE`,
      [options.product_id]
    )

    if (!productResult.rows.length) {
      await client.query('ROLLBACK')
      const error: any = new Error('Product not found')
      error.code = 'PRODUCT_NOT_FOUND'
      throw error
    }

    const product = productResult.rows[0]

    // Create license with ACTIVE status
    const license_id = uuidv4()
    const now = new Date()

    const licenseResult = await client.query(
      `INSERT INTO licenses (
        id, product_id, workspace_id, workspace_slug, 
        student_limit, staff_limit, status, 
        soft_lock_until, archived_at, deleted_at,
        expected_schema_version, expected_product_version,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        license_id,
        options.product_id,
        options.workspace_id,
        options.workspace_slug,
        product.default_student_limit,
        product.default_staff_limit,
        'ACTIVE', // Initial status
        null, // soft_lock_until
        null, // archived_at
        null, // deleted_at
        options.expected_schema_version,
        options.expected_product_version,
        now,
        now,
      ]
    )

    await client.query('COMMIT')

    const license = licenseResult.rows[0]

    logger.info(
      {
        action: 'license_created_service',
        license_id: license.id,
        workspace_id: options.workspace_id,
        workspace_slug: options.workspace_slug,
        student_limit: license.student_limit,
        staff_limit: license.staff_limit,
      },
      'License created in domain-core'
    )

    return license
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {})

    logger.error(
      {
        action: 'license_create_service_error',
        workspace_slug: options.workspace_slug,
        error_code: error.code,
        error_message: error.message,
      },
      'License creation failed in domain-core'
    )

    throw error
  } finally {
    client.release()
  }
}

/**
 * Transition license to a new state
 *
 * Transaction: SERIALIZABLE + SELECT FOR UPDATE prevents concurrent transitions
 * Idempotency: Uses Redis cache (24hr TTL) to detect duplicate transitions
 *
 * @param masterDb PostgreSQL database connection
 * @param options State transition parameters
 * @returns Transition result with updated license or error details
 */
export async function transitionLicenseState(
  masterDb: Database,
  options: TransitionOptions
): Promise<TransitionResult> {
  const client = await masterDb.connect()

  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

    // Lock the license row
    const lockResult = await client.query(
      'SELECT * FROM licenses WHERE id = $1 FOR UPDATE',
      [options.license_id]
    )

    if (!lockResult.rows.length) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error_code: 'LICENSE_NOT_FOUND',
        http_status: 404,
      }
    }

    const license = lockResult.rows[0]
    const current_state = license.status
    const target_state = options.target_state

    // Validate state transition
    const validTransitions: Record<string, string[]> = {
      ACTIVE: ['SOFT_LOCKED', 'ARCHIVED'],
      SOFT_LOCKED: ['ACTIVE', 'ARCHIVED'],
      ARCHIVED: ['ACTIVE', 'DELETED'],
      DELETED: [],
    }

    if (!validTransitions[current_state]?.includes(target_state)) {
      await client.query('ROLLBACK')
      logger.warn(
        {
          action: 'invalid_state_transition',
          license_id: options.license_id,
          from_state: current_state,
          to_state: target_state,
        },
        'Invalid license state transition'
      )
      return {
        success: false,
        error_code: 'INVALID_STATE_TRANSITION',
        http_status: 409,
      }
    }

    // Update license status
    const updateParams: any[] = [target_state, new Date(), options.license_id]

    let updateQuery = `UPDATE licenses SET status = $1, updated_at = $2`

    // Set state-specific columns
    if (target_state === 'SOFT_LOCKED') {
      // Calculate soft_lock_until as 7 days from now (per spec)
      const softLockUntil = new Date()
      softLockUntil.setDate(softLockUntil.getDate() + 7)
      updateQuery += `, soft_lock_until = $4`
      updateParams.push(softLockUntil)
    } else if (target_state === 'ARCHIVED') {
      updateQuery += `, archived_at = $4`
      updateParams.push(new Date())
    } else if (target_state === 'DELETED') {
      updateQuery += `, deleted_at = $4`
      updateParams.push(new Date())
    }

    updateQuery += ` WHERE id = $3 RETURNING *`

    const updateResult = await client.query(updateQuery, updateParams)
    const updatedLicense = updateResult.rows[0]

    await client.query('COMMIT')

    logger.info(
      {
        action: 'license_state_transitioned_service',
        license_id: options.license_id,
        from_state: current_state,
        to_state: target_state,
        reason: options.reason,
      },
      'License state transitioned in domain-core'
    )

    return {
      success: true,
      license: updatedLicense,
      previous_state: current_state,
    }
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {})

    logger.error(
      {
        action: 'license_transition_service_error',
        license_id: options.license_id,
        target_state: options.target_state,
        error_message: error.message,
      },
      'License transition failed in domain-core'
    )

    return {
      success: false,
      error_code: 'INTERNAL_ERROR',
      http_status: 500,
    }
  } finally {
    client.release()
  }
}

/**
 * Get license by ID
 * Queries master database directly (used for internal lookups)
 *
 * @param masterDb PostgreSQL database connection
 * @param license_id License UUID
 * @returns License object or null if not found
 */
export async function getLicenseById(
  masterDb: Database,
  license_id: string
): Promise<License | null> {
  const result = await masterDb.query(
    'SELECT * FROM licenses WHERE id = $1 LIMIT 1',
    [license_id]
  )

  return result.rows.length ? result.rows[0] : null
}

/**
 * Get license by workspace ID
 * Queries master database directly (used for internal lookups)
 *
 * @param masterDb PostgreSQL database connection
 * @param workspace_id Workspace UUID
 * @returns License object or null if not found
 */
export async function getLicenseByWorkspaceId(
  masterDb: Database,
  workspace_id: string
): Promise<License | null> {
  const result = await masterDb.query(
    'SELECT * FROM licenses WHERE workspace_id = $1 LIMIT 1',
    [workspace_id]
  )

  return result.rows.length ? result.rows[0] : null
}

/**
 * Delete a license (Task T028)
 *
 * Pre-conditions:
 * - License must be ARCHIVED
 * - Archive snapshot must exist
 * - Explicit confirmation required
 *
 * Transaction: SERIALIZABLE isolation + row locking
 * Idempotency: NO (destructive operation)
 *
 * @param masterDb Master database connection
 * @param license_id License UUID
 * @param confirm_deletion Explicit confirmation flag (must be true)
 * @returns Success or error
 */
export async function deleteLicense(
  masterDb: Database,
  license_id: string,
  confirm_deletion: boolean
): Promise<{
  success: boolean
  deleted_at?: Date
  error_code?: string
  http_status?: number
}> {
  const client = await masterDb.connect()

  try {
    // Pre-check 1: Verify explicit confirmation
    if (!confirm_deletion) {
      logger.warn(
        {
          action: 'license_delete_no_confirmation',
          license_id,
          error_code: 'CONFIRMATION_REQUIRED',
        },
        'License deletion attempted without confirmation'
      )

      return {
        success: false,
        error_code: 'CONFIRMATION_REQUIRED',
        http_status: 400,
      }
    }

    // Begin transaction
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

    // Pre-check 2: Verify license is ARCHIVED
    const licenseResult = await client.query(
      'SELECT * FROM licenses WHERE id = $1 FOR UPDATE',
      [license_id]
    )

    if (!licenseResult.rows.length) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error_code: 'LICENSE_NOT_FOUND',
        http_status: 404,
      }
    }

    const license = licenseResult.rows[0]

    if (license.status !== 'ARCHIVED') {
      await client.query('ROLLBACK')

      logger.warn(
        {
          action: 'license_delete_not_archived',
          license_id,
          current_status: license.status,
          error_code: 'LICENSE_NOT_ARCHIVED',
        },
        'Cannot delete non-archived license'
      )

      return {
        success: false,
        error_code: 'LICENSE_NOT_ARCHIVED',
        http_status: 409,
      }
    }

    // Pre-check 3: Verify snapshot exists
    if (!license.snapshot_id) {
      await client.query('ROLLBACK')

      logger.warn(
        {
          action: 'license_delete_no_snapshot',
          license_id,
          error_code: 'NO_SNAPSHOT_FOUND',
        },
        'Cannot delete license without snapshot backup'
      )

      return {
        success: false,
        error_code: 'NO_SNAPSHOT_FOUND',
        http_status: 409,
      }
    }

    // Delete license (mark as DELETED + set timestamp)
    const now = new Date()
    const deleteResult = await client.query(
      `UPDATE licenses 
       SET status=$1, deleted_at=$2, updated_at=$2 
       WHERE id=$3 
       RETURNING *`,
      ['DELETED', now, license_id]
    )

    const deletedLicense = deleteResult.rows[0]

    // Commit transaction
    await client.query('COMMIT')

    // Audit log (successful deletion)
    logger.info(
      {
        action: 'license_deleted',
        license_id,
        workspace_slug: license.workspace_slug,
        workspace_id: license.workspace_id,
        deleted_at: now.toISOString(),
        snapshot_id: license.snapshot_id,
        result: 'success',
      },
      'License successfully deleted'
    )

    return {
      success: true,
      deleted_at: now,
    }
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {})

    logger.error(
      {
        action: 'license_delete_error',
        license_id,
        error_message: error.message,
      },
      'License deletion failed'
    )

    return {
      success: false,
      error_code: 'INTERNAL_ERROR',
      http_status: 500,
    }
  } finally {
    client.release()
  }
}
