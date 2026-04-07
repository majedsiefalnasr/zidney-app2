/**
 * Unit tests for registerGlobalErrorHandlers / unregisterGlobalErrorHandlers
 * Stage: STAGE_UI_04_GLOBAL_ERROR_HANDLING
 * Task: T023
 */
import { describe, expect, it, vi } from 'vitest'

import { registerGlobalErrorHandlers, unregisterGlobalErrorHandlers } from '../global-error-handler'

describe('registerGlobalErrorHandlers', () => {
  it('adds unhandledrejection and error listeners on window', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const onError = vi.fn()
    registerGlobalErrorHandlers({ onError })
    expect(addSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('error', expect.any(Function))
    unregisterGlobalErrorHandlers()
    addSpy.mockRestore()
  })

  it('calls onError with a normalised AppError on unhandledrejection', () => {
    const onError = vi.fn()
    registerGlobalErrorHandlers({ onError })

    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason: new TypeError('network fail'),
    })
    window.dispatchEvent(event)

    expect(onError).toHaveBeenCalledOnce()
    const [err] = onError.mock.calls[0]
    expect(err).toMatchObject({ isNetworkError: true })
    unregisterGlobalErrorHandlers()
  })

  it('calls onError with a normalised AppError on ErrorEvent', () => {
    const onError = vi.fn()
    registerGlobalErrorHandlers({ onError })

    const event = new ErrorEvent('error', { message: 'script error', error: new Error('boom') })
    window.dispatchEvent(event)

    expect(onError).toHaveBeenCalledOnce()
    unregisterGlobalErrorHandlers()
  })

  it('logs via logger when provided', () => {
    const onError = vi.fn()
    const logError = vi.fn()
    const logger = { error: logError } as never
    registerGlobalErrorHandlers({ onError, logger })

    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason: new Error('err'),
    })
    window.dispatchEvent(event)

    expect(logError).toHaveBeenCalledOnce()
    unregisterGlobalErrorHandlers()
  })
})

describe('unregisterGlobalErrorHandlers', () => {
  it('removes window listeners and does not call onError after unregister', () => {
    const onError = vi.fn()
    registerGlobalErrorHandlers({ onError })
    unregisterGlobalErrorHandlers()

    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason: new Error('after unregister'),
    })
    window.dispatchEvent(event)

    expect(onError).not.toHaveBeenCalled()
  })
})
