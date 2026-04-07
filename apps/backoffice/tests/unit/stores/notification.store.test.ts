/**
 * Unit tests for useBackofficeNotificationStore
 * Coverage: FR-020, PO-HIGH (MAX_QUEUE_SIZE)
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppNotification } from '@/core/state/notification.store'
import { useBackofficeNotificationStore } from '@/core/state/notification.store'
import { useIsolatedPinia } from '../store-test-helper'

const makeNotification = (
  overrides?: Partial<Omit<AppNotification, 'id'>>
): Omit<AppNotification, 'id'> => ({
  type: 'info',
  title: 'Test',
  dismissible: true,
  ...overrides,
})

describe('useBackofficeNotificationStore', () => {
  useIsolatedPinia()

  it('initializes with empty notifications', () => {
    const store = useBackofficeNotificationStore()
    expect(store.notifications).toEqual([])
  })

  it('push returns a string id and appends to queue', () => {
    const store = useBackofficeNotificationStore()
    const id = store.push(makeNotification({ title: 'Hello' }))
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0].id).toBe(id)
    expect(store.notifications[0].title).toBe('Hello')
  })

  it('dismiss removes only the matching notification', () => {
    const store = useBackofficeNotificationStore()
    const id1 = store.push(makeNotification({ title: 'N1' }))
    const id2 = store.push(makeNotification({ title: 'N2' }))
    store.dismiss(id1)
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0].id).toBe(id2)
  })

  it('clearAll empties the notification queue', () => {
    const store = useBackofficeNotificationStore()
    store.push(makeNotification())
    store.push(makeNotification())
    store.clearAll()
    expect(store.notifications).toEqual([])
  })

  it('multiple concurrent notifications are independently dismissible', () => {
    const store = useBackofficeNotificationStore()
    const ids = [
      store.push(makeNotification({ title: 'A' })),
      store.push(makeNotification({ title: 'B' })),
      store.push(makeNotification({ title: 'C' })),
    ]
    store.dismiss(ids[1])
    expect(store.notifications).toHaveLength(2)
    expect(store.notifications.map((n) => n.title)).toEqual(['A', 'C'])
  })

  it('$reset restores empty queue', () => {
    const store = useBackofficeNotificationStore()
    store.push(makeNotification())
    store.$reset()
    expect(store.notifications).toEqual([])
  })

  it('enforces MAX_QUEUE_SIZE=20: push 21 items, only 20 remain (FIFO eviction)', () => {
    const store = useBackofficeNotificationStore()
    for (let i = 0; i < 21; i++) {
      store.push(makeNotification({ title: `N${i}` }))
    }
    expect(store.notifications).toHaveLength(20)
    // First notification should have been evicted (FIFO)
    expect(store.notifications[0].title).toBe('N1')
    expect(store.notifications[19].title).toBe('N20')
  })

  it('state is isolated between tests (SC-005)', () => {
    const store = useBackofficeNotificationStore()
    expect(store.notifications).toEqual([])
  })

  describe('deduplication (DEDUP_WINDOW_MS=2000)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('push returns empty string for duplicate within 2s window', () => {
      const store = useBackofficeNotificationStore()
      store.push(makeNotification({ title: 'Dup' }))
      const id = store.push(makeNotification({ title: 'Dup' }))
      expect(id).toBe('')
      expect(store.notifications).toHaveLength(1)
    })

    it('push succeeds for same-key notification after 2s window expires', () => {
      const store = useBackofficeNotificationStore()
      const id1 = store.push(makeNotification({ title: 'Dup' }))
      vi.setSystemTime(Date.now() + 2001)
      const id2 = store.push(makeNotification({ title: 'Dup' }))
      expect(id1).not.toBe('')
      expect(id2).not.toBe('')
      expect(store.notifications).toHaveLength(2)
    })
  })

  it('visibleNotifications exposes at most the 5 latest notifications', () => {
    const store = useBackofficeNotificationStore()
    for (let i = 0; i < 8; i++) {
      store.push(makeNotification({ title: `V${i}` }))
    }
    expect(store.visibleNotifications).toHaveLength(5)
    expect(store.visibleNotifications[0].title).toBe('V3')
    expect(store.visibleNotifications[4].title).toBe('V7')
  })

  it('$reset clears lastPushed so duplicate is pushable again after reset', () => {
    const store = useBackofficeNotificationStore()
    const id1 = store.push(makeNotification({ title: 'ResetDedup' }))
    expect(id1).not.toBe('')
    const dup = store.push(makeNotification({ title: 'ResetDedup' }))
    expect(dup).toBe('') // suppressed within dedup window
    store.$reset()
    const id2 = store.push(makeNotification({ title: 'ResetDedup' }))
    expect(id2).not.toBe('') // allowed after reset clears lastPushed
  })
})
