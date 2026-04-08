/**
 * Integration test: notification flow for Frontoffice
 *
 * Verifies end-to-end notification routing (same as MMC) plus:
 * - Exam-mode suppression (US5): when useAttemptStore().isExamActive is true,
 *   info/success notifications are suppressed (queue stays empty);
 *   error/warning notifications still push regardless.
 *
 * Stage: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK
 * Task: T035
 */

import type { AppError } from '@zidney/api-client'
import { createAppError, ErrorCodes } from '@zidney/api-client'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFormSubmit } from '@/composables/useFormSubmit'
import { useNotify } from '@/composables/useNotify'
import { normalizeError } from '@/core/errors/error-normalizer'
import { useAttemptStore } from '@/core/state/attempt.store'
import { useFrontofficeNotificationStore } from '@/core/state/notification.store'

vi.mock('@zidney/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

// ── Notification routing helper (mirrors real app error-handling pattern) ─────
function routeErrorToNotifications(
  err: AppError,
  store: ReturnType<typeof useFrontofficeNotificationStore>,
  router: { push: ReturnType<typeof vi.fn> }
): void {
  if (err.isNetworkError) return
  if (err.httpStatus === 400) return
  if (err.httpStatus === 401) {
    router.push('/login')
    return
  }
  if (err.httpStatus === 403) {
    store.push({ type: 'warning', title: 'Access denied', message: err.message, dismissible: true })
    return
  }
  if (err.httpStatus === 409 || err.httpStatus === 422) {
    store.push({ type: 'error', title: 'Request failed', message: err.message, dismissible: true })
    return
  }
  store.push({
    type: 'error',
    title: 'Something went wrong',
    message: err.message,
    dismissible: true,
  })
}

describe('notification-flow (frontoffice)', () => {
  let mockRouter: { push: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    setActivePinia(createPinia())
    mockRouter = { push: vi.fn() }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('400 VALIDATION_ERROR — no toast pushed (field errors route to form)', () => {
    const store = useFrontofficeNotificationStore()
    const err = normalizeError({ status: 400, statusText: 'Bad Request' })
    routeErrorToNotifications(err, store, mockRouter)
    expect(store.notifications).toHaveLength(0)
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('401 AUTH_REFRESH_FAILED — no toast, router.push called with /login', () => {
    const store = useFrontofficeNotificationStore()
    const err = createAppError({
      code: ErrorCodes.AUTH_REFRESH_FAILED,
      message: 'Session expired',
      httpStatus: 401,
      isNetworkError: false,
    })
    routeErrorToNotifications(err, store, mockRouter)
    expect(store.notifications).toHaveLength(0)
    expect(mockRouter.push).toHaveBeenCalledWith('/login')
  })

  it('403 PERMISSION_DENIED — warning toast pushed', () => {
    const store = useFrontofficeNotificationStore()
    const err = createAppError({
      code: ErrorCodes.PERMISSION_DENIED,
      message: 'Forbidden',
      httpStatus: 403,
      isNetworkError: false,
    })
    routeErrorToNotifications(err, store, mockRouter)
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0]).toMatchObject({ type: 'warning', title: 'Access denied' })
  })

  it('409 CONFLICT — error toast with err.message', () => {
    const store = useFrontofficeNotificationStore()
    const err = createAppError({
      code: ErrorCodes.CONFLICT,
      message: 'Resource already exists',
      httpStatus: 409,
      isNetworkError: false,
    })
    routeErrorToNotifications(err, store, mockRouter)
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0]).toMatchObject({
      type: 'error',
      message: 'Resource already exists',
    })
  })

  it('422 UNPROCESSABLE — error toast with err.message', () => {
    const store = useFrontofficeNotificationStore()
    const err = createAppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Invalid payload',
      httpStatus: 422,
      isNetworkError: false,
    })
    routeErrorToNotifications(err, store, mockRouter)
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0]).toMatchObject({ type: 'error', message: 'Invalid payload' })
  })

  it('500 SERVER_ERROR — generic error toast pushed', () => {
    const store = useFrontofficeNotificationStore()
    const err = normalizeError({ status: 500, statusText: 'Internal Server Error' })
    routeErrorToNotifications(err, store, mockRouter)
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0]).toMatchObject({ type: 'error', title: 'Something went wrong' })
  })

  it('network error (isNetworkError=true) — no toast, offline banner handles it', () => {
    const store = useFrontofficeNotificationStore()
    const err = createAppError({
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Network request failed',
      httpStatus: 0,
      isNetworkError: true,
    })
    routeErrorToNotifications(err, store, mockRouter)
    expect(store.notifications).toHaveLength(0)
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('isSubmitting: true before action, false after completion', async () => {
    const { isSubmitting, submit } = useFormSubmit()
    expect(isSubmitting.value).toBe(false)

    let resolveAction!: () => void
    const pending = new Promise<void>((res) => {
      resolveAction = res
    })

    const p = submit(() => pending)
    expect(isSubmitting.value).toBe(true)

    resolveAction()
    await p

    expect(isSubmitting.value).toBe(false)
  })

  it('double-submit guard: second call while first is in-flight is a no-op', async () => {
    const { isSubmitting, submit } = useFormSubmit()
    const actionCalls = { count: 0 }

    let resolveFirst!: () => void
    const firstPending = new Promise<void>((res) => {
      resolveFirst = res
    })

    const first = submit(async () => {
      actionCalls.count++
      await firstPending
    })
    expect(isSubmitting.value).toBe(true)

    const second = submit(async () => {
      actionCalls.count++
    })

    resolveFirst()
    await first
    await second

    expect(actionCalls.count).toBe(1)
    expect(isSubmitting.value).toBe(false)
  })

  describe('exam-mode suppression (US5)', () => {
    it('info and success notifications are suppressed when isExamActive=true', () => {
      const store = useFrontofficeNotificationStore()
      const attemptStore = useAttemptStore()
      attemptStore.isExamActive = true

      const notify = useNotify()
      notify.info('Test info', 'detail')
      notify.success('Test success', 'detail')

      expect(store.notifications).toHaveLength(0)
    })

    it('error and warning notifications are NOT suppressed when isExamActive=true', () => {
      const store = useFrontofficeNotificationStore()
      const attemptStore = useAttemptStore()
      attemptStore.isExamActive = true

      const notify = useNotify()
      notify.error('Critical error', 'detail')
      notify.warning('Caution', 'detail')

      expect(store.notifications).toHaveLength(2)
      expect(store.notifications[0].type).toBe('error')
      expect(store.notifications[1].type).toBe('warning')
    })

    it('info and success push normally when isExamActive=false', () => {
      const store = useFrontofficeNotificationStore()
      const attemptStore = useAttemptStore()
      attemptStore.isExamActive = false

      const notify = useNotify()
      notify.info('Info message', 'detail')
      notify.success('Success message', 'detail')

      expect(store.notifications).toHaveLength(2)
    })
  })
})
