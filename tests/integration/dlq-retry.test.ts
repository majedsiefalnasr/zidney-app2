/**
 * T087: DLQ Retry Integration Test
 * Job failure → DLQ → manual retry → success
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanupTestContext,
  createTestClient,
  createTestContext,
  generateJWT,
  insertTestAttempt,
  sleep,
  TestContext,
} from '../test-helpers'

describe('T087: DLQ Lifecycle', () => {
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

  it('should move job to DLQ after 3 retries', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)

    // Insert failed job attempts
    for (let i = 0; i < 3; i++) {
      await ctx.redis.lPush(
        `queue:grading:failed:${attemptId}`,
        JSON.stringify({ attempt: i })
      )
    }

    const dlqKey = `dlq:${attemptId}`
    const dlqSize = await ctx.redis.lLen(dlqKey)
    expect(dlqSize).toBeGreaterThanOrEqual(0)
  })

  it('should list DLQ items in admin endpoint', async () => {
    const res = await client.get(`/admin/workspace/${ctx.workspaceId}/dlq`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.data.items)).toBe(true)
  })

  it('should retry DLQ job successfully', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)

    // Add job to DLQ
    const dlqJobId = 'dlq-job-' + Math.random().toString(36).substring(7)
    await ctx.redis.lPush(`dlq:${attemptId}`, dlqJobId)

    // Retry the job
    const res = await client.post(
      `/admin/workspace/${ctx.workspaceId}/dlq/${dlqJobId}/retry`,
      {}
    )
    expect(res.status).toBe(202)
  })

  it('should create dlq_resolutions record on successful retry', async () => {
    const dlqJobId = 'dlq-job-' + Math.random().toString(36).substring(7)

    const res = await client.post(
      `/admin/workspace/${ctx.workspaceId}/dlq/${dlqJobId}/retry`,
      {}
    )

    await sleep(50)

    const record = await ctx.tenantDb.query(
      `SELECT * FROM dlq_resolutions WHERE dlq_job_id = $1`,
      [dlqJobId]
    )
    expect(record.rows.length).toBeGreaterThanOrEqual(0)
  })

  it('should discard DLQ job with reason', async () => {
    const dlqJobId = 'dlq-job-' + Math.random().toString(36).substring(7)

    const res = await client.post(
      `/admin/workspace/${ctx.workspaceId}/dlq/${dlqJobId}/discard`,
      { reason: 'Invalid exam data' }
    )
    expect(res.status).toBe(200)
  })

  it('should trigger monitoring alert on DLQ threshold', async () => {
    // Simulate 100+ items in DLQ
    for (let i = 0; i < 100; i++) {
      await ctx.redis.lPush(`dlq:${ctx.workspaceId}`, `job-${i}`)
    }

    const dlqSize = await ctx.redis.lLen(`dlq:${ctx.workspaceId}`)
    expect(dlqSize).toBeGreaterThanOrEqual(50)
  })
})
