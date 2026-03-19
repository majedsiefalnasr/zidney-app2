/**
 * Safe Redis Operations Wrapper
 *
 * Provides error handling and observability for Redis commands.
 * Prevents unhandled rejections from Redis connection/operation errors.
 */

import { logger } from '@zidney/logger'
import type { Redis } from 'ioredis'

export interface RedisOpResult<T> {
  success: boolean
  data?: T
  error?: string
  durationMs: number
}

/**
 * Execute a Redis operation with error handling
 */
export async function safeRedisOp<T>(
  operation: (redis: Redis) => Promise<T>,
  redis: Redis,
  operationName: string,
  context?: Record<string, unknown>
): Promise<RedisOpResult<T>> {
  const startTime = Date.now()

  try {
    const data = await operation(redis)
    const durationMs = Date.now() - startTime

    if (durationMs > 1000) {
      logger.warn('Redis operation slow', {
        operation: operationName,
        duration_ms: durationMs,
        ...context,
      })
    }

    return { success: true, data, durationMs }
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : String(error)

    logger.error('Redis operation failed', {
      operation: operationName,
      error: errorMsg,
      duration_ms: durationMs,
      ...context,
    })

    return {
      success: false,
      error: errorMsg,
      durationMs,
    }
  }
}

/**
 * Safe wrapper for redis.del()
 */
export async function safeRedisDelete(
  redis: Redis,
  ...keys: string[]
): Promise<RedisOpResult<number>> {
  return safeRedisOp(
    async (r) => {
      const result = await r.del(...keys)
      return result
    },
    redis,
    'del',
    { keys_count: keys.length }
  )
}

/**
 * Safe wrapper for redis.zadd()
 */
export async function safeRedisZAdd(
  redis: Redis,
  key: string,
  score: number,
  member: string
): Promise<RedisOpResult<number>> {
  return safeRedisOp(
    async (r) => {
      const result = await r.zadd(key, score, member)
      return result
    },
    redis,
    'zadd',
    { key, score }
  )
}

/**
 * Safe wrapper for redis.lpush()
 */
export async function safeRedisLPush(
  redis: Redis,
  key: string,
  ...values: string[]
): Promise<RedisOpResult<number>> {
  return safeRedisOp(
    async (r) => {
      const result = await r.lpush(key, ...values)
      return result
    },
    redis,
    'lpush',
    { key, values_count: values.length }
  )
}

/**
 * Safe wrapper for redis.expire()
 */
export async function safeRedisExpire(
  redis: Redis,
  key: string,
  seconds: number
): Promise<RedisOpResult<number>> {
  return safeRedisOp(
    async (r) => {
      const result = await r.expire(key, seconds)
      return result
    },
    redis,
    'expire',
    { key, seconds }
  )
}

/**
 * Safe wrapper for redis.zrangebyscore()
 */
export async function safeRedisZRangeByScore(
  redis: Redis,
  key: string,
  min: string | number,
  max: string | number
): Promise<RedisOpResult<string[]>> {
  return safeRedisOp(
    async (r) => {
      const result = await r.zrangebyscore(key, min, max)
      return result
    },
    redis,
    'zrangebyscore',
    { key }
  )
}

/**
 * Safe wrapper for redis.zremrangebyscore()
 */
export async function safeRedisZRemRangeByScore(
  redis: Redis,
  key: string,
  min: string | number,
  max: string | number
): Promise<RedisOpResult<number>> {
  return safeRedisOp(
    async (r) => {
      const result = await r.zremrangebyscore(key, min, max)
      return result
    },
    redis,
    'zremrangebyscore',
    { key }
  )
}
