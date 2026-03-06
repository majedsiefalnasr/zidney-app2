/**
 * Backoffice UI Store
 * Manages transient UI state: modals, drawers, overlay.
 * No persistence. No async operations.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useBackofficeUiStore = defineStore('backoffice-ui', () => {
  // ── State ──────────────────────────────────────────────────────────────
  const modals = ref<Record<string, boolean>>({})
  const drawers = ref<Record<string, boolean>>({})
  const overlayVisible = ref<boolean>(false)
  const sidebarCollapsed = ref<boolean>(false)
  const isMobile = ref<boolean>(false)

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

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setMobile(val: boolean): void {
    if (isMobile.value === val) return // no-op if unchanged
    isMobile.value = val
    // CL-005: atomic reset of sidebarCollapsed on breakpoint transition
    sidebarCollapsed.value = val // true on mobile, false on desktop
  }

  function $reset(): void {
    modals.value = {}
    drawers.value = {}
    overlayVisible.value = false
    sidebarCollapsed.value = false
    isMobile.value = false
  }

  return {
    modals,
    drawers,
    overlayVisible,
    sidebarCollapsed,
    isMobile,
    openModal,
    closeModal,
    toggleModal,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    showOverlay,
    hideOverlay,
    closeAll,
    toggleSidebar,
    setMobile,
    $reset,
  }
})

// ── HMR (development only) ────────────────────────────────────────────────────
import { acceptHMRUpdate } from 'pinia'
if ((import.meta as any).hot) {
  ;(import.meta as any).hot.accept(
    acceptHMRUpdate(useBackofficeUiStore, (import.meta as any).hot)
  )
}
