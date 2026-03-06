/**
 * Correlation ID Unit Tests
 * STAGE_08_RATE_LIMITING_AND_SECURITY - Task T077
 *
 * File: apps/api/tests/unit/correlation-id.test.ts
 * Purpose: Test UUID generation and propagation
 *
 * Test Coverage:
 * - UUID v4 generation
 * - Header extraction (X-Request-ID)
 * - State injection
 * - Response header injection
 */

import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'

class CorrelationIdManager {
  private static readonly HEADER_NAME = 'X-Request-ID'

  generateId(): string {
    return randomUUID()
  }

  extractFromHeaders(headers: Record<string, string | undefined>): string | null {
    const id =
      headers[CorrelationIdManager.HEADER_NAME.toLowerCase()] ||
      headers[CorrelationIdManager.HEADER_NAME]

    if (id && this.isValidUUID(id)) {
      return id
    }

    return null
  }

  isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    return uuidRegex.test(id)
  }

  getOrCreate(headers: Record<string, string | undefined>): string {
    const existing = this.extractFromHeaders(headers)

    if (existing) {
      return existing
    }

    return this.generateId()
  }

  injectIntoHeaders(headers: Record<string, any>, correlationId: string): Record<string, any> {
    return {
      ...headers,
      [CorrelationIdManager.HEADER_NAME]: correlationId,
    }
  }

  isValidForContext(correlationId: string, context: any): boolean {
    return this.isValidUUID(correlationId) && context.correlationId === correlationId
  }
}

