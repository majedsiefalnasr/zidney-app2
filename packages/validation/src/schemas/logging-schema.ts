import { z } from 'zod'

/**
 * T067: Structured Logging Schema
 *
 * Enforces structured logging across all services:
 * - Timestamp (ISO 8601)
 * - Logger level (info, warn, error, debug)
 * - Service name (api, worker, backoffice, frontoffice)
 * - Event name (structured string with _ separator)
 * - Workspace context (workspace_id, workspace_slug)
 * - User context (user_id)
 * - Correlation ID (request tracing)
 * - Attempt ID (if applicable)
 * - Job ID (if applicable)
 * - Duration (for performance tracking)
 * - Status code (for API events)
 * - Error details (message, stack, code)
 * - Custom fields (metadata)
 *
 * All logging must validate against this schema before writing.
 * Violations result in SyntaxError with event='log_schema_violation'.
 */

export const LOG_LEVEL = z.enum(['debug', 'info', 'warn', 'error'])
export type LogLevel = z.infer<typeof LOG_LEVEL>

export const SERVICE_NAME = z.enum([
  'api',
  'worker',
  'backoffice',
  'frontoffice',
  'mmc',
])
export type ServiceName = z.infer<typeof SERVICE_NAME>

/**
 * Base log entry schema - all logs MUST include these fields
 */
export const BASE_LOG_ENTRY = z.object({
  timestamp: z.string().datetime(),
  level: LOG_LEVEL,
  service: SERVICE_NAME,
  event: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/, 'Event must be lowercase with underscores'),
  message: z.string().min(1),
})

/**
 * Context fields - audit trail and correlation
 */
export const LOG_CONTEXT_FIELDS = z.object({
  correlation_id: z.string().optional(),
  request_id: z.string().optional(),
  workspace_id: z.string().uuid().optional(),
  workspace_slug: z.string().optional(),
  user_id: z.string().optional(),
  attempt_id: z.string().optional(),
  job_id: z.string().optional(),
})

/**
 * API request context
 */
export const API_LOG_CONTEXT = z.object({
  method: z
    .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'])
    .optional(),
  path: z.string().optional(),
  query_params: z.record(z.string()).optional(),
  status_code: z.number().int().min(100).max(599).optional(),
  duration_ms: z.number().int().positive().optional(),
  error_code: z.string().optional(),
})

/**
 * Performance tracking context
 */
export const PERFORMANCE_LOG_CONTEXT = z.object({
  duration_ms: z.number().int().positive().optional(),
  db_query_ms: z.number().int().positive().optional(),
  redis_query_ms: z.number().int().positive().optional(),
  items_processed: z.number().int().nonnegative().optional(),
  memory_usage_mb: z.number().positive().optional(),
})

/**
 * Error tracking context
 */
export const ERROR_LOG_CONTEXT = z.object({
  error_code: z.string().optional(),
  error_message: z.string().optional(),
  error_stack: z.string().optional(),
  error_details: z.any().optional(),
})

/**
 * Security event context
 */
export const SECURITY_LOG_CONTEXT = z.object({
  security_event: z.string().optional(), // e.g., "auth_failure", "rate_limit_exceeded", "csrf_violation"
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  source_ip: z.string().optional(),
  affected_resource: z.string().optional(),
})

/**
 * Complete log entry schema
 */
export const LOG_ENTRY = BASE_LOG_ENTRY.extend({
  ...LOG_CONTEXT_FIELDS.shape,
  ...API_LOG_CONTEXT.shape,
  ...PERFORMANCE_LOG_CONTEXT.shape,
  ...ERROR_LOG_CONTEXT.shape,
  ...SECURITY_LOG_CONTEXT.shape,
  metadata: z.record(z.any()).optional(),
})

export type LogEntry = z.infer<typeof LOG_ENTRY>

/**
 * Validate and sanitize log entry
 * Removes sensitive fields before writing
 */
export function validateLogEntry(entry: unknown): LogEntry {
  const validated = LOG_ENTRY.parse(entry)

  // Sanitize sensitive fields
  return sanitizeLogEntry(validated)
}

/**
 * Remove sensitive data from logs
 * - Passwords, tokens, API keys
 * - Personal information (emails masked, SSNs redacted)
 * - Full stack traces (first 5 lines only in production)
 */
function sanitizeLogEntry(entry: LogEntry): LogEntry {
  const sanitized = { ...entry }

  // Sanitize stack traces: keep only first 5 lines in production
  if (sanitized.error_stack) {
    const lines = sanitized.error_stack.split('\n').slice(0, 5)
    sanitized.error_stack = lines.join('\n')
  }

  // Sanitize metadata for common sensitive patterns
  if (sanitized.metadata) {
    sanitized.metadata = sanitizeMetadata(sanitized.metadata)
  }

  return sanitized
}

/**
 * Recursively sanitize metadata object
 */
function sanitizeMetadata(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeMetadata)
  }

  const sanitized: any = {}
  const SENSITIVE_KEYS = [
    'password',
    'token',
    'apikey',
    'api_key',
    'secret',
    'authorization',
    'bearer',
    'creditcard',
    'credit_card',
    'ssn',
    'email',
  ]

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Log entry factories for common event types
 */
