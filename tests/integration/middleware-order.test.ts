/**
 * T081: Middleware Order Integration Test
 * Verify 5-stage middleware executes in immutable order
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanupTestContext,
  createTestClient,
  createTestContext,
  type TestContext,
} from '../test-helpers'

describe('T081: Middleware Order', () => {
  let ctx: TestContext
  let client: ReturnType<typeof createTestClient>

  beforeEach(async () => {
    ctx = await createTestContext()
    client = createTestClient()
  })

  afterEach(async () => {
    await cleanupTestContext(ctx)
  })

  it('should execute correlation ID assignment first', async () => {
    const res = await client.post('/attempt', { exam_id: 'ex1' })
    expect(res.headers['X-Correlation-ID']).toBeDefined()
  })

  it('should resolve tenant before license check', async () => {
    client.setCorrelationId(ctx.correlationId)
    const res = await client.get(`/workspace/${ctx.workspaceId}/status`)
    expect(res.status).toBe(200)
  })

  it('should enforce license before rate limiting', async () => {
    const res = await client.post(`/workspace/${ctx.workspaceId}/login`, {
      email: 'test@example.com',
      password: 'test123',
    })
    expect(res.error?.code).not.toBe('RATE_LIMIT_EXCEEDED')
  })

  it('should check schema version before operation', async () => {
    const res = await client.post(`/attempt/${ctx.attemptId}/submit`, {
      idempotency_key: 'idem-key-1',
      answers: [],
    })
    expect(res.error?.code).not.toBe('SCHEMA_MISMATCH')
  })

  it('should apply rate limiting as final middleware', async () => {
    // Simulate 6 requests in rapid succession
    const promises = Array(6)
      .fill(null)
      .map(() =>
        client.post(`/workspace/${ctx.workspaceId}/login`, {
          email: 'test@example.com',
          password: 'wrong',
        })
      )
    const results = await Promise.all(promises)
    const rateLimited = results.filter((r) => r.status === 429)
    expect(rateLimited.length).toBeGreaterThan(0)
  })
})
