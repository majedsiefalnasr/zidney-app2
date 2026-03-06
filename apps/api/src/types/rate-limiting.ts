/**
 * T039: Rate Limiting Configuration Types
 *
 * Defines the type structure for rate limiting configuration
 * Used in middleware and route decorators
 */

export enum RateLimitIdentifier {
  IP = 'ip',
  USER = 'user',
  WORKSPACE = 'workspace',
  COMBINATION = 'combination', // ip + user + workspace
}

export enum RateLimitStrategy {
  SLIDING_WINDOW = 'sliding_window',
  TOKEN_BUCKET = 'token_bucket',
  FIXED_WINDOW = 'fixed_window',
}

/**
 * Rate limit window configuration
 */
export interface RateLimitWindow {
  limit: number // Max requests in window
  windowMs: number // Window duration in milliseconds
}

/**
 * Rate limit endpoint configuration
 */
export interface RateLimitConfig {
  // Identification
  endpoint: string // e.g., "POST /auth/login"
  identifier: RateLimitIdentifier
  strategy: RateLimitStrategy

  // Limits
  limits: RateLimitWindow // Primary rate limit

  // Optional burst handling
  burst?: {
    enabled: boolean
    maxBurst: number // Max in short burst window
    burstWindowMs: number // Burst window duration
  }

  // Optional exponential backoff
  exponentialBackoff?: {
    enabled: boolean
    maxLockoutDurationMs: number // Max lockout time
    lockoutMultiplier: number // Backoff multiplier (e.g., 2.0)
  }

  // Response handling
  retryAfterHeader: boolean // Include Retry-After header
  includeRateLimitHeaders: boolean // Include X-Rate-Limit-* headers

  // Skiplist
  skipRateLimiting?: string[] // Roles that bypass rate limiting
}

/**
 * Pre-configured rate limit scenarios
 */
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Authentication endpoints
  LOGIN: {
    endpoint: 'POST /auth/login',
    identifier: RateLimitIdentifier.IP,
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    limits: {
      limit: 5,
      windowMs: 60000, // 1 minute
    },
    exponentialBackoff: {
      enabled: true,
      maxLockoutDurationMs: 900000, // 15 minutes
      lockoutMultiplier: 2.0,
    },
    retryAfterHeader: true,
    includeRateLimitHeaders: true,
  },

  LOGIN_PER_USER: {
    endpoint: 'POST /auth/login',
    identifier: RateLimitIdentifier.USER,
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    limits: {
      limit: 10,
      windowMs: 3600000, // 1 hour
    },
    retryAfterHeader: true,
    includeRateLimitHeaders: true,
    skipRateLimiting: ['super_admin'],
  },

  PASSWORD_RESET: {
    endpoint: 'POST /auth/password-reset',
    identifier: RateLimitIdentifier.IP,
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    limits: {
      limit: 3,
      windowMs: 3600000, // 1 hour
    },
    retryAfterHeader: true,
    includeRateLimitHeaders: true,
  },

  ATTEMPT_START: {
    endpoint: 'POST /attempt/start',
    identifier: RateLimitIdentifier.USER,
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    limits: {
      limit: 5,
      windowMs: 60000, // 1 minute (max 5 starts per minute per user)
    },
    retryAfterHeader: true,
    includeRateLimitHeaders: true,
  },

  ATTEMPT_SUBMIT: {
    endpoint: 'POST /attempt/{id}/submit',
    identifier: RateLimitIdentifier.COMBINATION,
    strategy: RateLimitStrategy.FIXED_WINDOW,
    limits: {
      limit: 1,
      windowMs: 1000, // 1 submission per second (idempotency enforced)
    },
    retryAfterHeader: true,
    includeRateLimitHeaders: true,
  },

  WEBSOCKET: {
    endpoint: 'GET /ws/attempt/{id}',
    identifier: RateLimitIdentifier.COMBINATION,
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    limits: {
      limit: 100,
      windowMs: 60000, // 100 messages per 60 seconds
    },
    burst: {
      enabled: true,
      maxBurst: 10,
      burstWindowMs: 1000,
    },
    retryAfterHeader: true,
    includeRateLimitHeaders: true,
  },

  // Admin endpoints (stricter limits)
  ADMIN_OPERATIONS: {
    endpoint: 'POST /admin/**',
    identifier: RateLimitIdentifier.COMBINATION,
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    limits: {
      limit: 10,
      windowMs: 60000, // 10 requests per minute
    },
    retryAfterHeader: true,
    includeRateLimitHeaders: true,
    skipRateLimiting: ['super_admin'],
  },

  ADMIN_READ: {
    endpoint: 'GET /admin/**',
    identifier: RateLimitIdentifier.COMBINATION,
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    limits: {
      limit: 20,
      windowMs: 60000, // 20 requests per minute
    },
    retryAfterHeader: true,
    includeRateLimitHeaders: true,
    skipRateLimiting: ['super_admin'],
  },
}

/**
 * Rate limit response body
 */
export interface RateLimitError {
  code: 'RATE_LIMIT_EXCEEDED'
  message: string
  details: {
    limit: number
    window_seconds: number
    retry_after_seconds: number
  }
  correlationId: string
}

/**
 * Rate limit headers
 */
export interface RateLimitHeaders {
  'X-Rate-Limit-Limit': string
  'X-Rate-Limit-Remaining': string
  'X-Rate-Limit-Reset': string
  'Retry-After'?: string
}

/**
 * Helper function to calculate Retry-After duration
 */
export function calculateRetryAfter(resetTime: number, currentTime: number = Date.now()): number {
  const delayMs = Math.max(0, resetTime - currentTime)
  return Math.ceil(delayMs / 1000) // Convert to seconds
}

/**
 * Helper function to get rate limit config for endpoint
 */
export function getRateLimitConfig(endpoint: string): RateLimitConfig | null {
  // Match endpoint pattern
  for (const [_key, config] of Object.entries(RATE_LIMIT_CONFIGS)) {
    if (matchEndpointPattern(config.endpoint, endpoint)) {
      return config
    }
  }
  return null
}

/**
 * Helper function to match endpoint patterns
 * Supports wildcards: /admin/** matches /admin/anything
 */
function matchEndpointPattern(pattern: string, endpoint: string): boolean {
  if (pattern.includes('**')) {
    const basePath = pattern.replace('**', '')
    return endpoint.startsWith(basePath)
  }

  if (pattern.includes('{')) {
    // Parameterized route: /attempt/{id}/submit matches /attempt/123/submit
    const regex = new RegExp(`^${pattern.replace(/\{[^}]+\}/g, '[^/]+')}$`)
    return regex.test(endpoint)
  }

  return pattern === endpoint
}
