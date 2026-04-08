/**
 * useNotify composable — Frontoffice
 * Wraps useFrontofficeNotificationStore and exposes typed shorthand helpers.
 * Default durations: success=4000ms, error=undefined (persistent), warning=7000ms, info=5000ms.
 * All notifications are dismissible by default.
 *
 * Exam-mode guard (US5): if useAttemptStore().isExamActive is true,
 *   success() and info() are suppressed (return "").
 *   error() and warning() always push regardless of exam mode.
 *
 * Stage: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK
 */

import { useAttemptStore } from '@/core/state/attempt.store'
import { useFrontofficeNotificationStore } from '@/core/state/notification.store'

export function useNotify() {
  const store = useFrontofficeNotificationStore()
  const attemptStore = useAttemptStore()

  function success(title: string, message?: string): string {
    if (attemptStore.isExamActive) return ''
    return store.push({ type: 'success', title, message, duration: 4000, dismissible: true })
  }

  function error(title: string, message?: string): string {
    return store.push({ type: 'error', title, message, duration: undefined, dismissible: true })
  }

  function warning(title: string, message?: string): string {
    return store.push({ type: 'warning', title, message, duration: 7000, dismissible: true })
  }

  function info(title: string, message?: string): string {
    if (attemptStore.isExamActive) return ''
    return store.push({ type: 'info', title, message, duration: 5000, dismissible: true })
  }

  return { success, error, warning, info }
}
