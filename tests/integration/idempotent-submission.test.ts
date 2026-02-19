/**
 * T083: Idempotent Submission Integration Test
 * Duplicate submit with same idempotency_key returns cached result
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

describe('T083: Idempotent Submission', () => {
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

  it('should cache first submission result', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)

    const res1 = await client.post(`/attempt/${attemptId}/submit`, {
      idempotency_key: 'idem-cache-1',
      answers: [{ question_id: 'q1', answer: 'A' }],
    })
    expect(res1.status).toBe(202)
    expect(res1.data.cached).toBeFalsy()
  })

  it('should return cached result on duplicate submit', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)
    const idemKey = 'idem-cache-2'

    const res1 = await client.post(`/attempt/${attemptId}/submit`, {
      idempotency_key: idemKey,
      answers: [{ question_id: 'q1', answer: 'A' }],
    })
    const jobId1 = res1.data.job_id

    const res2 = await client.post(`/attempt/${attemptId}/submit`, {
      idempotency_key: idemKey,
      answers: [{ question_id: 'q1', answer: 'B' }],
    })

    expect(res2.status).toBe(202)
    expect(res2.data.cached).toBe(true)
    expect(res2.data.job_id).toBe(jobId1)
  })

  it('should enqueue job only once for duplicate submissions', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)
    const idemKey = 'idem-cache-3'

    const countBefore = await ctx.redis.lLen(`queue:grading:${attemptId}`)

    await client.post(`/attempt/${attemptId}/submit`, {
      idempotency_key: idemKey,
      answers: [{ question_id: 'q1', answer: 'A' }],
    })
    await client.post(`/attempt/${attemptId}/submit`, {
      idempotency_key: idemKey,
      answers: [{ question_id: 'q1', answer: 'A' }],
    })

    const countAfter = await ctx.redis.lLen(`queue:grading:${attemptId}`)
    expect(countAfter - countBefore).toBe(1)
  })

  it('should enforce UNIQUE constraint on idempotency key', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)
    const idemKey = 'idem-unique-test'

    await ctx.tenantDb.query(
      `INSERT INTO attempt_submissions (id, attempt_id, idempotency_key, submitted_answers, created_at)
       VALUES (gen_random_uuid(), $1, $2, '[]'::jsonb, NOW())`,
      [attemptId, idemKey]
    )

    const res = await client.post(`/attempt/${attemptId}/submit`, {
      idempotency_key: idemKey,
      answers: [{ question_id: 'q1', answer: 'A' }],
    })

    expect(res.status).toBe(202)
    expect(res.data.cached).toBe(true)
  })
})
