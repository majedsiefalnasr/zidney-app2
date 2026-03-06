/**
 * MMC useBreakpoint composable
 * Tracks viewport width and updates ui.store.isMobile at 768px threshold.
 * Uses native window resize listener — no external dependencies.
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 */
import { useMmcUiStore } from '@/core/state/ui.store'
import { onMounted, onUnmounted } from 'vue'

const MOBILE_BREAKPOINT = 768

export function useBreakpoint(): void {
  const uiStore = useMmcUiStore()

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
