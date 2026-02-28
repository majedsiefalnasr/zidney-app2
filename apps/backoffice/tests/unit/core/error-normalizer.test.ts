import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeError } from '../../../src/core/errors/error-normalizer'

afterEach(() => vi.resetAllMocks())

describe('normalizeError', () => {
  it('handles standard API error response', () => {
    const raw = {
      body: {
        success: false,
        data: null,
        error: { code: 'LICENSE_NOT_FOUND', message: 'Not found' },
      },
      httpStatus: 404,
    }
    const result = normalizeError(raw)
    expect(result).toEqual({
      code: 'LICENSE_NOT_FOUND',
      message: 'Not found',
      httpStatus: 404,
    })
  })

  it('handles direct API error response shape (body already parsed)', () => {
    const raw = {
      success: false as const,
      data: null,
      error: { code: 'FORBIDDEN', message: 'Forbidden access' },
    }
    const result = normalizeError(raw)
    expect(result.code).toBe('FORBIDDEN')
    expect(result.message).toBe('Forbidden access')
  })

  it('handles network error (TypeError)', () => {
    const raw = new TypeError('Failed to fetch')
    const result = normalizeError(raw)
    expect(result).toEqual({
      code: 'NETWORK_ERROR',
      message: 'Network request failed',
      httpStatus: 0,
    })
  })

  it('handles unknown shape (fallback for string)', () => {
    const result = normalizeError('unexpected string')
    expect(result).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      httpStatus: -1,
    })
  })

  it('handles unknown shape (fallback for null)', () => {
    const result = normalizeError(null)
    expect(result).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      httpStatus: -1,
    })
  })

  it('handles unknown shape (fallback for unrecognized object)', () => {
    const result = normalizeError({ foo: 'bar' })
    expect(result).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      httpStatus: -1,
    })
  })

  it('is a pure function — same input same output, no side effects', () => {
    const raw = new TypeError('Network issue')
    const result1 = normalizeError(raw)
    const result2 = normalizeError(raw)
    expect(result1).toEqual(result2)
  })
})
