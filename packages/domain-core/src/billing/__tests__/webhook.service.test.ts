/**
 * Billing Domain — Webhook Service Unit Tests
 *
 * File: packages/domain-core/src/billing/__tests__/webhook.service.test.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 *
 * Tests for verifyGatewaySignature:
 *   - Valid signature → true
 *   - Tampered payload → false
 *   - Invalid hex signature → false
 *   - Empty signature → false
 *   - Empty secret → false
 *   - Length-mismatched signature → false
 *   - Case-insensitive signature comparison
 */

import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { verifyGatewaySignature } from '../webhook.service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET = 'super-secret-webhook-key'

function sign(payload: string | Buffer, secret = SECRET): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

// ---------------------------------------------------------------------------
// verifyGatewaySignature
// ---------------------------------------------------------------------------

describe('verifyGatewaySignature', () => {
  it('returns true for a valid HMAC-SHA256 signature', () => {
    const payload = Buffer.from('{"event":"PAYMENT_CONFIRMED","invoice_id":"abc-123"}')
    const signature = sign(payload)

    expect(verifyGatewaySignature(payload, signature, SECRET)).toBe(true)
  })

  it('returns false when payload has been tampered', () => {
    const original = Buffer.from('{"event":"PAYMENT_CONFIRMED","invoice_id":"abc-123"}')
    const tampered = Buffer.from('{"event":"PAYMENT_CONFIRMED","invoice_id":"evil-456"}')
    const signature = sign(original)

    expect(verifyGatewaySignature(tampered, signature, SECRET)).toBe(false)
  })

  it('returns false when wrong secret is used', () => {
    const payload = Buffer.from('{"event":"PAYMENT_CONFIRMED"}')
    const signatureWithWrongSecret = sign(payload, 'wrong-secret')

    expect(verifyGatewaySignature(payload, signatureWithWrongSecret, SECRET)).toBe(false)
  })

  it('returns false when signature is an empty string', () => {
    const payload = Buffer.from('{"invoice_id":"abc"}')

    expect(verifyGatewaySignature(payload, '', SECRET)).toBe(false)
  })

  it('returns false when secret is an empty string', () => {
    const payload = Buffer.from('{"invoice_id":"abc"}')
    const sig = sign(payload)

    expect(verifyGatewaySignature(payload, sig, '')).toBe(false)
  })

  it('returns false for an invalid hex signature (length mismatch after decode)', () => {
    const payload = Buffer.from('{"invoice_id":"abc"}')

    // A 32-char string is not valid 64-char sha256 hex — buffer lengths will differ
    expect(verifyGatewaySignature(payload, 'deadbeefdeadbeef', SECRET)).toBe(false)
  })

  it('accepts uppercase hex signature (case-insensitive)', () => {
    const payload = Buffer.from('{"event":"PAYMENT_CONFIRMED"}')
    const signature = sign(payload).toUpperCase()

    expect(verifyGatewaySignature(payload, signature, SECRET)).toBe(true)
  })

  it('returns true for an empty payload buffer when signature matches', () => {
    const payload = Buffer.from('')
    const signature = sign(payload)

    expect(verifyGatewaySignature(payload, signature, SECRET)).toBe(true)
  })
})
