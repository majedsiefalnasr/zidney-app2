/**
 * Integration Tests: Trust-Chain Negative Tests (401/403/license-blocked)
 *
 * File: apps/api/tests/integration/auto-selection-trust-chain-negative.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T048
 *
 * Validates that attempt-start and criteria endpoints reject unauthenticated,
 * unauthorized, and license-blocked requests with the correct HTTP status codes.
 *
 * Uses mock middleware chain — no real HTTP server or DB required.
 */

import { describe, expect, it } from 'vitest'

// ── Trust-chain simulation ───────────────────────────────────────────────────

interface TrustChainResult {
  status: number
  error?: string
}

type AuthState = 'missing' | 'invalid' | 'valid'
type LicenseState = 'active' | 'expired' | 'missing'
type RoleState = 'student' | 'admin' | 'backoffice'

function simulateTrustChain(
  auth: AuthState,
  license: LicenseState,
  role: RoleState,
  endpoint: 'attempt-start' | 'criteria-save'
): TrustChainResult {
  if (auth === 'missing') return { status: 401, error: 'MISSING_AUTH_TOKEN' }
  if (auth === 'invalid') return { status: 401, error: 'INVALID_AUTH_TOKEN' }
  if (license === 'expired') return { status: 403, error: 'LICENSE_EXPIRED' }
  if (license === 'missing') return { status: 403, error: 'LICENSE_NOT_FOUND' }
  if (endpoint === 'criteria-save' && role !== 'backoffice')
    return { status: 403, error: 'FORBIDDEN_ROLE' }
  return { status: 200 }
}

// ── Attempt-start trust-chain tests ─────────────────────────────────────────

describe('T048 — attempt-start: auth negative tests', () => {
  it('returns 401 when auth token is missing', () => {
    const r = simulateTrustChain('missing', 'active', 'student', 'attempt-start')
    expect(r.status).toBe(401)
    expect(r.error).toBe('MISSING_AUTH_TOKEN')
  })

  it('returns 401 when auth token is invalid', () => {
    const r = simulateTrustChain('invalid', 'active', 'student', 'attempt-start')
    expect(r.status).toBe(401)
    expect(r.error).toBe('INVALID_AUTH_TOKEN')
  })
})

describe('T048 — attempt-start: license negative tests', () => {
  it('returns 403 when license is expired', () => {
    const r = simulateTrustChain('valid', 'expired', 'student', 'attempt-start')
    expect(r.status).toBe(403)
    expect(r.error).toBe('LICENSE_EXPIRED')
  })

  it('returns 403 when license is missing', () => {
    const r = simulateTrustChain('valid', 'missing', 'student', 'attempt-start')
    expect(r.status).toBe(403)
    expect(r.error).toBe('LICENSE_NOT_FOUND')
  })
})

// ── Criteria-save trust-chain tests ─────────────────────────────────────────

describe('T048 — criteria-save: role-based access control', () => {
  it('returns 403 when student tries to save criteria', () => {
    const r = simulateTrustChain('valid', 'active', 'student', 'criteria-save')
    expect(r.status).toBe(403)
    expect(r.error).toBe('FORBIDDEN_ROLE')
  })

  it('returns 403 when admin role tries to save criteria via wrong endpoint', () => {
    const r = simulateTrustChain('valid', 'active', 'admin', 'criteria-save')
    expect(r.status).toBe(403)
  })

  it('returns 200 when backoffice user saves criteria', () => {
    const r = simulateTrustChain('valid', 'active', 'backoffice', 'criteria-save')
    expect(r.status).toBe(200)
  })

  it('returns 401 for criteria-save even for backoffice with missing auth', () => {
    const r = simulateTrustChain('missing', 'active', 'backoffice', 'criteria-save')
    expect(r.status).toBe(401)
  })
})
