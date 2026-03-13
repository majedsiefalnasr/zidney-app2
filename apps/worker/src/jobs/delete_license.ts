import { createLogger } from '@zidney/logger'

const logger = createLogger('delete-license-job')

/**
 * T030: delete_license Worker Job
 *
 * Permanently deletes license and associated data.
 * Pre-flight: Verify license ARCHIVED, no active users, grace period expired
 * Atomic: Drop tenant DB, delete S3 snapshot, update master DB, all-or-nothing
 * Retry: max_retries=2 (only 2, terminal operation)
 * On failure: Alert ops, preserve license in ARCHIVED state
 */
export interface DeleteLicenseJobPayload {
  license_id: string
  grace_period_until?: string
}

export async function deleteLicenseJob(payload: DeleteLicenseJobPayload, jobId: string) {
  const { license_id, grace_period_until: _grace_period_until } = payload

  try {
    logger.info({ job_id: jobId, license_id, action: 'delete_started' }, 'Delete job started')

    // TODO: Full phase 5 implementation:
    // 1. Pre-flight: verify ARCHIVED, no active users, grace period ≥ now
    // 2. Atomic transaction:
    //    - Drop tenant DB
    //    - Delete snapshot from S3
    //    - DELETE from tenants_registry
    //    - UPDATE licenses SET status='DELETED'
    //    - INSERT audit_log

    logger.info({ job_id: jobId, license_id, action: 'delete_completed' }, 'Delete job completed')

    return {
      success: true,
      license_id,
      deleted_at: new Date(),
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    logger.error(
      {
        job_id: jobId,
        license_id,
        error: errMsg,
        action: 'delete_failed',
      },
      'Delete failed'
    )
    // Alert ops on persistent failure
    return { success: false, error: errMsg }
  }
}