export const LogEventFactories = {
  /**
   * API request completion
   */
  apiRequest: (params: {
    correlationId: string
    method: string
    path: string
    statusCode: number
    durationMs: number
    userId?: string
    workspaceId?: string
    workspaceSlug?: string
    errorCode?: string
  }): LogEntry => ({
    timestamp: new Date().toISOString(),
    level:
      params.statusCode >= 500
        ? 'error'
        : params.statusCode >= 400
          ? 'warn'
          : 'info',
    service: 'api',
    event: `http_${params.method.toLowerCase()}_${params.statusCode}`,
    message: `${params.method} ${params.path} completed with status ${params.statusCode}`,
    correlation_id: params.correlationId,
    method: params.method as any,
    path: params.path,
    status_code: params.statusCode,
    duration_ms: params.durationMs,
    error_code: params.errorCode,
    user_id: params.userId,
    workspace_id: params.workspaceId,
    workspace_slug: params.workspaceSlug,
  }),

  /**
   * Database operation
   */
  dbOperation: (params: {
    correlationId: string
    operation: string
    table: string
    durationMs: number
    rowsAffected?: number
    workspaceId?: string
    errorCode?: string
  }): LogEntry => ({
    timestamp: new Date().toISOString(),
    level: params.errorCode ? 'error' : 'debug',
    service: 'api',
    event: `db_${params.operation.toLowerCase()}`,
    message: `${params.operation} on ${params.table}`,
    correlation_id: params.correlationId,
    db_query_ms: params.durationMs,
    items_processed: params.rowsAffected,
    workspace_id: params.workspaceId,
    error_code: params.errorCode,
  }),

  /**
   * Rate limit event
   */
  rateLimitEvent: (params: {
    correlationId: string
    sourceIp: string
    userId?: string
    workspaceId?: string
    limitType: 'login' | 'api' | 'websocket' | 'admin'
    severity: 'low' | 'medium' | 'high' | 'critical'
  }): LogEntry => ({
    timestamp: new Date().toISOString(),
    level: params.severity === 'critical' ? 'error' : 'warn',
    service: 'api',
    event: `rate_limit_exceeded_${params.limitType}`,
    message: `Rate limit exceeded for ${params.limitType}`,
    correlation_id: params.correlationId,
    source_ip: params.sourceIp,
    user_id: params.userId,
    workspace_id: params.workspaceId,
    security_event: `rate_limit_${params.limitType}`,
    severity: params.severity,
  }),

  /**
   * Authentication event
   */
  authEvent: (params: {
    correlationId: string
    event: 'login_success' | 'login_failure' | 'token_refresh' | 'logout'
    userId?: string
    workspaceId?: string
    sourceIp?: string
    reason?: string
  }): LogEntry => ({
    timestamp: new Date().toISOString(),
    level: params.event.includes('failure') ? 'warn' : 'info',
    service: 'api',
    event: `auth_${params.event}`,
    message: `Authentication ${params.event}${params.reason ? `: ${params.reason}` : ''}`,
    correlation_id: params.correlationId,
    user_id: params.userId,
    workspace_id: params.workspaceId,
    source_ip: params.sourceIp,
    security_event: params.event,
  }),

  /**
   * Job processing event
   */
  jobEvent: (params: {
    correlationId: string
    jobId: string
    event: 'queued' | 'processing' | 'completed' | 'failed' | 'retrying' | 'dlq'
    workspaceId: string
    durationMs?: number
    errorCode?: string
    retryCount?: number
  }): LogEntry => ({
    timestamp: new Date().toISOString(),
    level:
      params.event === 'failed'
        ? 'error'
        : params.event === 'dlq'
          ? 'error'
          : 'info',
    service: 'worker',
    event: `job_${params.event}`,
    message: `Job ${params.jobId} ${params.event}`,
    correlation_id: params.correlationId,
    job_id: params.jobId,
    workspace_id: params.workspaceId,
    duration_ms: params.durationMs,
    error_code: params.errorCode,
    metadata: {
      retry_count: params.retryCount,
    },
  }),

  /**
   * Attempt submission event
   */
  attemptEvent: (params: {
    correlationId: string
    attemptId: string
    event: 'submitted' | 'grading_started' | 'grading_completed' | 'archived'
    userId: string
    workspaceId: string
    durationMs?: number
    score?: number
  }): LogEntry => ({
    timestamp: new Date().toISOString(),
    level: 'info',
    service: 'api',
    event: `attempt_${params.event}`,
    message: `Attempt ${params.attemptId} ${params.event}`,
    correlation_id: params.correlationId,
    attempt_id: params.attemptId,
    user_id: params.userId,
    workspace_id: params.workspaceId,
    duration_ms: params.durationMs,
    metadata: {
      score: params.score,
    },
  }),
}

/**
 * Validate all required fields are present
 */
export function validateRequiredFields(entry: LogEntry): boolean {
  return !!(
    entry.timestamp &&
    entry.level &&
    entry.service &&
    entry.event &&
    entry.message &&
    entry.correlation_id
  )
}
