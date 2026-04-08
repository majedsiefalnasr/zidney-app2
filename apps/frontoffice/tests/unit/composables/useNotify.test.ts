/**
 * Unit tests for apps/frontoffice/src/composables/useNotify.ts
 *
 * Includes exam-mode guard: success() and info() are suppressed when isExamActive=true.
 * error() and warning() always push regardless of exam mode.
 *
 * Stage: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK
 * Task: T029
 */

import { describe, expect, it } from 'vitest'
import { useNotify } from '@/composables/useNotify'
import { useAttemptStore } from '@/core/state/attempt.store'
import { useFrontofficeNotificationStore } from '@/core/state/notification.store'
import { useIsolatedPinia } from '../store-test-helper'

describe('useNotify (frontoffice)', () => {
  useIsolatedPinia()

  it('success() pushes a success notification with duration 4000ms', () => {
    const { success } = useNotify()
    const store = useFrontofficeNotificationStore()
    const id = success('Done', 'Operation succeeded')
    expect(id).not.toBe('')
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
    const store = useFrontofficeNotificationStore()
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
    const store = useFrontofficeNotificationStore()
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
    const store = useFrontofficeNotificationStore()
    const id = info('Note', 'FYI')
    expect(id).not.toBe('')
    expect(store.notifications[0]).toMatchObject({
      type: 'info',
      title: 'Note',
      duration: 5000,
      dismissible: true,
    })
  })

  describe('exam-mode guard (US5)', () => {
    it('success() and info() return empty string when isExamActive=true', () => {
      const attemptStore = useAttemptStore()
      attemptStore.isExamActive = true
      const { success, info } = useNotify()
      const store = useFrontofficeNotificationStore()
      expect(success('Exam Success')).toBe('')
      expect(info('Exam Note')).toBe('')
      expect(store.notifications).toHaveLength(0)
    })

    it('error() and warning() push even when isExamActive=true', () => {
      const attemptStore = useAttemptStore()
      attemptStore.isExamActive = true
      const { error, warning } = useNotify()
      const store = useFrontofficeNotificationStore()
      const errId = error('Exam Error')
      const warnId = warning('Exam Warning')
      expect(errId).not.toBe('')
      expect(warnId).not.toBe('')
      expect(store.notifications).toHaveLength(2)
    })
  })
})
