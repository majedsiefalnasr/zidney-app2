/**
 * Structured Logging Pipeline
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Comprehensive structured logging with mandatory fields.
 * Emit JSON logs with correlation_id, license_id, workspace_slug for tracing.
 * Support multiple log transports (console, file, remote).
 */

import { pino } from 'pino'

/**
 * Log context with mandatory fields
 */
export interface LogContext {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  service: string
  correlation_id: string
  workspace_slug?: string
  license_id?: string
  job_id?: string
  db_name?: string
  user_id?: string
  event: string
  step?: string
  duration_ms?: number
  error_code?: string
  error_message?: string
  [key: string]: unknown
}

/**
 * Structured Logger Pipeline
 */
export class StructuredLoggerPipeline {
  private pinoLogger: ReturnType<typeof pino>
  private serviceName: string
  private transports: Array<(log: LogContext) => void> = []

  constructor(
    serviceName: string,
    config: {
      level?: string
      transport?: 'console' | 'file' | 'remote'
      remoteUrl?: string
    } = {}
  ) {
    this.serviceName = serviceName

    // Initialize Pino logger
    this.pinoLogger = pino({
      level: config.level || 'info',
      transport: this.getTransport(config.transport),
    })

    // Register default console transport
    this.registerTransport((log) => {
      this.pinoLogger[log.level](
        JSON.stringify(log, null, 0) // Compact JSON
      )
    })
  }

  /**
   * Get Pino transport configuration
   */
  private getTransport(transport?: string) {
    if (transport === 'file') {
      return {
        target: 'pino/file',
      }
    }

    if (transport === 'remote') {
      return {
        target: 'pino-http-send',
        options: {
          url: process.env.LOG_REMOTE_URL || 'http://localhost:3000/logs',
        },
      }
    }

    // Default console transport
    return {
      target: 'pino-pretty',
      options: {
        colorize: process.env.NODE_ENV !== 'production',
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    }
  }

  /**
   * Register a log transport
   */
  registerTransport(transport: (log: LogContext) => void): void {
    this.transports.push(transport)
  }

  /**
   * Log an event
   */
  log(
    level: 'debug' | 'info' | 'warn' | 'error',
    event: string,
    context: Omit<LogContext, 'timestamp' | 'level' | 'service' | 'event'>
  ): void {
    const logEntry: LogContext = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      event,
      correlation_id: context.correlation_id || 'unknown',
      ...context,
    }

    // Emit to all transports
    for (const transport of this.transports) {
      try {
        transport(logEntry)
      } catch (error) {
        console.error('Transport error:', error)
      }
    }
  }

  /**
   * Log debug message
   */
  debug(
    event: string,
    context: Omit<LogContext, 'timestamp' | 'level' | 'service' | 'event'>
  ): void {
    this.log('debug', event, context)
  }

  /**
   * Log info message
   */
  info(
    event: string,
    context: Omit<LogContext, 'timestamp' | 'level' | 'service' | 'event'>
  ): void {
    this.log('info', event, context)
  }

  /**
   * Log warning message
   */
  warn(
    event: string,
    context: Omit<LogContext, 'timestamp' | 'level' | 'service' | 'event'>
  ): void {
    this.log('warn', event, context)
  }

  /**
   * Log error message
   */
  error(
    event: string,
    context: Omit<LogContext, 'timestamp' | 'level' | 'service' | 'event'>,
    error?: Error
  ): void {
    const errorContext = {
      ...context,
      error_code: context.error_code || 'UNKNOWN_ERROR',
      error_message: error?.message || context.error_message || 'Unknown error',
    }

    this.log('error', event, errorContext)
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: Partial<LogContext>): StructuredLoggerPipeline {
    const childLogger = new StructuredLoggerPipeline(this.serviceName)

    // Preserve additional context in child
    const originalLog = childLogger.log.bind(childLogger)
    childLogger.log = (level, event, context) => {
      originalLog(level, event, {
        ...additionalContext,
        ...context,
      } as unknown as Omit<LogContext, 'timestamp' | 'level' | 'service' | 'event'>)
    }

    return childLogger
  }
}

/**
 * Factory to create structured logger pipeline
 */
export function createStructuredLoggerPipeline(
  serviceName: string,
  config?: {
    level?: string
    transport?: 'console' | 'file' | 'remote'
    remoteUrl?: string
  }
): StructuredLoggerPipeline {
  return new StructuredLoggerPipeline(serviceName, config)
}

/**
 * Global logger singleton
 */
let globalLogger: StructuredLoggerPipeline | null = null

/**
 * Get global logger instance
 */
export function getGlobalLogger(serviceName: string = 'provisioning'): StructuredLoggerPipeline {
  if (!globalLogger) {
    globalLogger = createStructuredLoggerPipeline(serviceName, {
      level: process.env.LOG_LEVEL || 'info',
      transport: (process.env.LOG_TRANSPORT as 'console' | 'file' | 'remote') || 'console',
      remoteUrl: process.env.LOG_REMOTE_URL,
    })
  }

  return globalLogger
}

/**
 * Reset global logger (for testing)
 */
export function resetGlobalLogger(): void {
  globalLogger = null
}
