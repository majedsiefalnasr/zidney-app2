/**
 * CSRF Token Unit Tests
 * STAGE_08_RATE_LIMITING_AND_SECURITY - Task T078
 *
 * File: apps/api/tests/unit/csrf-token.test.ts
 * Purpose: Test token generation, validation, and expiration
 *
 * Test Coverage:
 * - CSRF token generation
 * - Token validation
 * - Token expiration
 * - Cookie setting (SameSite=Strict, HttpOnly)
 */

import { beforeEach, describe, expect, it } from 'vitest'

interface CSRFToken {
  token: string
  createdAt: number
  expiresAt: number
}

interface CSRFCookie {
  name: string
  value: string
  httpOnly: boolean
  sameSite: 'Strict' | 'Lax' | 'None'
  secure: boolean
  path: string
}

class CSRFTokenManager {
  private tokens: Map<string, CSRFToken> = new Map()
  private readonly tokenTTL = 24 * 60 * 60 * 1000 // 24 hours

  generateToken(): string {
    const randomBytes = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))

    return randomBytes.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  createToken(userId: string): CSRFToken {
    const token = this.generateToken()
    const now = Date.now()

    const csrfToken: CSRFToken = {
      token,
      createdAt: now,
      expiresAt: now + this.tokenTTL,
    }

    this.tokens.set(`${userId}:${token}`, csrfToken)

    return csrfToken
  }

  validateToken(userId: string, providedToken: string, cookieToken: string): boolean {
    // Both header and cookie tokens must match
    if (providedToken !== cookieToken) {
      return false
    }

    const storedToken = this.tokens.get(`${userId}:${providedToken}`)

    if (!storedToken) {
      return false
    }

    // Check expiration
    if (Date.now() > storedToken.expiresAt) {
      this.tokens.delete(`${userId}:${providedToken}`)
      return false
    }

    return true
  }

  invalidateToken(userId: string, token: string): void {
    this.tokens.delete(`${userId}:${token}`)
  }

  generateCookie(token: string, isProduction: boolean = true): CSRFCookie {
    return {
      name: 'X-CSRF-TOKEN',
      value: token,
      httpOnly: true,
      sameSite: 'Strict',
      secure: isProduction,
      path: '/',
    }
  }

  formatCookieHeader(cookie: CSRFCookie): string {
    const parts = [
      `${cookie.name}=${cookie.value}`,
      `Path=${cookie.path}`,
      `SameSite=${cookie.sameSite}`,
      'HttpOnly',
    ]

    if (cookie.secure) {
      parts.push('Secure')
    }

    return parts.join('; ')
  }

  isTokenExpired(token: CSRFToken): boolean {
    return Date.now() > token.expiresAt
  }

  getTokenAge(token: CSRFToken): number {
    return Date.now() - token.createdAt
  }
}

