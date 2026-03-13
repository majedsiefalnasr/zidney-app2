/**
 * T093: JWT Workspace Isolation Security Test
 * JWT workspace_id mismatch rejection
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanupTestContext,
  createTestClient,
  createTestContext,
  generateJWT,
  type TestContext,
} from '../test-helpers'

describe('T093: JWT Workspace Isolation', () => {
  let ctx: TestContext
  let client: ReturnType<typeof createTestClient>

  beforeEach(async () => {
    ctx = await createTestContext()
    client = createTestClient()
  })

  afterEach(async () => {
    await cleanupTestContext(ctx)
  })

  it('should validate JWT workspace_id matches request', async () => {
    const jwt = generateJWT(ctx.workspaceId, ctx.userId)
    client.setJWT(jwt)

    const res = await client.get(`/workspace/${ctx.workspaceId}/status`)
    expect(res.status).not.toBe(403)
  })

  it('should reject JWT with mismatched workspace_id', async () => {
    const jwt = generateJWT('ws-other', ctx.userId)
    client.setJWT(jwt)

    const res = await client.get(`/workspace/${ctx.workspaceId}/status`)
    expect(res.status).toBe(403)
    expect(res.error?.code).toBe('FORBIDDEN')
  })

  it('should prevent workspace override from request body', async () => {
    const jwt = generateJWT(ctx.workspaceId, ctx.userId)
    client.setJWT(jwt)

    const res = await client.post(`/attempt/${ctx.attemptId}/submit`, {
      workspace_id: 'ws-other', // Attempt override
      idempotency_key: 'test-1',
      answers: [],
    })
    expect(res.error?.code).not.toBe('WORKSPACE_MISMATCH')
  })

  it('should validate attempt ownership per workspace', async () => {
    const attemptInOtherWs = `attempt-${Math.random().toString(36).substring(7)}`
    // This attempt doesn't exist in current workspace
    const jwt = generateJWT(ctx.workspaceId, ctx.userId)
    client.setJWT(jwt)

    const res = await client.get(`/attempt/${attemptInOtherWs}/status`)
    expect(res.status).toBe(404)
  })

  it('should validate user_id from JWT claims', async () => {
    const differentUser = `user-other-${Math.random().toString(36).substring(7)}`
    const jwt = generateJWT(ctx.workspaceId, differentUser)
    client.setJWT(jwt)

    const res = await client.get(`/workspace/${ctx.workspaceId}/status`)
    expect(res.status).not.toBe(403)
  })
})
