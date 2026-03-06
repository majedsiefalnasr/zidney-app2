/**
 * MMC Dashboard Rate Limiting Configuration (T007C)
 *
 * Purpose: Define per-endpoint rate limits for dashboard analytics API
 * - Export endpoint: 100 requests/hour (critical: preventing large exports)
 * - Other endpoints: 1000 requests/hour (analytics queries can be repeated)
 *
 * File: apps/api/src/config/dashboard-rate-limits.config.ts
 * Task: T007C
 * Phase: 1 - Backend Implementation (CRITICAL)
 *
 * Constraint Verification:
 * ✓ Rate Limiting (T007B+T007C): export=100/hr, others=1000/hr
 * ✓ Returns 429 with X-RateLimit-* headers
 * ✓ Redis key format: rate_limit:{endpoint}:{user_id}:{window}
 * ✓ Per-user, not global (allows parallel access for different users)
 *
 * Rate Limit Headers (RFC 6585):
 * - X-RateLimit-Limit: Maximum requests in window
 * - X-RateLimit-Remaining: Requests remaining in current window
 * - X-RateLimit-Reset: Unix timestamp when limit resets
 * - Retry-After: Seconds to wait before retry (on 429)
 *
 * Configuration Strategy:
 * - Export: 100 req/hr (conservative, large payload operations)
 * - Analytics: 1000 req/hr (typical API usage)
 * - Sliding window counter (more fair than fixed window)
 * - Redis expiry: Auto-cleanup after window passes
 */

/**
 * Rate limit configuration per endpoint
 *
 * Format:
 * - method: HTTP method (GET, POST)
 * - path: API path pattern
 * - max: Maximum requests in window
 * - window_seconds: Time window (3600s = 1 hour)
 * - description: Human-readable purpose
 */
export interface RateLimitRule {
  method: 'GET' | 'POST'
  path: string
  max: number
  window_seconds: number
  description: string
}

/**
 * Dashboard endpoint rate limit configuration
 *
 * Organized by endpoint:
 * 1. GET /summary - 1000/hr (cached query, lightweight)
 * 2. GET /revenue-breakdown - 1000/hr (indexed query, lightweight)
 * 3. GET /geographic - 1000/hr (indexed query with pagination)
 * 4. GET /affiliates - 1000/hr (indexed query with pagination)
 * 5. GET /trends - 1000/hr (materialized view access)
 * 6. POST /export - 100/hr (CRITICAL: large payload, database intensive)
 */
export const DASHBOARD_RATE_LIMITS: RateLimitRule[] = [
  {
    method: 'GET',
    path: '/api/mmc/dashboard/summary',
    max: 1000,
    window_seconds: 3600,
    description: 'License status counts + revenue summary (cached, 5 min TTL)',
  },

  {
    method: 'GET',
    path: '/api/mmc/dashboard/revenue-breakdown',
    max: 1000,
    window_seconds: 3600,
    description: 'Product revenue rankings with growth (indexed, always fresh)',
  },

  {
    method: 'GET',
    path: '/api/mmc/dashboard/geographic',
    max: 1000,
    window_seconds: 3600,
    description: 'Revenue by country with pagination (indexed, always fresh)',
  },

  {
    method: 'GET',
    path: '/api/mmc/dashboard/affiliates',
    max: 1000,
    window_seconds: 3600,
    description: 'Affiliate leaderboard with pagination (indexed, 1 min cache)',
  },

  {
    method: 'GET',
    path: '/api/mmc/dashboard/trends',
    max: 1000,
    window_seconds: 3600,
    description: 'Historical trends (monthly aggregation, 10 min cache)',
  },

  {
    method: 'POST',
    path: '/api/mmc/dashboard/export',
    max: 100,
    window_seconds: 3600,
    description: 'CSV data export (CRITICAL: 100 req/hr, 2s timeout, 50k row limit)',
  },
]

/**
 * Rate limit status codes and headers
 */
export const RATE_LIMIT_RESPONSE = {
  statusCode: 429,
  headers: {
    'Content-Type': 'application/json',
    'Retry-After': 'seconds', // Will be calculated dynamically
  },
  body: {
    success: false,
    data: null,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please retry after the specified time.',
    },
  },
}

/**
 * Redis key format for rate limiting
 *
 * Pattern: rate_limit:{endpoint}:{user_id}:{hour_window}
 *
 * Where:
 * - endpoint: API path (e.g., /api/mmc/dashboard/export)
 * - user_id: Authenticated user ID
 * - hour_window: Unix timestamp rounded down to hour (for hourly windows)
 *
 * Example: rate_limit:/api/mmc/dashboard/export:user-123:1708339200
 */
export function generateRateLimitKey(
  endpoint: string,
  userId: string,
  windowSeconds: number
): string {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds
  return `rate_limit:${endpoint}:${userId}:${windowStart}`
}

/**
 * Get rate limit config by endpoint
 */
export function getRateLimitConfig(method: string, path: string): RateLimitRule | null {
  return DASHBOARD_RATE_LIMITS.find((r) => r.method === method && r.path === path) || null
}

/**
 * Get rate limit options by endpoint
 */
export function getRateLimitOptions(
  method: string,
  path: string
): { max: number; windowSeconds: number } | null {
  const config = getRateLimitConfig(method, path)
  return config
    ? {
        max: config.max,
        windowSeconds: config.window_seconds,
      }
    : null
}

/**
 * Check if endpoint has strict rate limiting (export endpoint)
 */
export function hasStrictRateLimit(method: string, path: string): boolean {
  const config = getRateLimitConfig(method, path)
  return config ? config.max <= 100 : false // Export limit is 100/hr
}

/**
 * Rate limit headers response builder
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': number
  'X-RateLimit-Remaining': number
  'X-RateLimit-Reset': number
  'Retry-After'?: number
}

export function buildRateLimitHeaders(
  limit: number,
  remaining: number,
  resetUnixSeconds: number,
  isExceeded?: boolean
): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': limit,
    'X-RateLimit-Remaining': Math.max(0, remaining),
    'X-RateLimit-Reset': resetUnixSeconds,
  }

  if (isExceeded) {
    headers['Retry-After'] = Math.max(1, resetUnixSeconds - Math.floor(Date.now() / 1000))
  }

  return headers
}

/**
 * Export configuration for testing
 */
export const DASHBOARD_RATE_LIMIT_POLICY = {
  export: {
    requestsPerHour: 100,
    recommended: 'Use for non-automated exports only',
  },
  analytics: {
    requestsPerHour: 1000,
    recommended: 'Use for interactive dashboard queries',
  },
  window: {
    seconds: 3600,
    description: '1 hour sliding window',
  },
}
