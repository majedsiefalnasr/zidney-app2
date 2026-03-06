/**
 * Distributed Lock Service
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Implements distributed locking using Redis SETNX primitive.
 * Ensures only one worker provisions a given license simultaneously.
 *
 * Features:
 * - Exponential backoff on lock contention
 * - TTL-based recovery for dead worker cleanup
 * - Jitter to prevent thundering herd
 * - Lease generation for safety in distributed systems
 *
 * Lock Key Format: provisioning:lock:{license_id}
 * TTL: 30 seconds (configurable)
 */

import { ProvisioningErrorCode } from '@zidney/types/errors/provisioning-errors'
import type { Redis } from 'ioredis'
import { LOCK_CONFIG, QUEUE_KEYS } from '../config/queue-config'

/**
 * Lock Lease
 * Represents acquired lock with metadata for safety
 */
export interface LockLease {
  licenseId: string
  leaseKey: string // Unique lease identifier
  acquiredAt: Date
  expiresAt: Date
  ttlSeconds: number
}

/**
 * Lock Acquisition Result
 */
export interface LockResult {
  acquired: boolean
  lease?: LockLease
  error?: ProvisioningErrorCode
  retryAfterMs?: number
}

/**
 * Distributed Lock Service
 */
export class DistributedLockService {
  private redis: Redis
  private config: typeof LOCK_CONFIG
  private logger?: any

  constructor(redis: Redis, config: typeof LOCK_CONFIG = LOCK_CONFIG, logger?: any) {
    this.redis = redis
    this.config = config
    this.logger = logger
  }

  /**
   * Acquire lock for a license
   *
   * Returns immediately if lock acquired.
   * Retries with exponential backoff if lock held.
   * Fails after max retries.
   */
  async acquireLock(
    licenseId: string,
    maxRetries: number = this.config.MAX_RETRIES
  ): Promise<LockResult> {
    const lockKey = QUEUE_KEYS.lockKey(licenseId)
    const leaseKey = this.generateLeaseKey()

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Try to set lock (SETNX = SET if Not eXists)
        const acquired = await this.redis.set(lockKey, leaseKey, 'EX', this.config.TTL, 'NX')

        if (acquired === 'OK') {
          const now = new Date()
          const expiresAt = new Date(now.getTime() + this.config.TTL * 1000)

          this.logger?.logStep('lock-acquired', 'Distributed lock acquired', {
            license_id: licenseId,
            lease_key: leaseKey,
            ttl_seconds: this.config.TTL,
            attempt,
          })

          return {
            acquired: true,
            lease: {
              licenseId,
              leaseKey,
              acquiredAt: now,
              expiresAt,
              ttlSeconds: this.config.TTL,
            },
          }
        }

        // Lock held by another worker, retry with backoff
        if (attempt < maxRetries - 1) {
          const backoffMs = this.calculateBackoff(attempt)
          const jitter = Math.random() * this.config.TTL * 1000 * 0.3 // ±30%

          this.logger?.logWarn('Lock held by another worker, retrying', {
            license_id: licenseId,
            attempt,
            backoff_ms: backoffMs,
            retry_after_ms: backoffMs + jitter,
          })

          await this.sleep(backoffMs + jitter)
        }
      } catch (error) {
        this.logger?.logError(
          'Lock acquisition failed',
          error instanceof Error ? error : new Error(String(error)),
          {
            license_id: licenseId,
            attempt,
          }
        )

        return {
          acquired: false,
          error: ProvisioningErrorCode.LOCK_ACQUISITION_FAILED,
        }
      }
    }

    // Max retries exhausted
    this.logger?.logWarn('Lock acquisition timeout', {
      license_id: licenseId,
      max_attempts: maxRetries,
    })

    return {
      acquired: false,
      error: ProvisioningErrorCode.LOCK_TIMEOUT,
      retryAfterMs: this.config.INITIAL_BACKOFF_MS,
    }
  }

  /**
   * Release lock (requires valid lease)
   */
  async releaseLock(lease: LockLease): Promise<boolean> {
    const lockKey = QUEUE_KEYS.lockKey(lease.licenseId)

    try {
      // Use Lua script to ensure we only delete our own lock
      const result = await this.redis.eval(
        `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
        `,
        1,
        lockKey,
        lease.leaseKey
      )

      if (result === 1) {
        this.logger?.logStep('lock-released', 'Distributed lock released', {
          license_id: lease.licenseId,
          lease_key: lease.leaseKey,
        })
        return true
      } else {
        this.logger?.logWarn('Lock release failed: lease expired or changed', {
          license_id: lease.licenseId,
          lease_key: lease.leaseKey,
        })
        return false
      }
    } catch (error) {
      this.logger?.logError(
        'Lock release error',
        error instanceof Error ? error : new Error(String(error)),
        {
          license_id: lease.licenseId,
        }
      )
      return false
    }
  }

  /**
   * Renew lock lease (extend TTL)
   * Used during long-running operations
   */
  async renewLease(lease: LockLease): Promise<boolean> {
    const lockKey = QUEUE_KEYS.lockKey(lease.licenseId)

    try {
      // Using Lua script to ensure atomicity
      const result = await this.redis.eval(
        `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("expire", KEYS[1], ARGV[2])
        else
          return 0
        end
        `,
        1,
        lockKey,
        lease.leaseKey,
        this.config.TTL
      )

      if (result === 1) {
        // Update lease expiration time
        lease.acquiredAt = new Date()
        lease.expiresAt = new Date(Date.now() + this.config.TTL * 1000)

        this.logger?.logStep('lease-renewed', 'Lock lease renewed', {
          license_id: lease.licenseId,
          new_ttl: this.config.TTL,
        })
        return true
      }

      return false
    } catch (error) {
      this.logger?.logError(
        'Lease renewal error',
        error instanceof Error ? error : new Error(String(error))
      )
      return false
    }
  }

  /**
   * Check if lock is still valid
   */
  async isLockValid(lease: LockLease): Promise<boolean> {
    const lockKey = QUEUE_KEYS.lockKey(lease.licenseId)
    const currentLeaseKey = await this.redis.get(lockKey)
    return currentLeaseKey === lease.leaseKey
  }

  /**
   * Generate unique lease key
   */
  private generateLeaseKey(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    return `${timestamp}-${random}`
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private calculateBackoff(attemptNumber: number): number {
    const exponential = Math.min(
      this.config.INITIAL_BACKOFF_MS * this.config.BACKOFF_MULTIPLIER ** attemptNumber,
      this.config.MAX_BACKOFF_MS
    )
    return exponential
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Force release lock (admin operation, use with caution)
   * Bypasses lease verification
   */
  async forceReleaseLock(licenseId: string): Promise<boolean> {
    const lockKey = QUEUE_KEYS.lockKey(licenseId)
    try {
      const result = await this.redis.del(lockKey)
      return result === 1
    } catch (error) {
      return false
    }
  }
}

/**
 * Factory to create distributed lock service
 */
export function createDistributedLockService(redis: Redis, logger?: any): DistributedLockService {
  return new DistributedLockService(redis, LOCK_CONFIG, logger)
}
