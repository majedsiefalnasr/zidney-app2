/**
 * usePermission composable — STAGE_21
 *
 * File: apps/backoffice/src/composables/usePermission.ts
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 *
 * Display-only composable that reads permission flags for the current staff
 * user from the backoffice context endpoint, and exposes a `can()` helper.
 *
 * ⚠️  IMPORTANT — SECURITY CONTRACT:
 * The `can()` function returned by this composable is FOR DISPLAY PURPOSES
 * ONLY. It controls UI visibility (hiding buttons, links, etc.) but MUST
 * NOT be treated as a security boundary. ALL permission enforcement happens
 * server-side via `createPermissionGuard` in the API layer.
 * Client-side permission state MUST NOT bypass server-side authorization.
 *
 * Constitutional Compliance:
 * ✓ No business logic — display only
 * ✓ No DB imports — pure fetch + reactive refs
 * ✓ credentials: 'include' — cookie-based auth (no Authorization header)
 * ✓ No console.log
 * ✓ sc-007 compliant — no server error details exposed in UI
 */

import { ref } from 'vue'

export type PermissionFlags = {
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
}

export type PermissionsMap = Record<string, PermissionFlags>

export function usePermission() {
  const permissions = ref<PermissionsMap>({})
  const loading = ref(false)
  const error = ref<{ code: string; message: string } | null>(null)

  /**
   * Fetches the current user's permission map from GET /api/v1/backoffice/context.
   * The context endpoint returns the user's role + permissions as part of the
   * BackofficeContext payload.
   *
   * Call this once on app startup or after role assignment mutations.
   */
  async function fetchPermissions(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      // eslint-disable-next-line no-restricted-globals
      const response = await fetch('/api/v1/backoffice/context', {
        credentials: 'include',
      })
      const json = (await response.json()) as {
        success: boolean
        data: { permissions?: PermissionsMap } | null
        error: { code: string; message: string } | null
      }
      if (!json.success || !json.data) {
        error.value = json.error ?? {
          code: 'UNKNOWN_ERROR',
          message: 'Failed to load permissions',
        }
        permissions.value = {}
        return
      }
      permissions.value = json.data.permissions ?? {}
    } catch {
      error.value = {
        code: 'NETWORK_ERROR',
        message: 'Failed to load permissions',
      }
      permissions.value = {}
    } finally {
      loading.value = false
    }
  }

  /**
   * Returns whether the current user can perform `action` on `module`.
   *
   * ⚠️  FOR DISPLAY ONLY — do NOT use this for security decisions.
   * All access control is enforced server-side.
   *
   * @param module  - Permission module key (e.g. 'settings', 'users')
   * @param action  - Permission action ('view' | 'create' | 'edit' | 'delete')
   * @returns boolean — defaults to false (deny-by-default in UI)
   */
  function can(
    module: string,
    action: 'view' | 'create' | 'edit' | 'delete'
  ): boolean {
    return (
      permissions.value[module]?.[`can_${action}` as keyof PermissionFlags] ??
      false
    )
  }

  return { permissions, loading, error, fetchPermissions, can }
}
