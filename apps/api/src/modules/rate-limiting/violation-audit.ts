import { logger } from '../../infrastructure/logger'
import { redis } from '../../infrastructure/redis'

/**
 * T070: Rate Limit Violation Audit
 *
 * Track rate limit violations for security monitoring:
 * - Store violation count per limit type
 * - Track patterns of abuse (repeated IPs, users)
 * - Alert on spike in violations
 * - Support admin queries for investigation
 *
 * Redis structure:
 * - ratelimit:violations:{limitType}:{identifier} → count and timestamps
 * - ratelimit:patterns:{limitType} → aggregated pattern data
 */

export interface RateLimitViolation {
  timestamp: Date
  limit_type: string
  identifier: string // IP, user_id, workspace_id, or combination
  attempted_count: number
  limit: number
  window_seconds: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  source_ip?: string
  user_agent?: string
}

/**
 * Log rate limit violation to Redis and structured logs
 */
export async function logRateLimitViolation(params: {
  limitType: 'login' | 'api' | 'websocket' | 'admin'
  identifier: string
  attemptedCount: number
  limit: number
  windowSeconds: number
  sourceIp?: string
  userId?: string
  workspaceId?: string
  userAgent?: string
  correlationId?: string
}): Promise<void> {
  // Determine severity based on ratio
  const ratio = params.attemptedCount / params.limit
  let severity: 'low' | 'medium' | 'high' | 'critical'

  if (ratio >= 3) {
    severity = 'critical'
  } else if (ratio >= 2) {
    severity = 'high'
  } else if (ratio >= 1.5) {
    severity = 'medium'
  } else {
    severity = 'low'
  }

  const violation: RateLimitViolation = {
    timestamp: new Date(),
    limit_type: params.limitType,
    identifier: params.identifier,
    attempted_count: params.attemptedCount,
    limit: params.limit,
    window_seconds: params.windowSeconds,
    severity,
    source_ip: params.sourceIp,
    user_agent: params.userAgent,
  }

  // Store violation in Redis
  const keyViolation = `ratelimit:violations:${params.limitType}:${params.identifier}`
  const violationData = JSON.stringify(violation)

  await redis.lpush(keyViolation, violationData)
  await redis.ltrim(keyViolation, 0, 99) // Keep last 100 violations
  await redis.expire(keyViolation, 86400) // 24-hour retention

  // Update pattern tracking
  const keyPattern = `ratelimit:patterns:${params.limitType}`
  const patternData = {
    identifier: params.identifier,
    count: 1,
    last_violation: new Date().toISOString(),
    severity,
  }

  await redis.hset(keyPattern, params.identifier, JSON.stringify(patternData))
  await redis.expire(keyPattern, 86400)

  // Structured logging
  logger.warn(`rate_limit_violation_${params.limitType}`, {
    correlation_id: params.correlationId || 'unknown',
    limit_type: params.limitType,
    identifier: params.identifier,
    attempted_count: params.attemptedCount,
    limit: params.limit,
    severity,
    source_ip: params.sourceIp,
    user_id: params.userId,
    workspace_id: params.workspaceId,
  })

  // Alert on critical violations
  if (severity === 'critical') {
    logger.error(`rate_limit_critical_alert`, {
      correlation_id: params.correlationId || 'unknown',
      limit_type: params.limitType,
      identifier: params.identifier,
      severity,
      source_ip: params.sourceIp,
      user_id: params.userId,
      workspace_id: params.workspaceId,
      message: `Critical rate limit violation: ${params.limitType} from ${params.identifier}`,
    })

    // TODO: Send to monitoring system (Slack, PagerDuty, etc.)
  }
}

/**
 * Query recent violations for an identifier
 */
export async function getRecentViolations(
  limitType: string,
  identifier: string,
  limit: number = 10
): Promise<RateLimitViolation[]> {
  const key = `ratelimit:violations:${limitType}:${identifier}`

  const data = await redis.lrange(key, 0, limit - 1)

  return data.map((item: string) => JSON.parse(item))
}

/**
 * Get aggregated violation patterns for a limit type
 */
export async function getViolationPatterns(
  limitType: string
): Promise<Map<string, any>> {
  const key = `ratelimit:patterns:${limitType}`

  const data = await redis.hgetall(key)

  const patterns = new Map()
  for (const [identifier, dataStr] of Object.entries(data)) {
    patterns.set(identifier, JSON.parse(dataStr as string))
  }

  return patterns
}

