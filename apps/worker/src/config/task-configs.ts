/**
 * Worker Task Configurations
 *
 * Defines retry policies, timeouts, and DLQ routing for all worker tasks.
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 * Task: T027 (retry policy definition)
 */

export interface TaskRetryPolicy {
  maxRetries: number
  backoffDelays: number[] // milliseconds
  dlqEscalation: boolean
  skipRetryOn?: string[] // Error codes/flags that bypass retry
}

export interface TaskTimeoutConfig {
  lockTimeout: string // PostgreSQL SET LOCAL lock_timeout
  statementTimeout: string // PostgreSQL SET LOCAL statement_timeout
}

export interface TaskConfig {
  taskType: string
  retryPolicy: TaskRetryPolicy
  timeouts: TaskTimeoutConfig
  dlqBehavior: {
    escalateOn?: string[]
    alertOn: string[]
    manualReviewRequired: boolean
  }
}

// ============================================================================
// INIT_TENANT_SCHEMA Task Configuration
// ============================================================================

export const INIT_TENANT_SCHEMA_CONFIG: TaskConfig = {
  taskType: 'INIT_TENANT_SCHEMA',

  // Retry Policy
  retryPolicy: {
    maxRetries: 3,
    // Exponential backoff sequence
    backoffDelays: [
      2000, // 1st retry: 2 seconds
      4000, // 2nd retry: 4 seconds
      8000, // 3rd retry: 8 seconds
    ],
    dlqEscalation: true,
    // CRITICAL: NO RETRY on tampering or lock timeout
    skipRetryOn: ['tampering_detected', 'lock_timeout_exceeded'],
  },

  // PostgreSQL Timeouts (SET LOCAL per connection)
  timeouts: {
    // Lock timeout: 5s (prevents hanging on stuck migrations)
    // If exceeded: Immediate DLQ escalation, NO RETRY (suspicious activity)
    lockTimeout: '5s',

    // Statement timeout: 30s (prevents hung transactions blocking other tenants)
    // If exceeded: Transaction rolls back, eligible for retry
    statementTimeout: '30000', // PostgreSQL uses milliseconds
  },

  // DLQ Behavior
  dlqBehavior: {
    escalateOn: [
      'checksum_mismatch', // Tampering detected
      'lock_timeout', // Suspicious activity
      'max_retries_exceeded', // Migration genuinely failed
      'critical_error', // Unrecoverable error
    ],
    alertOn: [
      'checksum_mismatch', // CRITICAL: Security incident
      'lock_timeout', // CRITICAL: Suspicious activity
      'max_retries_exceeded', // WARN: Investigate
    ],
    manualReviewRequired: true, // Admin must investigate DLQ items
  },
}

// ============================================================================
// APPLY_MIGRATION Task Configuration (for future use)
// ============================================================================

export const APPLY_MIGRATION_CONFIG: TaskConfig = {
  taskType: 'APPLY_MIGRATION',

  retryPolicy: {
    maxRetries: 3,
    backoffDelays: [2000, 4000, 8000],
    dlqEscalation: true,
    skipRetryOn: ['schema_version_mismatch', 'downgrade_attempt'],
  },

  timeouts: {
    lockTimeout: '5s',
    statementTimeout: '30000',
  },

  dlqBehavior: {
    escalateOn: [
      'schema_version_mismatch',
      'downgrade_attempt',
      'max_retries_exceeded',
    ],
    alertOn: ['schema_version_mismatch', 'max_retries_exceeded'],
    manualReviewRequired: true,
  },
}

// ============================================================================
// Worker Task Result Handlers
// ============================================================================

/**
 * Determine retry action based on task result
 *
 * @param taskType - Task identifier
 * @param result - Task execution result
 * @param attemptNumber - Current attempt count (1 = first attempt)
 * @returns Action to take: RETRY, DLQ, or SUCCESS
 */
