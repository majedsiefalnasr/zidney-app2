/**
 * T082: Attempt Submission Integration Test
 * Full lifecycle: create → start → submit → grade (via worker) → result
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

describe('T082: Attempt Submission Lifecycle', () => {
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

  it('should create attempt', async () => {
    const res = await client.post(`/workspace/${ctx.workspaceId}/attempt`, {
      exam_id: 'exam-1',
    })
    expect(res.status).toBe(201)
    expect(res.data.id).toBeDefined()
    expect(res.data.status).toBe('CREATED')
  })

  it('should start attempt', async () => {
    const attemptRes = await client.post(
      `/workspace/${ctx.workspaceId}/attempt`,
      {
        exam_id: 'exam-1',
      }
    )
    const attemptId = attemptRes.data.id

    const startRes = await client.put(`/attempt/${attemptId}/start`, {})
    expect(startRes.status).toBe(200)
    expect(startRes.data.status).toBe('IN_PROGRESS')
  })

  it('should submit attempt and enqueue grading', async () => {
    const attemptRes = await client.post(
      `/workspace/${ctx.workspaceId}/attempt`,
      {
        exam_id: 'exam-1',
      }
    )
    const attemptId = attemptRes.data.id

    await client.put(`/attempt/${attemptId}/start`, {})

    const submitRes = await client.post(`/attempt/${attemptId}/submit`, {
      idempotency_key: 'submit-1',
      answers: [{ question_id: 'q1', answer: 'A' }],
    })
    expect(submitRes.status).toBe(202)
    expect(submitRes.data.job_id).toBeDefined()
  })

  it('should grade attempt via worker', async () => {
    const attemptRes = await client.post(
      `/workspace/${ctx.workspaceId}/attempt`,
      {
        exam_id: 'exam-1',
      }
    )
    const attemptId = attemptRes.data.id

    await client.put(`/attempt/${attemptId}/start`, {})
    await client.post(`/attempt/${attemptId}/submit`, {
      idempotency_key: 'submit-2',
      answers: [{ question_id: 'q1', answer: 'A' }],
    })

    // Wait for worker to process
    await sleep(100)

    const resultRes = await client.get(`/attempt/${attemptId}/result`)
    expect(resultRes.status).toBe(200)
    expect(resultRes.data.score).toBeDefined()
  })

  it('should return result with grade and metadata', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)
    await ctx.tenantDb.query(
      `UPDATE attempts SET status = 'COMPLETED', result = $1 
       WHERE id = $2`,
      [JSON.stringify({ score: 85, passed: true, max_score: 100 }), attemptId]
    )

    const res = await client.get(`/attempt/${attemptId}/result`)
    expect(res.status).toBe(200)
    expect(res.data.score).toBe(85)
    expect(res.data.passed).toBe(true)
  })
})
