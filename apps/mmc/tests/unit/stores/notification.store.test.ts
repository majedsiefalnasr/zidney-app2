/**
 * Unit tests for useMmcNotificationStore
 * Coverage: FR-020, PO-HIGH (MAX_QUEUE_SIZE)
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */

import { describe, expect, it } from 'vitest'
import type { AppNotification } from '@/core/state/notification.store'
import { useMmcNotificationStore } from '@/core/state/notification.store'
import { useIsolatedPinia } from '../store-test-helper'

const makeNotification = (
  overrides?: Partial<Omit<AppNotification, 'id'>>
): Omit<AppNotification, 'id'> => ({
  type: 'info',
  title: 'Test',
  dismissible: true,
  ...overrides,
})

describe('useMmcNotificationStore', () => {
  useIsolatedPinia()

  it('initializes with empty notifications', () => {
    const store = useMmcNotificationStore()
    expect(store.notifications).toEqual([])
  })

  it('push returns a string id and appends to queue', () => {
    const store = useMmcNotificationStore()
    const id = store.push(makeNotification({ title: 'Hello' }))
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0].id).toBe(id)
    expect(store.notifications[0].title).toBe('Hello')
  })

  it('dismiss removes only the matching notification', () => {
    const store = useMmcNotificationStore()
    const id1 = store.push(makeNotification({ title: 'N1' }))
    const id2 = store.push(makeNotification({ title: 'N2' }))
    store.dismiss(id1)
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0].id).toBe(id2)
  })

  it('clearAll empties the notification queue', () => {
    const store = useMmcNotificationStore()
    store.push(makeNotification())
    store.push(makeNotification())
    store.clearAll()
    expect(store.notifications).toEqual([])
  })

  it('multiple concurrent notifications are independently dismissible', () => {
    const store = useMmcNotificationStore()
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
    const store = useMmcNotificationStore()
    store.push(makeNotification())
    store.$reset()
    expect(store.notifications).toEqual([])
  })

  it('enforces MAX_QUEUE_SIZE=20: push 21 items, only 20 remain (FIFO eviction)', () => {
    const store = useMmcNotificationStore()
    const ids: string[] = []
    for (let i = 0; i < 21; i++) {
      ids.push(store.push(makeNotification({ title: `N${i}` })))
    }
    expect(store.notifications).toHaveLength(20)
    // First notification should have been evicted (FIFO)
    expect(store.notifications[0].title).toBe('N1')
    expect(store.notifications[19].title).toBe('N20')
  })

  it('state is isolated between tests (SC-005)', () => {
    const store = useMmcNotificationStore()
    expect(store.notifications).toEqual([])
  })
})
