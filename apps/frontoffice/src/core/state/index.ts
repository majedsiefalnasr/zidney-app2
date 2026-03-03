/**
 * Pinia state module index for Frontoffice.
 * Re-exports all core stores for the Frontoffice application.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
export { defineAuthStore } from './auth.store'
export { useFrontofficeAppStore } from './app.store'
export { useFrontofficeUiStore } from './ui.store'
export { useFrontofficeNotificationStore } from './notification.store'
export { useLicenseStatusStore } from './license-status.store'
export type { AppNotification } from './notification.store'
