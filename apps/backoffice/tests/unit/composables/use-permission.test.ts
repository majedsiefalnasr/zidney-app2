/**
 * Unit tests for usePermission composable.
 *
 * Test coverage:
 * - Default state: permissions is empty, loading is false, error is null
 * - can() returns false by default (deny-by-default contract)
 * - can() returns true when correct flag is set in permissions map
 * - can() covers all four actions: view, create, edit, delete
 * - can() returns false for unknown module (no map entry)
 * - can() returns false when flag is explicitly false
 * - can() is display-only — pure reactive read, no side effects
 *
 * Note: fetchPermissions() is covered separately via integration tests
 * (requires mocking global.fetch). These tests exercise the `can()` helper
 * in isolation by directly mutating the returned `permissions` ref.
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — Additional unit coverage
 * Refs: usePermission.ts security contract, deny-by-default UI rule
 */

import { usePermission } from '@/composables/usePermission'
import { describe, expect, it } from 'vitest'

describe('usePermission — can() helper', () => {
  it('initial state: permissions is empty, loading false, error null', () => {
    const { permissions, loading, error } = usePermission()

    expect(permissions.value).toEqual({})
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  describe('deny-by-default', () => {
    it('returns false for any module when permissions map is empty', () => {
      const { can } = usePermission()

      expect(can('users', 'view')).toBe(false)
      expect(can('settings', 'create')).toBe(false)
      expect(can('exams', 'edit')).toBe(false)
      expect(can('reports', 'delete')).toBe(false)
    })

    it('returns false for a module not in the permissions map', () => {
      const { permissions, can } = usePermission()

      permissions.value = {
        settings: {
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: true,
        },
      }

      expect(can('users', 'view')).toBe(false)
      expect(can('exams', 'edit')).toBe(false)
    })

    it('returns false when flag is explicitly set to false', () => {
      const { permissions, can } = usePermission()

      permissions.value = {
        settings: {
          can_view: true,
          can_create: false,
          can_edit: false,
          can_delete: false,
        },
      }

      expect(can('settings', 'create')).toBe(false)
      expect(can('settings', 'edit')).toBe(false)
      expect(can('settings', 'delete')).toBe(false)
    })
  })

  describe('permission grant', () => {
    it('returns true for action=view when can_view is true', () => {
      const { permissions, can } = usePermission()

      permissions.value = {
        settings: {
          can_view: true,
          can_create: false,
          can_edit: false,
          can_delete: false,
        },
      }

      expect(can('settings', 'view')).toBe(true)
    })

    it('returns true for action=create when can_create is true', () => {
      const { permissions, can } = usePermission()

      permissions.value = {
        users: {
          can_view: false,
          can_create: true,
          can_edit: false,
          can_delete: false,
        },
      }

      expect(can('users', 'create')).toBe(true)
    })

    it('returns true for action=edit when can_edit is true', () => {
      const { permissions, can } = usePermission()

      permissions.value = {
        exams: {
          can_view: false,
          can_create: false,
          can_edit: true,
          can_delete: false,
        },
      }

      expect(can('exams', 'edit')).toBe(true)
    })

    it('returns true for action=delete when can_delete is true', () => {
      const { permissions, can } = usePermission()

      permissions.value = {
        reports: {
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: true,
        },
      }

      expect(can('reports', 'delete')).toBe(true)
    })

    it('returns correct values for all four actions on a fully-permitted module', () => {
      const { permissions, can } = usePermission()

      permissions.value = {
        admin: {
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: true,
        },
      }

      expect(can('admin', 'view')).toBe(true)
      expect(can('admin', 'create')).toBe(true)
      expect(can('admin', 'edit')).toBe(true)
      expect(can('admin', 'delete')).toBe(true)
    })
  })

  describe('isolation between instances', () => {
    it('two usePermission() calls are independent (no shared state)', () => {
      const a = usePermission()
      const b = usePermission()

      a.permissions.value = {
        settings: {
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: true,
        },
      }

      // b has its own empty permissions map
      expect(b.can('settings', 'view')).toBe(false)
    })
  })

  describe('permissions reactivity', () => {
    it('can() reflects updated permissions.value in real-time', () => {
      const { permissions, can } = usePermission()

      // Initially denied
      expect(can('reports', 'view')).toBe(false)

      // Grant view
      permissions.value = {
        reports: {
          can_view: true,
          can_create: false,
          can_edit: false,
          can_delete: false,
        },
      }

      expect(can('reports', 'view')).toBe(true)

      // Revoke
      permissions.value = {}

      expect(can('reports', 'view')).toBe(false)
    })
  })
})
