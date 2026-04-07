/**
 * Backoffice Notification Store
 * Manages a queue of toast/alert notifications.
 * Supports independent push, dismiss, and clearAll.
 * No persistence. No async operations.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

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

export const useBackofficeNotificationStore = defineStore('backoffice-notification', () => {
  // ── Constants ──────────────────────────────────────────────────────────
  const MAX_QUEUE_SIZE = 20 // prevents unbounded growth during error-retry storms (PO-HIGH)
  const DEDUP_WINDOW_MS = 2000 // suppress identical notifications within 2 seconds
  const VISIBLE_CAP = 5 // maximum number of notifications surfaced to the toast bridge

  // ── State ──────────────────────────────────────────────────────────────
  const notifications = ref<AppNotification[]>([])
  const lastPushed = new Map<string, number>() // key → timestamp, for dedup

  // ── Computed ───────────────────────────────────────────────────────────
  const visibleNotifications = computed(() => notifications.value.slice(-VISIBLE_CAP))

  // ── Actions ────────────────────────────────────────────────────────────
  function push(notification: Omit<AppNotification, 'id'>): string {
    const key = `${notification.type}:${notification.title}:${notification.message ?? ''}`
    const now = Date.now()
    const last = lastPushed.get(key)
    if (last !== undefined && now - last < DEDUP_WINDOW_MS) {
      return '' // duplicate within dedup window — suppress
    }
    lastPushed.set(key, now)
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
    lastPushed.clear()
  }

  return {
    notifications,
    visibleNotifications,
    push,
    dismiss,
    clearAll,
    $reset,
  }
})

// ── HMR (development only) ────────────────────────────────────────────────────
import { acceptHMRUpdate } from 'pinia'

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBackofficeNotificationStore, import.meta.hot))
}
