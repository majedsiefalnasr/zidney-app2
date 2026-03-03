/**
 * Unit tests for useFrontofficeNotificationStore
 * Coverage: FR-020, PO-HIGH (MAX_QUEUE_SIZE)
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import type { AppNotification } from '@/core/state/notification.store'
import { useFrontofficeNotificationStore } from '@/core/state/notification.store'
import { describe, expect, it } from 'vitest'
import { useIsolatedPinia } from '../store-test-helper'

const makeNotification = (
  overrides?: Partial<Omit<AppNotification, 'id'>>
): Omit<AppNotification, 'id'> => ({
  type: 'info',
  title: 'Test',
  dismissible: true,
  ...overrides,
})

describe('useFrontofficeNotificationStore', () => {
  useIsolatedPinia()

  it('initializes with empty notifications', () => {
    const store = useFrontofficeNotificationStore()
    expect(store.notifications).toEqual([])
  })

  it('push returns a string id and appends to queue', () => {
    const store = useFrontofficeNotificationStore()
    const id = store.push(makeNotification({ title: 'Hello' }))
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0].id).toBe(id)
    expect(store.notifications[0].title).toBe('Hello')
  })

  it('dismiss removes only the matching notification', () => {
    const store = useFrontofficeNotificationStore()
    const id1 = store.push(makeNotification({ title: 'N1' }))
    const id2 = store.push(makeNotification({ title: 'N2' }))
    store.dismiss(id1)
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0].id).toBe(id2)
  })

  it('clearAll empties the notification queue', () => {
    const store = useFrontofficeNotificationStore()
    store.push(makeNotification())
    store.push(makeNotification())
    store.clearAll()
    expect(store.notifications).toEqual([])
  })

  it('multiple concurrent notifications are independently dismissible', () => {
    const store = useFrontofficeNotificationStore()
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
    const store = useFrontofficeNotificationStore()
    store.push(makeNotification())
    store.$reset()
    expect(store.notifications).toEqual([])
  })

  it('enforces MAX_QUEUE_SIZE=20: push 21 items, only 20 remain (FIFO eviction)', () => {
    const store = useFrontofficeNotificationStore()
    for (let i = 0; i < 21; i++) {
      store.push(makeNotification({ title: `N${i}` }))
    }
    expect(store.notifications).toHaveLength(20)
    expect(store.notifications[0].title).toBe('N1')
    expect(store.notifications[19].title).toBe('N20')
  })

  it('state is isolated between tests (SC-005)', () => {
    const store = useFrontofficeNotificationStore()
    expect(store.notifications).toEqual([])
  })
})
