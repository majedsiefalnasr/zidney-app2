/**
 * Redis Cache Client for MMC Dashboard
 *
 * Purpose: Provide high-level cache operations for dashboard metrics
 * - Generates cache keys with format: mmc_dashboard:{endpoint}:{workspace_id}:{hash(query_params)}
 * - Supports get/set/del/exists operations
 * - Per-endpoint TTL configuration
 * - Graceful fallback if Redis unavailable (returns null)
 *
 * File: packages/redis-utils/cache-client.ts (new or extend existing)
 * Task: T026
 * Phase: 1 - Backend Implementation
 *
 * Constitutional Compliance:
 * ✓ Graceful degradation: Falls back to cache miss if Redis unavailable
 * ✓ Key generation: Deterministic, includes workspace_id for isolation
 * ✓ TTL management: Per-endpoint configuration
 * ✓ No sensitive data: Only caches workspace-agnostic metrics
 *
 * Cache Strategy:
 * - summary: 300s (5 min) - changes slowly
 * - affiliates: 60s (1 min) - needed for pagination
 * - trends: 600s (10 min) - historical data
 * - revenue_breakdown: 0 (no cache) - always fresh
 * - geographic: 0 (no cache) - always fresh
 * - export: 0 (no cache) - always fresh
 *
 * Key Format:
 * mmc_dashboard:{endpoint}:{workspace_id}:{hash(query_params)}
 *
 * Example:
 * - mmc_dashboard:summary:uuid-workspace-1:abc123def456
 * - mmc_dashboard:trends:uuid-workspace-1:abc123def456
 */

import { createHash } from 'node:crypto'
import { logger } from '@zidney/logger'
import type Redis from 'ioredis'

/**
 * Cache TTL configuration per endpoint (in seconds)
 */
const CACHE_TTL_CONFIG: Record<string, number> = {
  summary: 300, // 5 minutes
  revenue_breakdown: 0, // no cache
  geographic: 0, // no cache
  affiliates: 60, // 1 minute
  trends: 600, // 10 minutes
  export: 0, // no cache
} as const

/**
 * Generate cache key from endpoint, workspace_id, and query parameters
 *
 * @param endpoint - API endpoint name (e.g., "summary", "trends")
 * @param workspaceId - Workspace UUID
 * @param queryParams - Query parameters object (will be hashed)
 * @returns Cache key (e.g., "mmc_dashboard:summary:uuid-workspace-1:abc123def456")
 */
function generateCacheKey(
  endpoint: string,
  workspaceId: string,
  queryParams?: Record<string, unknown>
): string {
  // Hash query parameters to create deterministic key
  let paramHash = ''

  if (queryParams && Object.keys(queryParams).length > 0) {
    // Sort keys to ensure consistent hashing regardless of parameter order
    const sortedParams = Object.keys(queryParams)
      .sort()
      .map((key) => `${key}=${String(queryParams[key])}`)
      .join('&')

    paramHash = createHash('md5').update(sortedParams).digest('hex').substring(0, 12)
  } else {
    // No params, use fixed hash
    paramHash = 'no-params'
  }

  return `mmc_dashboard:${endpoint}:${workspaceId}:${paramHash}`
}

/**
 * Dashboard Cache Client
 *
 * High-level Redis client for dashboard caching with graceful degradation
 */
export class DashboardCacheClient {
  private redis: Redis | null = null
  private isConnected: boolean = false

  constructor(redisClient?: Redis) {
    if (redisClient) {
      this.redis = redisClient
      this.isConnected = true
    }
  }

  /**
   * Initialize Redis connection (if not provided at construction)
   *
   * @param redisClient - ioredis client instance
   */
  initialize(redisClient: Redis): void {
    this.redis = redisClient
    this.isConnected = true
  }

  /**
   * Check if Redis is available
   */
  private isAvailable(): boolean {
    return this.redis !== null && this.isConnected
  }

