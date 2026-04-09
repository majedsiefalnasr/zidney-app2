import { describe, expect, it } from 'vitest'
import { lookupPermission, PUBLIC_ROUTES } from '../../src/rbac/permission-registry'

describe('permission-registry', () => {
  it('returns permission entry for registered route', () => {
    const entry = lookupPermission('GET', '/api/v1/backoffice/workspace/roles')
    expect(entry).not.toBeNull()
    expect(entry?.action).toBe('can_view')
  })

  it('returns null for public routes', () => {
    const res = lookupPermission('GET', '/api/v1/backoffice/health')
    expect(PUBLIC_ROUTES.has('GET /api/v1/backoffice/health')).toBeTruthy()
    expect(res).toBeNull()
  })

  it('returns null for unknown route (fail-closed semantics)', () => {
    const res = lookupPermission('POST', '/api/v1/backoffice/unknown-route')
    expect(res).toBeNull()
  })
})
