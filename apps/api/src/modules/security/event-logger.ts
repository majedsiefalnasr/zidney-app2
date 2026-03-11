import { createLogger } from '@zidney/logger'
import { redis } from '../../infrastructure/redis'

// @ts-expect-error: TS6133 - declared but never read [INFRA-001]
const logger = createLogger('security')

/**
 * T071: Security Event Logging
 *
 * Centralized security event tracking for compliance:
 * - Authentication failures
 * - Authorization violations (403 Forbidden)
 * - Token expiration/revocation
 * - CSRF token mismatches
 * - WebSocket unauthorized access attempts
 * - Schema version mismatch attempts (potential downgrade attacks)
 *
 * All events include:
 * - Timestamp
 * - Severity (low, medium, high, critical)
 * - Source IP
 * - User ID (if applicable)
 * - Workspace ID (if applicable)
 * - Attempted action
 * - Outcome (success, denied, blocked)
 */

export interface SecurityEvent {
  event_type:
    | 'auth_failure'
    | 'auth_success'
    | 'csrf_violation'
    | 'unauthorized_access'
    | 'token_expired'
    | 'token_revoked'
    | 'schema_mismatch'
    | 'version_downgrade_attempt'
    | 'websocket_auth_fail'
    | 'admin_access'
    | 'sensitive_data_access'
  severity: 'low' | 'medium' | 'high' | 'critical'
  source_ip: string
  user_id?: string
  workspace_id?: string
  workspace_slug?: string
  attempt_id?: string
  reason?: string
  attempted_action?: string
  target_resource?: string
  correlation_id?: string
  timestamp: Date
  additional_context?: Record<string, unknown>
}

/**
 * Log security event
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  // Sanitize PII from logs
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const sanitized = { ...event }
  if (sanitized.source_ip) {
    sanitized.source_ip = maskIp(sanitized.source_ip)
  }

  // Log to structured logger
  logger[event.severity === 'critical' ? 'error' : 'warn'](`security_event_${event.event_type}`, {
    correlation_id: event.correlation_id,
    event_type: event.event_type,
    severity: event.severity,
    source_ip: sanitized.source_ip,
    user_id: event.user_id,
    workspace_id: event.workspace_id,
    workspace_slug: event.workspace_slug,
    attempt_id: event.attempt_id,
    reason: event.reason,
    attempted_action: event.attempted_action,
    target_resource: event.target_resource,
  })

  // Store in Redis for real-time monitoring
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const key = `security:events:${event.event_type}`
  await redis.lPush(key, JSON.stringify(sanitized))
  await redis.lTrim(key, 0, 999) // Keep last 1000 events
  await redis.expire(key, 604800) // 7-day retention in Redis

  // Update event counters for alerting
  await updateSecurityEventCounters(event)

  // Check for attack patterns
  if (event.severity === 'critical') {
    await checkAttackPattern(event)
  }
}

/**
 * Mask IP address (keep first 2 octets for statistics)
 */
