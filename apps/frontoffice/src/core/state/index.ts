/**
 * Pinia state module index for Frontoffice.
 * Router is no longer injected via Pinia plugin — it is passed directly to
 * defineAuthStore() in main.ts (STAGE_UI_01_AUTH_MODULE).
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */
import { createPinia } from 'pinia'

export { createPinia }

// Backward-compatible factory (no longer injects router)
export function createAppPinia() {
  return createPinia()
}
