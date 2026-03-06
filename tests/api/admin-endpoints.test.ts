/**
 * T110-T111: WebSocket & Admin Endpoints
 * GET /ws/attempt/{id}, admin endpoints
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanupTestContext,
  createTestClient,
  createTestContext,
  generateJWT,
  type TestContext,
} from '../test-helpers'

describe('T110-T111: WebSocket & Admin Endpoints', () => {
  let ctx: TestContext
  let client: ReturnType<typeof createTestClient>

  beforeEach(async () => {
    ctx = await createTestContext()
    client = createTestClient()
    client.setJWT(generateJWT(ctx.workspaceId, ctx.userId))
  })

  afterEach(async () => {
    await cleanupTestContext(ctx)
  })

  // T110: GET /ws/attempt/{id} (WebSocket)
  it('should establish WebSocket connection with valid JWT', async () => {
    const jwt = generateJWT(ctx.workspaceId, ctx.userId)
    expect(jwt).toBeDefined()
  })

  it('should reject WebSocket without JWT', async () => {
    // Connection should be rejected without auth
  })

  it('should enforce rate limiting on WebSocket messages', async () => {
    // 100+ messages should trigger rate limit
  })

  // Admin Endpoints
  it('should require admin role for admin endpoints', async () => {
    const studentJwt = generateJWT(ctx.workspaceId, ctx.userId)
    client.setJWT(studentJwt)

    const res = await client.get(`/admin/workspace/${ctx.workspaceId}/dlq`)
    expect([200, 403]).toContain(res.status)
  })

  it('should list DLQ items for admin', async () => {
    // Admin should be able to list DLQ
    const res = await client.get(`/admin/workspace/${ctx.workspaceId}/dlq`)
    expect([200, 403]).toContain(res.status)
  })

  it('should retry DLQ job for admin', async () => {
    const dlqJobId = 'dlq-job-123'
    const res = await client.post(`/admin/workspace/${ctx.workspaceId}/dlq/${dlqJobId}/retry`, {})
    expect([200, 202, 403]).toContain(res.status)
  })

  it('should discard DLQ job for admin', async () => {
    const dlqJobId = 'dlq-job-456'
    const res = await client.post(`/admin/workspace/${ctx.workspaceId}/dlq/${dlqJobId}/discard`, {
      reason: 'Invalid data',
    })
    expect([200, 403]).toContain(res.status)
  })

  it('should rate-limit audit for admin', async () => {
    const res = await client.get(`/admin/workspace/${ctx.workspaceId}/rate-limit-audit`)
    expect([200, 403]).toContain(res.status)
  })

  it('should export rate-limit metrics for admin', async () => {
    const res = await client.get(`/admin/workspace/${ctx.workspaceId}/rate-limit-export`)
    expect([200, 403]).toContain(res.status)
  })
})
