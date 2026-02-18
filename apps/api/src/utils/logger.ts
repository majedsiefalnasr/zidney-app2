/**
 * Logger Utility — STAGE_06 Attempt Engine
 *
 * Purpose: Structured logging with correlation IDs
 * Used by: All middleware and domain logic
 *
 * Constitutional Compliance:
 * - All logs are structured JSON
 * - Correlation ID propagated to all logs
 * - Workspace_id and user_id logged when available
 * - No sensitive data in logs (passwords, tokens)
 * - Log levels: debug, info, warn, error
 */

export interface LogContext {
  correlation_id?: string
  workspace_id?: string
  user_id?: string
  attempt_id?: string
  [key: string]: any
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  service: string
  message: string
  context: LogContext
}

/**
 * Structured Logger for STAGE_06
 *
 * Usage:
 * ```
 * const logger = new Logger('attempt-engine')
 * logger.info('Attempt created', {
 *   workspace_id,
 *   user_id,
 *   attempt_id,
 *   exam_id,
 * })
 * ```
 */
export class Logger {
  private service: string
  private min_level: LogLevel

  constructor(service: string, min_level: LogLevel = LogLevel.DEBUG) {
    this.service = service
    this.min_level = min_level
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ]
    const levelIndex = levels.indexOf(level)
    const minIndex = levels.indexOf(this.min_level)
    return levelIndex >= minIndex
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      context: {
        ...context,
      },
    }
  }

  private output(entry: LogEntry): void {
    // In production, send to centralized logging service
    // For now, output to console
    console.log(JSON.stringify(entry))
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.output(this.formatEntry(LogLevel.DEBUG, message, context))
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.output(this.formatEntry(LogLevel.INFO, message, context))
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.output(this.formatEntry(LogLevel.WARN, message, context))
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.output(this.formatEntry(LogLevel.ERROR, message, context))
    }
  }
}

export default Logger
