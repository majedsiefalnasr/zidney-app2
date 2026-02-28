/**
 * @zidney/redis-utils
 *
 * Redis utilities for rate limiting and caching
 */

import { Redis } from 'ioredis'

/**
 * Creates a new Redis client using environment variables.
 * Pattern: module-scoped singleton — call once at module scope, never per-request.
 *
 * Env vars: REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB
 */
export function createRedisClient(): Redis {
  return new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'],
    db: parseInt(process.env['REDIS_DB'] ?? '0', 10),
    lazyConnect: false,
    enableOfflineQueue: true,
    maxRetriesPerRequest: 3,
  })
}

// Algorithms
export {
  createSlidingWindowLimiter,
  SlidingWindowRateLimiter,
  type RateLimitResult,
  type RateLimitWindow,
} from './algorithms/sliding-window'

export {
  createTokenBucketLimiter,
  TokenBucketRateLimiter,
  type TokenBucketConfig,
  type TokenBucketResult,
} from './algorithms/token-bucket'

// Schemas
export {
  formatRedisKey,
  getRateLimitConfig,
  RATE_LIMIT_BY_ENDPOINT,
  REDIS_RATE_LIMIT_SCHEMAS,
} from './schemas/rate-limiting'
