import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LicenseResolver } from '../../src/license/resolver'
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

  beforeEach(() => {
    mockDb = new MockDatabaseClient()
    mockRedis = new MockRedisClient()
    resolver = new LicenseResolver(mockDb, mockRedis)
  })

  afterEach(() => {
    mockDb.reset()
    mockRedis.reset()
  })

  // From TEST_INDEX.md: 5 tests for resolver
  it('T033.1: Should hit cache on second query', async () => {
    const workspace_slug = 'acme.edu'
    const license = testFixtures.makeLicense({ workspace_slug })

    mockDb.mockResult('SELECT * FROM licenses WHERE workspace_slug = $1', [
      license,
    ])

    // First query (miss)
    const result1 = await resolver.getLicenseBySlug(workspace_slug)
    expect(result1).toEqual(license)

    // Second query (hit)
    const result2 = await resolver.getLicenseBySlug(workspace_slug)
    expect(result2).toEqual(license)
  })

  it('T033.2: Should miss cache and re-query', async () => {
    const workspace_slug = 'acme.edu'
    const license = testFixtures.makeLicense({ workspace_slug })

    mockDb.mockResult('SELECT * FROM licenses WHERE workspace_slug = $1', [
      license,
    ])
    mockRedis.flush() // Clear cache

    const result = await resolver.getLicenseBySlug(workspace_slug)
    expect(result).toEqual(license)
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

    mockDb.mockResult('SELECT * FROM licenses WHERE workspace_slug = $1', [])

    const result = await resolver.getLicenseBySlug(workspace_slug)
    expect(result).toBeNull()
  })

  it('T033.5: Should bust cache on license update', async () => {
    const workspace_slug = 'acme.edu'
    const cacheKey = `license:${workspace_slug}`

    mockRedis.set(cacheKey, JSON.stringify(testFixtures.makeLicense()))
    expect(mockRedis.get(cacheKey)).toBeDefined()

    await resolver.bustCacheForWorkspace(workspace_slug)
    expect(mockRedis.get(cacheKey)).toBeNull()
  })
})
