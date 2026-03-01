import { describe, expect, it } from 'vitest'
import {
  applyAuthHeader,
  applyContentType,
  applyCorrelationId,
  applyIdempotencyKey,
  createCombinedSignal,
} from '../src/interceptors'

describe('Interceptors', () => {
  // ─── Auth Interceptor (US2) ─────────────────────────────────────────────

  describe('applyAuthHeader (US2)', () => {
    it('should add Authorization header when token is present', () => {
      const headers: Record<string, string> = {}
      applyAuthHeader(headers, () => 'test-token')

      expect(headers['Authorization']).toBe('Bearer test-token')
    })

    it('should not add Authorization header when token is null', () => {
      const headers: Record<string, string> = {}
      applyAuthHeader(headers, () => null)

      expect(headers['Authorization']).toBeUndefined()
    })

    it('should use updated token between calls', () => {
      let token: string | null = 'first-token'
      const getToken = () => token

      const headers1: Record<string, string> = {}
      applyAuthHeader(headers1, getToken)
      expect(headers1['Authorization']).toBe('Bearer first-token')

      token = 'second-token'
      const headers2: Record<string, string> = {}
      applyAuthHeader(headers2, getToken)
      expect(headers2['Authorization']).toBe('Bearer second-token')
    })
  })

  // ─── Idempotency Interceptor (US6) ──────────────────────────────────────

  describe('applyIdempotencyKey (US6)', () => {
    it('should add Idempotency-Key header on POST with key', () => {
      const headers: Record<string, string> = {}
      applyIdempotencyKey(headers, 'POST', 'abc-123')

      expect(headers['Idempotency-Key']).toBe('abc-123')
    })

    it('should not add Idempotency-Key header on POST without key', () => {
      const headers: Record<string, string> = {}
      applyIdempotencyKey(headers, 'POST', undefined)

      expect(headers['Idempotency-Key']).toBeUndefined()
    })

    it('should NOT add Idempotency-Key header on GET even with key', () => {
      const headers: Record<string, string> = {}
      applyIdempotencyKey(headers, 'GET', 'abc-123')

      expect(headers['Idempotency-Key']).toBeUndefined()
    })

    it('should add Idempotency-Key header on PUT with key', () => {
      const headers: Record<string, string> = {}
      applyIdempotencyKey(headers, 'PUT', 'put-key')

      expect(headers['Idempotency-Key']).toBe('put-key')
    })

    it('should add Idempotency-Key header on PATCH with key', () => {
      const headers: Record<string, string> = {}
      applyIdempotencyKey(headers, 'PATCH', 'patch-key')

      expect(headers['Idempotency-Key']).toBe('patch-key')
    })

    it('should add Idempotency-Key header on DELETE with key', () => {
      const headers: Record<string, string> = {}
      applyIdempotencyKey(headers, 'DELETE', 'delete-key')

      expect(headers['Idempotency-Key']).toBe('delete-key')
    })
  })

  // ─── Correlation ID Interceptor (US9) ───────────────────────────────────

  describe('applyCorrelationId (US9)', () => {
    it('should auto-generate UUID when no correlationId provided', () => {
      const headers: Record<string, string> = {}
      applyCorrelationId(headers)

      expect(headers['X-Correlation-ID']).toBeDefined()
      // UUID v4 pattern
      expect(headers['X-Correlation-ID']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    })

    it('should use provided correlationId', () => {
      const headers: Record<string, string> = {}
      applyCorrelationId(headers, 'my-custom-id')

      expect(headers['X-Correlation-ID']).toBe('my-custom-id')
    })

    it('should generate distinct IDs for each request', () => {
      const headers1: Record<string, string> = {}
      const headers2: Record<string, string> = {}
      applyCorrelationId(headers1)
      applyCorrelationId(headers2)

      expect(headers1['X-Correlation-ID']).not.toBe(
        headers2['X-Correlation-ID']
      )
    })
  })

  // ─── Content-Type Interceptor ───────────────────────────────────────────

  describe('applyContentType', () => {
    it('should add Content-Type on POST', () => {
      const headers: Record<string, string> = {}
      applyContentType(headers, 'POST')
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('should add Content-Type on PUT', () => {
      const headers: Record<string, string> = {}
      applyContentType(headers, 'PUT')
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('should add Content-Type on PATCH', () => {
      const headers: Record<string, string> = {}
      applyContentType(headers, 'PATCH')
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('should NOT add Content-Type on GET', () => {
      const headers: Record<string, string> = {}
      applyContentType(headers, 'GET')
      expect(headers['Content-Type']).toBeUndefined()
    })

    it('should NOT add Content-Type on DELETE', () => {
      const headers: Record<string, string> = {}
      applyContentType(headers, 'DELETE')
      expect(headers['Content-Type']).toBeUndefined()
    })
  })

  // ─── Timeout / Combined Signal Interceptor (US8) ───────────────────────

  describe('createCombinedSignal (US8)', () => {
    it('should return undefined when no timeout and no user signal', () => {
      const signal = createCombinedSignal(0)
      expect(signal).toBeUndefined()
    })

    it('should return timeout signal when only timeout provided', () => {
      const signal = createCombinedSignal(5000)
      expect(signal).toBeDefined()
      expect(signal).toBeInstanceOf(AbortSignal)
    })

    it('should return user signal when only user signal provided', () => {
      const controller = new AbortController()
      const signal = createCombinedSignal(0, controller.signal)
      expect(signal).toBe(controller.signal)
    })

    it('should combine timeout and user signal', () => {
      const controller = new AbortController()
      const signal = createCombinedSignal(5000, controller.signal)
      expect(signal).toBeDefined()
      expect(signal).toBeInstanceOf(AbortSignal)
      // Combined signal should be different from user signal
      expect(signal).not.toBe(controller.signal)
    })
  })
})
