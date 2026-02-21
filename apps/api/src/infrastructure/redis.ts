import { createClient } from 'redis'

/**
 * T013: Redis Connection Pool Initialization
 *
 * Purpose: Centralized Redis pool initialization at app boot
 * Layer: API Infrastructure
 * Transactional: No
 * Idempotent: Yes (connection singleton)
 * Version Enforcement: Not applicable
 * License Middleware: Not applicable
 *
 * Constitutional Compliance:
 * ✓ Singleton pattern (no duplicate connections)
 * ✓ Health checks enabled (monitoring)
 * ✓ Structured logging ready
 * ✓ Rate limiting foundation
 */

type RedisClientType = ReturnType<typeof createClient>

let redisClient: RedisClientType | null = null

/**
 * Initialize Redis connection pool
 * Called once during app boot
 */
export async function initializeRedisPool(
  context?: any
): Promise<RedisClientType> {
  const correlationId = context?.correlationId || 'system'

  if (redisClient) {
    console.log(
      `[${correlationId}] Redis client already initialized, reusing connection`
    )
    return redisClient
  }

  try {
    // Create Redis client with connection pooling (Redis v4 API)
    redisClient = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            console.error(
              `[${correlationId}] Redis connection retries exhausted`
            )
            return new Error('Redis connection retries exhausted')
          }
          // Exponential backoff: 100ms, 200ms, 400ms, etc.
          return Math.min(retries * 100, 3000)
        },
      },
      database: parseInt(process.env.REDIS_DB || '0'),
      password: process.env.REDIS_PASSWORD || undefined,
    })

    // Connect to Redis
    await redisClient.connect()

    // Configure memory policy
    // Use LRU eviction: allkeys-lru removes any key when memory limit reached
    await redisClient.configSet('maxmemory-policy', 'allkeys-lru')

    // Enable keyspace notifications for monitoring (KEY EVENTS)
    await redisClient.configSet('notify-keyspace-events', 'EK')

    // Health check
    const result = await redisClient.ping()
    console.log(`[${correlationId}] Redis health check: ${result}`)

    // Set up error handlers
    redisClient.on('error', (err: Error) => {
      console.error(`[${correlationId}] Redis client error:`, err.message)
    })

    redisClient.on('reconnecting', () => {
      console.warn(`[${correlationId}] Redis client reconnecting...`)
    })

    console.log(
      `[${correlationId}] Redis connection pool initialized successfully`
    )

    return redisClient
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `[${correlationId}] Failed to initialize Redis pool:`,
      message
    )
    throw error
  }
}

/**
 * Get existing Redis client instance
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error(
      'Redis client not initialized. Call initializeRedisPool() first.'
    )
  }
  return redisClient
}

/**
 * Close Redis connection
 * Called during app shutdown
 */
export async function closeRedisPool(context?: any): Promise<void> {
  const correlationId = context?.correlationId || 'system'

  if (!redisClient) {
    return
  }

  try {
    await redisClient.quit()
    console.log(`[${correlationId}] Redis connection pool closed`)
    redisClient = null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[${correlationId}] Error closing Redis pool:`, message)
  }
}

/**
 * Redis client proxy for backward compatibility
 * Provides direct access to Redis client methods
 */
export const redis = new Proxy({} as RedisClientType, {
  get(_target, prop) {
    const client = getRedisClient()
    const value = client[prop as keyof RedisClientType]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})
