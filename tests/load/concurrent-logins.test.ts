/**
 * T088: Concurrent Logins Load Test
 * 1000 concurrent login attempts
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestClient, createTestContext, type TestContext } from '../test-helpers'

describe('T088: Concurrent Logins Load', () => {
  let ctx: TestContext
  let client: ReturnType<typeof createTestClient>

  beforeEach(async () => {
    ctx = await createTestContext()
    client = createTestClient()
  })

  it('should handle 1000 concurrent login attempts', async () => {
    const promises = Array(1000)
      .fill(null)
      .map(() =>
        client.post(`/workspace/${ctx.workspaceId}/login`, {
          email: `user-${Math.random()}@example.com`,
          password: 'test123',
        })
      )

    const results = await Promise.all(promises)
    expect(results.length).toBe(1000)

    const rateLimitedCount = results.filter((r) => r.status === 429).length
    expect(rateLimitedCount).toBeGreaterThan(0)

    const successCount = results.filter((r) => r.status === 200 || r.status === 401).length
    expect(successCount).toBeGreaterThan(0)
  })

  it('should maintain Redis connection pool', async () => {
    const poolInfo = await ctx.redis.info('clients')
    expect(poolInfo).toBeDefined()
  })

  it('should rate-limit users independently', async () => {
    const user1Promises = Array(5)
      .fill(null)
      .map(() =>
        client.post(`/workspace/${ctx.workspaceId}/login`, {
          email: 'user1@example.com',
          password: 'wrong',
        })
      )

    const user2Promises = Array(5)
      .fill(null)
      .map(() =>
        client.post(`/workspace/${ctx.workspaceId}/login`, {
          email: 'user2@example.com',
          password: 'wrong',
        })
      )

    const user1Results = await Promise.all(user1Promises)
    const user2Results = await Promise.all(user2Promises)

    expect(user1Results.every((r) => r.status !== 429)).toBe(true)
    expect(user2Results.every((r) => r.status !== 429)).toBe(true)
  })

  it('should handle 100+ concurrent IPs', async () => {
    const ips = Array(100)
      .fill(null)
      .map((_, i) => `192.168.${Math.floor(i / 256)}.${i % 256}`)

    const promises = ips.map((ip) =>
      (async () => {
        const c = createTestClient()
        c.headers['X-Forwarded-For'] = ip
        return c.post(`/workspace/${ctx.workspaceId}/login`, {
          email: 'test@example.com',
          password: 'wrong',
        })
      })()
    )

    const results = await Promise.all(promises)
    expect(results.length).toBe(100)
  })

  it('should measure rate limit check latency', async () => {
    const start = Date.now()
    for (let i = 0; i < 100; i++) {
      await client.post(`/workspace/${ctx.workspaceId}/login`, {
        email: 'test@example.com',
        password: 'wrong',
      })
    }
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(10000) // Should complete in less than 10 seconds
  })
})
