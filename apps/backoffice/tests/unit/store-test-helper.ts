import { createPinia, setActivePinia } from 'pinia'
import { beforeEach } from 'vitest'

/**
 * Call this in test describe blocks to isolate store state between tests.
 * Satisfies FR-028, FR-030, SC-005.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
export function useIsolatedPinia(): void {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
}
