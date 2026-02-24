/**
 * Unified Logger Implementation
 *
 * A single logger package for the entire Zidney platform.
 * Provides consistent API and structured logging across all services.
 *
 * Usage:
 * ```typescript
 * import { createLogger } from '@zidney/logger'
 *
 * const logger = createLogger('api')
 * logger.info('Server started', { port: 3000 })
 * logger.error('Request failed', { error: err.message, correlation_id: 'abc-123' })
 * ```
 */

import type {
  LogContext,
  LogEntry,
  LoggerConfig,
  LogLevel,
  OutputFormat,
} from './types'
import { FORBIDDEN_FIELDS, SENSITIVE_PATTERNS } from './types'

/**
 * Log level priority mapping
 */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
}

/**
 * Console colors for log levels
 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: '\x1b[90m', // gray
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m', // green
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
  fatal: '\x1b[35m', // magenta
}

const RESET_COLOR = '\x1b[0m'

/**
 * Unified Logger Class
 *
 * Provides structured logging with:
 * - Multiple output formats (console, JSON)
 * - Sensitive data sanitization
 * - Child loggers with bound context
 * - Log level filtering
 */
export class Logger {
  private service: string
  private level: LogLevel
  private format: OutputFormat
  private sanitizeSensitive: boolean
  private boundContext: LogContext

  constructor(config: string | LoggerConfig) {
    if (typeof config === 'string') {
      this.service = config
      this.level = this.parseLogLevel(process.env.LOG_LEVEL || 'info')
      this.format = this.parseOutputFormat(process.env.LOG_FORMAT || 'console')
      this.sanitizeSensitive = true
      this.boundContext = {}
    } else {
      this.service = config.service
      this.level =
        config.level || this.parseLogLevel(process.env.LOG_LEVEL || 'info')
      this.format =
        config.format ||
        this.parseOutputFormat(process.env.LOG_FORMAT || 'console')
      this.sanitizeSensitive = config.sanitizeSensitive !== false
      this.boundContext = config.boundContext || {}
    }
  }

  /**
   * Parse log level from string
   */
  private parseLogLevel(level: string): LogLevel {
    const normalized = level.toLowerCase()

    if (normalized === 'critical') {
      return 'fatal'
    }

    if (normalized in LEVEL_PRIORITY) {
      return normalized as LogLevel
    }
    return 'info'
  }

