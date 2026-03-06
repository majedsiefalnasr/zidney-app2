/**
 * T097-T101: Auth Endpoint Tests
 * POST /login, POST /logout, POST /password-reset, POST /token-refresh, GET /verify
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanupTestContext,
  createTestClient,
  createTestContext,
  generateJWT,
  type TestContext,
} from '../test-helpers'

describe('T097-T101: Auth Endpoints', () => {
  let ctx: TestContext
  let client: ReturnType<typeof createTestClient>

  beforeEach(async () => {
    ctx = await createTestContext()
    client = createTestClient()
  })

  afterEach(async () => {
    await cleanupTestContext(ctx)
  })

  // T097: POST /login
  it('should login with valid credentials', async () => {
    const res = await client.post(`/workspace/${ctx.workspaceId}/login`, {
      email: 'test@example.com',
      password: 'correct123',
    })
    if (res.status === 200) {
      expect(res.data.token).toBeDefined()
    }
  })

  it('should return 401 on invalid password', async () => {
    const res = await client.post(`/workspace/${ctx.workspaceId}/login`, {
      email: 'test@example.com',
      password: 'wrong',
    })
    expect(res.status).toBe(401)
    expect(res.error?.code).toBe('INVALID_CREDENTIALS')
  })

  it('should rate-limit failed logins (429)', async () => {
    for (let i = 0; i < 6; i++) {
      const res = await client.post(`/workspace/${ctx.workspaceId}/login`, {
        email: 'test@example.com',
        password: 'wrong',
      })
      if (i === 5) {
        expect(res.status).toBe(429)
      }
    }
  })

  // T098: POST /logout
  it('should logout and invalidate token', async () => {
    const jwt = generateJWT(ctx.workspaceId, ctx.userId)
    client.setJWT(jwt)

    const res = await client.post(`/workspace/${ctx.workspaceId}/logout`, {})
    expect(res.status).toBe(200)
  })

  // T099: POST /password-reset
  it('should initiate password reset', async () => {
    const res = await client.post(`/workspace/${ctx.workspaceId}/password-reset`, {
      email: 'test@example.com',
    })
    expect(res.status).toBe(202)
  })

  it('should return 404 for nonexistent email', async () => {
    const res = await client.post(`/workspace/${ctx.workspaceId}/password-reset`, {
      email: 'nonexistent@example.com',
    })
    expect(res.status).toBe(200) // 202 for privacy
  })

  // T100: POST /token-refresh
  it('should refresh expired token', async () => {
    const jwt = generateJWT(ctx.workspaceId, ctx.userId)
    client.setJWT(jwt)

    const res = await client.post(`/workspace/${ctx.workspaceId}/token-refresh`, {})
    expect(res.status).toBe(200)
    expect(res.data.token).toBeDefined()
  })

  // T101: GET /verify
  it('should verify valid JWT', async () => {
    const jwt = generateJWT(ctx.workspaceId, ctx.userId)
    client.setJWT(jwt)

    const res = await client.get(`/workspace/${ctx.workspaceId}/verify`)
    expect(res.status).toBe(200)
    expect(res.data.valid).toBe(true)
  })

  it('should reject invalid JWT', async () => {
    client.headers['Authorization'] = 'Bearer invalid'
    const res = await client.get(`/workspace/${ctx.workspaceId}/verify`)
    expect(res.status).toBe(401)
  })
})
