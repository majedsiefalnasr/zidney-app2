import { describe, expect, it } from 'vitest'
import app from '../../src/app'

describe('Tenant Resolver Integration', () => {
  it.skip('should resolve valid tenant', async () => {
    const response = await app.request('/api/workspace/test/exams', {
      headers: { host: 'test.zidney.com' },
    })

    expect(response.status).toBe(404) // No route, but resolver should pass
  })

  it.skip('should reject invalid tenant', async () => {
    const response = await app.request('/api/workspace/invalid/exams', {
      headers: { host: 'invalid.zidney.com' },
    })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error.code).toBe('TENANT_NOT_FOUND')
  })
})
