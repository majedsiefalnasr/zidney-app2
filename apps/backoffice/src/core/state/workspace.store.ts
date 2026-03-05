/**
 * Backoffice Workspace Store
 * Manages the resolved workspace context (slug, name, tier) for the active session.
 * Read by feature stores via storeToRefs(useBackofficeWorkspaceStore()).
 * Never mutated by feature stores.
 *
 * Loading: uses both isLoading (primary) + pending (per-action) per FR-016.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import { type AppError, createAppError } from '@zidney/api-client'
import { logger } from '@zidney/logger'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface WorkspaceContext {
  slug: string
  name: string
  tier: string
  schemaVersion: number
  productVersion: string
}

export const useBackofficeWorkspaceStore = defineStore(
  'backoffice-workspace',
  () => {
    // ── State ──────────────────────────────────────────────────────────────
    const workspace = ref<WorkspaceContext | null>(null)
    const pending = ref<Record<string, boolean>>({})
    // isLoading is a derived computed — auto-updates from pending map (PO-MED-1)
    const isLoading = computed(() => Object.values(pending.value).some(Boolean))
    const error = ref<AppError | null>(null)

    // ── Actions ────────────────────────────────────────────────────────────
    async function loadWorkspace(slug: string): Promise<void> {
      // Concurrent call guard: skip if already loading (FR-016, M-03 contract)
      if (pending.value['loadWorkspace']) return

      pending.value['loadWorkspace'] = true
      // isLoading automatically becomes true as pending now has a truthy key
      error.value = null

      try {
        // NOTE: Structural stub — replace with actual workspaceApi.getWorkspace(slug)
        // once the workspace API module is available from the relevant backend stage.
        // The stub resolves cleanly (no-op) so tests can exercise the happy path lifecycle.
        // const data = await workspaceApi.getWorkspace(slug)
        // workspace.value = data

        // Stub: resolve without throwing so bootstrap and lifecycle tests pass cleanly
        await Promise.resolve()

        // Suppress unused variable warning for slug until stub is replaced
        void slug
      } catch (err: unknown) {
        const appErr = createAppError({
          code: 'WORKSPACE_LOAD_FAILED',
          message: 'Unable to load workspace. Please try again.', // generic, never raw err.message (SA-003)
          httpStatus: 0,
          isNetworkError: false,
        })
        logger.warn('workspace.store: loadWorkspace failed', {
          service: 'backoffice-store',
          error_code: appErr.code,
          internal_message: err instanceof Error ? err.message : String(err), // internal-only
        })
        error.value = appErr
      } finally {
        pending.value['loadWorkspace'] = false
        // isLoading auto-derives from pending — no manual assignment needed
      }
    }

    function clearError(): void {
      error.value = null
    }

    function $reset(): void {
      workspace.value = null
      pending.value = {} // isLoading auto-derives to false when pending is empty
      error.value = null
    }

    return {
      workspace,
      isLoading,
      pending,
      error,
      loadWorkspace,
      clearError,
      $reset,
    }
  }
)

// ── HMR (development only) ────────────────────────────────────────────────────
import { acceptHMRUpdate } from 'pinia'
if ((import.meta as any).hot) {
  ;(import.meta as any).hot.accept(
    acceptHMRUpdate(useBackofficeWorkspaceStore, (import.meta as any).hot)
  )
}
