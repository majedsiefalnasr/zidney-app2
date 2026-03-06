/**
 * T086: Schema Version Enforcement Integration Test
 * Client version < server returns 426
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanupTestContext,
  createTestClient,
  createTestContext,
  generateJWT,
  type TestContext,
} from '../test-helpers'

describe('T086: Schema Version Enforcement', () => {
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

  it('should allow compatible schema versions', async () => {
    client.headers['X-Schema-Version'] = '1.1.0'
    const res = await client.post(`/attempt/${ctx.attemptId}/submit`, {
      idempotency_key: 'test-1',
      answers: [],
    })
    expect(res.status).not.toBe(426)
  })

  it('should return 426 when client schema outdated', async () => {
    client.headers['X-Schema-Version'] = '0.9.0'
    const res = await client.post(`/attempt/${ctx.attemptId}/submit`, {
      idempotency_key: 'test-1',
      answers: [],
    })
    expect(res.status).toBe(426)
    expect(res.error?.code).toBe('UPGRADE_REQUIRED')
  })

  it('should return 426 when client schema incompatible', async () => {
    client.headers['X-Schema-Version'] = '2.0.0'
    const res = await client.get(`/attempt/${ctx.attemptId}/status`)
    expect(res.status).toBe(426)
  })

  it('should include upgrade action in error message', async () => {
    client.headers['X-Schema-Version'] = '0.8.0'
    const res = await client.post(`/attempt/${ctx.attemptId}/submit`, {
      idempotency_key: 'test-1',
      answers: [],
    })
    expect(res.error?.message).toContain('upgrade')
  })

  it('should validate all DB-touching routes', async () => {
    client.headers['X-Schema-Version'] = '0.7.0'
    const routes = [
      () =>
        client.post(`/workspace/${ctx.workspaceId}/attempt`, {
          exam_id: 'ex1',
        }),
      () => client.get(`/attempt/${ctx.attemptId}/result`),
      () =>
        client.post(`/attempt/${ctx.attemptId}/submit`, {
          idempotency_key: 'test-1',
          answers: [],
        }),
    ]

    for (const route of routes) {
      const res = await route()
      expect(res.status).toBe(426)
    }
  })
})
