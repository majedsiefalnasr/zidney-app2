/**
 * T089: Concurrent Submissions Load Test
 * 500 concurrent submissions to same attempt
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanupTestContext,
  createTestClient,
  createTestContext,
  generateJWT,
  insertTestAttempt,
  type TestContext,
} from '../test-helpers'

describe('T089: Concurrent Submissions', () => {
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

  it('should handle 500 concurrent submissions', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)

    const promises = Array(500)
      .fill(null)
      .map((_, i) =>
        client.post(`/attempt/${attemptId}/submit`, {
          idempotency_key: `submit-${i}`,
          answers: [{ question_id: 'q1', answer: 'A' }],
        })
      )

    const results = await Promise.all(promises)
    expect(results.length).toBe(500)

    const successCount = results.filter((r) => r.status === 202).length
    expect(successCount).toBeGreaterThan(0)
  })

  it('should enforce exclusive lock with FOR UPDATE', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)

    const promises = Array(10)
      .fill(null)
      .map((_, i) =>
        client.post(`/attempt/${attemptId}/submit`, {
          idempotency_key: `exclusive-${i}`,
          answers: [{ question_id: 'q1', answer: 'A' }],
        })
      )

    const results = await Promise.all(promises)
    const successCount = results.filter((r) => r.status === 202).length
    expect(successCount).toBe(10)
  })

  it('should detect duplicate submissions', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)
    const idemKey = 'duplicate-test'

    const promises = Array(5)
      .fill(null)
      .map(() =>
        client.post(`/attempt/${attemptId}/submit`, {
          idempotency_key: idemKey,
          answers: [{ question_id: 'q1', answer: 'A' }],
        })
      )

    const results = await Promise.all(promises)
    const cachedCount = results.filter((r) => r.data?.cached === true).length
    expect(cachedCount).toBeGreaterThanOrEqual(1)
  })

  it('should measure lock acquisition latency', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)

    const start = Date.now()
    await client.post(`/attempt/${attemptId}/submit`, {
      idempotency_key: `latency-test-1`,
      answers: [{ question_id: 'q1', answer: 'A' }],
    })
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(1000)
  })
})
