import pino, { Logger, LoggerOptions } from 'pino'

/**
 * Global Pino logger singleton for structured logging.
 * Initialized once at service startup.
 * All logs output valid JSON with required base fields.
 */

const pinoConfig: LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: process.env.SERVICE_NAME || 'api',
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
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      path: req.path,
      headers: {
        'user-agent': req.headers['user-agent'],
      },
      request_id: req.context?.request_id,
    }),
    res: (res: any) => ({
      statusCode: res.statusCode,
      headers: {
        'content-type': res.headers['content-type'],
      },
    }),
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
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

const logger: Logger = pino(pinoConfig)

/**
 * Get the global logger instance.
 * Returns the same singleton on every call.
 *
 * @returns Pino logger singleton
 */
export function getLogger(): Logger {
  return logger
}

/**
 * Create a child logger with request-scoped context.
 * Child logger binds context fields to all subsequent logs.
 *
 * @param context - Context fields to bind (request_id, workspace_id, user_id, etc.)
 * @returns New child logger with injected context
 */
export function createChildLogger(context: {
  request_id?: string
  workspace_id?: string
  workspace_slug?: string
  user_id?: string
  attempt_id?: string
  job_id?: string
  job_name?: string
  [key: string]: any
}): Logger {
  return logger.child(context)
}

/**
 * Export singleton for direct access
 */
export { logger }
