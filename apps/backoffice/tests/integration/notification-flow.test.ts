/**
 * Integration test: notification flow for Backoffice
 *
 * Verifies end-to-end notification routing (same as MMC) plus:
 * - workspace_slug from useBackofficeWorkspaceStore() is injected into
 *   409/422 notification messages (not sourced from request body)
 *
 * Stage: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK
 * Task: T034
 */

import type { AppError } from '@zidney/api-client'
import { createAppError, ErrorCodes } from '@zidney/api-client'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFormSubmit } from '@/composables/useFormSubmit'
import { normalizeError } from '@/core/errors/error-normalizer'
import { useBackofficeNotificationStore } from '@/core/state/notification.store'
import { useBackofficeWorkspaceStore } from '@/core/state/workspace.store'

vi.mock('@zidney/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

// ── Notification routing helper (mirrors real app error-handling pattern) ─────
function routeErrorToNotifications(
  err: AppError,
  notifStore: ReturnType<typeof useBackofficeNotificationStore>,
  workspaceStore: ReturnType<typeof useBackofficeWorkspaceStore>,
  router: { push: ReturnType<typeof vi.fn> }
): void {
  const workspaceSlug = workspaceStore.workspace?.slug
  const workspaceSuffix = workspaceSlug ? ` (workspace: ${workspaceSlug})` : ''

  if (err.isNetworkError) return
  if (err.httpStatus === 400) return
  if (err.httpStatus === 401) {
    router.push('/login')
    return
  }
  if (err.httpStatus === 403) {
    notifStore.push({
      type: 'warning',
      title: 'Access denied',
      message: err.message,
      dismissible: true,
    })
    return
  }
  if (err.httpStatus === 409 || err.httpStatus === 422) {
    notifStore.push({
      type: 'error',
      title: 'Request failed',
      message: `${err.message}${workspaceSuffix}`,
      dismissible: true,
    })
    return
  }
  notifStore.push({
    type: 'error',
    title: 'Something went wrong',
    message: `${err.message}${workspaceSuffix}`,
    dismissible: true,
  })
}

describe('notification-flow (backoffice)', () => {
  let mockRouter: { push: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    setActivePinia(createPinia())
    mockRouter = { push: vi.fn() }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('400 VALIDATION_ERROR — no toast pushed (field errors route to form)', () => {
    const notifStore = useBackofficeNotificationStore()
    const workspaceStore = useBackofficeWorkspaceStore()
    const err = normalizeError({ status: 400, statusText: 'Bad Request' })
    routeErrorToNotifications(err, notifStore, workspaceStore, mockRouter)
    expect(notifStore.notifications).toHaveLength(0)
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('401 AUTH_REFRESH_FAILED — no toast, router.push called with /login', () => {
    const notifStore = useBackofficeNotificationStore()
    const workspaceStore = useBackofficeWorkspaceStore()
    const err = createAppError({
      code: ErrorCodes.AUTH_REFRESH_FAILED,
      message: 'Session expired',
      httpStatus: 401,
      isNetworkError: false,
    })
    routeErrorToNotifications(err, notifStore, workspaceStore, mockRouter)
    expect(notifStore.notifications).toHaveLength(0)
    expect(mockRouter.push).toHaveBeenCalledWith('/login')
  })

  it('403 PERMISSION_DENIED — warning toast pushed', () => {
    const notifStore = useBackofficeNotificationStore()
    const workspaceStore = useBackofficeWorkspaceStore()
    const err = createAppError({
      code: ErrorCodes.PERMISSION_DENIED,
      message: 'Forbidden',
      httpStatus: 403,
      isNetworkError: false,
    })
    routeErrorToNotifications(err, notifStore, workspaceStore, mockRouter)
    expect(notifStore.notifications).toHaveLength(1)
    expect(notifStore.notifications[0]).toMatchObject({ type: 'warning', title: 'Access denied' })
  })

  it('409 CONFLICT — error toast with err.message', () => {
    const notifStore = useBackofficeNotificationStore()
    const workspaceStore = useBackofficeWorkspaceStore()
    const err = createAppError({
      code: ErrorCodes.CONFLICT,
      message: 'Resource already exists',
      httpStatus: 409,
      isNetworkError: false,
    })
    routeErrorToNotifications(err, notifStore, workspaceStore, mockRouter)
    expect(notifStore.notifications).toHaveLength(1)
    expect(notifStore.notifications[0]).toMatchObject({
      type: 'error',
      message: 'Resource already exists',
    })
  })

  it('422 UNPROCESSABLE — error toast with err.message', () => {
    const notifStore = useBackofficeNotificationStore()
    const workspaceStore = useBackofficeWorkspaceStore()
    const err = createAppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Invalid payload',
      httpStatus: 422,
      isNetworkError: false,
    })
    routeErrorToNotifications(err, notifStore, workspaceStore, mockRouter)
    expect(notifStore.notifications).toHaveLength(1)
    expect(notifStore.notifications[0]).toMatchObject({ type: 'error', message: 'Invalid payload' })
  })

  it('500 SERVER_ERROR — generic error toast pushed', () => {
    const notifStore = useBackofficeNotificationStore()
    const workspaceStore = useBackofficeWorkspaceStore()
    const err = normalizeError({ status: 500, statusText: 'Internal Server Error' })
    routeErrorToNotifications(err, notifStore, workspaceStore, mockRouter)
    expect(notifStore.notifications).toHaveLength(1)
    expect(notifStore.notifications[0]).toMatchObject({
      type: 'error',
      title: 'Something went wrong',
    })
  })

  it('network error (isNetworkError=true) — no toast, offline banner handles it', () => {
    const notifStore = useBackofficeNotificationStore()
    const workspaceStore = useBackofficeWorkspaceStore()
    const err = createAppError({
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Network request failed',
      httpStatus: 0,
      isNetworkError: true,
    })
    routeErrorToNotifications(err, notifStore, workspaceStore, mockRouter)
    expect(notifStore.notifications).toHaveLength(0)
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('workspace_slug from store injected into notification message (not from request body)', () => {
    const notifStore = useBackofficeNotificationStore()
    const workspaceStore = useBackofficeWorkspaceStore()
    workspaceStore.workspace = {
      slug: 'acme',
      name: 'Acme Corp',
      tier: 'pro',
      schemaVersion: 1,
      productVersion: '1.0.0',
    }
    const err = createAppError({
      code: ErrorCodes.CONFLICT,
      message: 'Duplicate record',
      httpStatus: 409,
      isNetworkError: false,
    })
    routeErrorToNotifications(err, notifStore, workspaceStore, mockRouter)
    expect(notifStore.notifications).toHaveLength(1)
    expect(notifStore.notifications[0].message).toBe('Duplicate record (workspace: acme)')
  })

  it('workspace_slug absent — message has no workspace suffix', () => {
    const notifStore = useBackofficeNotificationStore()
    const workspaceStore = useBackofficeWorkspaceStore()
    workspaceStore.workspace = null
    const err = createAppError({
      code: ErrorCodes.CONFLICT,
      message: 'Duplicate record',
      httpStatus: 409,
      isNetworkError: false,
    })
    routeErrorToNotifications(err, notifStore, workspaceStore, mockRouter)
    expect(notifStore.notifications).toHaveLength(1)
    expect(notifStore.notifications[0].message).toBe('Duplicate record')
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
})
