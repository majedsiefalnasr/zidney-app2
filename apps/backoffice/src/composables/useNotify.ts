/**
 * useNotify composable — Backoffice
 * Wraps useBackofficeNotificationStore and exposes typed shorthand helpers.
 * Default durations: success=4000ms, error=undefined (persistent), warning=7000ms, info=5000ms.
 * All notifications are dismissible by default.
 *
 * Stage: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK
 */

import { useBackofficeNotificationStore } from '@/core/state/notification.store'

export function useNotify() {
  const store = useBackofficeNotificationStore()

  function success(title: string, message?: string): string {
    return store.push({ type: 'success', title, message, duration: 4000, dismissible: true })
  }

  function error(title: string, message?: string): string {
    return store.push({ type: 'error', title, message, duration: undefined, dismissible: true })
  }

  function warning(title: string, message?: string): string {
    return store.push({ type: 'warning', title, message, duration: 7000, dismissible: true })
  }

  function info(title: string, message?: string): string {
    return store.push({ type: 'info', title, message, duration: 5000, dismissible: true })
  }

  return { success, error, warning, info }
}
