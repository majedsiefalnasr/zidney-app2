/**
 * Provisioning Logger
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Structured JSON logging for provisioning operations.
 *
 * Mandatory fields in every log:
 * - timestamp (ISO 8601)
 * - level (INFO, WARN, ERROR, DEBUG)
 * - service ("provisioning-worker" or "provisioning-api")
 * - correlation_id (UUID for request tracing)
 * - workspace_slug (if applicable)
 * - license_id (if applicable)
 * - event (short description of what happened)
 *
 * All logs are JSON-formatted for parsing and indexing in observability systems.
 * No personally identifiable information (PII) is logged.
 */

import pino, { type Logger } from 'pino'

/**
 * Log Level Type
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

/**
 * Provisioning Log Context
 * Context object passed to logger throughout request lifecycle.
 */
export interface ProvisioningLogContext {
  correlationId: string
  workspaceSlug?: string
  licenseId?: string
  jobId?: string
  step?: string
  durationMs?: number
  userId?: string
}

/**
 * Provisioning Log Entry
 * Structure of a single log entry.
 */
export interface ProvisioningLogEntry {
  timestamp: string
  level: LogLevel
  service: string
  correlation_id: string
  workspace_slug?: string
  license_id?: string
  job_id?: string
  event: string
  step?: string
  duration_ms?: number
  error?: {
    code?: string
    message?: string
    stack?: string
  }
  metadata?: Record<string, unknown>
}

/**
 * Create provisioning logger instance
 */
export function createProvisioningLogger(service: 'api' | 'worker' = 'worker'): Logger {
  const transport = pino.transport({
    target: 'pino/file',
    options: {
      destination: process.env.LOG_FILE || '/dev/stdout',
      mkdir: true,
    },
  })

  return pino(
    {
      level: process.env.LOG_LEVEL || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => {
          return { level: label }
        },
      },
      base: {
        service: `provisioning-${service}`,
        version: process.env.APP_VERSION || '1.0.0',
      },
    },
    transport
  )
}

/**
 * Global logger instance
 */
let provisioningLogger: Logger | null = null

/**
 * Get or create logger
 */
export function getProvisioningLogger(service: 'api' | 'worker' = 'worker'): Logger {
  if (!provisioningLogger) {
    provisioningLogger = createProvisioningLogger(service)
  }
  return provisioningLogger
}

/**
 * Logger interface specific to provisioning
 */
export class ProvisioningLogger {
  private logger: Logger
  private context: ProvisioningLogContext

  constructor(baseLogger: Logger, context: ProvisioningLogContext) {
    this.logger = baseLogger
    this.context = context
  }

  /**
   * Create child logger with additional context
   */
  child(context: Partial<ProvisioningLogContext>): ProvisioningLogger {
    return new ProvisioningLogger(this.logger, {
      ...this.context,
      ...context,
    })
  }

  /**
   * Log provisioning step
   */
  logStep(step: string, event: string, metadata?: Record<string, unknown>): void {
    this.logger.info({
      ...this.context,
      step,
      event,
      ...metadata,
    })
  }

  /**
   * Log provisioning success
   */
  logSuccess(event: string, durationMs: number, metadata?: Record<string, unknown>): void {
    this.logger.info({
      ...this.context,
      event,
      duration_ms: durationMs,
      ...metadata,
    })
  }

  /**
   * Log provisioning error
   */
  logError(event: string, error: Error, metadata?: Record<string, unknown>): void {
    this.logger.error({
      ...this.context,
      event,
      error: {
        code: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...metadata,
    })
  }

  /**
   * Log provisioning warning
   */
  logWarn(event: string, metadata?: Record<string, unknown>): void {
    this.logger.warn({
      ...this.context,
      event,
      ...metadata,
    })
  }

  /**
   * Log provisioning debug
   */
  logDebug(event: string, metadata?: Record<string, unknown>): void {
    this.logger.debug({
      ...this.context,
      event,
      ...metadata,
    })
  }

  /**
   * Log validation error
   */
  logValidationError(field: string, reason: string, value?: unknown): void {
    this.logger.warn({
      ...this.context,
      event: 'validation_failed',
      field,
      reason,
      value: typeof value === 'string' ? value : '[redacted]',
    })
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(
    operation: 'CREATE' | 'MIGRATE' | 'SEED' | 'QUERY',
    table: string,
    durationMs: number,
    rowsAffected?: number
  ): void {
    this.logger.info({
      ...this.context,
      event: 'database_operation',
      operation,
      table,
      duration_ms: durationMs,
      rows_affected: rowsAffected,
    })
  }

  /**
   * Log lock operation
   */
  logLockOperation(
    operation: 'ACQUIRE' | 'RELEASE' | 'TIMEOUT',
    durationMs: number,
    success: boolean
  ): void {
    this.logger.info({
      ...this.context,
      event: 'lock_operation',
      operation,
      duration_ms: durationMs,
      success,
    })
  }

  /**
   * Log retry attempt
   */
  logRetry(attempt: number, maxAttempts: number, reason: string, nextRetryMs: number): void {
    this.logger.warn({
      ...this.context,
      event: 'retry_attempt',
      attempt,
      max_attempts: maxAttempts,
      reason,
      next_retry_ms: nextRetryMs,
    })
  }

  /**
   * Log DLQ move
   */
  logDLQMove(reason: string, attempts: number, metadata?: Record<string, unknown>): void {
    this.logger.error({
      ...this.context,
      event: 'dlq_move',
      reason,
      total_attempts: attempts,
      ...metadata,
    })
  }
}

/**
 * Factory to create provisioning logger with context
 */
export function createProvisioningLoggerWithContext(
  baseLogger: Logger,
  context: ProvisioningLogContext
): ProvisioningLogger {
  return new ProvisioningLogger(baseLogger, context)
}

/**
 * Setup global provisioning logger
 */
export function initializeProvisioningLogger(
  service: 'api' | 'worker' = 'worker'
): ProvisioningLogger {
  const baseLogger = getProvisioningLogger(service)
  const context: ProvisioningLogContext = {
    correlationId: process.env.CORRELATION_ID || 'system',
  }
  return createProvisioningLoggerWithContext(baseLogger, context)
}