/**
 * Get top violators for a limit type
 */
export async function getTopViolators(
  limitType: string,
  count: number = 10
): Promise<Array<{ identifier: string; violationCount: number }>> {
  const patterns = await getViolationPatterns(limitType)

  const sorted = Array.from(patterns.entries())
    .map(([identifier, data]) => ({
      identifier,
      violationCount: data.count || 0,
    }))
    .sort((a, b) => b.violationCount - a.violationCount)
    .slice(0, count)

  return sorted
}

/**
 * Check if identifier is blocked (too many violations)
 *
 * Returns true if violations exceed threshold in recent period
 */
export async function isIdentifierBlocked(
  limitType: string,
  identifier: string,
  thresholdViolations: number = 5,
  windowMinutes: number = 10
): Promise<boolean> {
  const recentViolations = await getRecentViolations(
    limitType,
    identifier,
    thresholdViolations
  )

  if (recentViolations.length < thresholdViolations) {
    return false
  }

  // Check if violations are within window
  const now = Date.now()
  const windowMs = windowMinutes * 60 * 1000

  const recentCount = recentViolations.filter((v) => {
    const violationTime = new Date(v.timestamp).getTime()
    return now - violationTime < windowMs
  }).length

  return recentCount >= thresholdViolations
}

/**
 * Clear violation history for an identifier (admin action)
 */
export async function clearViolationHistory(
  limitType: string,
  identifier: string
): Promise<void> {
  const keyViolation = `ratelimit:violations:${limitType}:${identifier}`
  const keyPattern = `ratelimit:patterns:${limitType}`

  await redis.del(keyViolation)
  await redis.hdel(keyPattern, identifier)

  logger.info(`rate_limit_violation_history_cleared`, {
    limit_type: limitType,
    identifier,
  })
}

/**
 * Export violation data for compliance/audit
 */
export async function exportViolationData(
  limitType: string,
  startDate: Date,
  endDate: Date
): Promise<RateLimitViolation[]> {
  // In production, this would query a time-series DB or audit log table
  // For now, returns data stored in Redis (limited to 24-hour retention)

  const patterns = await getViolationPatterns(limitType)
  const violations: RateLimitViolation[] = []

  for (const [identifier] of patterns.entries()) {
    const recent = await getRecentViolations(limitType, identifier, 100)

    violations.push(
      ...recent.filter((v) => {
        const t = new Date(v.timestamp)
        return t >= startDate && t <= endDate
      })
    )
  }

  return violations.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

/**
 * Alert threshold configuration for violation spikes
 */
export interface ViolationAlertConfig {
  minViolationsPerMinute: number // Alert if > N violations/min detected
  criticalProbability: number // Alert threshold for % critical violations
  consecutiveErrors: number // Alert after N consecutive critical violations
  blockDuration: number // Duration (seconds) to block identifier after exceeded threshold
}

/**
 * Default alert configuration
 */
export const DEFAULT_VIOLATION_ALERT_CONFIG: ViolationAlertConfig = {
  minViolationsPerMinute: 10,
  criticalProbability: 0.5, // 50%+ critical violations
  consecutiveErrors: 3,
  blockDuration: 900, // 15 minutes
}

/**
 * Check if pattern indicates abuse and should trigger alert
 */
export async function checkAbusePattern(
  limitType: string,
  config: ViolationAlertConfig = DEFAULT_VIOLATION_ALERT_CONFIG
): Promise<{
  isAbuse: boolean
  reason?: string
  affectedIdentifiers: string[]
}> {
  const patterns = await getViolationPatterns(limitType)

  // Calculate violations per minute
  const now = Date.now()
  const oneMinuteAgo = now - 60000

  let recentViolationCount = 0
  const affectedIdentifiers: string[] = []

  for (const [identifier, data] of patterns.entries()) {
    const lastViolation = new Date(data.last_violation).getTime()
    if (lastViolation > oneMinuteAgo) {
      recentViolationCount++
      affectedIdentifiers.push(identifier)
    }
  }

  if (recentViolationCount > config.minViolationsPerMinute) {
    return {
      isAbuse: true,
      reason: `Too many violations: ${recentViolationCount} in last minute`,
      affectedIdentifiers,
    }
  }

  return {
    isAbuse: false,
    affectedIdentifiers: [],
  }
}
