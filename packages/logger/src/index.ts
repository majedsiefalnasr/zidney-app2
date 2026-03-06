/**
 * @zidney/logger - Unified Logger Package
 *
 * A single logging package for the entire Zidney platform.
 * Provides consistent API and structured logging across all services.
 *
 * ## Usage
 *
 * ```typescript
 * import { createLogger } from '@zidney/logger'
 *
 * // Create a logger with service name
 * const logger = createLogger('api')
 *
 * // Basic logging
 * logger.info('Server started', { port: 3000 })
 * logger.error('Request failed', { error: err.message })
 *
 * // With context
 * logger.debug('Processing request', {
 *   correlation_id: 'abc-123',
 *   workspace_id: 'ws-456'
 * })
 *
 * // Create child logger with bound context
 * const requestLogger = logger.child({ correlation_id: 'abc-123' })
 * requestLogger.info('Processing') // Automatically includes correlation_id
 * ```
 *
 * ## Environment Variables
 *
 * - `LOG_LEVEL`: Set minimum log level (debug, info, warn, error)
 * - `LOG_FORMAT`: Set output format (console, json-stdout, json-file)
 *
 * ## API
 *
 * All log methods follow the signature: `(message: string, context?: LogContext) => void`
 *
 * - `logger.debug(message, context?)` - Detailed debugging information
 * - `logger.info(message, context?)` - General information
 * - `logger.warn(message, context?)` - Warning conditions
 * - `logger.error(message, context?)` - Error conditions
 *
 * ## Context Fields
 *
 * Common context fields used across Zidney:
 *
 * - `correlation_id` - Request correlation ID
 * - `workspace_id` - Workspace UUID
 * - `workspace_slug` - Workspace slug (subdomain)
 * - `user_id` - User UUID
 * - `attempt_id` - Attempt UUID (exam runtime)
 * - `job_id` - Job UUID (worker tasks)
 * - `task_id` - Task ID (provisioning)
 * - `duration_ms` - Duration in milliseconds
 *
 * ## Sensitive Data
 *
 * The logger automatically redacts sensitive fields:
 * - password, password_hash
 * - token, api_key, secret
 * - private_key, credentials
 * - session_id
 */

// Main exports
// Default export
export {
  createChildLogger,
  createLogger,
  getLogger,
  Logger,
  Logger as default,
  logger,
} from './logger'
// Type exports
export type {
  LogContext,
  LogEntry,
  LoggerConfig,
  LogLevel,
  OutputFormat,
} from './types'
export { FORBIDDEN_FIELDS, SENSITIVE_PATTERNS } from './types'
