/**
 * Backoffice Context Store — STAGE_17
 *
 * File: apps/backoffice/src/stores/context.ts
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 *
 * Pinia store for BackofficeContext. Fetched once on app mount via
 * useBackofficeContext() composable. All route guards and components
 * consume this store — no additional API calls needed after mount.
 *
 * Constitutional Compliance:
 * ✓ No direct fetch calls in store — delegates to composable
 * ✓ Using @zidney/types BackofficeContext and Module
 * ✓ hasModule() is pure function — no side effects
 */

import type { BackofficeContext, Module } from '@zidney/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useBackofficeContext } from '../composables/useBackofficeContext'

export const useContextStore = defineStore('backoffice-context', () => {
  const context = ref<BackofficeContext | null>(null)
  const loading = ref(false)
  const error = ref<{ code: string; message: string } | null>(null)

  // ── Computed ──────────────────────────────────────────────────────────────

  const isActive = computed(() => context.value?.license_status === 'ACTIVE')

  const enabledModules = computed<Module[]>(
    () => (context.value?.enabled_modules as Module[]) ?? []
  )

  const licenseStatus = computed(() => context.value?.license_status ?? null)

  const licenseErrorCode = computed(() => error.value?.code ?? null)

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Returns true if the given module is in the workspace's enabled_modules list.
   * Used by router navigation guards and layout components.
   */
  function hasModule(module: Module): boolean {
    return enabledModules.value.includes(module)
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Fetches BackofficeContext from the API and populates this store.
   * Safe to call multiple times — subsequent calls re-fetch the context.
   */
  async function loadContext(): Promise<void> {
    const { fetchContext, context: fetchedContext, error: fetchError } = useBackofficeContext()
    loading.value = true
    error.value = null
    try {
      await fetchContext()
      if (fetchError.value) {
        error.value = fetchError.value
        context.value = null
      } else {
        context.value = fetchedContext.value
      }
    } finally {
      loading.value = false
    }
  }

  /**
   * Resets store state. Called on logout or workspace switch.
   */
  function clearContext(): void {
    context.value = null
    loading.value = false
    error.value = null
  }

  return {
    // State
    context,
    loading,
    error,
    // Computed
    isActive,
    enabledModules,
    licenseStatus,
    licenseErrorCode,
    // Helpers
    hasModule,
    // Actions
    loadContext,
    clearContext,
  }
})