  /**
   * Get value from cache
   *
   * @param endpoint - Endpoint name (used for TTL lookup)
   * @param workspaceId - Workspace UUID
   * @param queryParams - Query parameters (optional)
   * @returns Cached value as string, or null if cache miss/unavailable
   */
  async get(
    endpoint: string,
    workspaceId: string,
    queryParams?: Record<string, unknown>
  ): Promise<string | null> {
    if (!this.isAvailable()) {
      // Graceful fallback: cache unavailable
      return null
    }

    try {
      const key = generateCacheKey(endpoint, workspaceId, queryParams)
      const value = await this.redis?.get(key)

      if (value) {
        // Log cache hit for observability
        logger.log({
          timestamp: new Date().toISOString(),
          level: 'debug',
          service: 'dashboard-cache',
          event: 'cache_hit',
          endpoint,
          workspace_id: workspaceId,
          cache_key: key,
        })
      }

      return value
    } catch (error) {
      // Log cache error but don't throw; treat as cache miss
      logger.log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        service: 'dashboard-cache',
        event: 'cache_get_error',
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Set value in cache with endpoint-specific TTL
   *
   * @param endpoint - Endpoint name (used for TTL lookup)
   * @param workspaceId - Workspace UUID
   * @param value - Value to cache (as string/JSON)
   * @param queryParams - Query parameters (optional)
   * @returns True if set successfully, false otherwise
   */
  async set(
    endpoint: string,
    workspaceId: string,
    value: string,
    queryParams?: Record<string, unknown>
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      return false
    }

    try {
      const key = generateCacheKey(endpoint, workspaceId, queryParams)
      const ttl = CACHE_TTL_CONFIG[endpoint] || 0

      // If TTL is 0, don't cache
      if (ttl === 0) {
        return false
      }

      await this.redis?.setex(key, ttl, value)

      logger.log({
        timestamp: new Date().toISOString(),
        level: 'debug',
        service: 'dashboard-cache',
        event: 'cache_set',
        endpoint,
        workspace_id: workspaceId,
        cache_key: key,
        ttl_seconds: ttl,
      })

      return true
    } catch (error) {
      logger.log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        service: 'dashboard-cache',
        event: 'cache_set_error',
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * Delete cache key
   *
   * @param endpoint - Endpoint name
   * @param workspaceId - Workspace UUID
   * @param queryParams - Query parameters (optional)
   * @returns True if deleted successfully, false otherwise
   */
  async del(
    endpoint: string,
    workspaceId: string,
    queryParams?: Record<string, unknown>
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      return false
    }

    try {
      const key = generateCacheKey(endpoint, workspaceId, queryParams)
      const result = await this.redis?.del(key)

      logger.log({
        timestamp: new Date().toISOString(),
        level: 'debug',
        service: 'dashboard-cache',
        event: 'cache_del',
        endpoint,
        workspace_id: workspaceId,
        cache_key: key,
        deleted: result > 0,
      })

      return result > 0
    } catch (error) {
      logger.log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        service: 'dashboard-cache',
        event: 'cache_del_error',
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * Check if cache key exists
   *
   * @param endpoint - Endpoint name
   * @param workspaceId - Workspace UUID
   * @param queryParams - Query parameters (optional)
   * @returns True if key exists, false otherwise
   */
  async exists(
    endpoint: string,
    workspaceId: string,
    queryParams?: Record<string, unknown>
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      return false
    }

    try {
      const key = generateCacheKey(endpoint, workspaceId, queryParams)
      const result = await this.redis?.exists(key)
      return result > 0
    } catch (_error) {
      return false
    }
  }

  /**
   * Invalidate all cache keys for an endpoint (across all workspaces)
   * WARNING: This is expensive; use sparingly (e.g., schema migration, data update)
   *
   * @param endpoint - Endpoint name
   * @returns Number of keys deleted
   */
  async invalidateEndpoint(endpoint: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0
    }

    try {
      const pattern = `mmc_dashboard:${endpoint}:*`
      const keys = await this.redis?.keys(pattern)

      if (keys.length === 0) {
        return 0
      }

      const deleted = await this.redis?.del(...keys)

      logger.log({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'dashboard-cache',
        event: 'cache_invalidate_endpoint',
        endpoint,
        keys_deleted: deleted,
      })

      return deleted
    } catch (error) {
      logger.log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        service: 'dashboard-cache',
        event: 'cache_invalidate_error',
        error: error instanceof Error ? error.message : String(error),
      })
      return 0
    }
  }

  /**
   * Invalidate cache for a specific workspace (across all endpoints)
   * WARNING: This is expensive; use sparingly
   *
   * @param workspaceId - Workspace UUID
   * @returns Number of keys deleted
   */
  async invalidateWorkspace(workspaceId: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0
    }

    try {
      const pattern = `mmc_dashboard:*:${workspaceId}:*`
      const keys = await this.redis?.keys(pattern)

      if (keys.length === 0) {
        return 0
      }

      const deleted = await this.redis?.del(...keys)

      logger.log({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'dashboard-cache',
        event: 'cache_invalidate_workspace',
        workspace_id: workspaceId,
        keys_deleted: deleted,
      })

      return deleted
    } catch (error) {
      logger.log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        service: 'dashboard-cache',
        event: 'cache_invalidate_error',
        error: error instanceof Error ? error.message : String(error),
      })
      return 0
    }
  }

  /**
   * Get cache TTL for endpoint
   *
   * @param endpoint - Endpoint name
   * @returns TTL in seconds, or 0 if no caching
   */
  getTTL(endpoint: string): number {
    return CACHE_TTL_CONFIG[endpoint] || 0
  }
}

/**
 * Global cache client instance (singleton)
 */
let globalCacheClient: DashboardCacheClient | null = null

/**
 * Get or initialize global cache client
 *
 * @param redisClient - ioredis client (optional; if provided, initializes client)
 * @returns Global cache client instance
 */
export function getDashboardCacheClient(redisClient?: Redis): DashboardCacheClient {
  if (!globalCacheClient) {
    globalCacheClient = new DashboardCacheClient(redisClient)
  } else if (redisClient && !globalCacheClient.isAvailable) {
    globalCacheClient.initialize(redisClient)
  }

  return globalCacheClient
}
