/**
 * Logger Factory Utility
 *
 * Purpose: Provide structured logging with required fields
 * Used by: All scripts requiring logging
 *
 * Provides:
 * - Structured logging with context fields
 * - Correlation ID propagation
 * - Workspace and attempt ID tracking
 * - JSON and human-readable output
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  correlationId?: string
  workspaceSlug?: string
  workspaceId?: string
  userId?: string
  attemptId?: string
  module?: string
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context: LogContext
  metadata?: Record<string, unknown>
}

/**
 * Structured logger
 */
export class StructuredLogger {
  private context: LogContext
  private jsonOutput: boolean

  constructor(moduleName: string, jsonOutput = false) {
    this.context = { module: moduleName, correlationId: this.generateCorrelationId() }
    this.jsonOutput = jsonOutput
  }

  /**
   * Set logging context
   */
  setContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context }
  }

  /**
   * Get current context
   */
  getContext(): LogContext {
    return { ...this.context }
  }

  /**
   * Log at debug level
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata)
  }

  /**
   * Log at info level
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata)
  }

  /**
   * Log at warn level
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata)
  }

  /**
   * Log at error level
   */
  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata)
  }

  /**
   * Internal logging function
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      metadata,
    }

    if (this.jsonOutput) {
      console.log(JSON.stringify(entry))
    } else {
      this.logHumanReadable(entry)
    }
  }

  /**
   * Format for human-readable output
   */
  private logHumanReadable(entry: LogEntry): void {
    const parts: string[] = [entry.timestamp, `[${entry.level.toUpperCase()}]`, entry.message]

    if (this.context.correlationId) {
      parts.push(`(${this.context.correlationId})`)
    }

    const output = parts.join(' ')

    if (entry.level === 'error') {
      console.error(output)
    } else if (entry.level === 'warn') {
      console.warn(output)
    } else {
      console.log(output)
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      console.log(JSON.stringify(entry.metadata, null, 2))
    }
  }

  /**
   * Generate a unique correlation ID
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }
}

/**
 * Create a logger for a module
 */
export function createLogger(moduleName: string, jsonOutput = false): StructuredLogger {
  return new StructuredLogger(moduleName, jsonOutput)
}

/**
 * Get global logger instance
 */
let globalLogger: StructuredLogger | null = null

export function getGlobalLogger(moduleName = 'global'): StructuredLogger {
  if (!globalLogger) {
    globalLogger = createLogger(moduleName)
  }
  return globalLogger
}

/**
 * Set global logger context
 */
export function setGlobalLoggerContext(context: Partial<LogContext>): void {
  getGlobalLogger().setContext(context)
}

/**
 * Simple log functions for quick use
 */
export function logDebug(message: string, metadata?: Record<string, unknown>): void {
  getGlobalLogger().debug(message, metadata)
}

export function logInfo(message: string, metadata?: Record<string, unknown>): void {
  getGlobalLogger().info(message, metadata)
}

export function logWarn(message: string, metadata?: Record<string, unknown>): void {
  getGlobalLogger().warn(message, metadata)
}

export function logError(message: string, metadata?: Record<string, unknown>): void {
  getGlobalLogger().error(message, metadata)
}
