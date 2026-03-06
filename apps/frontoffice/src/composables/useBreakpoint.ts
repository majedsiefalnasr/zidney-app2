/**
 * Frontoffice useBreakpoint composable
 * Tracks viewport width and updates ui.store.isMobile at 768px threshold.
 * Uses native window resize listener — no external dependencies.
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 */

import { onMounted, onUnmounted } from 'vue'
import { useFrontofficeUiStore } from '../core/state/ui.store'

const MOBILE_BREAKPOINT = 768

export function useBreakpoint(): void {
  const uiStore = useFrontofficeUiStore()

  function checkBreakpoint(): void {
    uiStore.setMobile(window.innerWidth < MOBILE_BREAKPOINT)
  }

  onMounted(() => {
    checkBreakpoint()
    window.addEventListener('resize', checkBreakpoint)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', checkBreakpoint)
  })
}
