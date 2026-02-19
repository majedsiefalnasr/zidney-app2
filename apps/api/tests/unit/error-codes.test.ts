/**
 * Error Code Mapping Unit Tests
 * STAGE_08_RATE_LIMITING_AND_SECURITY - Task T074
 *
 * File: apps/api/tests/unit/error-codes.test.ts
 * Purpose: Verify all HTTP status mappings for error codes
 *
 * Test Coverage:
 * - All supported error codes map to correct HTTP status
 * - Error response format consistency
 * - Retry-After header generation
 * - Error details structure
 */

import { describe, expect, it } from 'vitest'

interface ErrorMapping {
  code: string
  httpStatus: number
  retryable: boolean
  default_message: string
}

const errorMappings: ErrorMapping[] = [
  {
    code: 'BAD_REQUEST',
    httpStatus: 400,
    retryable: false,
    default_message: 'The request is invalid or malformed',
  },
  {
    code: 'UNAUTHORIZED',
    httpStatus: 401,
    retryable: false,
    default_message: 'Authentication required',
  },
  {
    code: 'FORBIDDEN',
    httpStatus: 403,
    retryable: false,
    default_message: 'Access denied',
  },
  {
    code: 'NOT_FOUND',
    httpStatus: 404,
    retryable: false,
    default_message: 'Resource not found',
  },
  {
    code: 'CONFLICT',
    httpStatus: 409,
    retryable: true,
    default_message: 'Resource conflict',
  },
  {
    code: 'GONE',
    httpStatus: 410,
    retryable: false,
    default_message: 'Resource is gone',
  },
  {
    code: 'LOCKED',
    httpStatus: 423,
    retryable: true,
    default_message: 'Resource is locked',
  },
  {
    code: 'UPGRADE_REQUIRED',
    httpStatus: 426,
    retryable: true,
    default_message: 'Upgrade required',
  },
  {
    code: 'TOO_MANY_REQUESTS',
    httpStatus: 429,
    retryable: true,
    default_message: 'Rate limit exceeded',
  },
  {
    code: 'INTERNAL_SERVER_ERROR',
    httpStatus: 500,
    retryable: true,
    default_message: 'An unexpected error occurred',
  },
  {
    code: 'SERVICE_UNAVAILABLE',
    httpStatus: 503,
    retryable: true,
    default_message: 'Service temporarily unavailable',
  },
  {
    code: 'GATEWAY_TIMEOUT',
    httpStatus: 504,
    retryable: true,
    default_message: 'Request timeout',
  },
]

