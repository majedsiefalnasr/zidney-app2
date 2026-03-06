/**
 * T057: DLQ Handler for Migration Failures
 * Processes failed migrations from dead letter queue
 * Special handling for tampering detection (no retry ever)
 */

export interface FailedMigrationTask {
  task_id: string
  workspace_id: string
  from_version: string
  to_version: string
  error_message: string
  retry_count: number
  tampering_detected?: boolean
  error_code?: string
}

/**
 * Process failed migration from DLQ
 */
export async function processMigrationDLQ(
  task: FailedMigrationTask,
  logger?: any,
  alertService?: any
): Promise<void> {
  logger?.log('error', 'Processing failed migration from DLQ', {
    task_id: task.task_id,
    workspace_id: task.workspace_id,
    retry_count: task.retry_count,
  })

  // CRITICAL: Check for tampering flag
  if (task.tampering_detected || task.error_code === 'CHECKSUM_MISMATCH') {
    logger?.log('critical', 'TAMPERING DETECTED - ESCALATING TO SECURITY TEAM', {
      task_id: task.task_id,
      workspace_id: task.workspace_id,
      from_version: task.from_version,
      to_version: task.to_version,
    })

    // Alert security team
    if (alertService) {
      try {
        await alertService.sendAlert({
          severity: 'CRITICAL',
          title: 'MIGRATION TAMPERING DETECTED',
          message: `Migration checksum mismatch on workspace ${task.workspace_id}. Possible malicious modification.`,
          workspace_id: task.workspace_id,
          task_id: task.task_id,
        })
      } catch (err: any) {
        logger?.log('error', 'Failed to send tampering alert', {
          error: err.message,
        })
      }
    }

    // Create incident ticket (requires ticket system integration)
    logger?.log('debug', 'Incident ticket would be created for tampering')

    // Return without retry
    return
  }

  // Non-tampering failures: log for manual investigation
  logger?.log('error', 'Migration failed - manual investigation required', {
    task_id: task.task_id,
    error: task.error_message,
    retry_count: task.retry_count,
  })

  // Update workspace status (if tracking)
  // await markWorkspaceMigrationFailed(task.workspace_id, task.error_message)

  // Create support ticket for manual investigation
  logger?.log('debug', 'Support ticket would be created for migration failure')

  // Alert infrastructure team
  if (alertService) {
    try {
      await alertService.sendAlert({
        severity: 'HIGH',
        title: 'MIGRATION FAILURE',
        message: `Migration failed on workspace ${task.workspace_id}: ${task.error_message}`,
        workspace_id: task.workspace_id,
        task_id: task.task_id,
      })
    } catch (err: any) {
      logger?.log('error', 'Failed to send migration failure alert', {
        error: err.message,
      })
    }
  }
}

/**
 * Classify migration failure
 */
export function classifyMigrationFailure(error: string): {
  type: 'TAMPERING' | 'TRANSIENT' | 'PERMANENT' | 'UNKNOWN'
  retryable: boolean
} {
  if (error.includes('Checksum mismatch') || error.includes('TAMPERING')) {
    return { type: 'TAMPERING', retryable: false }
  }

  if (error.includes('lock timeout') || error.includes('connection refused')) {
    return { type: 'TRANSIENT', retryable: true }
  }

  if (
    error.includes('syntax error') ||
    error.includes('column') ||
    error.includes('constraint violation')
  ) {
    return { type: 'PERMANENT', retryable: false }
  }

  return { type: 'UNKNOWN', retryable: false }
}

/**
 * Export audit trail for failed migration
 */
export function generateMigrationFailureReport(task: FailedMigrationTask): string {
  return `
=== MIGRATION FAILURE REPORT ===
Task ID: ${task.task_id}
Workspace: ${task.workspace_id}
Migration: ${task.from_version} → ${task.to_version}
Retry Count: ${task.retry_count}
Tampering Detected: ${task.tampering_detected ? 'YES' : 'NO'}
Error Code: ${task.error_code || 'UNKNOWN'}
Error Message: ${task.error_message}
Timestamp: ${new Date().toISOString()}

RECOMMENDED ACTION:
${
  task.tampering_detected
    ? '1. ESCALATE TO SECURITY TEAM IMMEDIATELY'
    : '1. Review migration file for errors\n2. Check workspace database state\n3. Retry or rollback to snapshot'
}
================================
`
}
