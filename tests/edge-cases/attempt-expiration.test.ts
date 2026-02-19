/**
 * T096: Attempt Expiration Edge Case Test
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanupTestContext,
  createTestClient,
  createTestContext,
  generateJWT,
  insertTestAttempt,
  TestContext,
} from '../test-helpers'

describe('T096: Attempt Expiration', () => {
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

  it('should reject submission after attempt expires', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)

    // Mark attempt as expired
    await ctx.tenantDb.query(
      `UPDATE attempts SET status = 'EXPIRED' WHERE id = $1`,
      [attemptId]
    )

    const res = await client.post(`/attempt/${attemptId}/submit`, {
      idempotency_key: 'expired-test-1',
      answers: [],
    })
    expect(res.status).toBe(410)
    expect(res.error?.code).toBe('ATTEMPT_EXPIRED')
  })

  it('should return 410 Gone for expired attempt', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)
    await ctx.tenantDb.query(
      `UPDATE attempts SET status = 'EXPIRED' WHERE id = $1`,
      [attemptId]
    )

    const res = await client.get(`/attempt/${attemptId}/status`)
    expect(res.status).toBe(410)
  })

  it('should prevent resubmission after completion', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)
    await ctx.tenantDb.query(
      `UPDATE attempts SET status = 'COMPLETED' WHERE id = $1`,
      [attemptId]
    )

    const res = await client.post(`/attempt/${attemptId}/submit`, {
      idempotency_key: 'completed-test',
      answers: [],
    })
    expect(res.status).toBe(409)
    expect(res.error?.code).toBe('ATTEMPT_ALREADY_SUBMITTED')
  })

  it('should handle concurrent expiration checks', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)
    await ctx.tenantDb.query(
      `UPDATE attempts SET status = 'EXPIRED' WHERE id = $1`,
      [attemptId]
    )

    const promises = Array(10)
      .fill(null)
      .map(() =>
        client.post(`/attempt/${attemptId}/submit`, {
          idempotency_key: `concurrent-${Math.random()}`,
          answers: [],
        })
      )

    const results = await Promise.all(promises)
    expect(results.every((r) => r.status === 410)).toBe(true)
  })
})
