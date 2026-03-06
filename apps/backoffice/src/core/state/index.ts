import { createPinia } from 'pinia'
import type { Router } from 'vue-router'

/**
 * Pinia state module index for Backoffice.
 * Re-exports all core stores for the Backoffice application.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */

export function createAppPinia(_router: Router) {
  return createPinia()
}
export { useBackofficeAppStore } from './app.store'
export { defineAuthStore, useBackofficeAuthStore } from './auth.store'
export { useLicenseStatusStore } from './license-status.store'
export type { AppNotification } from './notification.store'
export { useBackofficeNotificationStore } from './notification.store'
export { useBackofficeUiStore } from './ui.store'
export type { WorkspaceContext } from './workspace.store'
export { useBackofficeWorkspaceStore } from './workspace.store'
