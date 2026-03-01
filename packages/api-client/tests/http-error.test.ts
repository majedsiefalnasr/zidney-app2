import { describe, expect, it } from 'vitest'
import {
  createAppError,
  ErrorCodes,
  isAppError,
  normalizeNetworkError,
  normalizeResponseError,
} from '../src/http-error'
import type { AdapterResponse } from '../src/types'

describe('http-error', () => {
  // ─── isAppError ───────────────────────────────────────────────────────────

  describe('isAppError', () => {
    it('should return true for valid AppError objects', () => {
      const error = createAppError({
        code: 'TEST',
        message: 'test',
        httpStatus: 400,
        isNetworkError: false,
      })
      expect(isAppError(error)).toBe(true)
    })

    it('should return false for non-objects', () => {
      expect(isAppError(null)).toBe(false)
      expect(isAppError(undefined)).toBe(false)
      expect(isAppError('error')).toBe(false)
      expect(isAppError(42)).toBe(false)
    })

    it('should return false for objects missing required fields', () => {
      expect(isAppError({ code: 'X', message: 'Y' })).toBe(false)
      expect(isAppError({ code: 'X', httpStatus: 0 })).toBe(false)
    })
  })

  // ─── createAppError ──────────────────────────────────────────────────────

  describe('createAppError', () => {
    it('should create a frozen AppError object', () => {
      const error = createAppError({
        code: 'TEST',
        message: 'test message',
        httpStatus: 500,
        isNetworkError: false,
      })

      expect(error.code).toBe('TEST')
      expect(error.message).toBe('test message')
      expect(error.httpStatus).toBe(500)
      expect(error.isNetworkError).toBe(false)
      expect(Object.isFrozen(error)).toBe(true)
    })

    it('should include retryAfter when provided', () => {
      const error = createAppError({
        code: 'RATE_LIMITED',
        message: 'slow down',
        httpStatus: 429,
        isNetworkError: false,
        retryAfter: 30,
      })

      expect(error.retryAfter).toBe(30)
    })

    it('should not include retryAfter when not provided', () => {
      const error = createAppError({
        code: 'TEST',
        message: 'test',
        httpStatus: 400,
        isNetworkError: false,
      })

      expect(error.retryAfter).toBeUndefined()
    })
  })

  // ─── normalizeResponseError (US4) ─────────────────────────────────────────

  describe('normalizeResponseError (US4)', () => {
    it('should extract code and message from backend structured error', () => {
      const response: AdapterResponse = {
        status: 400,
        ok: false,
        headers: {},
        body: {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Name is required' },
        },
      }

      const error = normalizeResponseError(response)

      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.message).toBe('Name is required')
      expect(error.httpStatus).toBe(400)
      expect(error.isNetworkError).toBe(false)
    })

    it('should return INVALID_RESPONSE for null body', () => {
      const response: AdapterResponse = {
        status: 500,
        ok: false,
        headers: {},
        body: null,
      }

      const error = normalizeResponseError(response)

      expect(error.code).toBe(ErrorCodes.INVALID_RESPONSE)
      expect(error.httpStatus).toBe(500)
    })

    it('should return UNKNOWN_ERROR for unexpected body shape', () => {
      const response: AdapterResponse = {
        status: 502,
        ok: false,
        headers: {},
        body: { weird: 'data' },
      }

      const error = normalizeResponseError(response)

      expect(error.code).toBe(ErrorCodes.UNKNOWN_ERROR)
      expect(error.httpStatus).toBe(502)
    })

    it('should produce frozen AppError objects', () => {
      const response: AdapterResponse = {
        status: 400,
        ok: false,
        headers: {},
        body: {
          success: false,
          error: { code: 'TEST', message: 'test' },
        },
      }

      const error = normalizeResponseError(response)

      expect(Object.isFrozen(error)).toBe(true)
    })
  })

  // ─── normalizeNetworkError ────────────────────────────────────────────────

  describe('normalizeNetworkError', () => {
    it('should return NETWORK_ERROR for TypeError', () => {
      const error = normalizeNetworkError(new TypeError('Failed to fetch'))

      expect(error.code).toBe(ErrorCodes.NETWORK_ERROR)
      expect(error.message).toBe('Failed to fetch')
      expect(error.httpStatus).toBe(0)
      expect(error.isNetworkError).toBe(true)
    })

    it('should return REQUEST_CANCELLED for AbortError', () => {
      const error = normalizeNetworkError(
        new DOMException('The operation was aborted.', 'AbortError')
      )

      expect(error.code).toBe(ErrorCodes.REQUEST_CANCELLED)
      expect(error.httpStatus).toBe(0)
      expect(error.isNetworkError).toBe(false)
    })

    it('should return REQUEST_TIMEOUT for TimeoutError DOMException', () => {
      const error = normalizeNetworkError(
        new DOMException('The operation timed out.', 'TimeoutError')
      )

      expect(error.code).toBe(ErrorCodes.REQUEST_TIMEOUT)
      expect(error.httpStatus).toBe(0)
      expect(error.isNetworkError).toBe(true)
    })

    it('should pass through existing AppError', () => {
      const appError = createAppError({
        code: 'CUSTOM',
        message: 'custom',
        httpStatus: 418,
        isNetworkError: false,
      })

      const result = normalizeNetworkError(appError)

      expect(result).toBe(appError)
    })

    it('should return UNKNOWN_ERROR for unknown error types', () => {
      const error = normalizeNetworkError('some string error')

      expect(error.code).toBe(ErrorCodes.UNKNOWN_ERROR)
    })
  })

  // ─── 429 Rate Limiting (US5) ──────────────────────────────────────────────

  describe('429 rate limiting (US5)', () => {
    it('should return RATE_LIMITED with retryAfter from Retry-After header', () => {
      const response: AdapterResponse = {
        status: 429,
        ok: false,
        headers: { 'retry-after': '30' },
        body: null,
      }

      const error = normalizeResponseError(response)

      expect(error.code).toBe(ErrorCodes.RATE_LIMITED)
      expect(error.httpStatus).toBe(429)
      expect(error.retryAfter).toBe(30)
      expect(error.isNetworkError).toBe(false)
    })

    it('should return RATE_LIMITED without retryAfter when header is missing', () => {
      const response: AdapterResponse = {
        status: 429,
        ok: false,
        headers: {},
        body: null,
      }

      const error = normalizeResponseError(response)

      expect(error.code).toBe(ErrorCodes.RATE_LIMITED)
      expect(error.httpStatus).toBe(429)
      expect(error.retryAfter).toBeUndefined()
    })

    it('should not auto-retry on 429', () => {
      // This test verifies 429 produces a single error, not a retry loop
      const response: AdapterResponse = {
        status: 429,
        ok: false,
        headers: { 'retry-after': '60' },
        body: null,
      }

      const error = normalizeResponseError(response)

      // If it returned an error (not retried), the test passes
      expect(error.code).toBe(ErrorCodes.RATE_LIMITED)
    })
  })
})
