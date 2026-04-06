/**
 * Billing Domain — Webhook Service
 *
 * File: packages/domain-core/src/billing/webhook.service.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 *
 * HMAC-SHA256 signature verification for inbound payment gateway webhooks.
 * Uses timingSafeEqual to prevent timing-based signature oracle attacks.
 *
 * Constitutional Compliance:
 * ✓ No HTTP, no framework imports
 * ✓ No DB access — pure cryptographic verification helper
 * ✓ No logging side-effects
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verify a payment gateway webhook signature.
 *
 * The gateway signs the raw request body with a shared secret using HMAC-SHA256
 * and sends the hex-encoded signature in a header (e.g. X-Gateway-Signature).
 *
 * Security guarantees:
 * - Uses `timingSafeEqual` to prevent timing-based oracle attacks.
 * - If the signature or secret is missing/empty, returns false immediately.
 *
 * @param payload  Raw request body as a Buffer (must be the exact bytes that were signed).
 * @param signature Hex-encoded HMAC-SHA256 signature from the gateway.
 * @param secret    Shared HMAC secret configured for this integration.
 * @returns `true` if the signature is valid, `false` otherwise.
 */
export function verifyGatewaySignature(
  payload: Buffer,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) return false

  const expected = createHmac('sha256', secret).update(payload).digest('hex')

  // Buffer.from(..., 'hex') returns empty buffer on invalid hex — safe to compare
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf = Buffer.from(signature.toLowerCase(), 'hex')

  // Length mismatch would panic timingSafeEqual — guard it explicitly.
  if (expectedBuf.length !== actualBuf.length) return false

  return timingSafeEqual(expectedBuf, actualBuf)
}
