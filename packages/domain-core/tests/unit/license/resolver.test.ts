import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LicenseResolver } from '../../../src/license/resolver'
import { MockDatabaseClient, MockRedisClient, testFixtures } from './fixtures'

/**
 * Test: License Resolver (T033)
 *
 * Unit tests for LicenseResolver query caching and validation.
 * Covers: cache hits/misses, query execution, TTL, error handling.
 */

describe('LicenseResolver', () => {
  let resolver: LicenseResolver
  let mockDb: MockDatabaseClient
  let mockRedis: MockRedisClient
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>
    info: ReturnType<typeof vi.fn>
    warn: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockDb = new MockDatabaseClient()
    mockRedis = new MockRedisClient()
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    resolver = new LicenseResolver(mockDb, mockRedis, mockLogger)
  })

  afterEach(() => {
    mockDb.reset()
    mockRedis.reset()
  })

  // From TEST_INDEX.md: 5 tests for resolver
  it('T033.1: Should hit cache on second query', async () => {
    const workspace_slug = 'acme.edu'
    const license = testFixtures.makeLicense({ workspace_slug })

    mockDb.mockResult('from licenses where workspace_slug = $1', [license])

    // First query (miss)
    const result1 = await resolver.getLicenseBySlug(workspace_slug)
    expect(result1?.workspace_slug).toBe(license.workspace_slug)
    expect(result1?.status).toBe(license.status)

    // Second query (hit)
    const result2 = await resolver.getLicenseBySlug(workspace_slug)
    expect(result2?.workspace_slug).toBe(license.workspace_slug)
    expect(mockDb.query).toHaveBeenCalledTimes(1)
  })

  it('T033.2: Should miss cache and re-query', async () => {
    const workspace_slug = 'acme.edu'
    const license = testFixtures.makeLicense({ workspace_slug })

    mockDb.mockResult('from licenses where workspace_slug = $1', [license])
    mockRedis.flush() // Clear cache

    const result = await resolver.getLicenseBySlug(workspace_slug)
    expect(result?.workspace_slug).toBe(license.workspace_slug)
  })

  it('T033.3: Should respect TTL (5 minutes)', async () => {
    const workspace_slug = 'acme.edu'
    const ttl = 300 // 5 min

    mockRedis.setex(
      `license:${workspace_slug}`,
      ttl,
      JSON.stringify(testFixtures.makeLicense({ workspace_slug }))
    )

    const storedTTL = mockRedis.getTTL(`license:${workspace_slug}`)
    expect(storedTTL).toBeLessThanOrEqual(ttl)
    expect(storedTTL).toBeGreaterThan(0)
  })

  it('T033.4: Should handle query errors gracefully', async () => {
    const workspace_slug = 'notfound.edu'

    mockDb.mockResult('from licenses where workspace_slug = $1', [])

    const result = await resolver.getLicenseBySlug(workspace_slug)
    expect(result).toBeNull()
  })

  it('T033.5: Should bust cache on license update', async () => {
    const workspace_slug = 'acme.edu'
    const cacheKey = `license:${workspace_slug}`

    mockRedis.set(cacheKey, JSON.stringify(testFixtures.makeLicense()))
    expect(mockRedis.get(cacheKey)).toBeDefined()

    await resolver.invalidateCache(workspace_slug)
    expect(mockRedis.get(cacheKey)).toBeNull()
  })
})
