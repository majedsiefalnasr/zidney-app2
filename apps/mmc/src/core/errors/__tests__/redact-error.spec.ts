/**
 * Unit tests for redactError()
 * Stage: STAGE_UI_04_GLOBAL_ERROR_HANDLING
 * Task: T022
 */
import { createAppError } from '@zidney/api-client'
import { describe, expect, it } from 'vitest'

import { redactError } from '../redact-error'

function makeError(message: string) {
  return createAppError({ code: 'TEST', message, httpStatus: 500, isNetworkError: false })
}

describe('redactError', () => {
  it('redacts Bearer tokens from messages', () => {
    const err = makeError('auth: Bearer abc123def456')
    const result = redactError(err, false)
    expect(result.message).not.toContain('abc123')
    expect(result.message).toContain('Bearer [REDACTED]')
  })

  it('redacts password= credentials', () => {
    const err = makeError('password=mySecret&user=admin')
    const result = redactError(err, false)
    expect(result.message).not.toContain('mySecret')
    expect(result.message).toContain('[REDACTED]')
  })

  it('redacts token= credentials', () => {
    const err = makeError('token=abc&ok=1')
    const result = redactError(err, false)
    expect(result.message).not.toContain('abc')
    expect(result.message).toContain('[REDACTED]')
  })

  it('strips stack frames in production mode', () => {
    const err = makeError('crash\n    at Object.<anonymous> (app.js:1:1)')
    const result = redactError(err, true)
    expect(result.message).not.toContain('at Object')
  })

  it('preserves stack frames in development mode', () => {
    const err = makeError('crash\n    at Object.<anonymous> (app.js:1:1)')
    const result = redactError(err, false)
    expect(result.message).toContain('at Object')
  })

  it('retains code, httpStatus and isNetworkError fields', () => {
    const err = createAppError({
      code: 'KEEP',
      message: 'ok',
      httpStatus: 200,
      isNetworkError: false,
    })
    const result = redactError(err, false)
    expect(result.code).toBe('KEEP')
    expect(result.httpStatus).toBe(200)
    expect(result.isNetworkError).toBe(false)
  })

  it('redacts secret= credentials', () => {
    const err = makeError('secret=superSecret123&other=val')
    const result = redactError(err, false)
    expect(result.message).not.toContain('superSecret123')
    expect(result.message).toContain('[REDACTED]')
  })

  it('preserves retryAfter when present', () => {
    const err = createAppError({
      code: 'RATE_LIMITED',
      message: 'slow down',
      httpStatus: 429,
      isNetworkError: false,
      retryAfter: 60,
    })
    const result = redactError(err, false)
    expect(result.retryAfter).toBe(60)
  })
})
