/**
 * Unit tests for apps/backoffice/src/composables/useNotify.ts
 *
 * Stage: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK
 * Task: T028
 */

import { describe, expect, it } from 'vitest'
import { useNotify } from '@/composables/useNotify'
import { useBackofficeNotificationStore } from '@/core/state/notification.store'
import { useIsolatedPinia } from '../store-test-helper'

describe('useNotify (backoffice)', () => {
  useIsolatedPinia()

  it('success() pushes a success notification with duration 4000ms', () => {
    const { success } = useNotify()
    const store = useBackofficeNotificationStore()
    const id = success('Done', 'Operation succeeded')
    expect(id).not.toBe('')
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0]).toMatchObject({
      type: 'success',
      title: 'Done',
      message: 'Operation succeeded',
      duration: 4000,
      dismissible: true,
    })
  })

  it('error() pushes a persistent error notification (no duration)', () => {
    const { error } = useNotify()
    const store = useBackofficeNotificationStore()
    const id = error('Failed', 'Something went wrong')
    expect(id).not.toBe('')
    expect(store.notifications[0]).toMatchObject({
      type: 'error',
      title: 'Failed',
      duration: undefined,
      dismissible: true,
    })
  })

  it('warning() pushes a warning notification with duration 7000ms', () => {
    const { warning } = useNotify()
    const store = useBackofficeNotificationStore()
    const id = warning('Caution', 'Check your input')
    expect(id).not.toBe('')
    expect(store.notifications[0]).toMatchObject({
      type: 'warning',
      title: 'Caution',
      duration: 7000,
      dismissible: true,
    })
  })

  it('info() pushes an info notification with duration 5000ms', () => {
    const { info } = useNotify()
    const store = useBackofficeNotificationStore()
    const id = info('Note', 'FYI')
    expect(id).not.toBe('')
    expect(store.notifications[0]).toMatchObject({
      type: 'info',
      title: 'Note',
      duration: 5000,
      dismissible: true,
    })
  })
})
