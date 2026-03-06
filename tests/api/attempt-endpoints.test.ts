/**
 * T102-T109: Attempt Endpoints
 * POST /create, PUT /start, POST /submit, GET /status, GET /result, GET /audit-log, DELETE, GET /list
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

describe('T102-T109: Attempt Endpoints', () => {
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

  // T102: POST /attempt (create)
  it('should create attempt', async () => {
    const res = await client.post(`/workspace/${ctx.workspaceId}/attempt`, {
      exam_id: 'exam-1',
    })
    expect(res.status).toBe(201)
    expect(res.data.id).toBeDefined()
  })

  it('should return 400 on missing exam_id', async () => {
    const res = await client.post(`/workspace/${ctx.workspaceId}/attempt`, {})
    expect(res.status).toBe(400)
    expect(res.error?.code).toBe('VALIDATION_ERROR')
  })

  // T103: PUT /attempt/{id}/start
  it('should start attempt', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)

    const res = await client.put(`/attempt/${attemptId}/start`, {})
    expect(res.status).toBe(200)
    expect(res.data.status).toBe('IN_PROGRESS')
  })

  it('should return 409 if already started', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)
    await ctx.tenantDb.query(`UPDATE attempts SET status = 'IN_PROGRESS' WHERE id = $1`, [
      attemptId,
    ])

    const res = await client.put(`/attempt/${attemptId}/start`, {})
    expect(res.status).toBe(409)
  })

  // T104: POST /attempt/{id}/submit
  it('should submit attempt', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)

    const res = await client.post(`/attempt/${attemptId}/submit`, {
      idempotency_key: 'submit-1',
      answers: [{ question_id: 'q1', answer: 'A' }],
    })
    expect(res.status).toBe(202)
  })

  it('should return 400 on missing idempotency_key', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)

    const res = await client.post(`/attempt/${attemptId}/submit`, {
      answers: [],
    })
    expect(res.status).toBe(400)
  })

  // T105: GET /attempt/{id}/status
  it('should get attempt status', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)

    const res = await client.get(`/attempt/${attemptId}/status`)
    expect(res.status).toBe(200)
    expect(res.data.status).toBeDefined()
  })

  it('should return 404 for nonexistent attempt', async () => {
    const res = await client.get(`/attempt/nonexistent/status`)
    expect(res.status).toBe(404)
  })

  // T106: GET /attempt/{id}/result
  it('should get attempt result', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)
    await ctx.tenantDb.query(
      `UPDATE attempts SET status = 'COMPLETED', result = $1 WHERE id = $2`,
      [JSON.stringify({ score: 85 }), attemptId]
    )

    const res = await client.get(`/attempt/${attemptId}/result`)
    expect(res.status).toBe(200)
    expect(res.data.score).toBe(85)
  })

  // T107: GET /attempt/{id}/audit-log
  it('should get attempt audit log', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)

    const res = await client.get(`/attempt/${attemptId}/audit-log`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.data.events)).toBe(true)
  })

  // T108: DELETE /attempt/{id}
  it('should delete draft attempt', async () => {
    const attemptId = await insertTestAttempt(ctx.tenantDb, ctx.workspaceId)

    const res = await client.delete(`/attempt/${attemptId}`)
    expect(res.status).toBe(204)
  })

  // T109: GET /workspace/{id}/attempts
  it('should list workspace attempts', async () => {
    const res = await client.get(`/workspace/${ctx.workspaceId}/attempts`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.data.attempts)).toBe(true)
  })
})
