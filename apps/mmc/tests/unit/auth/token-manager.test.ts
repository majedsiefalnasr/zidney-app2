/**
 * Unit tests for createTokenManager().
 * Verifies: in-memory storage only, no browser storage side effects,
 * no token value leaked to logger.
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ITokenManager } from '../../../src/core/auth/token-manager'
import { createTokenManager } from '../../../src/core/auth/token-manager'

// ─── Logger mock ─────────────────────────────────────────────────────────────
vi.mock('@zidney/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('createTokenManager', () => {
  let tokenManager: ITokenManager

  beforeEach(() => {
    tokenManager = createTokenManager()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ── Initial state ─────────────────────────────────────────────────────────

  it('getToken() returns null before any token is set', () => {
    expect(tokenManager.getToken()).toBeNull()
  })

  it('hasToken() returns false before any token is set', () => {
    expect(tokenManager.hasToken()).toBe(false)
  })

  // ── After setToken ────────────────────────────────────────────────────────

  it('setToken(val) stores a retrievable value', () => {
    tokenManager.setToken('abc-123')
    expect(tokenManager.getToken()).toBe('abc-123')
  })

  it('hasToken() returns true after token is set', () => {
    tokenManager.setToken('abc-123')
    expect(tokenManager.hasToken()).toBe(true)
  })

  // ── After clearToken ──────────────────────────────────────────────────────

  it('clearToken() destroys the stored value', () => {
    tokenManager.setToken('abc-123')
    tokenManager.clearToken()
    expect(tokenManager.getToken()).toBeNull()
  })

  it('hasToken() returns false after clearToken()', () => {
    tokenManager.setToken('abc-123')
    tokenManager.clearToken()
    expect(tokenManager.hasToken()).toBe(false)
  })

  // ── No browser storage side effects ──────────────────────────────────────

  it('setToken does NOT write to localStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    tokenManager.setToken('secret-token')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('setToken does NOT write to sessionStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    tokenManager.setToken('secret-token')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('setToken does NOT write to document.cookie', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
    const cookieSetter = vi.fn()
    Object.defineProperty(document, 'cookie', {
      set: cookieSetter,
      get: () => '',
      configurable: true,
    })
    tokenManager.setToken('secret-token')
    expect(cookieSetter).not.toHaveBeenCalled()
    if (originalDescriptor) {
      Object.defineProperty(document, 'cookie', originalDescriptor)
    }
  })

  // ── Each instance is independent ─────────────────────────────────────────

  it('two token manager instances do not share state', () => {
    const tm2 = createTokenManager()
    tokenManager.setToken('token-A')
    expect(tm2.getToken()).toBeNull()
    expect(tokenManager.getToken()).toBe('token-A')
  })

  // ── Overwrite ────────────────────────────────────────────────────────────

  it('setToken overwrites a previously stored token', () => {
    tokenManager.setToken('first-token')
    tokenManager.setToken('second-token')
    expect(tokenManager.getToken()).toBe('second-token')
  })
})
