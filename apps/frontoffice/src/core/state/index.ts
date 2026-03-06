import { createPinia } from 'pinia'
import type { Router } from 'vue-router'

/**
 * Pinia state module index for Frontoffice.
 * Re-exports all core stores for the Frontoffice application.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */

export function createAppPinia(_router: Router) {
  return createPinia()
}
export { useFrontofficeAppStore } from './app.store'
export { defineAuthStore, useFrontofficeAuthStore } from './auth.store'
export { useLicenseStatusStore } from './license-status.store'
export type { AppNotification } from './notification.store'
export { useFrontofficeNotificationStore } from './notification.store'
export { useFrontofficeUiStore } from './ui.store'
