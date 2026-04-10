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

// ─── HTTP status code propagation (Test 3.2) ──────────────────────────
// Confirms app-level normalizeError() delegates each critical HTTP status
// through to the correct ErrorCode via mapHttpStatusToCode().

describe('normalizeError — HTTP status code propagation (Test 3.2)', () => {
  function makeAdapter(status: number): AdapterResponse {
    return { status, headers: {}, body: null, ok: false }
  }

  it('403 → PERMISSION_DENIED', () => {
    const r = normalizeError(makeAdapter(403))
    expect(r.httpStatus).toBe(403)
    expect(r.code).toBe(ErrorCodes.PERMISSION_DENIED)
  })

  it('423 → LOCKED', () => {
    const r = normalizeError(makeAdapter(423))
    expect(r.httpStatus).toBe(423)
    expect(r.code).toBe(ErrorCodes.LOCKED)
  })

  it('426 → UPGRADE_REQUIRED', () => {
    const r = normalizeError(makeAdapter(426))
    expect(r.httpStatus).toBe(426)
    expect(r.code).toBe(ErrorCodes.UPGRADE_REQUIRED)
  })

  it('429 → RATE_LIMITED', () => {
    const r = normalizeError(makeAdapter(429))
    expect(r.httpStatus).toBe(429)
    expect(r.code).toBe(ErrorCodes.RATE_LIMITED)
  })

  it('500 → SERVER_ERROR', () => {
    const r = normalizeError(makeAdapter(500))
    expect(r.httpStatus).toBe(500)
    expect(r.code).toBe(ErrorCodes.SERVER_ERROR)
  })
})