  /**
   * Parse output format from string
   */
  private parseOutputFormat(format: string): OutputFormat {
    if (format === 'json-stdout' || format === 'json-file') {
      return format
    }
    return 'console'
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.level]
  }

  /**
   * Sanitize context by removing sensitive fields
   */
  private sanitize(context: LogContext): LogContext {
    if (!this.sanitizeSensitive) {
      return context
    }

    const sanitized: LogContext = {}

    for (const [key, value] of Object.entries(context)) {
      // Check if field name is forbidden
      if (FORBIDDEN_FIELDS.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]'
        continue
      }

      // Check if field name matches sensitive patterns
      const isSensitive = SENSITIVE_PATTERNS.some((pattern) =>
        pattern.test(key)
      )
      if (isSensitive) {
        sanitized[key] = '[REDACTED]'
        continue
      }

      // Recursively sanitize nested objects
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        sanitized[key] = this.sanitize(value as LogContext)
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  /**
   * Create a log entry
   */
  private createEntry(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): LogEntry {
    const mergedContext = {
      ...this.boundContext,
      ...context,
    }

    // Generate event name from message (convert to snake_case)
    const event = this.messageToEvent(message)

    return {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      event,
      message,
      context: this.sanitize(mergedContext),
    }
  }

  /**
   * Convert message to event name (snake_case)
   */
  private messageToEvent(message: string): string {
    return message
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50) // Limit length
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return
    }

    switch (this.format) {
      case 'console':
        this.outputConsole(entry)
        break
      case 'json-stdout':
      case 'json-file':
        this.outputJson(entry)
        break
    }
  }

  /**
   * Output to console with colors
   */
  private outputConsole(entry: LogEntry): void {
    const color = LEVEL_COLORS[entry.level]
    const levelUpper = entry.level.toUpperCase().padEnd(5)
    const timestamp = entry.timestamp

    // Build context string
    const contextParts: string[] = []
    if (entry.context.correlation_id) {
      contextParts.push(`cid=${entry.context.correlation_id}`)
    }
    if (entry.context.workspace_id) {
      contextParts.push(`ws=${entry.context.workspace_id}`)
    }
    if (entry.context.user_id) {
      contextParts.push(`uid=${entry.context.user_id}`)
    }

    const contextStr =
      contextParts.length > 0 ? ` [${contextParts.join(' ')}]` : ''

    console.log(
      `${color}[${timestamp}] [${entry.service}] [${levelUpper}]${RESET_COLOR}${contextStr} [${entry.event}] ${entry.message}`
    )

    // Output additional context on trace/debug
    if (
      (entry.level === 'trace' || entry.level === 'debug') &&
      Object.keys(entry.context).length > 0
    ) {
      console.log(
        `  ${color}Context:${RESET_COLOR}`,
        JSON.stringify(entry.context, null, 2)
      )
    }

    // Output error details
    if ((entry.level === 'error' || entry.level === 'fatal') && entry.context.error) {
      console.error(`  ${color}Error:${RESET_COLOR}`, entry.context.error)
    }
  }

  /**
   * Output as JSON line
   */
  private outputJson(entry: LogEntry): void {
    console.log(JSON.stringify(entry))
  }

  /**
   * Log at debug level
   *
   * @param message - Log message
   * @param context - Optional context fields
   */
  private normalizeArgs(
    messageOrContext: string | LogContext,
    contextOrMessage?: LogContext | string
  ): { message: string; context?: LogContext } {
    if (typeof messageOrContext === 'string') {
      if (typeof contextOrMessage === 'string') {
        return { message: messageOrContext, context: { note: contextOrMessage } }
      }
      return { message: messageOrContext, context: contextOrMessage }
    }

    return {
      message:
        typeof contextOrMessage === 'string' ? contextOrMessage : 'log_event',
      context: messageOrContext,
    }
  }

  private logAt(
    level: LogLevel,
    messageOrContext: string | LogContext,
    contextOrMessage?: LogContext | string
  ): void {
    const { message, context } = this.normalizeArgs(
      messageOrContext,
      contextOrMessage
    )
    this.output(this.createEntry(level, message, context))
  }

  trace(message: string, context?: LogContext): void
  trace(context: LogContext, message?: string): void
  trace(
    messageOrContext: string | LogContext,
    contextOrMessage?: LogContext | string
  ): void {
    this.logAt('trace', messageOrContext, contextOrMessage)
  }

  debug(message: string, context?: LogContext): void
  debug(context: LogContext, message?: string): void
  debug(
    messageOrContext: string | LogContext,
    contextOrMessage?: LogContext | string
  ): void {
    this.logAt('debug', messageOrContext, contextOrMessage)
  }

  /**
   * Log at info level
   *
   * @param message - Log message
   * @param context - Optional context fields
   */
  info(message: string, context?: LogContext): void
  info(context: LogContext, message?: string): void
  info(
    messageOrContext: string | LogContext,
    contextOrMessage?: LogContext | string
  ): void {
    this.logAt('info', messageOrContext, contextOrMessage)
  }

  /**
   * Log at warn level
   *
   * @param message - Log message
   * @param context - Optional context fields
   */
  warn(message: string, context?: LogContext): void
  warn(context: LogContext, message?: string): void
  warn(
    messageOrContext: string | LogContext,
    contextOrMessage?: LogContext | string
  ): void {
    this.logAt('warn', messageOrContext, contextOrMessage)
  }

  /**
   * Log at error level
   *
   * @param message - Log message
   * @param context - Optional context fields
   */
  error(message: string, context?: LogContext): void
  error(context: LogContext, message?: string): void
  error(
    messageOrContext: string | LogContext,
    contextOrMessage?: LogContext | string
  ): void {
    this.logAt('error', messageOrContext, contextOrMessage)
  }

  fatal(message: string, context?: LogContext): void
  fatal(context: LogContext, message?: string): void
  fatal(
    messageOrContext: string | LogContext,
    contextOrMessage?: LogContext | string
  ): void {
    this.logAt('fatal', messageOrContext, contextOrMessage)
  }

  critical(message: string, context?: LogContext): void
  critical(context: LogContext, message?: string): void
  critical(
    messageOrContext: string | LogContext,
    contextOrMessage?: LogContext | string
  ): void {
    this.logAt('fatal', messageOrContext, contextOrMessage)
  }

  /**
   * Create a child logger with bound context
   *
   * The child logger will include the bound context in all log entries.
   *
   * @param context - Context to bind to the child logger
   * @returns New logger instance with bound context
   */
  child(context: LogContext): Logger {
    return new Logger({
      service: this.service,
      level: this.level,
      format: this.format,
      sanitizeSensitive: this.sanitizeSensitive,
      boundContext: {
        ...this.boundContext,
        ...context,
      },
    })
  }

  /**
   * Set the log level
   */
  setLevel(level: LogLevel): void {
    this.level = level
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.level
  }

  /**
   * Set the output format
   */
  setFormat(format: OutputFormat): void {
    this.format = format
  }
}

/**
 * Create a logger instance
 *
 * Convenience function for creating logger instances.
 *
 * @param service - Service name
 * @param config - Optional configuration
 * @returns Logger instance
 */
export function createLogger(
  service: string,
  config?: Partial<LoggerConfig>
): Logger {
  return new Logger({
    service,
    ...config,
  })
}

const defaultLogger = createLogger(process.env.SERVICE_NAME || 'app')

export function getLogger(): Logger {
  return defaultLogger
}

export function createChildLogger(context: LogContext): Logger {
  return defaultLogger.child(context)
}

export const logger = defaultLogger

export default Logger
