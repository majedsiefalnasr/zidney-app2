/**
 * Pinia state module index for MMC.
 * Re-exports all core stores for the MMC application.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
export { defineAuthStore } from './auth.store'
export { useMmcAppStore } from './app.store'
export { useMmcUiStore } from './ui.store'
export { useMmcNotificationStore } from './notification.store'
export { useLicenseStatusStore } from './license-status.store'
export type { AppNotification } from './notification.store'
