/**
 * useOfflineBanner composable — Frontoffice
 * Detects online/offline status via @vueuse/core useOnline().
 * Returns showBanner: true when the browser is offline.
 *
 * Stage: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK
 */

import { useOnline } from '@vueuse/core'
import { computed } from 'vue'

export function useOfflineBanner() {
  const isOnline = useOnline()
  const showBanner = computed(() => !isOnline.value)
  return { showBanner }
}
