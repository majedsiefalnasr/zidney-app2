/**
 * MMC UI Store
 * Manages transient UI state: modals, drawers, overlay.
 * No persistence. No async operations.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMmcUiStore = defineStore('mmc-ui', () => {
  // ── State ──────────────────────────────────────────────────────────────
  const modals = ref<Record<string, boolean>>({})
  const drawers = ref<Record<string, boolean>>({})
  const overlayVisible = ref<boolean>(false)

  // ── Actions ────────────────────────────────────────────────────────────
  function openModal(id: string): void {
    modals.value[id] = true
  }
  function closeModal(id: string): void {
    modals.value[id] = false
  }
  function toggleModal(id: string): void {
    modals.value[id] = !modals.value[id]
  }
  function openDrawer(id: string): void {
    drawers.value[id] = true
  }
  function closeDrawer(id: string): void {
    drawers.value[id] = false
  }
  function toggleDrawer(id: string): void {
    drawers.value[id] = !drawers.value[id]
  }
  function showOverlay(): void {
    overlayVisible.value = true
  }
  function hideOverlay(): void {
    overlayVisible.value = false
  }
  function closeAll(): void {
    modals.value = {}
    drawers.value = {}
    overlayVisible.value = false
  }

  function $reset(): void {
    modals.value = {}
    drawers.value = {}
    overlayVisible.value = false
  }

  return {
    modals,
    drawers,
    overlayVisible,
    openModal,
    closeModal,
    toggleModal,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    showOverlay,
    hideOverlay,
    closeAll,
    $reset,
  }
})

// ── HMR (development only) ────────────────────────────────────────────────────
import { acceptHMRUpdate } from 'pinia'
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMmcUiStore, import.meta.hot))
}