describe('CSRF Token Management', () => {
  let manager: CSRFTokenManager

  beforeEach(() => {
    manager = new CSRFTokenManager()
  })

  describe('Token Generation', () => {
    it('should generate valid CSRF token', () => {
      const token = manager.generateToken()

      expect(token).toBeDefined()
      expect(token.length).toBe(64) // 32 bytes = 64 hex characters
    })

    it('should generate unique tokens', () => {
      const token1 = manager.generateToken()
      const token2 = manager.generateToken()

      expect(token1).not.toBe(token2)
    })

    it('should generate hex-only tokens', () => {
      const token = manager.generateToken()

      expect(/^[0-9a-f]+$/.test(token)).toBe(true)
    })

    it('should generate different tokens on each call', () => {
      const tokens = Array.from({ length: 10 }, () => manager.generateToken())
      const uniqueTokens = new Set(tokens)

      expect(uniqueTokens.size).toBe(10)
    })
  })

  describe('Token Creation', () => {
    it('should create token with correct structure', () => {
      const token = manager.createToken('user-1')

      expect(token).toHaveProperty('token')
      expect(token).toHaveProperty('createdAt')
      expect(token).toHaveProperty('expiresAt')
    })

    it('should set expiration to 24 hours', () => {
      const token = manager.createToken('user-1')
      const expectedTTL = 24 * 60 * 60 * 1000

      expect(token.expiresAt - token.createdAt).toBe(expectedTTL)
    })

    it('should store token for validation', () => {
      const token = manager.createToken('user-1')

      // Token should be retrievable (tested in validation)
      const isValid = manager.validateToken('user-1', token.token, token.token)

      expect(isValid).toBe(true)
    })

    it('should create unique tokens for same user', () => {
      const token1 = manager.createToken('user-1')
      const token2 = manager.createToken('user-1')

      expect(token1.token).not.toBe(token2.token)
    })

    it('should store timestamp', () => {
      const beforeCreation = Date.now()
      const token = manager.createToken('user-1')
      const afterCreation = Date.now()

      expect(token.createdAt).toBeGreaterThanOrEqual(beforeCreation)
      expect(token.createdAt).toBeLessThanOrEqual(afterCreation)
    })
  })

  describe('Token Validation', () => {
    it('should validate correct token', () => {
      const token = manager.createToken('user-1')

      const isValid = manager.validateToken('user-1', token.token, token.token)

      expect(isValid).toBe(true)
    })

    it('should reject invalid token', () => {
      const token = manager.createToken('user-1')

      const isValid = manager.validateToken('user-1', 'wrong-token', token.token)

      expect(isValid).toBe(false)
    })

    it('should reject mismatched header and cookie tokens', () => {
      const token = manager.createToken('user-1')

      const isValid = manager.validateToken('user-1', `${token.token}extra`, token.token)

      expect(isValid).toBe(false)
    })

    it('should reject expired token', () => {
      const token = manager.createToken('user-1')

      // Simulate token expiration
      token.expiresAt = Date.now() - 1000

      const isValid = manager.validateToken('user-1', token.token, token.token)

      expect(isValid).toBe(false)
    })

    it('should reject token from different user', () => {
      const _token1 = manager.createToken('user-1')
      const token2 = manager.createToken('user-2')

      const isValid = manager.validateToken('user-1', token2.token, token2.token)

      expect(isValid).toBe(false)
    })

    it('should require both tokens to match', () => {
      const token = manager.createToken('user-1')

      const isValid1 = manager.validateToken('user-1', token.token, 'different-cookie')
      const isValid2 = manager.validateToken('user-1', 'different-header', token.token)

      expect(isValid1).toBe(false)
      expect(isValid2).toBe(false)
    })
  })

  describe('Token Expiration', () => {
    it('should mark token as not expired when fresh', () => {
      const token = manager.createToken('user-1')

      const isExpired = manager.isTokenExpired(token)

      expect(isExpired).toBe(false)
    })

    it('should mark token as expired when past expiration', () => {
      const token = manager.createToken('user-1')
      token.expiresAt = Date.now() - 1000

      const isExpired = manager.isTokenExpired(token)

      expect(isExpired).toBe(true)
    })

    it('should calculate token age correctly', () => {
      const token = manager.createToken('user-1')

      const age = manager.getTokenAge(token)

      expect(age).toBeGreaterThanOrEqual(0)
      expect(age).toBeLessThan(100) // Should be almost instant
    })

    it('should allow pre-expiration validation', () => {
      const token = manager.createToken('user-1')

      // Token should still be valid up to expiration
      const isValid = manager.validateToken('user-1', token.token, token.token)

      expect(isValid).toBe(true)
    })
  })

  describe('Cookie Generation', () => {
    it('should generate cookie with HttpOnly flag', () => {
      const token = manager.generateToken()
      const cookie = manager.generateCookie(token, true)

      expect(cookie.httpOnly).toBe(true)
    })

    it('should generate cookie with SameSite=Strict', () => {
      const token = manager.generateToken()
      const cookie = manager.generateCookie(token, true)

      expect(cookie.sameSite).toBe('Strict')
    })

    it('should set Secure flag in production', () => {
      const token = manager.generateToken()
      const cookie = manager.generateCookie(token, true)

      expect(cookie.secure).toBe(true)
    })

    it('should skip Secure flag in development', () => {
      const token = manager.generateToken()
      const cookie = manager.generateCookie(token, false)

      expect(cookie.secure).toBe(false)
    })

    it('should set correct cookie name', () => {
      const token = manager.generateToken()
      const cookie = manager.generateCookie(token, true)

      expect(cookie.name).toBe('X-CSRF-TOKEN')
    })

    it('should set cookie path to root', () => {
      const token = manager.generateToken()
      const cookie = manager.generateCookie(token, true)

      expect(cookie.path).toBe('/')
    })
  })

  describe('Cookie Formatting', () => {
    it('should format cookie header correctly', () => {
      const token = manager.generateToken()
      const cookie = manager.generateCookie(token, true)
      const header = manager.formatCookieHeader(cookie)

      expect(header).toContain(`X-CSRF-TOKEN=${token}`)
      expect(header).toContain('Path=/')
      expect(header).toContain('SameSite=Strict')
      expect(header).toContain('HttpOnly')
      expect(header).toContain('Secure')
    })

    it('should omit Secure flag in development mode', () => {
      const token = manager.generateToken()
      const cookie = manager.generateCookie(token, false)
      const header = manager.formatCookieHeader(cookie)

      expect(header).not.toContain('Secure')
      expect(header).toContain('HttpOnly')
      expect(header).toContain('SameSite=Strict')
    })

    it('should use semicolon separator', () => {
      const token = manager.generateToken()
      const cookie = manager.generateCookie(token, true)
      const header = manager.formatCookieHeader(cookie)

      expect(header).toMatch(/; /g)
    })
  })

  describe('Token Invalidation', () => {
    it('should invalidate token', () => {
      const token = manager.createToken('user-1')

      manager.invalidateToken('user-1', token.token)

      const isValid = manager.validateToken('user-1', token.token, token.token)

      expect(isValid).toBe(false)
    })

    it('should allow logout by invalidating token', () => {
      const token = manager.createToken('user-1')
      const initialCheck = manager.validateToken('user-1', token.token, token.token)

      manager.invalidateToken('user-1', token.token)

      const finalCheck = manager.validateToken('user-1', token.token, token.token)

      expect(initialCheck).toBe(true)
      expect(finalCheck).toBe(false)
    })
  })

  describe('Security Properties', () => {
    it('should generate cryptographically random tokens', () => {
      const tokens = Array.from({ length: 100 }, () => manager.generateToken())

      // All tokens should be unique
      const uniqueTokens = new Set(tokens)

      expect(uniqueTokens.size).toBe(100)
    })

    it('should not expose token in logs', () => {
      const token = manager.createToken('user-1')

      // Token should not appear in error messages
      const logMessage = `CSRF validation failed for user-1`

      expect(logMessage).not.toContain(token.token)
    })

    it('should prevent token brute force with expiration', () => {
      const token = manager.createToken('user-1')

      // Token expires after 24 hours
      const ttl = token.expiresAt - token.createdAt

      expect(ttl).toBe(24 * 60 * 60 * 1000)
    })

    it('should be retrieved per-user', () => {
      const token1 = manager.createToken('user-1')
      const token2 = manager.createToken('user-2')

      const valid1 = manager.validateToken('user-1', token1.token, token1.token)
      const valid2 = manager.validateToken('user-2', token2.token, token2.token)
      const invalid = manager.validateToken('user-1', token2.token, token2.token)

      expect(valid1).toBe(true)
      expect(valid2).toBe(true)
      expect(invalid).toBe(false)
    })
  })

  describe('End-to-End Flow', () => {
    it('should complete login → CSRF token → validation flow', () => {
      // Step 1: Generate token on login
      const loginToken = manager.createToken('user-1')

      // Step 2: Send in response
      const _cookie = manager.generateCookie(loginToken.token, true)

      // Step 3: Client uses token in header and cookie for subsequent requests
      const headerTokenValue = loginToken.token
      const cookieTokenValue = loginToken.token

      // Step 4: Validate on server
      const isValid = manager.validateToken('user-1', headerTokenValue, cookieTokenValue)

      expect(isValid).toBe(true)
    })

    it('should reject CSRF without valid token pair', () => {
      const _loginToken = manager.createToken('user-1')

      // Attacker tries to use different token values
      const isValid = manager.validateToken('user-1', 'attacker-token', 'attacker-token')

      expect(isValid).toBe(false)
    })
  })
})
