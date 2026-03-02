/**
 * Permission Registry — Unit Tests
 *
 * File: tests/unit/rbac/permission-registry.test.ts
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 * Date: 2026-03-02
 *
 * Tests the ROUTE_PERMISSION_REGISTRY and lookupPermission utility.
 *
 * Coverage:
 * - lookupPermission returns correct {module,action} for all 9 registered routes
 * - lookupPermission returns null for unregistered paths (fail-closed)
 * - PUBLIC_ROUTES entries resolve to null without triggering 403
 * - All registry module keys match PermissionModule enum values
 * - All 9 routes in roles.ts are represented in the registry (no escapes)
 */

import { describe, expect, it } from 'vitest'

import {
  PUBLIC_ROUTES,
  ROUTE_PERMISSION_REGISTRY,
  lookupPermission,
} from '../../../packages/domain-core/src/rbac/permission-registry'
import { PermissionModule } from '../../../packages/domain-core/src/rbac/rbac.types'

// ---------------------------------------------------------------------------
// Individual route lookups
// ---------------------------------------------------------------------------

describe('lookupPermission() — registered routes', () => {
  it('resolves POST /api/v1/backoffice/workspace/roles → SETTINGS can_create', () => {
    const result = lookupPermission(
      'POST',
      '/api/v1/backoffice/workspace/roles'
    )
    expect(result).not.toBeNull()
    expect(result?.module).toBe(PermissionModule.SETTINGS)
    expect(result?.action).toBe('can_create')
  })

  it('resolves GET /api/v1/backoffice/workspace/roles → SETTINGS can_view', () => {
    const result = lookupPermission('GET', '/api/v1/backoffice/workspace/roles')
    expect(result).not.toBeNull()
    expect(result?.module).toBe(PermissionModule.SETTINGS)
    expect(result?.action).toBe('can_view')
  })

  it('resolves GET /api/v1/backoffice/workspace/roles/:id → SETTINGS can_view', () => {
    const result = lookupPermission(
      'GET',
      '/api/v1/backoffice/workspace/roles/:id'
    )
    expect(result).not.toBeNull()
    expect(result?.module).toBe(PermissionModule.SETTINGS)
    expect(result?.action).toBe('can_view')
  })

  it('resolves PATCH /api/v1/backoffice/workspace/roles/:id → SETTINGS can_edit', () => {
    const result = lookupPermission(
      'PATCH',
      '/api/v1/backoffice/workspace/roles/:id'
    )
    expect(result).not.toBeNull()
    expect(result?.module).toBe(PermissionModule.SETTINGS)
    expect(result?.action).toBe('can_edit')
  })

  it('resolves PUT /api/v1/backoffice/workspace/roles/:id/permissions → SETTINGS can_edit', () => {
    const result = lookupPermission(
      'PUT',
      '/api/v1/backoffice/workspace/roles/:id/permissions'
    )
    expect(result).not.toBeNull()
    expect(result?.module).toBe(PermissionModule.SETTINGS)
    expect(result?.action).toBe('can_edit')
  })

  it('resolves DELETE /api/v1/backoffice/workspace/roles/:id → SETTINGS can_delete', () => {
    const result = lookupPermission(
      'DELETE',
      '/api/v1/backoffice/workspace/roles/:id'
    )
    expect(result).not.toBeNull()
    expect(result?.module).toBe(PermissionModule.SETTINGS)
    expect(result?.action).toBe('can_delete')
  })

  it('resolves GET /api/v1/backoffice/workspace/roles/:id/users → SETTINGS can_view', () => {
    const result = lookupPermission(
      'GET',
      '/api/v1/backoffice/workspace/roles/:id/users'
    )
    expect(result).not.toBeNull()
    expect(result?.module).toBe(PermissionModule.SETTINGS)
    expect(result?.action).toBe('can_view')
  })

  it('resolves PATCH /api/v1/backoffice/workspace/staff/:userId/role → USERS can_edit', () => {
    const result = lookupPermission(
      'PATCH',
      '/api/v1/backoffice/workspace/staff/:userId/role'
    )
    expect(result).not.toBeNull()
    expect(result?.module).toBe(PermissionModule.USERS)
    expect(result?.action).toBe('can_edit')
  })

  it('resolves GET /api/v1/backoffice/workspace/role-permission-modules → SETTINGS can_view', () => {
    const result = lookupPermission(
      'GET',
      '/api/v1/backoffice/workspace/role-permission-modules'
    )
    expect(result).not.toBeNull()
    expect(result?.module).toBe(PermissionModule.SETTINGS)
    expect(result?.action).toBe('can_view')
  })
})

