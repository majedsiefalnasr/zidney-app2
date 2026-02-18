/**
 * Worker Logger - Pino singleton with job scope injection.
 *
 * Follows same pattern as API logger (T001) but specialized for worker job processing.
 * Enables dual ID tracking: request_id (from API) + job_id (per job execution).
 *
 * Structure:
 * - Global singleton: `getLogger()` returns process-wide logger
 * - Child binding: `getJobLogger(job)` creates job-scoped child logger
 * - Context injection: All logs automatically include injected fields (no manual params)
 */

import { JobEnvelope } from '@types/job-envelope'
import pino, { Logger, LoggerOptions } from 'pino'

/**
 * Pino logger configuration for worker service.
 */
const pinoConfig: LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: process.env.SERVICE_NAME || 'worker',
    environment: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
  serializers: {
    job: (job: any) => ({
      job_id: job.job_id,
      job_name: job.job_name,
      request_id: job.request_id,
      workspace_id: job.workspace_id,
      attempt_id: job.attempt_id,
      retry_count: job.retry_count,
    }),
  },
  redact: {
    paths: [
      '*.password',
      '*.token',
      '*.jwt',
      '*.api_key',
      '*.secret',
      '*.access_token',
      '*.refresh_token',
    ],
    remove: false,
  },
}

/**
 * Global Pino logger singleton.
 * Instantiated once per worker service process.
 */
const logger: Logger = pino(pinoConfig)

/**
 * Get the global logger instance (singleton).
 *
 * @returns Pino logger singleton
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
  const context: Record<string, any> = {
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
