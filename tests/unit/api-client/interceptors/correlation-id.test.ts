/**
 * Unit tests for applyCorrelationId() in packages/api-client/src/interceptors.ts
 * Covers Test 3.3: X-Correlation-ID header present on all outgoing requests.
 * Stage: STAGE_TEST_01_UI_RUNTIME_VALIDATION
 */
import { describe, expect, it } from 'vitest'
import { applyCorrelationId } from '../../../../packages/api-client/src/interceptors'

describe('applyCorrelationId', () => {
  it('sets X-Correlation-ID to the provided correlationId', () => {
    const headers: Record<string, string> = {}
    applyCorrelationId(headers, 'my-request-id-123')
    expect(headers['X-Correlation-ID']).toBe('my-request-id-123')
  })

  it('auto-generates a UUID when no correlationId is provided', () => {
    const headers: Record<string, string> = {}
    applyCorrelationId(headers)
    expect(headers['X-Correlation-ID']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
  })

  it('generates distinct UUIDs for separate calls', () => {
    const h1: Record<string, string> = {}
    const h2: Record<string, string> = {}
    applyCorrelationId(h1)
    applyCorrelationId(h2)
    expect(h1['X-Correlation-ID']).not.toBe(h2['X-Correlation-ID'])
  })

  it('key is exactly X-Correlation-ID (not x-request-id or other variants)', () => {
    const headers: Record<string, string> = {}
    applyCorrelationId(headers, 'test-id')
    expect(Object.keys(headers)).toContain('X-Correlation-ID')
    expect(Object.keys(headers)).not.toContain('x-request-id')
    expect(Object.keys(headers)).not.toContain('X-Request-ID')
  })

  it('overwrites an existing X-Correlation-ID when a new value is provided', () => {
    const headers: Record<string, string> = { 'X-Correlation-ID': 'old-id' }
    applyCorrelationId(headers, 'new-id')
    expect(headers['X-Correlation-ID']).toBe('new-id')
  })
})
