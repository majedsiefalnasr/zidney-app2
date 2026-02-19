/**
 * T012: Redis Rate Limiting Schema Definition
 *
 * Purpose: Define all Redis key patterns for rate limiting across layers
 * Layer: Shared Package (Redis)
 * Transactional: No (Redis operations atomic per key)
 * Idempotent: Yes (schema definitions idempotent)
 * Version Enforcement: Not applicable (Redis is ephemeral)
 * License Middleware: Not applicable
 *
 * Constitutional Compliance:
 * ✓ Tenant isolation (all keys namespaced with workspace_id)
 * ✓ No cross-tenant shared buckets (each tenant has separate key space)
 * ✓ Structured naming for observability
 */

export const REDIS_RATE_LIMIT_SCHEMAS = {
  // Authentication rate limiting
  AUTH_LOGIN_BY_IP: {
    pattern: 'rate:v1:auth:login:ip:{ip}',
    ttl: 3600, // 1 hour
    limit: 20, // 20 attempts
    window: 3600, // per hour
    description: 'Login attempts per IP address',
  },

  AUTH_LOGIN_BY_USER: {
    pattern: 'rate:v1:auth:login:user:{user_id}:{workspace_id}',
    ttl: 3600, // 1 hour
    limit: 10, // 10 attempts
    window: 3600, // per hour
    description: 'Login attempts per user per workspace',
  },

  AUTH_LOGIN_LOCK: {
    pattern: 'lock:v1:auth:user:{user_id}:{workspace_id}',
    ttl: 300, // 5 minutes exponential backoff
    description: 'Account lock due to failed login attempts',
  },

  AUTH_PASSWORD_RESET_BY_IP: {
    pattern: 'rate:v1:auth:password-reset:ip:{ip}',
    ttl: 3600,
    limit: 5, // 5 resets per IP per hour
    window: 3600,
    description: 'Password reset attempts per IP',
  },

  AUTH_PASSWORD_RESET_BY_USER: {
    pattern: 'rate:v1:auth:password-reset:user:{user_id}:{workspace_id}',
    ttl: 3600,
    limit: 2, // 2 resets per user per hour
    window: 3600,
    description: 'Password reset attempts per user',
  },

  // Attempt lifecycle rate limiting
  ATTEMPT_START_BY_USER: {
    pattern: 'rate:v1:attempt:start:user:{user_id}:{workspace_id}',
    ttl: 60,
    limit: 5, // 5 starts per minute
    window: 60,
    description: 'Attempt starts per user per minute',
  },

  ATTEMPT_START_BY_WORKSPACE: {
    pattern: 'rate:v1:attempt:start:workspace:{workspace_id}',
    ttl: 60,
    limit: 100, // 100 starts per workspace per minute
    window: 60,
    description: 'Attempt starts per workspace per minute',
  },

  ATTEMPT_SUBMIT_BY_ID: {
    pattern: 'rate:v1:attempt:submit:attempt:{attempt_id}',
    ttl: 30,
    limit: 1, // 1 submission per attempt (idempotency enforced)
    window: 30,
    description: 'Submission attempts per attempt (strict: 1 per attempt)',
  },

  // WebSocket rate limiting
  WS_CONNECTION: {
    pattern: 'rate:v1:ws:connection:{user_id}:{attempt_id}',
    ttl: 1800, // 30 minutes
    limit: 1, // 1 connection per user per attempt
    window: 1800,
    description: 'WebSocket connections per user per attempt',
  },

  WS_MESSAGE_RATE: {
    pattern: 'rate:v1:ws:msg:{user_id}:{attempt_id}',
    ttl: 60,
    limit: 100, // 100 messages per minute
    window: 60,
    burst: 10, // 10 message burst capacity
    description: 'WebSocket messages per user per attempt (with burst)',
  },

  // Idempotency cache (dual-layer with DB)
  IDEMPOTENCY_CACHE: {
    pattern: 'idempotent:v1:attempt:{attempt_id}:{idempotency_key}',
    ttl: 86400, // 24 hours (matches DB TTL)
    description: 'Cached submission result for deduplication',
  },

  // Admin endpoints rate limiting
  ADMIN_OPERATIONS_BY_IP: {
    pattern: 'rate:v1:admin:operations:ip:{ip}',
    ttl: 60,
    limit: 10, // 10 admin ops per IP per minute (strict)
    window: 60,
    description: 'Admin operations per IP (DLQ, rate limit inspection)',
  },

  ADMIN_OPERATIONS_BY_USER: {
    pattern: 'rate:v1:admin:operations:user:{user_id}:{workspace_id}',
    ttl: 60,
    limit: 20, // 20 admin ops per user per minute
    window: 60,
    description: 'Admin operations per user per workspace',
  },

  // Internal service rate limiting (worker callbacks, internal APIs)
  INTERNAL_API_CALLBACK: {
    pattern: 'rate:v1:internal:callback:{workspace_id}',
    ttl: 60,
    limit: 1000, // High limit for internal service
    window: 60,
    description: 'Internal API callbacks (worker job completion)',
  },
} as const

/**
 * Export rate limit config by endpoint
 */
export const RATE_LIMIT_BY_ENDPOINT = {
  'POST /auth/login': REDIS_RATE_LIMIT_SCHEMAS.AUTH_LOGIN_BY_IP,
  'POST /auth/logout': null, // No rate limit (cleanup operation)
  'POST /auth/password-reset':
    REDIS_RATE_LIMIT_SCHEMAS.AUTH_PASSWORD_RESET_BY_IP,
  'POST /attempt/{id}/start': REDIS_RATE_LIMIT_SCHEMAS.ATTEMPT_START_BY_USER,
  'POST /attempt/{id}/submit': REDIS_RATE_LIMIT_SCHEMAS.ATTEMPT_SUBMIT_BY_ID,
  'GET /attempt/{id}/status': null, // No rate limit (read operation)
  'GET /ws/attempt/{id}': REDIS_RATE_LIMIT_SCHEMAS.WS_CONNECTION,
  'GET /admin/workspace/{id}/dlq':
    REDIS_RATE_LIMIT_SCHEMAS.ADMIN_OPERATIONS_BY_IP,
  'POST /admin/workspace/{id}/dlq/{dlqId}/retry':
    REDIS_RATE_LIMIT_SCHEMAS.ADMIN_OPERATIONS_BY_USER,
}

/**
 * Get rate limit config for an endpoint
 */
export function getRateLimitConfig(endpoint: string) {
  return (
    RATE_LIMIT_BY_ENDPOINT[endpoint as keyof typeof RATE_LIMIT_BY_ENDPOINT] ||
    null
  )
}

/**
 * Format Redis key with tenant isolation
 */
export function formatRedisKey(
  pattern: string,
  params: Record<string, string>
): string {
  let key = pattern
  for (const [param, value] of Object.entries(params)) {
    key = key.replace(`{${param}}`, value)
  }
  return key
}
