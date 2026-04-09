import { describe, expect, it } from 'vitest'
import {
  applyAuthHeader,
  applyContentType,
  applyCorrelationId,
  applyIdempotencyKey,
  createCombinedSignal,
} from '../src/interceptors'

describe('api-client interceptors', () => {
  describe('applyAuthHeader', () => {
    it('adds Authorization header when token present', () => {
      const headers: Record<string, string> = {}
      applyAuthHeader(headers, () => 'tok-123')
      expect(headers.Authorization).toBe('Bearer tok-123')
    })

    it('does not add Authorization when token is null', () => {
      const headers: Record<string, string> = {}
      applyAuthHeader(headers, () => null)
      expect(headers.Authorization).toBeUndefined()
    })
  })

  describe('applyCorrelationId', () => {
    it('uses provided correlation id', () => {
      const headers: Record<string, string> = {}
      applyCorrelationId(headers, 'cid-1')
      expect(headers['X-Correlation-ID']).toBe('cid-1')
    })

    it('generates a UUID when none provided', () => {
      const headers: Record<string, string> = {}
      applyCorrelationId(headers)
      expect(typeof headers['X-Correlation-ID']).toBe('string')
      expect(headers['X-Correlation-ID']!.length).toBeGreaterThan(0)
    })
  })

  describe('applyContentType', () => {
    it('adds content-type for POST/PUT/PATCH', () => {
      const h: Record<string, string> = {}
      applyContentType(h, 'POST')
      expect(h['Content-Type']).toBe('application/json')
    })

    it('does not add content-type for GET/DELETE', () => {
      const h: Record<string, string> = {}
      applyContentType(h, 'GET')
      expect(h['Content-Type']).toBeUndefined()
    })
  })

  describe('applyIdempotencyKey', () => {
    it('adds Idempotency-Key on non-GET when provided', () => {
      const h: Record<string, string> = {}
      applyIdempotencyKey(h, 'POST', 'key-1')
      expect(h['Idempotency-Key']).toBe('key-1')
    })

    it('does not add Idempotency-Key on GET even if provided', () => {
      const h: Record<string, string> = {}
      applyIdempotencyKey(h, 'GET', 'key-1')
      expect(h['Idempotency-Key']).toBeUndefined()
    })
  })

  describe('createCombinedSignal', () => {
    it('returns undefined when no timeout and no user signal', () => {
      const sig = createCombinedSignal(0)
      expect(sig).toBeUndefined()
    })

    it('returns user signal when provided and no timeout', () => {
      const controller = new AbortController()
      const sig = createCombinedSignal(0, controller.signal)
      expect(sig).toBe(controller.signal)
    })

    it('returns a combined signal when both timeout and user signal provided', () => {
      const controller = new AbortController()
      const sig = createCombinedSignal(1000, controller.signal)
      expect(sig).toBeDefined()
      expect(sig).toBeInstanceOf(AbortSignal)
      expect(sig).not.toBe(controller.signal)
    })

    it('returns an already-aborted signal when userSignal is pre-aborted', () => {
      const controller = new AbortController()
      controller.abort()
      const sig = createCombinedSignal(1000, controller.signal)
      // Combined signal should reflect aborted user signal
      expect(sig).toBeDefined()
      expect((sig as AbortSignal).aborted).toBe(true)
    })
  })
})