export function determineTaskAction(
  taskType: string,
  result: { status: string; tampering_detected?: boolean; error?: string },
  attemptNumber: number
): 'RETRY' | 'DLQ' | 'SUCCESS' {
  const config =
    taskType === 'INIT_TENANT_SCHEMA'
      ? INIT_TENANT_SCHEMA_CONFIG
      : APPLY_MIGRATION_CONFIG

  // SUCCESS: No action needed
  if (result.status === 'SUCCESS') {
    return 'SUCCESS'
  }

  // TAMPERING DETECTED: Escalate immediately to DLQ, NO RETRY
  if (result.tampering_detected) {
    return 'DLQ'
  }

  // Check if error is in skipRetryOn list
  if (result.error && config.retryPolicy.skipRetryOn) {
    for (const skipError of config.retryPolicy.skipRetryOn) {
      if (result.error.includes(skipError)) {
        return 'DLQ'
      }
    }
  }

  // Check if max retries exceeded
  if (attemptNumber > config.retryPolicy.maxRetries) {
    return 'DLQ'
  }

  // RETRY: Use exponential backoff
  return 'RETRY'
}

/**
 * Get next retry delay
 *
 * @param taskType - Task identifier
 * @param attemptNumber - Current attempt (1 = first)
 * @returns Delay in milliseconds
 */
export function getRetryDelay(taskType: string, attemptNumber: number): number {
  const config =
    taskType === 'INIT_TENANT_SCHEMA'
      ? INIT_TENANT_SCHEMA_CONFIG
      : APPLY_MIGRATION_CONFIG

  // attemptNumber = 1 means we've already tried once, next retry is backoffDelays[0]
  const retryIndex = attemptNumber - 1

  if (retryIndex >= config.retryPolicy.backoffDelays.length) {
    // Max retries exceeded - caller should route to DLQ
    return 0
  }

  return config.retryPolicy.backoffDelays[retryIndex]!
}

/**
 * Determine if alert should be sent to operations team
 *
 * @param taskType - Task identifier
 * @param result - Task result
 * @param attemptNumber - Current attempt
 * @returns true if alert should be sent
 */
export function shouldAlertOps(
  taskType: string,
  result: { status: string; error?: string },
  attemptNumber: number
): boolean {
  const config =
    taskType === 'INIT_TENANT_SCHEMA'
      ? INIT_TENANT_SCHEMA_CONFIG
      : APPLY_MIGRATION_CONFIG

  // Check if result contains alert-trigger error codes
  if (result.error) {
    for (const alertTrigger of config.dlqBehavior.alertOn) {
      if (result.error.includes(alertTrigger)) {
        return true
      }
    }
  }

  // Check if max retries exceeded
  if (attemptNumber > config.retryPolicy.maxRetries) {
    return config.dlqBehavior.alertOn.includes('max_retries_exceeded')
  }

  return false
}

// ============================================================================
// DLQ (Dead Letter Queue) Routing Rules
// ============================================================================

export interface DLQMessage {
  taskType: string
  taskId: string
  workspaceId: string
  payload: Record<string, any>
  result: Record<string, any>
  attemptCount: number
  lastError: string
  timestamp: string
  requiresManualReview: boolean
  alertLevel: 'CRITICAL' | 'WARN' | 'INFO'
}

/**
 * Create DLQ message with proper metadata for ops investigation
 */
export function createDLQMessage(
  taskType: string,
  taskId: string,
  workspaceId: string,
  payload: Record<string, any>,
  result: Record<string, any>,
  attemptCount: number
): DLQMessage {
  const config =
    taskType === 'INIT_TENANT_SCHEMA'
      ? INIT_TENANT_SCHEMA_CONFIG
      : APPLY_MIGRATION_CONFIG

  // Determine alert level
  let alertLevel: 'CRITICAL' | 'WARN' | 'INFO' = 'INFO'
  if (result.tampering_detected || result.error?.includes('tampering')) {
    alertLevel = 'CRITICAL'
  } else if (attemptCount >= config.retryPolicy.maxRetries) {
    alertLevel = 'WARN'
  }

  return {
    taskType,
    taskId,
    workspaceId,
    payload,
    result,
    attemptCount,
    lastError: result.error || 'Unknown error',
    timestamp: new Date().toISOString(),
    requiresManualReview: config.dlqBehavior.manualReviewRequired,
    alertLevel,
  }
}

export default {
  INIT_TENANT_SCHEMA_CONFIG,
  APPLY_MIGRATION_CONFIG,
  determineTaskAction,
  getRetryDelay,
  shouldAlertOps,
  createDLQMessage,
}