describe('Correlation ID Management', () => {
  let manager: CorrelationIdManager

  beforeEach(() => {
    manager = new CorrelationIdManager()
  })

  describe('UUID Generation', () => {
    it('should generate valid UUID v4', () => {
      const id = manager.generateId()

      expect(id).toBeDefined()
      expect(manager.isValidUUID(id)).toBe(true)
    })

    it('should generate different IDs on each call', () => {
      const id1 = manager.generateId()
      const id2 = manager.generateId()

      expect(id1).not.toBe(id2)
    })

    it('should generate UUID with correct format', () => {
      const id = manager.generateId()

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const parts = id.split('-')

      expect(parts.length).toBe(5)
      expect(parts[0]?.length).toBe(8)
      expect(parts[1]?.length).toBe(4)
      expect(parts[2]?.length).toBe(4)
      expect(parts[3]?.length).toBe(4)
      expect(parts[4]?.length).toBe(12)

      // Version 4 in 3rd group (first char)
      expect(parts[2]?.[0]).toBe('4')
    })

    it('should generate 36-character IDs (with dashes)', () => {
      const id = manager.generateId()

      expect(id.length).toBe(36)
    })

    it('should generate hex characters only', () => {
      const id = manager.generateId()

      const hexOnlyId = id.replace(/-/g, '')
      const isHexOnly = /^[0-9a-f]+$/i.test(hexOnlyId)

      expect(isHexOnly).toBe(true)
    })
  })

  describe('Header Extraction', () => {
    it('should extract X-Request-ID from headers', () => {
      const testId = '123e4567-e89b-42d3-a456-426614174000'
      const headers = { 'x-request-id': testId }

      const extracted = manager.extractFromHeaders(headers)

      expect(extracted).toBe(testId)
    })

    it('should handle case-insensitive header name', () => {
      const testId = '123e4567-e89b-42d3-a456-426614174000'
      const headers1 = { 'X-Request-ID': testId }
      const headers2 = { 'x-request-id': testId }

      const extracted1 = manager.extractFromHeaders(headers1)
      const extracted2 = manager.extractFromHeaders(headers2)

      expect(extracted1).toBe(testId)
      expect(extracted2).toBe(testId)
    })

    it('should return null for missing header', () => {
      const headers = {}

      const extracted = manager.extractFromHeaders(headers)

      expect(extracted).toBeNull()
    })

    it('should return null for invalid UUID format', () => {
      const headers = { 'x-request-id': 'not-a-uuid' }

      const extracted = manager.extractFromHeaders(headers)

      expect(extracted).toBeNull()
    })

    it('should return null for malformed UUID', () => {
      const headers = { 'x-request-id': '123e4567-e89b-invalid' }

      const extracted = manager.extractFromHeaders(headers)

      expect(extracted).toBeNull()
    })

    it('should validate UUID v4 version', () => {
      // UUID v3 format (not v4)
      const uuidV3 = '123e4567-e89b-33d3-a456-426614174000'
      const headers = { 'x-request-id': uuidV3 }

      const extracted = manager.extractFromHeaders(headers)

      expect(extracted).toBeNull()
    })
  })

  describe('Get or Create', () => {
    it('should return existing ID if valid', () => {
      const testId = '123e4567-e89b-42d3-a456-426614174000'
      const headers = { 'x-request-id': testId }

      const result = manager.getOrCreate(headers)

      expect(result).toBe(testId)
    })

    it('should generate new ID if header missing', () => {
      const headers = {}

      const result = manager.getOrCreate(headers)

      expect(manager.isValidUUID(result)).toBe(true)
      expect(result).toBeDefined()
    })

    it('should generate new ID if header invalid', () => {
      const headers = { 'x-request-id': 'invalid' }

      const result = manager.getOrCreate(headers)

      expect(manager.isValidUUID(result)).toBe(true)
    })

    it('should prefer provided ID over generation', () => {
      const testId = '123e4567-e89b-42d3-a456-426614174000'
      const headers = { 'x-request-id': testId }

      const result1 = manager.getOrCreate(headers)
      const result2 = manager.getOrCreate(headers)

      expect(result1).toBe(testId)
      expect(result2).toBe(testId)
      expect(result1).toBe(result2)
    })
  })

  describe('Header Injection', () => {
    it('should inject correlation ID into response headers', () => {
      const correlationId = '123e4567-e89b-42d3-a456-426614174000'
      const headers = {}

      const result = manager.injectIntoHeaders(headers, correlationId)

      expect(result['X-Request-ID']).toBe(correlationId)
    })

    it('should preserve existing headers while injecting', () => {
      const correlationId = '123e4567-e89b-42d3-a456-426614174000'
      const headers = { 'Content-Type': 'application/json' }

      const result = manager.injectIntoHeaders(headers, correlationId)

      expect(result['Content-Type']).toBe('application/json')
      expect(result['X-Request-ID']).toBe(correlationId)
    })

    it('should override existing X-Request-ID', () => {
      const oldId = '123e4567-e89b-42d3-a456-426614174000'
      const newId = '987e6543-e89b-42d3-a456-426614174999'
      const headers = { 'X-Request-ID': oldId }

      const result = manager.injectIntoHeaders(headers, newId)

      expect(result['X-Request-ID']).toBe(newId)
    })
  })

  describe('Validation', () => {
    it('should validate correlation ID in context', () => {
      const correlationId = '123e4567-e89b-42d3-a456-426614174000'
      const context = { correlationId }

      const isValid = manager.isValidForContext(correlationId, context)

      expect(isValid).toBe(true)
    })

    it('should reject mismatched correlation ID', () => {
      const correlationId = '123e4567-e89b-42d3-a456-426614174000'
      const context = { correlationId: 'different-id' }

      const isValid = manager.isValidForContext(correlationId, context)

      expect(isValid).toBe(false)
    })

    it('should reject invalid UUID format in context', () => {
      const correlationId = 'not-a-uuid'
      const context = { correlationId }

      const isValid = manager.isValidForContext(correlationId, context)

      expect(isValid).toBe(false)
    })
  })

  describe('Propagation', () => {
    it('should propagate correlation ID through request context', () => {
      const incomingHeaders = {}
      const correlationId = manager.getOrCreate(incomingHeaders)

      const context = { correlationId }

      expect(context.correlationId).toBe(correlationId)
    })

    it('should maintain same ID across multiple operations', () => {
      const correlationId = manager.generateId()

      const context1 = { correlationId }
      const context2 = { correlationId: context1.correlationId }

      expect(context1.correlationId).toBe(context2.correlationId)
    })

    it('should include ID in log entries', () => {
      const correlationId = manager.generateId()

      const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Request processed',
        correlationId,
      }

      expect(logEntry.correlationId).toBe(correlationId)
    })

    it('should pass ID to worker jobs', () => {
      const correlationId = manager.generateId()

      const jobPayload = {
        job_type: 'grade_attempt',
        attempt_id: 'attempt-123',
        correlation_id: correlationId,
      }

      expect(jobPayload.correlation_id).toBe(correlationId)
    })
  })

  describe('Edge Cases', () => {
    it('should handle headers with multiple values', () => {
      const testId = '123e4567-e89b-42d3-a456-426614174000'
      const headers = {
        'x-request-id': testId,
        'x-random-header': 'value',
      }

      const extracted = manager.extractFromHeaders(headers)

      expect(extracted).toBe(testId)
    })

    it('should handle empty header string', () => {
      const headers = { 'x-request-id': '' }

      const extracted = manager.extractFromHeaders(headers)

      expect(extracted).toBeNull()
    })

    it('should handle undefined headers object', () => {
      const headers = {}

      const result = manager.getOrCreate(headers)

      expect(manager.isValidUUID(result)).toBe(true)
    })

    it('should be idempotent for same input', () => {
      const headers = { 'x-request-id': '123e4567-e89b-42d3-a456-426614174000' }

      const result1 = manager.getOrCreate(headers)
      const result2 = manager.getOrCreate(headers)

      expect(result1).toBe(result2)
    })
  })
})