// ---------------------------------------------------------------------------
// Fail-closed behavior
// ---------------------------------------------------------------------------

describe('lookupPermission() — fail-closed for unregistered routes', () => {
  it('returns null for a completely unknown path', () => {
    expect(
      lookupPermission('GET', '/api/v1/backoffice/workspace/unknown')
    ).toBeNull()
  })

  it('returns null for a known path with wrong method', () => {
    expect(
      lookupPermission('PUT', '/api/v1/backoffice/workspace/roles')
    ).toBeNull()
  })

  it('returns null for an empty path', () => {
    expect(lookupPermission('GET', '')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// PUBLIC_ROUTES
// ---------------------------------------------------------------------------

describe('PUBLIC_ROUTES', () => {
  it('contains health check route', () => {
    expect(PUBLIC_ROUTES.has('GET /api/v1/backoffice/health')).toBe(true)
  })

  it('contains backoffice context route', () => {
    expect(PUBLIC_ROUTES.has('GET /api/v1/backoffice/context')).toBe(true)
  })

  it('all PUBLIC_ROUTES entries resolve to null from lookupPermission (no 403)', () => {
    for (const entry of PUBLIC_ROUTES) {
      const [method, path] = entry.split(' ') as [string, string]
      // Public routes should not be in ROUTE_PERMISSION_REGISTRY
      const result = lookupPermission(method, path)
      expect(result).toBeNull()
    }
  })
})

// ---------------------------------------------------------------------------
// Registry completeness
// ---------------------------------------------------------------------------

describe('ROUTE_PERMISSION_REGISTRY completeness', () => {
  it('contains exactly 9 entries', () => {
    expect(Object.keys(ROUTE_PERMISSION_REGISTRY).length).toBe(9)
  })

  it('all module keys match known PermissionModule enum values', () => {
    const validModules = new Set(Object.values(PermissionModule))
    for (const entry of Object.values(ROUTE_PERMISSION_REGISTRY)) {
      expect(validModules.has(entry.module as PermissionModule)).toBe(true)
    }
  })

  it('all actions are valid permission action names', () => {
    const validActions = new Set([
      'can_view',
      'can_create',
      'can_edit',
      'can_delete',
    ])
    for (const entry of Object.values(ROUTE_PERMISSION_REGISTRY)) {
      expect(validActions.has(entry.action)).toBe(true)
    }
  })

  it('no duplicate route entries', () => {
    const keys = Object.keys(ROUTE_PERMISSION_REGISTRY)
    const unique = new Set(keys)
    expect(unique.size).toBe(keys.length)
  })

  it('covers all 9 roles.ts route paths', () => {
    const expected = [
      'POST /api/v1/backoffice/workspace/roles',
      'GET /api/v1/backoffice/workspace/roles',
      'GET /api/v1/backoffice/workspace/roles/:id',
      'PATCH /api/v1/backoffice/workspace/roles/:id',
      'PUT /api/v1/backoffice/workspace/roles/:id/permissions',
      'DELETE /api/v1/backoffice/workspace/roles/:id',
      'GET /api/v1/backoffice/workspace/roles/:id/users',
      'PATCH /api/v1/backoffice/workspace/staff/:userId/role',
      'GET /api/v1/backoffice/workspace/role-permission-modules',
    ]
    const actual = Object.keys(ROUTE_PERMISSION_REGISTRY)
    for (const route of expected) {
      expect(actual).toContain(route)
    }
  })
})