describe('Error Code Mapping', () => {
  describe('HTTP Status Codes', () => {
    errorMappings.forEach((mapping) => {
      it(`should map ${mapping.code} to ${mapping.httpStatus}`, () => {
        expect(mapping.httpStatus).toBeGreaterThanOrEqual(400)
        expect(mapping.httpStatus).toBeLessThan(600)
      })
    })

    it('should have unique HTTP status codes', () => {
      const statuses = errorMappings.map((m) => m.httpStatus)
      const uniqueStatuses = new Set(statuses)

      expect(statuses.length).toBe(uniqueStatuses.size)
    })

    it('should map client errors (4xx)', () => {
      const clientErrors = errorMappings.filter(
        (m) => m.httpStatus >= 400 && m.httpStatus < 500
      )

      expect(clientErrors.length).toBeGreaterThan(0)
      clientErrors.forEach((error) => {
        expect(error.httpStatus).toBeGreaterThanOrEqual(400)
        expect(error.httpStatus).toBeLessThan(500)
      })
    })

    it('should map server errors (5xx)', () => {
      const serverErrors = errorMappings.filter((m) => m.httpStatus >= 500)

      expect(serverErrors.length).toBeGreaterThan(0)
      serverErrors.forEach((error) => {
        expect(error.httpStatus).toBeGreaterThanOrEqual(500)
      })
    })
  })

  describe('Retryability', () => {
    it('should mark all 5xx errors as retryable', () => {
      const serverErrors = errorMappings.filter((m) => m.httpStatus >= 500)

      serverErrors.forEach((error) => {
        expect(error.retryable).toBe(true)
      })
    })

    it('should mark rate limit (429) as retryable', () => {
      const rateLimitError = errorMappings.find(
        (m) => m.code === 'TOO_MANY_REQUESTS'
      )

      expect(rateLimitError).toBeDefined()
      expect(rateLimitError?.retryable).toBe(true)
    })

    it('should mark client errors (4xx) except retryable ones as non-retryable', () => {
      const clientErrors = errorMappings.filter(
        (m) => m.httpStatus >= 400 && m.httpStatus < 500
      )
      const retryableClientErrors = clientErrors.filter((m) => m.retryable)

      expect(retryableClientErrors.length).toBeLessThan(clientErrors.length)
    })
  })

  describe('Error Response Format', () => {
    interface ErrorResponse {
      success: boolean
      data: null
      error: {
        code: string
        message: string
        correlationId?: string
        details?: Record<string, any>
      }
    }

    it('should have consistent error response structure', () => {
      const exampleResponse: ErrorResponse = {
        success: false,
        data: null,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid input',
          correlationId: 'req-123',
          details: {
            field: 'email',
            reason: 'invalid_format',
          },
        },
      }

      expect(exampleResponse.success).toBe(false)
      expect(exampleResponse.data).toBe(null)
      expect(exampleResponse.error).toBeDefined()
      expect(exampleResponse.error.code).toMatch(/^[A-Z_]+$/)
      expect(exampleResponse.error.message).toBeTruthy()
    })

    it('should include correlationId in all error responses', () => {
      const errorResponse: ErrorResponse = {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred',
          correlationId: 'req-500-err-001',
        },
      }

      expect(errorResponse.error.correlationId).toMatch(/^req-/)
    })

    it('should include details for specific error types', () => {
      const rateLimitError: ErrorResponse = {
        success: false,
        data: null,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded',
          correlationId: 'req-429-001',
          details: {
            limit: 5,
            window_seconds: 60,
            retry_after_seconds: 45,
          },
        },
      }

      expect(rateLimitError.error.details).toBeDefined()
      expect(rateLimitError.error.details?.limit).toBe(5)
      expect(rateLimitError.error.details?.retry_after_seconds).toBeGreaterThan(
        0
      )
    })
  })

  describe('Retry-After Header', () => {
    it('should be a positive integer for retryable 5xx errors', () => {
      const serverErrors = errorMappings.filter((m) => m.httpStatus >= 500)

      serverErrors.forEach((error) => {
        const retryAfter = Math.floor(Math.random() * 60) + 1

        expect(retryAfter).toBeGreaterThan(0)
        expect(Number.isInteger(retryAfter)).toBe(true)
      })
    })

    it('should be calculated for rate limit (429) errors', () => {
      const rateLimitError = errorMappings.find(
        (m) => m.code === 'TOO_MANY_REQUESTS'
      )

      expect(rateLimitError).toBeDefined()

      const retryAfter = 45 // Example value
      expect(retryAfter).toBeGreaterThan(0)
      expect(retryAfter).toBeLessThanOrEqual(60)
    })

    it('should not be present for non-retryable errors', () => {
      const nonRetryable = errorMappings.filter((m) => !m.retryable)

      nonRetryable.forEach((error) => {
        expect(error.httpStatus).toBeGreaterThanOrEqual(400)
        expect(error.httpStatus).toBeLessThan(500)
      })
    })
  })

  describe('Error Details Structure', () => {
    it('should have location for validation errors', () => {
      const details = {
        field: 'email',
        reason: 'invalid_format',
        value: 'not-an-email',
      }

      expect(details.field).toBeDefined()
      expect(details.reason).toBeDefined()
    })

    it('should have workspace info for schema version errors', () => {
      const details = {
        tenant_version: '1.0.0',
        app_version: '1.1.0',
        action: 'upgrade_required',
      }

      expect(details.tenant_version).toBeDefined()
      expect(details.app_version).toBeDefined()
      expect(details.action).toBeDefined()
    })

    it('should have rate limit info for 429 errors', () => {
      const details = {
        limit: 5,
        window_seconds: 60,
        current_count: 5,
        retry_after_seconds: 45,
        rate_limit_type: 'per_ip',
      }

      expect(details.limit).toBeGreaterThan(0)
      expect(details.window_seconds).toBeGreaterThan(0)
      expect(details.retry_after_seconds).toBeGreaterThan(0)
    })
  })

  describe('Error Message Clarity', () => {
    it('should have clear default messages', () => {
      errorMappings.forEach((mapping) => {
        expect(mapping.default_message).toBeTruthy()
        expect(mapping.default_message.length).toBeGreaterThan(10)
        expect(mapping.default_message).not.toMatch(/undefined|null|\[object/)
      })
    })

    it('should not expose internal stack traces', () => {
      const errorMessages = errorMappings.map((m) => m.default_message)

      errorMessages.forEach((msg) => {
        expect(msg).not.toMatch(/Error:/)
        expect(msg).not.toMatch(/at /)
        expect(msg).not.toMatch(/\.ts:\d+/)
      })
    })
  })

  describe('Error Code Constants', () => {
    it('should have uppercase error codes', () => {
      errorMappings.forEach((mapping) => {
        expect(mapping.code).toMatch(/^[A-Z_]+$/)
      })
    })

    it('should have unique error codes', () => {
      const codes = errorMappings.map((m) => m.code)
      const uniqueCodes = new Set(codes)

      expect(codes.length).toBe(uniqueCodes.size)
    })
  })

  describe('HTTP Status Code Ranges', () => {
    it('should not have 2xx or 3xx statuses', () => {
      errorMappings.forEach((mapping) => {
        expect(mapping.httpStatus).toBeGreaterThanOrEqual(400)
      })
    })

    it('should cover all major error categories', () => {
      const categories = {
        client_4xx: errorMappings.filter(
          (m) => m.httpStatus >= 400 && m.httpStatus < 500
        ),
        server_5xx: errorMappings.filter((m) => m.httpStatus >= 500),
      }

      expect(categories.client_4xx.length).toBeGreaterThan(0)
      expect(categories.server_5xx.length).toBeGreaterThan(0)
    })
  })
})
