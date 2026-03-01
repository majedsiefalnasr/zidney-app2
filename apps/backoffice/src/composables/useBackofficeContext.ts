/**
 * useBackofficeContext composable — STAGE_17
 *
 * File: apps/backoffice/src/composables/useBackofficeContext.ts
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 *
 * Fetches GET /api/v1/backoffice/context with credentials: 'include'.
 * Auth is carried via HttpOnly SameSite=Strict cookie (backoffice_token).
 * No Authorization header — SPA must never read the cookie value.
 *
 * Returns reactive BackofficeContext | null.
 *
 * Constitutional Compliance:
 * ✓ credentials: 'include' — cookie sent automatically; no JS token access
 * ✓ Uses @zidney/types BackofficeContext type
 * ✓ No console.log — error captured in returned reactive ref
 */

import type { BackofficeContext } from '@zidney/types'
import { ref } from 'vue'

export function useBackofficeContext() {
  const context = ref<BackofficeContext | null>(null)
  const loading = ref(false)
  const error = ref<{ code: string; message: string } | null>(null)

  async function fetchContext(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      // eslint-disable-next-line no-restricted-globals -- pre-auth bootstrap: no token available yet
      const response = await fetch('/api/v1/backoffice/context', {
        // FE-01: HttpOnly SameSite=Strict cookie sent automatically.
        // No Authorization header; no token read from JS-accessible storage.
        credentials: 'include',
      })
      const json = (await response.json()) as {
        success: boolean
        data: BackofficeContext | null
        error: { code: string; message: string } | null
      }
      if (!json.success) {
        error.value = json.error
        context.value = null
        return
      }
      context.value = json.data
    } catch {
      error.value = {
        code: 'NETWORK_ERROR',
        message: 'Failed to load workspace context',
      }
    } finally {
      loading.value = false
    }
  }

  return { context, loading, error, fetchContext }
}
