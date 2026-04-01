/**
 * Unit tests for createTokenManager().
 * Mirrors MMC coverage for the Backoffice token manager implementation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ITokenManager } from '../../../src/core/auth/token-manager'
import { createTokenManager } from '../../../src/core/auth/token-manager'

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

  it('getToken() returns null before any token is set', () => {
    expect(tokenManager.getToken()).toBeNull()
  })

  it('hasToken() returns false before any token is set', () => {
    expect(tokenManager.hasToken()).toBe(false)
  })

  it('setToken(val) stores a retrievable value', () => {
    tokenManager.setToken('abc-123')
    expect(tokenManager.getToken()).toBe('abc-123')
  })

  it('hasToken() returns true after token is set', () => {
    tokenManager.setToken('abc-123')
    expect(tokenManager.hasToken()).toBe(true)
  })

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

  it('setToken does not write to localStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    tokenManager.setToken('secret-token')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('setToken does not write to sessionStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    tokenManager.setToken('secret-token')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('setToken does not write to document.cookie', () => {
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

  it('two token manager instances do not share state', () => {
    const tokenManagerTwo = createTokenManager()
    tokenManager.setToken('token-A')
    expect(tokenManagerTwo.getToken()).toBeNull()
    expect(tokenManager.getToken()).toBe('token-A')
  })

  it('setToken overwrites a previously stored token', () => {
    tokenManager.setToken('first-token')
    tokenManager.setToken('second-token')
    expect(tokenManager.getToken()).toBe('second-token')
  })
})
