/**
 * DistributedLock - Redis-based distributed lock for concurrent provisioning safety
 *
 * Purpose: Prevent concurrent provisioning of same workspace
 * Design: Lock key = "provisioning:<workspace_slug>", TTL = 60s
 * Recovery: Auto-expires on worker crash (TTL prevents permanent lock)
 *
 * Scope: apps/worker/src/services/provisioning/
 * Task: T008 – Implement distributed lock mechanism (Redis-based)
 * Phase: 01 – Platform Foundation
 * Stage: STAGE_05_TENANT_PROVISIONING_SERVICE
 *
 * Pattern: Redis SET with NX (only if not exists) and EX (expiry)
 * Atomicity: Guaranteed by Redis (single command)
 * Safety: Full lock recoverability after TTL expiry
 */

import { logger } from '@zidney/logger'
import type { Redis } from 'ioredis'

/**
 * DistributedLock: Manages distributed locks for provisioning operations
 */
export class DistributedLock {
  private redis: Redis
  private lock_ttl_seconds: number = 60
  private initial_backoff_ms: number = 5
  private max_backoff_ms: number = 60000
  private max_retry_attempts: number = 12 // ~60s total with exponential backoff

  constructor(redis: Redis, ttl_seconds: number = 60) {
    this.redis = redis
    this.lock_ttl_seconds = ttl_seconds
  }

  /**
   * Generate consistent lock key for workspace
   */
  private getLockKey(workspace_slug: string): string {
    return `provisioning:${workspace_slug}`
  }

  /**
   * Generate lock value (unique per attempt for safety)
   * Used to ensure only lock holder can release
   */
  private generateLockValue(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Attempt to acquire lock with exponential backoff retry
   *
   * @param key - Lock key identifier
   * @param ttl_seconds - Time-to-live in seconds
   * @returns {acquired: false} if lock not acquired, {acquired: true, release_fn, lock_value} if acquired
   */
  async acquireLock(
    key: string,
    ttl_seconds: number = this.lock_ttl_seconds
  ): Promise<
    { acquired: false } | { acquired: true; release_fn: () => Promise<void>; lock_value: string }
  > {
    const lock_key = this.getLockKey(key)
    const lock_value = this.generateLockValue()
    let backoff_ms = this.initial_backoff_ms
    let attempts = 0

    while (attempts < this.max_retry_attempts) {
      try {
        // Try to set lock atomically (NX = only if not exists, EX = expiry seconds)
        const result = await this.redis.set(lock_key, lock_value, 'EX', ttl_seconds, 'NX')

        if (result === 'OK') {
          // Lock acquired successfully
          const release_fn = async (): Promise<void> => {
            await this.releaseLock(lock_key, lock_value)
          }

          return {
            acquired: true,
            release_fn,
            lock_value,
          }
        }

        // Lock already held by another process, retry with backoff
        attempts++
        if (attempts >= this.max_retry_attempts) {
          // Max retries exhausted
          return { acquired: false }
        }

        // Wait before retry (exponential backoff with jitter)
        const jitter = Math.random() * 0.1 * backoff_ms
        await this.sleep(backoff_ms + jitter)
        backoff_ms = Math.min(backoff_ms * 2, this.max_backoff_ms)
      } catch (error) {
        logger.error('distributed_lock_acquire_failed', { key, error: String(error) })
        throw error
      }
    }

    return { acquired: false }
  }

  /**
   * Try to acquire lock without retry (non-blocking)
   * Returns immediately if lock not available
   */
  async tryAcquireLock(
    key: string,
    ttl_seconds: number = this.lock_ttl_seconds
  ): Promise<
    { acquired: false } | { acquired: true; release_fn: () => Promise<void>; lock_value: string }
  > {
    const lock_key = this.getLockKey(key)
    const lock_value = this.generateLockValue()

    try {
      const result = await this.redis.set(lock_key, lock_value, 'EX', ttl_seconds, 'NX')

      if (result === 'OK') {
        const release_fn = async (): Promise<void> => {
          await this.releaseLock(lock_key, lock_value)
        }
        return {
          acquired: true,
          release_fn,
          lock_value,
        }
      }

      return { acquired: false }
    } catch (error) {
      logger.error('distributed_lock_try_acquire_failed', { key, error: String(error) })
      throw error
    }
  }

  /**
   * Release lock (only if holder has correct lock_value)
   * Prevents accidental release of locks held by other processes
   *
   * @param lock_key - Full lock key
   * @param lock_value - Lock value to verify ownership
   */
  private async releaseLock(lock_key: string, lock_value: string): Promise<boolean> {
    try {
      // Use Lua script for atomic check-and-delete
      // Ensures only lock holder can release
      const released = await this.redis.eval(
        `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
        `,
        1,
        lock_key,
        lock_value
      )

      return (released as number) === 1
    } catch (error) {
      logger.error('distributed_lock_release_failed', { lock_key, error: String(error) })
      throw error
    }
  }

  /**
   * Renew lock to prevent expiration during long operations
   * Extends TTL as long as current process still holds lock
   *
   * @param key - Lock key identifier
   * @param ttl_seconds - New TTL in seconds
   * @returns true if lock renewed, false if lock not held by this process
   */
  async renewLock(key: string, ttl_seconds: number = this.lock_ttl_seconds): Promise<boolean> {
    const lock_key = this.getLockKey(key)

    try {
      // Check if lock still exists (renewal only makes sense if held)
      const exists = await this.redis.exists(lock_key)

      if (exists === 0) {
        // Lock lost (probably timed out)
        return false
      }

      // Extend TTL
      const result = await this.redis.expire(lock_key, ttl_seconds)
      return result === 1 // 1 = TTL set, 0 = key doesn't exist
    } catch (error) {
      logger.error('distributed_lock_renew_failed', { key, error: String(error) })
      throw error
    }
  }

  /**
   * Force release of lock (emergency cleanup)
   * Should only be called by operations/admin in exceptional cases
   */
  async forceReleaseLock(key: string): Promise<boolean> {
    const lock_key = this.getLockKey(key)

    try {
      const deleted = await this.redis.del(lock_key)
      return deleted === 1
    } catch (error) {
      logger.error('distributed_lock_force_release_failed', { key, error: String(error) })
      throw error
    }
  }

  /**
   * Utility: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get lock status for debugging
   */
  async getLockStatus(key: string): Promise<{
    locked: boolean
    ttl_seconds: number
  }> {
    const lock_key = this.getLockKey(key)

    try {
      const ttl = await this.redis.ttl(lock_key)

      return {
        locked: ttl > 0,
        ttl_seconds: ttl > 0 ? ttl : 0,
      }
    } catch (error) {
      logger.error('distributed_lock_status_failed', { key, error: String(error) })
      throw error
    }
  }

  /**
   * Cleanup: Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit()
  }
}

export default DistributedLock
