/**
 * Unit tests for normalizeError()
 * Stage: STAGE_UI_04_GLOBAL_ERROR_HANDLING
 * Task: T021
 */
import type { AdapterResponse } from '@zidney/api-client'
import { createAppError, ErrorCodes, isAppError } from '@zidney/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { normalizeError } from '../error-normalizer'

vi.mock('@zidney/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zidney/api-client')>()
  return {
    ...actual,
    normalizeResponseError: vi.fn((r: AdapterResponse) =>
      actual.createAppError({
        code: actual.mapHttpStatusToCode(r.status),
        message: 'delegated',
        httpStatus: r.status,
        isNetworkError: false,
      })
    ),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('normalizeError', () => {
  it('maps TypeError to NETWORK_ERROR', () => {
    const result = normalizeError(new TypeError('Failed to fetch'))
    expect(result.code).toBe(ErrorCodes.NETWORK_ERROR)
    expect(result.isNetworkError).toBe(true)
    expect(result.httpStatus).toBe(0)
  })

  it('passes through an existing AppError unchanged', () => {
    const appErr = createAppError({
      code: 'MY_CODE',
      message: 'original',
      httpStatus: 422,
      isNetworkError: false,
    })
    const result = normalizeError(appErr)
    expect(result).toBe(appErr)
    expect(isAppError(result)).toBe(true)
  })

  it('migrates legacy NormalizedError shape (has code + httpStatus, lacks isNetworkError)', () => {
    const legacy = { code: 'LEGACY_CODE', message: 'old message', httpStatus: 400 }
    const result = normalizeError(legacy)
    expect(result.code).toBe('LEGACY_CODE')
    expect(result.httpStatus).toBe(400)
    expect(result.isNetworkError).toBe(false)
  })

  it('normalizes structured API error body { success: false, error: { code, message } }', () => {
    const body = {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'invalid input' },
      httpStatus: 422,
    }
    const result = normalizeError(body)
    expect(result.code).toBe('VALIDATION_ERROR')
    expect(result.message).toBe('invalid input')
    expect(result.httpStatus).toBe(422)
  })

  it('delegates AdapterResponse shape to normalizeResponseError', async () => {
    const { normalizeResponseError } = await import('@zidney/api-client')
    const adapter: AdapterResponse = { status: 503, headers: {}, body: null }
    normalizeError(adapter)
    expect(normalizeResponseError).toHaveBeenCalledWith(adapter)
  })

  it('maps raw HTTP object with status code', () => {
    const result = normalizeError({ status: 404, statusText: 'Not Found' })
    expect(result.httpStatus).toBe(404)
    expect(result.message).toBe('Not Found')
  })

  it('falls back to UNKNOWN_ERROR for unrecognised input', () => {
    const result = normalizeError('unexpected string')
    expect(result.code).toBe(ErrorCodes.UNKNOWN_ERROR)
    expect(result.httpStatus).toBe(-1)
  })

  it('falls back for null input', () => {
    const result = normalizeError(null)
    expect(result.code).toBe(ErrorCodes.UNKNOWN_ERROR)
  })
})
