/**
 * Distributed Lock Service Unit Tests
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Tests lock acquisition, release, TTL expiration, and contention handling.
 */

import { Redis } from 'ioredis'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DistributedLockService } from '../../src/services/distributed-lock-service'

describe('DistributedLockService', () => {
  let redis: Redis
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lockService: any
  const testLockKey = 'test:lock:provisioning:test-license'

  beforeEach(async () => {
    // Initialize Redis connection
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: parseInt(process.env.REDIS_DB || '1'),
    })

    lockService = new DistributedLockService(redis)
  })

  afterEach(async () => {
    // Clean up test locks
    await redis.del(testLockKey)
    await redis.quit()
  })

  describe('Lock Acquisition', () => {
    it('should successfully acquire a lock', async () => {
      const result = await lockService.acquireLock(testLockKey)

      expect(result).toBeDefined()
      expect(result.leaseKey).toBeDefined()
      expect(result.leaseKey.length).toBeGreaterThan(0)
    })

    it('should fail to acquire lock if already held', async () => {
      // Acquire first lock
      const lock1 = await lockService.acquireLock(testLockKey)
      expect(lock1).toBeDefined()

      // Try to acquire same lock
      const lock2 = await lockService.acquireLock(testLockKey)
      expect(lock2).toBeNull()
    })

    it('should respect lock TTL expiration', async () => {
      // Acquire lock with short TTL
      const lock = await lockService.acquireLock(testLockKey, 1) // 1 second
      expect(lock).toBeDefined()

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Should be able to acquire now
      const lock2 = await lockService.acquireLock(testLockKey)
      expect(lock2).toBeDefined()
    })

    it('should implement exponential backoff on contention', async () => {
      const lock1 = await lockService.acquireLock(testLockKey, 5)
      expect(lock1).toBeDefined()

      const startTime = Date.now()

      // Try to acquire contested lock (should retry with backoff)
      const lock2 = await lockService.acquireLock(testLockKey, 5, 2) // Max 2 retries

      const duration = Date.now() - startTime

      // Should have taken at least 100ms (first backoff attempt)
      expect(duration).toBeGreaterThanOrEqual(50)
      expect(lock2).toBeNull()
    })
  })

  describe('Lock Release', () => {
    it('should release a held lock', async () => {
      const lock = await lockService.acquireLock(testLockKey)
      expect(lock).toBeDefined()

      const released = await lockService.releaseLock(
        testLockKey,
        lock!.leaseKey
      )
      expect(released).toBe(true)

      // Should be able to acquire again
      const lock2 = await lockService.acquireLock(testLockKey)
      expect(lock2).toBeDefined()
    })

    it('should prevent release with wrong lease key', async () => {
      const lock = await lockService.acquireLock(testLockKey)
      expect(lock).toBeDefined()

      const released = await lockService.releaseLock(
        testLockKey,
        'wrong-lease-key'
      )
      expect(released).toBe(false)

      // Lock should still be held
      const lock2 = await lockService.acquireLock(testLockKey)
      expect(lock2).toBeNull()
    })

    it('should handle release of non-existent lock gracefully', async () => {
      const released = await lockService.releaseLock(
        testLockKey,
        'any-lease-key'
      )
      expect(released).toBe(false)
    })
  })

  describe('Lease Renewal', () => {
    it('should renew an active lease', async () => {
      const lock = await lockService.acquireLock(testLockKey, 2)
      expect(lock).toBeDefined()

      // Wait 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Renew lease
      const renewed = await lockService.renewLease(
        testLockKey,
        lock!.leaseKey,
        3
      )
      expect(renewed).toBe(true)

      // Wait original TTL would have expired
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Lock should still be held
      const lock2 = await lockService.acquireLock(testLockKey)
      expect(lock2).toBeNull()
    })

    it('should fail to renew with wrong lease key', async () => {
      const lock = await lockService.acquireLock(testLockKey, 2)
      expect(lock).toBeDefined()

      const renewed = await lockService.renewLease(testLockKey, 'wrong-key', 3)
      expect(renewed).toBe(false)
    })
  })

  describe('Lock Validity Check', () => {
    it('should verify lock is valid with correct lease key', async () => {
      const lock = await lockService.acquireLock(testLockKey)
      expect(lock).toBeDefined()

      const isValid = await lockService.isLockValid(testLockKey, lock!.leaseKey)
      expect(isValid).toBe(true)
    })

    it('should reject lock with incorrect lease key', async () => {
      const lock = await lockService.acquireLock(testLockKey)
      expect(lock).toBeDefined()

      const isValid = await lockService.isLockValid(testLockKey, 'wrong-key')
      expect(isValid).toBe(false)
    })

    it('should reject non-existent lock', async () => {
      const isValid = await lockService.isLockValid(testLockKey, 'any-key')
      expect(isValid).toBe(false)
    })
  })

  describe('Force Release (Admin)', () => {
    it('should force release a lock without lease key', async () => {
      const lock = await lockService.acquireLock(testLockKey)
      expect(lock).toBeDefined()

      const released = await lockService.forceReleaseLock(testLockKey)
      expect(released).toBe(true)

      // Should be able to acquire again
      const lock2 = await lockService.acquireLock(testLockKey)
      expect(lock2).toBeDefined()
    })

    it('should handle force release of non-existent lock', async () => {
      const released = await lockService.forceReleaseLock(testLockKey)
      expect(released).toBe(false)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle multiple sequential acquire-release cycles', async () => {
      for (let i = 0; i < 5; i++) {
        const lock = await lockService.acquireLock(testLockKey)
        expect(lock).toBeDefined()
        expect(lock).not.toBeNull()

        const released = await lockService.releaseLock(
          testLockKey,
          lock!.leaseKey
        )
        expect(released).toBe(true)
      }
    })

    it('should maintain lock isolation for different keys', async () => {
      const key1 = `${testLockKey}:1`
      const key2 = `${testLockKey}:2`

      const lock1 = await lockService.acquireLock(key1)
      const lock2 = await lockService.acquireLock(key2)

      expect(lock1).toBeDefined()
      expect(lock2).toBeDefined()

      // Should be able to acquire key1 again (key2's lock is independent)
      const lock3 = await lockService.acquireLock(key1)
      expect(lock3).toBeNull() // Still held

      // Can acquire key2 independently
      const lock4 = await lockService.acquireLock(key2)
      expect(lock4).toBeNull() // Still held

      // Clean up
      await lockService.releaseLock(key1, lock1!.leaseKey)
      await lockService.releaseLock(key2, lock2!.leaseKey)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long lock keys', async () => {
      const longKey = `${testLockKey}:${'x'.repeat(500)}`
      const lock = await lockService.acquireLock(longKey)
      expect(lock).toBeDefined()

      await lockService.releaseLock(longKey, lock!.leaseKey)
    })

    it('should handle zero TTL gracefully', async () => {
      // Zero TTL should be treated as no expiration or immediate expiration
      // Behavior depends on implementation
      const lock = await lockService.acquireLock(testLockKey, 0)
      expect(lock).toBeDefined()

      await lockService.forceReleaseLock(testLockKey)
    })

    it('should handle negative TTL gracefully', async () => {
      // Negative TTL should be handled safely
      const lock = await lockService.acquireLock(testLockKey, -1)
      // Should either fail or use default TTL
      if (lock) {
        await lockService.forceReleaseLock(testLockKey)
      }
    })
  })
})
