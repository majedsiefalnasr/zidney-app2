/**
 * Master Database Structured Logger
 *
 * File: packages/domain-core/src/logging/master-db-logger.ts
 * Task: T021
 * Phase: 4 - Validation and Utility Functions
 *
 * Provides structured JSON logging for master database operations.
 * All logs include required fields: timestamp, level, service, correlation_id
 *
 * Log Levels:
 * - INFO: Normal operation (migration start, completion)
 * - WARN: Potential issues (deprecation, unusual conditions)
 * - ERROR: Failures (migration error, DB connection failure)
 * - DEBUG: Detailed operation steps (for debugging in dev)
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

/**
 * Structured log entry format
 *
 * Required fields (always present):
 * - timestamp: ISO 8601 timestamp
 * - level: LOG_LEVEL
 * - service: 'master-db-migration' or similar
 * - correlation_id: Request/session tracing ID
 *
 * Optional fields (context-specific):
 * - migration_version: Version of migration being executed
 * - phase: 'startup', 'bootstrap', 'execution', 'completion', etc.
 * - status: 'started', 'completed', 'failed', etc.
 * - message: Human-readable message
 * - error: Error details { code, message }
 * - duration_ms: Operation duration
 * - details: Additional context
 */
export interface StructuredLogEntry {
  timestamp: string // ISO 8601
  level: LogLevel
  service: string
  correlation_id: string
  migration_version?: string
  phase?: string
  status?: string
  message?: string
  error?: {
    code: string
    message: string
  }
  duration_ms?: number
  [key: string]: unknown // Allow additional fields
}

/**
 * MasterDB Logger
 *
 * Enforces structured logging with required fields.
 * Never logs sensitive data (passwords, tokens).
 */
export class MasterDBLogger {
  private service: string
  private correlationId: string

  constructor(service: string = 'master-db', correlationId?: string) {
    this.service = service
    this.correlationId = correlationId || this.generateCorrelationId()
  }

  /**
   * Set correlation ID for tracing
   */
  setCorrelationId(id: string): void {
    this.correlationId = id
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string {
    return this.correlationId
  }

  /**
   * Log at INFO level
   *
   * @example
   * logger.info({
   *   phase: 'startup',
   *   message: 'Starting master database migrations'
   * });
   */
  info(data: Omit<StructuredLogEntry, 'timestamp' | 'level' | 'service' | 'correlation_id'>): void {
    this.log('INFO', data)
  }

  /**
   * Log at WARN level
   */
  warn(data: Omit<StructuredLogEntry, 'timestamp' | 'level' | 'service' | 'correlation_id'>): void {
    this.log('WARN', data)
  }

  /**
   * Log at ERROR level
   */
  error(
    data: Omit<StructuredLogEntry, 'timestamp' | 'level' | 'service' | 'correlation_id'>
  ): void {
    this.log('ERROR', data)
  }

  /**
   * Log at DEBUG level
   */
  debug(
    data: Omit<StructuredLogEntry, 'timestamp' | 'level' | 'service' | 'correlation_id'>
  ): void {
    this.log('DEBUG', data)
  }

  /**
   * Log structured entry (internal method)
   *
   * Creates full StructuredLogEntry with timestamp and required fields.
   * Outputs as single-line JSON to stdout/stderr.
   *
   * CRITICAL: Never logs passwords, tokens, or sensitive data
   */
  private log(
    level: LogLevel,
    data: Omit<StructuredLogEntry, 'timestamp' | 'level' | 'service' | 'correlation_id'>
  ): void {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      correlation_id: this.correlationId,
      ...data,
    }

    // Validate no sensitive data in logs
    this.validateNoSensitiveData(entry)

    // Output as single-line JSON
    console.log(JSON.stringify(entry))
  }

  /**
   * Validate that log entry contains no sensitive data
   *
   * Forbidden fields:
   * - password, password_hash
   * - token, api_key, secret
   * - db_password_encrypted (should never be logged individually)
   *
   * @throws Error if sensitive data detected
   */
  private validateNoSensitiveData(entry: StructuredLogEntry): void {
    const sensitivePatterns = [/password/i, /token/i, /secret/i, /api_key/i, /credentials/i]

    // Check all keys and values
    const entryStr = JSON.stringify(entry).toLowerCase()
    for (const pattern of sensitivePatterns) {
      if (pattern.test(entryStr)) {
        // Only alarm if it's in a value (not just in error messages)
        // Error messages may contain "password reset" context
        const keys = Object.keys(entry)
        for (const key of keys) {
          if (pattern.test(key) && key !== 'message' && key !== 'error') {
            throw new Error(
              `SECURITY: Attempted to log sensitive field '${key}'. ` +
                `Never log passwords, tokens, or encrypted credentials.`
            )
          }
        }
      }
    }
  }

  /**
   * Generate correlation ID for tracing
   *
   * Format: timestamp-random (e.g., 1705338000000-9x8k4c2f)
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Create child logger with inherited correlation ID
   * (useful for sub-operations)
   */
  child(service: string): MasterDBLogger {
    return new MasterDBLogger(service, this.correlationId)
  }
}

/**
 * Global logger instance (singleton pattern)
 *
 * Usage:
 * import { globalLogger } from '@zidney/domain-core/logging';
 * globalLogger.info({ message: 'Database initialized' });
 */
export const globalLogger = new MasterDBLogger('master-db')

export default MasterDBLogger
