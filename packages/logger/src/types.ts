/**
 * Logger Types
 *
 * Shared type definitions for the unified logging package.
 */

/**
 * Log levels in order of severity
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

/**
 * Output format for log entries
 */
export type OutputFormat = 'console' | 'json-stdout' | 'json-file'

/**
 * Context fields that can be included in log entries
 *
 * These fields are commonly used across the Zidney platform
 * for request tracing and multi-tenancy support.
 */
export interface LogContext {
  /** Request correlation ID for tracing */
  correlation_id?: string

  /** Workspace UUID */
  workspace_id?: string

  /** Workspace slug (subdomain) */
  workspace_slug?: string

  /** User UUID */
  user_id?: string

  /** Attempt UUID (for exam runtime) */
  attempt_id?: string

  /** Job UUID (for worker tasks) */
  job_id?: string

  /** Task ID (for provisioning tasks) */
  task_id?: string

  /** Error code (for structured error logging) */
  error_code?: string

  /** Duration in milliseconds */
  duration_ms?: number

  /** Additional metadata */
  [key: string]: any
}

/**
 * Structured log entry format
 *
 * All log entries conform to this structure for consistency
 * and to support log aggregation systems.
 */
export interface LogEntry {
  /** ISO 8601 timestamp */
  timestamp: string

  /** Log level */
  level: LogLevel

  /** Service name (e.g., 'api', 'worker', 'domain-core') */
  service: string

  /** Event name (lowercase with underscores, e.g., 'http_request_completed') */
  event: string

  /** Log message */
  message: string

  /** Context fields */
  context: LogContext
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Service name for log entries */
  service: string

  /** Minimum log level to output */
  level?: LogLevel

  /** Output format */
  format?: OutputFormat

  /** File path for json-file format */
  filePath?: string

  /** Enable schema validation (default: false) */
  validateSchema?: boolean

  /** Auto-redact sensitive fields (default: true) */
  sanitizeSensitive?: boolean

  /** Bound context for all log entries */
  boundContext?: LogContext
}

/**
 * Sensitive field patterns to sanitize
 */
export const SENSITIVE_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth[_-]?key/i,
  /private[_-]?key/i,
  /credential/i,
  /session[_-]?id/i,
]

/**
 * Fields that should never be logged
 */
export const FORBIDDEN_FIELDS = [
  'password',
  'password_hash',
  'token',
  'api_key',
  'secret',
  'private_key',
  'access_token',
  'refresh_token',
  'session_id',
]
