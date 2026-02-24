/**
 * Worker logger singleton with job scope injection.
 *
 * Uses @zidney/logger package as the single logging implementation.
 * Enables dual ID tracking: request_id (from API) + job_id (per job execution).
 *
 * Structure:
 * - Global singleton: `getLogger()` returns process-wide logger
 * - Child binding: `getJobLogger(job)` creates job-scoped child logger
 * - Context injection: All logs automatically include injected fields (no manual params)
 */

import { createLogger, type Logger } from '@zidney/logger'
import { JobEnvelope } from '@zidney/types/job-envelope'

/**
 * Global logger singleton.
 * Instantiated once per worker service process.
 */
const logger: Logger = createLogger(process.env.SERVICE_NAME || 'worker')

/**
 * Get the global logger instance (singleton).
 *
 * @returns Logger singleton
 */
export function getLogger(): Logger {
  return logger
}

/**
 * Create job-scoped child logger with dual ID binding.
 *
 * Child logger automatically injects all job context fields:
 * - job_id: Unique identifier per job execution
 * - request_id: Inherited from API request
 * - workspace_id: For workspace isolation
 * - user_id: User who triggered job (optional)
 * - job_name: Job type label
 * - attempt_id: For attempt-specific jobs (optional)
 *
 * All logs within job processing include these fields automatically.
 *
 * @param job - Job envelope
 * @returns Child logger with injected context
 */
export function getJobLogger(job: JobEnvelope): Logger {
  const context: Record<string, unknown> = {
    job_id: job.job_id,
    request_id: job.request_id,
    workspace_id: job.workspace_id,
    job_name: job.job_name,
  }

  // Optional fields
  if (job.user_id) {
    context.user_id = job.user_id
  }
  if (job.attempt_id) {
    context.attempt_id = job.attempt_id
  }

  return logger.child(context)
}

/**
 * Create custom child logger with arbitrary context.
 *
 * @param context - Context fields to inject
 * @returns Child logger
 */
export function createChildLogger(context: Record<string, any>): Logger {
  return logger.child(context)
}

/**
 * Export singleton for backward compatibility.
 */
export { logger }
