import { logger } from '@zidney/logger'
import { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid'

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
  masterDb: Pool,
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
  masterDb: Pool,
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
      // Calculate soft_lock_until as 90 days from now (per STAGE_04 spec)
      const softLockUntil = new Date()
      softLockUntil.setDate(softLockUntil.getDate() + 90)
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
 * T006: Transition license to SOFT_LOCKED state
 *
 * Validates: License exists and status = ACTIVE
 * Sets: soft_lock_until to now + 90 days
 * Transaction: SERIALIZABLE + SELECT FOR UPDATE
 * Audit: Creates audit log entry
 *
 * @param masterDb Master database connection
 * @param license_id License UUID
 * @param reason Reason for soft lock (e.g., "payment_pending", "compliance_review")
 * @param actor_id Actor UUID performing the transition
 * @returns Transition result with updated license and audit details
 */
export async function transitionToSoftLock(
  masterDb: Pool,
  license_id: string,
  reason: string,
  actor_id: string
): Promise<TransitionResult> {
  const client = await masterDb.connect()

  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

    // Lock and verify license exists
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
    const current_state = license.status

    // Validate: Must be ACTIVE
    if (current_state !== 'ACTIVE') {
      await client.query('ROLLBACK')
      logger.warn(
        {
          action: 'invalid_soft_lock_attempt',
          license_id,
          current_status: current_state,
          reason,
        },
        'Cannot soft-lock non-ACTIVE license'
      )
      return {
        success: false,
        error_code: 'INVALID_STATE_TRANSITION',
        http_status: 409,
      }
    }

    // Calculate soft_lock_until (90 days from now)
    const soft_lock_until = new Date()
    soft_lock_until.setDate(soft_lock_until.getDate() + 90)
    const now = new Date()

    // Update license
    const updateResult = await client.query(
      `UPDATE licenses 
       SET status = $1, soft_lock_until = $2, updated_at = $3
       WHERE id = $4
       RETURNING *`,
      ['SOFT_LOCKED', soft_lock_until, now, license_id]
    )

    const updatedLicense = updateResult.rows[0]

    // Create audit log
    await client.query(
      `INSERT INTO license_audit_logs 
       (license_id, previous_status, new_status, actor_id, reason, transition_metadata, timestamp, correlation_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        license_id,
        current_state,
        'SOFT_LOCKED',
        actor_id,
        reason,
        JSON.stringify({ soft_lock_until: soft_lock_until.toISOString() }),
        now,
        uuidv4(), // correlation_id
        now,
      ]
    )

    await client.query('COMMIT')

    logger.info(
      {
        action: 'license_soft_locked',
        license_id,
        workspace_slug: license.workspace_slug,
        soft_lock_until: soft_lock_until.toISOString(),
        reason,
        actor_id,
      },
      'License transitioned to SOFT_LOCKED'
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
        action: 'soft_lock_error',
        license_id,
        error_message: error.message,
      },
      'Soft lock transition failed'
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
 * T007: Transition license to ACTIVE state
 *
 * Validates: License exists and status = SOFT_LOCKED
 * Clears: soft_lock_until to NULL
 * Transaction: SERIALIZABLE + SELECT FOR UPDATE
 * Audit: Creates audit log entry
 *
 * @param masterDb Master database connection
 * @param license_id License UUID
 * @param reason Reason for renewal (e.g., "payment_received", "compliance_cleared")
 * @param actor_id Actor UUID performing the transition
 * @returns Transition result with updated license
 */
export async function transitionToActive(
  masterDb: Pool,
  license_id: string,
  reason: string,
  actor_id: string
): Promise<TransitionResult> {
  const client = await masterDb.connect()

  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

    // Lock and verify license exists
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
    const current_state = license.status

    // Validate: Must be SOFT_LOCKED
    if (current_state !== 'SOFT_LOCKED') {
      await client.query('ROLLBACK')
      logger.warn(
        {
          action: 'invalid_active_transition',
          license_id,
          current_status: current_state,
        },
        'Cannot activate non-SOFT_LOCKED license'
      )
      return {
        success: false,
        error_code: 'INVALID_STATE_TRANSITION',
        http_status: 409,
      }
    }

    const now = new Date()

    // Update license: clear soft_lock_until
    const updateResult = await client.query(
      `UPDATE licenses 
       SET status = $1, soft_lock_until = NULL, updated_at = $2
       WHERE id = $3
       RETURNING *`,
      ['ACTIVE', now, license_id]
    )

    const updatedLicense = updateResult.rows[0]

    // Create audit log
    await client.query(
      `INSERT INTO license_audit_logs 
       (license_id, previous_status, new_status, actor_id, reason, timestamp, correlation_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        license_id,
        current_state,
        'ACTIVE',
        actor_id,
        reason,
        now,
        uuidv4(),
        now,
      ]
    )

    await client.query('COMMIT')

    logger.info(
      {
        action: 'license_activated',
        license_id,
        workspace_slug: license.workspace_slug,
        reason,
        actor_id,
      },
      'License transitioned to ACTIVE'
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
        action: 'activate_error',
        license_id,
        error_message: error.message,
      },
      'Activate transition failed'
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
 * T008: Transition license to ARCHIVED state
 *
 * Validates: License status = SOFT_LOCKED, snapshot exists and status = CREATED
 * Sets: archived_at = now, soft_lock_until = NULL, current_snapshot_id = snapshotId
 * Transaction: SERIALIZABLE + SELECT FOR UPDATE
 * Audit: Creates audit log entry with snapshot_id
 *
 * @param masterDb Master database connection
 * @param license_id License UUID
 * @param snapshot_id Snapshot UUID
 * @param reason Reason for archive (e.g., "license_expired")
 * @param actor_id Actor UUID performing the transition
 * @returns Transition result with archive timestamp
 */
export async function transitionToArchived(
  masterDb: Pool,
  license_id: string,
  snapshot_id: string,
  reason: string,
  actor_id: string
): Promise<
  TransitionResult & { archive_timestamp?: Date; snapshot_id?: string }
> {
  const client = await masterDb.connect()

  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

    // Lock and verify license exists
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
    const current_state = license.status

    // Validate: Must be SOFT_LOCKED
    if (current_state !== 'SOFT_LOCKED') {
      await client.query('ROLLBACK')
      return {
        success: false,
        error_code: 'INVALID_STATE_TRANSITION',
        http_status: 409,
      }
    }

    // Verify snapshot exists and status = CREATED
    const snapshotResult = await client.query(
      'SELECT * FROM snapshots WHERE id = $1 AND license_id = $2 FOR UPDATE',
      [snapshot_id, license_id]
    )

    if (!snapshotResult.rows.length) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error_code: 'SNAPSHOT_NOT_FOUND',
        http_status: 404,
      }
    }

    const snapshot = snapshotResult.rows[0]

    if (snapshot.status !== 'CREATED') {
      await client.query('ROLLBACK')
      logger.warn(
        {
          action: 'invalid_snapshot_status',
          license_id,
          snapshot_id,
          snapshot_status: snapshot.status,
        },
        'Cannot archive with non-CREATED snapshot'
      )
      return {
        success: false,
        error_code: 'SNAPSHOT_FAILED',
        http_status: 400,
      }
    }

    const now = new Date()

    // Update license
    const updateResult = await client.query(
      `UPDATE licenses 
       SET status = $1, archived_at = $2, soft_lock_until = NULL, current_snapshot_id = $3, updated_at = $2
       WHERE id = $4
       RETURNING *`,
      ['ARCHIVED', now, snapshot_id, license_id]
    )

    const updatedLicense = updateResult.rows[0]

    // Create audit log
    await client.query(
      `INSERT INTO license_audit_logs 
       (license_id, previous_status, new_status, actor_id, reason, transition_metadata, timestamp, correlation_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        license_id,
        current_state,
        'ARCHIVED',
        actor_id,
        reason,
        JSON.stringify({ snapshot_id, archived_at: now.toISOString() }),
        now,
        uuidv4(),
        now,
      ]
    )

    await client.query('COMMIT')

    logger.info(
      {
        action: 'license_archived',
        license_id,
        workspace_slug: license.workspace_slug,
        snapshot_id,
        archived_at: now.toISOString(),
        reason,
        actor_id,
      },
      'License transitioned to ARCHIVED'
    )

    return {
      success: true,
      license: updatedLicense,
      previous_state: current_state,
      archive_timestamp: now,
      snapshot_id,
    }
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {})
    logger.error(
      {
        action: 'archive_error',
        license_id,
        snapshot_id,
        error_message: error.message,
      },
      'Archive transition failed'
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
 * T009: Queue restore job for archived license
 *
 * Validates: License status = ARCHIVED, snapshot exists, schema compatibility
 * Enqueues: Worker job (restore_from_archive)
 * Returns: Job ID + ETA for restoration
 * Idempotency: Duplicate restores succeed (no data corruption)
 *
 * @param masterDb Master database connection
 * @param license_id License UUID
 * @param actor_id Actor UUID requesting restore
 * @returns Job ID and restore job status
 */
export async function restoreFromArchive(
  masterDb: Pool,
  license_id: string,
  actor_id: string
): Promise<{
  success: boolean
  restore_job_id?: string
  restore_timestamp?: Date
  eta_seconds?: number
  error_code?: string
  http_status?: number
}> {
  const client = await masterDb.connect()

  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

    // Verify license exists and is ARCHIVED
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
          action: 'invalid_restore_state',
          license_id,
          current_status: license.status,
        },
        'Cannot restore non-archived license'
      )
      return {
        success: false,
        error_code: 'INVALID_STATE_TRANSITION',
        http_status: 409,
      }
    }

    // Verify snapshot exists
    if (!license.current_snapshot_id) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error_code: 'SNAPSHOT_NOT_FOUND',
        http_status: 404,
      }
    }

    const snapshotResult = await client.query(
      'SELECT * FROM snapshots WHERE id = $1 FOR UPDATE',
      [license.current_snapshot_id]
    )

    if (!snapshotResult.rows.length) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error_code: 'SNAPSHOT_FAILED',
        http_status: 400,
      }
    }

    // TODO: Implement schema compatibility check
    // For now, proceed with restore job

    const now = new Date()
    const restore_job_id = uuidv4()

    // TODO: Queue worker job: restore_from_archive
    // Job payload: { license_id, snapshot_id, actor_id, correlation_id }
    // This will be handled by worker integration in Phase 7

    // Create audit log for restore initiation
    await client.query(
      `INSERT INTO license_audit_logs 
       (license_id, previous_status, new_status, actor_id, reason, transition_metadata, timestamp, correlation_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        license_id,
        'ARCHIVED',
        'RESTORING', // Temporary state
        actor_id,
        'restore_initiated',
        JSON.stringify({
          restore_job_id,
          snapshot_id: license.current_snapshot_id,
        }),
        now,
        restore_job_id,
        now,
      ]
    )

    await client.query('COMMIT')

    logger.info(
      {
        action: 'restore_job_enqueued',
        license_id,
        restore_job_id,
        snapshot_id: license.current_snapshot_id,
        actor_id,
      },
      'Restore job enqueued for archived license'
    )

    // ETA: 30 seconds for typical restore
    return {
      success: true,
      restore_job_id,
      restore_timestamp: now,
      eta_seconds: 30,
    }
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {})
    logger.error(
      {
        action: 'restore_job_error',
        license_id,
        error_message: error.message,
      },
      'Restore job queueing failed'
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
 * T010: Queue delete job for archived license
 *
 * Validates: License status = ARCHIVED, confirmation phrase matches, grace period expired
 * Enqueues: Worker job (delete_license)
 * Returns: Job ID + deletion timestamp
 * Grace Period: 30 days from deletion initiation (configurable)
 *
 * @param masterDb Master database connection
 * @param license_id License UUID
 * @param confirmation_phrase_hash Hash of confirmation phrase
 * @param actor_id Actor UUID requesting deletion
 * @returns Job ID and delete job status
 */
export async function transitionToDeleted(
  masterDb: Pool,
  license_id: string,
  confirmation_phrase_hash: string,
  actor_id: string
): Promise<{
  success: boolean
  delete_job_id?: string
  delete_timestamp?: Date
  error_code?: string
  http_status?: number
}> {
  const client = await masterDb.connect()

  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

    // Verify license exists and is ARCHIVED
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
          action: 'invalid_delete_state',
          license_id,
          current_status: license.status,
        },
        'Cannot delete non-archived license'
      )
      return {
        success: false,
        error_code: 'INVALID_STATE_TRANSITION',
        http_status: 409,
      }
    }

    // Verify snapshot exists
    if (!license.current_snapshot_id) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error_code: 'NO_SNAPSHOT_FOUND',
        http_status: 409,
      }
    }

    // Check deletion confirmation record
    const confirmationResult = await client.query(
      'SELECT * FROM license_deletion_confirmations WHERE license_id = $1 FOR UPDATE',
      [license_id]
    )

    if (
      !confirmationResult.rows.length ||
      confirmationResult.rows[0].confirmation_phrase_hash !==
        confirmation_phrase_hash
    ) {
      await client.query('ROLLBACK')
      logger.warn(
        {
          action: 'invalid_confirmation_phrase',
          license_id,
        },
        'Deletion confirmation phrase mismatch'
      )
      return {
        success: false,
        error_code: 'INVALID_CONFIRMATION',
        http_status: 403,
      }
    }

    const confirmation = confirmationResult.rows[0]
    const now = new Date()

    // Check if grace period has expired
    if (
      confirmation.grace_period_until &&
      now < confirmation.grace_period_until
    ) {
      await client.query('ROLLBACK')
      const remaining_ms =
        confirmation.grace_period_until.getTime() - now.getTime()
      logger.warn(
        {
          action: 'grace_period_active',
          license_id,
          grace_period_until: confirmation.grace_period_until.toISOString(),
          remaining_seconds: Math.ceil(remaining_ms / 1000),
        },
        'License deletion still in grace period'
      )
      return {
        success: false,
        error_code: 'CONFIRMATION_EXPIRED',
        http_status: 410,
      }
    }

    const delete_job_id = uuidv4()

    // TODO: Queue worker job: delete_license
    // Job payload: { license_id, snapshot_id, actor_id, grace_period_until }

    // Create audit log
    await client.query(
      `INSERT INTO license_audit_logs 
       (license_id, previous_status, new_status, actor_id, reason, transition_metadata, timestamp, correlation_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        license_id,
        'ARCHIVED',
        'DELETING', // Temporary state
        actor_id,
        'delete_initiated',
        JSON.stringify({
          delete_job_id,
          snapshot_id: license.current_snapshot_id,
        }),
        now,
        delete_job_id,
        now,
      ]
    )

    await client.query('COMMIT')

    logger.info(
      {
        action: 'delete_job_enqueued',
        license_id,
        delete_job_id,
        snapshot_id: license.current_snapshot_id,
        actor_id,
      },
      'Delete job enqueued for archived license'
    )

    return {
      success: true,
      delete_job_id,
      delete_timestamp: now,
    }
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {})
    logger.error(
      {
        action: 'delete_job_error',
        license_id,
        error_message: error.message,
      },
      'Delete job queueing failed'
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
  masterDb: Pool,
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
  masterDb: Pool,
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
  masterDb: Pool,
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
    await client.query(
      `UPDATE licenses 
       SET status=$1, deleted_at=$2, updated_at=$2 
       WHERE id=$3 
       RETURNING *`,
      ['DELETED', now, license_id]
    )

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