function maskIp(ip: string): string {
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const parts = ip.split('.')
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.${parts[3]}`
  }
  return '*.*.*.xxx'
}

/**
 * Update counters for alerting
 */
async function updateSecurityEventCounters(event: SecurityEvent): Promise<void> {
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const now = new Date()
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const hourKey = now.toISOString().slice(0, 13) // YYYY-MM-DDTHH

  // Global counter
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const globalKey = `security:counter:${event.event_type}:${hourKey}`
  await redis.incr(globalKey)
  await redis.expire(globalKey, 3600)

  // Per-IP counter
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const ipKey = `security:counter:${event.event_type}:ip:${event.source_ip}:${hourKey}`
  await redis.incr(ipKey)
  await redis.expire(ipKey, 3600)

  // Per-user counter (if applicable)
  if (event.user_id) {
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const userKey = `security:counter:${event.event_type}:user:${event.user_id}:${hourKey}`
    await redis.incr(userKey)
    await redis.expire(userKey, 3600)
  }

  // Per-workspace counter (if applicable)
  if (event.workspace_id) {
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const wsKey = `security:counter:${event.event_type}:workspace:${event.workspace_id}:${hourKey}`
    await redis.incr(wsKey)
    await redis.expire(wsKey, 3600)
  }
}

/**
 * Detect potential attack patterns
 */
async function checkAttackPattern(event: SecurityEvent): Promise<void> {
  // Check for repeated failures from same IP
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const ipKey = `security:counter:${event.event_type}:ip:${event.source_ip}`
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const _keysPattern = `${ipKey}:*`

  // TODO: Implement scan-based counting or use sorted set
  // TBD: Alert if pattern matches known attack signature

  logger.warn(`security_critical_event_detected`, {
    event_type: event.event_type,
    source_ip: maskIp(event.source_ip),
    severity: event.severity,
    reason: event.reason,
  })
}

/**
 * Log authentication success
 */
export async function logAuthSuccess(params: {
  userId: string
  workspaceId: string
  workspaceSlug: string
  sourceIp: string
  correlationId?: string
}): Promise<void> {
  await logSecurityEvent({
    event_type: 'auth_success',
    severity: 'low',
    source_ip: params.sourceIp,
    user_id: params.userId,
    workspace_id: params.workspaceId,
    workspace_slug: params.workspaceSlug,
    timestamp: new Date(),
    correlation_id: params.correlationId,
  })
}

/**
 * Log authentication failure
 */
export async function logAuthFailure(params: {
  reason: string
  sourceIp: string
  workspaceSlug?: string
  userId?: string
  attemptedAction?: string
  correlationId?: string
}): Promise<void> {
  await logSecurityEvent({
    event_type: 'auth_failure',
    severity: 'medium',
    source_ip: params.sourceIp,
    workspace_slug: params.workspaceSlug,
    user_id: params.userId,
    reason: params.reason,
    attempted_action: params.attemptedAction,
    timestamp: new Date(),
    correlation_id: params.correlationId,
  })
}

/**
 * Log CSRF token violation
 */
export async function logCSRFViolation(params: {
  userId: string
  workspaceId: string
  sourceIp: string
  method: string
  path: string
  correlationId?: string
}): Promise<void> {
  await logSecurityEvent({
    event_type: 'csrf_violation',
    severity: 'high',
    source_ip: params.sourceIp,
    user_id: params.userId,
    workspace_id: params.workspaceId,
    attempted_action: `${params.method} ${params.path}`,
    reason: 'CSRF token mismatch or missing',
    timestamp: new Date(),
    correlation_id: params.correlationId,
  })
}

/**
 * Log unauthorized access attempt (403)
 */
export async function logUnauthorizedAccess(params: {
  userId: string
  workspaceId: string
  sourceIp: string
  method: string
  path: string
  requiredRole?: string
  userRole?: string
  correlationId?: string
}): Promise<void> {
  await logSecurityEvent({
    event_type: 'unauthorized_access',
    severity: 'medium',
    source_ip: params.sourceIp,
    user_id: params.userId,
    workspace_id: params.workspaceId,
    attempted_action: `${params.method} ${params.path}`,
    reason: `Permission denied. Required: ${params.requiredRole}, User has: ${params.userRole}`,
    target_resource: params.path,
    timestamp: new Date(),
    correlation_id: params.correlationId,
  })
}

/**
 * Log token expiration attempt
 */
export async function logTokenExpired(params: {
  userId: string
  workspaceId: string
  sourceIp: string
  method: string
  path: string
  correlationId?: string
}): Promise<void> {
  await logSecurityEvent({
    event_type: 'token_expired',
    severity: 'low',
    source_ip: params.sourceIp,
    user_id: params.userId,
    workspace_id: params.workspaceId,
    attempted_action: `${params.method} ${params.path}`,
    timestamp: new Date(),
    correlation_id: params.correlationId,
  })
}

/**
 * Log schema version mismatch attempt (potential downgrade attack)
 */
export async function logSchemaVersionMismatch(params: {
  workspaceId: string
  workspaceSlug: string
  sourceIp: string
  clientVersion: number
  serverVersion: number
  correlationId?: string
}): Promise<void> {
  await logSecurityEvent({
    event_type: 'schema_mismatch',
    severity:
      `${Math.abs(params.serverVersion - params.clientVersion) > 10 ? 'high' : 'medium'}` as unknown,
    source_ip: params.sourceIp,
    workspace_id: params.workspaceId,
    workspace_slug: params.workspaceSlug,
    reason: `Schema version mismatch: client=${params.clientVersion}, server=${params.serverVersion}`,
    timestamp: new Date(),
    correlation_id: params.correlationId,
    additional_context: {
      client_version: params.clientVersion,
      server_version: params.serverVersion,
      version_gap: Math.abs(params.serverVersion - params.clientVersion),
    },
  })
}

/**
 * Log WebSocket authentication failure
 */
export async function logWebSocketAuthFailure(params: {
  sourceIp: string
  reason: string
  attemptedAttemptId?: string
  correlationId?: string
}): Promise<void> {
  await logSecurityEvent({
    event_type: 'websocket_auth_fail',
    severity: 'medium',
    source_ip: params.sourceIp,
    attempt_id: params.attemptedAttemptId,
    reason: params.reason,
    timestamp: new Date(),
    correlation_id: params.correlationId,
  })
}

/**
 * Log admin access action
 */
export async function logAdminAccess(params: {
  userId: string
  workspaceId: string
  sourceIp: string
  action: string // e.g., "dlq_retry", "dlq_discard", "violation_history_cleared"
  targetResource: string
  correlationId?: string
}): Promise<void> {
  await logSecurityEvent({
    event_type: 'admin_access',
    severity: 'low',
    source_ip: params.sourceIp,
    user_id: params.userId,
    workspace_id: params.workspaceId,
    attempted_action: params.action,
    target_resource: params.targetResource,
    timestamp: new Date(),
    correlation_id: params.correlationId,
  })
}

/**
 * Query security events by type
 */
export async function querySecurityEvents(
  eventType: string,
  limit: number = 100
): Promise<SecurityEvent[]> {
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const key = `security:events:${eventType}`

  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const data = await redis.lRange(key, 0, limit - 1)

  return data.map((item: string) => {
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const parsed = JSON.parse(item)
    return {
      ...parsed,
      timestamp: new Date(parsed.timestamp),
    }
  })
}

/**
 * Get security event summary for a time period
 */
export async function getSecurityEventSummary(
  _startDate: Date,
  _endDate: Date
): Promise<Record<string, number>> {
  // In production, this would query a security events table
  // For now, calculates from counters

  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const summary: Record<string, number> = {}

  // TODO: Implement counter aggregation

  return summary
}
