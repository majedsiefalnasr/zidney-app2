/**
 * Frontoffice Notification Store
 * Manages a queue of toast/alert notifications.
 * Supports independent push, dismiss, and clearAll.
 * No persistence. No async operations.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface AppNotification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number // ms; undefined = persistent
  dismissible: boolean
}
// NOTE (M-01): AppNotification is defined locally in this store for this stage.
// All three apps (MMC, Backoffice, Frontoffice) MUST keep this interface shape identical.
// Moving this type to @zidney/types is deferred to a future cleanup stage.

export const useFrontofficeNotificationStore = defineStore(
  'frontoffice-notification',
  () => {
    // ── Constants ──────────────────────────────────────────────────────────
    const MAX_QUEUE_SIZE = 20 // prevents unbounded growth during error-retry storms (PO-HIGH)

    // ── State ──────────────────────────────────────────────────────────────
    const notifications = ref<AppNotification[]>([])

    // ── Actions ────────────────────────────────────────────────────────────
    function push(notification: Omit<AppNotification, 'id'>): string {
      const id = crypto.randomUUID()
      if (notifications.value.length >= MAX_QUEUE_SIZE) {
        notifications.value.shift() // evict oldest when at capacity
      }
      notifications.value.push({ ...notification, id })
      return id
    }

    function dismiss(id: string): void {
      notifications.value = notifications.value.filter((n) => n.id !== id)
    }

    function clearAll(): void {
      notifications.value = []
    }

    function $reset(): void {
      notifications.value = []
    }

    return {
      notifications,
      push,
      dismiss,
      clearAll,
      $reset,
    }
  }
)

// ── HMR (development only) ────────────────────────────────────────────────────
import { acceptHMRUpdate } from 'pinia'
if ((import.meta as any).hot) {
  ;(import.meta as any).hot.accept(
    acceptHMRUpdate(useFrontofficeNotificationStore, (import.meta as any).hot)
  )
}
