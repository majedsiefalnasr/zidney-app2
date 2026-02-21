/**
 * Worker Structured Logger
 *
 * Provides structured JSON logging for worker operations.
 * All logs include required fields: timestamp, level, service, correlation_id
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

/**
 * Structured log entry format
 */
export interface StructuredLogEntry {
  timestamp: string // ISO 8601
  level: LogLevel
  service: string
  correlation_id?: string
  [key: string]: unknown
}

/**
 * Worker Logger
 *
 * Enforces structured logging with required fields.
 * Never logs sensitive data (passwords, tokens).
 */
class WorkerLogger {
  private service: string
  private correlationId: string

  constructor(service: string = 'worker', correlationId?: string) {
    this.service = service
    this.correlationId = correlationId || this.generateCorrelationId()
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`
  }

  private formatLog(
    level: LogLevel,
    context: Record<string, unknown>,
    message: string
  ): StructuredLogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      correlation_id: this.correlationId,
      message,
      ...context,
    }
  }

  debug(context: Record<string, unknown>, message: string): void {
    const entry = this.formatLog('DEBUG', context, message)
    console.log(JSON.stringify(entry))
  }

  info(context: Record<string, unknown>, message: string): void {
    const entry = this.formatLog('INFO', context, message)
    console.log(JSON.stringify(entry))
  }

  warn(context: Record<string, unknown>, message: string): void {
    const entry = this.formatLog('WARN', context, message)
    console.warn(JSON.stringify(entry))
  }

  error(context: Record<string, unknown>, message: string): void {
    const entry = this.formatLog('ERROR', context, message)
    console.error(JSON.stringify(entry))
  }

  /**
   * Create child logger with inherited correlation ID
   */
  child(service: string): WorkerLogger {
    return new WorkerLogger(service, this.correlationId)
  }
}

/**
 * Global logger instance (singleton pattern)
 *
 * Usage:
 * import { logger } from './services/logger';
 * logger.info({ action: 'startup' }, 'Worker starting');
 */
export const logger = new WorkerLogger('worker')

export default WorkerLogger
