/**
 * Coverage Service — Unit Tests
 *
 * File: tests/unit/translation/coverage-service.test.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Tests Redis cache hit/miss, SCAN-based invalidation, graceful Redis errors.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  getCoverage,
  invalidateCoverage,
  invalidateWorkspaceCoverage,
  type RedisClient,
} from '../../../packages/domain-core/src/translation/coverage.service'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockRedis(overrides: Partial<RedisClient> = {}): RedisClient {
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    scan: vi.fn().mockResolvedValue(['0', []]) as any, // Default: empty scan
    ...overrides,
  }
}

function createMockDb(queryResponses: Record<string, any> = {}) {
  const db = {
    query: vi.fn(async (sql: string) => {
      for (const [keyword, response] of Object.entries(queryResponses)) {
        if (sql.includes(keyword)) return response
      }
      return { rows: [], rowCount: 0 }
    }),
  }
  return db
}

// ---------------------------------------------------------------------------
// getCoverage tests
// ---------------------------------------------------------------------------

describe('getCoverage', () => {
  it('returns null immediately for default language without Redis or DB call', async () => {
    const redis = createMockRedis()
    const db = createMockDb()

    const result = await getCoverage(
      db as any,
      'ws-001',
      'question',
      'en', // default language
      'en',
      redis
    )

    expect(result).toBeNull()
    expect(redis.get).not.toHaveBeenCalled()
    expect(db.query).not.toHaveBeenCalled()
  })

  it('returns cached data on cache hit', async () => {
    const cachedData = {
      entity_type: 'question',
      language_code: 'ar',
      translated_count: 8,
      total_entities: 10,
      coverage_percent: 40,
    }
    const redis = createMockRedis({
      get: vi.fn().mockResolvedValue(JSON.stringify(cachedData)),
    })
    const db = createMockDb()

    const result = await getCoverage(db as any, 'ws-001', 'question', 'ar', 'en', redis)

    expect(result).toEqual(cachedData)
    expect(db.query).not.toHaveBeenCalled()
  })

  it('fetches from DB on cache miss and writes result to cache', async () => {
    // Return correct format: string counts as pg returns them
    const redis = createMockRedis({
      get: vi.fn().mockResolvedValue(null), // cache miss
    })
    const db = createMockDb({
      'FROM translations': {
        rows: [{ total_entities: '5', translated_count: '4' }],
        rowCount: 1,
      },
    })

    const result = await getCoverage(db as any, 'ws-001', 'question', 'ar', 'en', redis)

    expect(result).not.toBeNull()
    expect(result?.entity_type).toBe('question')
    expect(result?.language_code).toBe('ar')
    expect(result?.translated_count).toBe(4)
    expect(redis.set).toHaveBeenCalledOnce()
  })

  it('uses correct Redis key format coverage:{workspaceId}:{entityType}:{languageCode}', async () => {
    const redis = createMockRedis({
      get: vi.fn().mockResolvedValue(null),
    })
    const db = createMockDb({
      'FROM translations': {
        rows: [{ total_entities: '0', translated_count: '0' }],
        rowCount: 1,
      },
    })

    await getCoverage(db as any, 'ws-abc', 'question', 'ar', 'en', redis)

    expect(redis.get).toHaveBeenCalledWith('coverage:ws-abc:question:ar')
  })

  it('returns DB result gracefully when Redis.get throws', async () => {
    const redis = createMockRedis({
      get: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
    })
    const db = createMockDb({
      'FROM translations': {
        rows: [{ total_entities: '3', translated_count: '3' }],
        rowCount: 1,
      },
    })

    // Should not throw; falls back to DB
    const result = await getCoverage(db as any, 'ws-001', 'question', 'ar', 'en', redis)

    expect(result).not.toBeNull()
    expect(result?.entity_type).toBe('question')
  })

  it('works without Redis parameter (no Redis client)', async () => {
    const db = createMockDb({
      'FROM translations': {
        rows: [{ total_entities: '7', translated_count: '7' }],
        rowCount: 1,
      },
    })

    const result = await getCoverage(
      db as any,
      'ws-001',
      'question',
      'ar',
      'en'
      // No redis
    )

    expect(result).not.toBeNull()
    expect(result?.translated_count).toBeGreaterThanOrEqual(0)
  })

  it('returns zero-coverage object when DB returns no rows for entity type', async () => {
    const redis = createMockRedis({
      get: vi.fn().mockResolvedValue(null),
    })
    const db = createMockDb({
      'FROM translations': { rows: [], rowCount: 0 },
    })

    const result = await getCoverage(
      db as any,
      'ws-001',
      'exam', // valid entity type
      'ar',
      'en',
      redis
    )

    // Coverage service returns zero-coverage object (not null) when no entities exist
    expect(result).not.toBeNull()
    expect(result?.coverage_percent).toBe(0)
    expect(result?.entity_type).toBe('exam')
  })
})

// ---------------------------------------------------------------------------
// invalidateCoverage tests
// ---------------------------------------------------------------------------

describe('invalidateCoverage', () => {
  it('calls redis.del with the correct key', async () => {
    const redis = createMockRedis({
      del: vi.fn().mockResolvedValue(1),
    })

    await invalidateCoverage(redis, 'ws-001', 'question', 'ar')

    expect(redis.del).toHaveBeenCalledWith('coverage:ws-001:question:ar')
  })

  it('does not throw when redis.del fails', async () => {
    const redis = createMockRedis({
      del: vi.fn().mockRejectedValue(new Error('Redis error')),
    })

    // Should resolve without throwing
    await expect(invalidateCoverage(redis, 'ws-001', 'question', 'ar')).resolves.not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// invalidateWorkspaceCoverage tests
// ---------------------------------------------------------------------------

describe('invalidateWorkspaceCoverage', () => {
  it('uses SCAN with workspace pattern, not KEYS', async () => {
    const redis = createMockRedis({
      scan: vi.fn().mockResolvedValue(['0', []]),
    })

    await invalidateWorkspaceCoverage(redis, 'ws-001')

    const scanCall = (redis.scan as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(scanCall[0]).toBe('0') // starts at cursor 0
    expect(scanCall[1]).toBe('MATCH')
    expect(scanCall[2]).toBe('coverage:ws-001:*')
  })

  it('iterates multiple SCAN pages until cursor is 0', async () => {
    const scanMock = vi
      .fn()
      .mockResolvedValueOnce([
        'cursor-1',
        ['coverage:ws-001:question:ar', 'coverage:ws-001:question:fr'],
      ])
      .mockResolvedValueOnce(['0', ['coverage:ws-001:exam:ar']])

    const redis = createMockRedis({
      scan: scanMock as any,
      del: vi.fn().mockResolvedValue(1),
    })

    await invalidateWorkspaceCoverage(redis, 'ws-001')

    expect(scanMock).toHaveBeenCalledTimes(2)
    expect(redis.del).toHaveBeenCalledTimes(2) // Two batches
  })

  it('skips del call when SCAN returns empty batch', async () => {
    const redis = createMockRedis({
      scan: vi.fn().mockResolvedValue(['0', []]),
      del: vi.fn(),
    })

    await invalidateWorkspaceCoverage(redis, 'ws-001')

    expect(redis.del).not.toHaveBeenCalled()
  })

  it('handles SCAN error gracefully without throwing', async () => {
    const redis = createMockRedis({
      scan: vi.fn().mockRejectedValue(new Error('SCAN failed')),
    })

    await expect(invalidateWorkspaceCoverage(redis, 'ws-001')).resolves.not.toThrow()
  })
})
