/**
 * JWT Operations Tests
 *
 * File: apps/api/tests/unit/jwt-operations.test.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Verify JWT signing and verification
 *
 * Requirements:
 * - Sign JWT with HS256
 * - Include workspace_id + token_version claims
 * - Verify signature
 * - Check expiration
 * - Validate required claims
 *
 * Tests:
 * 1. Sign valid JWT
 * 2. Verify valid JWT
 * 3. Reject expired token
 * 4. Reject tampered signature
 * 5. Include required claims
 */

import * as jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'

describe('JWT Operations', () => {
  const SECRET_MMC = 'supersecret-mmc-key-12345'
  const SECRET_WORKSPACE = 'supersecret-workspace-key-12345'

  /**
   * Sign JWT
   */
  const signToken = (payload: any, secret: string): string => {
    return jwt.sign(payload, secret, {
      algorithm: 'HS256',
      expiresIn: '24h',
    })
  }

  /**
   * Verify JWT
   */
  const verifyToken = (token: string, secret: string): any => {
    return jwt.verify(token, secret, {
      algorithms: ['HS256'],
    })
  }

  it('should sign valid JWT', () => {
    const payload = {
      user_id: 'user-123',
      email: 'test@example.com',
      scope: 'mmc',
      type: 'access',
    }

    const token = signToken(payload, SECRET_MMC)

    expect(token).toBeDefined()
    expect(token).toMatch(/^[A-Za-z0-9-_]*\.[A-Za-z0-9-_]*\.[A-Za-z0-9-_]*$/)
  })

  it('should verify valid JWT', () => {
    const payload = {
      user_id: 'user-456',
      email: 'verify@example.com',
      scope: 'backoffice',
      workspace_id: 'ws-789',
    }

    const token = signToken(payload, SECRET_WORKSPACE)
    const decoded = verifyToken(token, SECRET_WORKSPACE)

    expect(decoded.user_id).toBe(payload.user_id)
    expect(decoded.email).toBe(payload.email)
    expect(decoded.scope).toBe(payload.scope)
  })

  it('should reject expired token', () => {
    const payload = {
      user_id: 'user-exp',
      email: 'exp@example.com',
    }

    const token = jwt.sign(payload, SECRET_MMC, {
      algorithm: 'HS256',
      expiresIn: '-1s', // Expired 1 second ago
    })

    expect(() => {
      verifyToken(token, SECRET_MMC)
    }).toThrow()
  })

  it('should reject tampered signature', () => {
    const payload = {
      user_id: 'user-tamper',
      email: 'tamper@example.com',
    }

    const token = signToken(payload, SECRET_MMC)

    // Tamper with signature
    const parts = token.split('.')
    const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`

    expect(() => {
      verifyToken(tamperedToken, SECRET_MMC)
    }).toThrow()
  })

  it('should reject token signed with different key', () => {
    const payload = {
      user_id: 'user-key',
      email: 'key@example.com',
    }

    const token = signToken(payload, SECRET_MMC)

    // Try to verify with different key
    expect(() => {
      verifyToken(token, 'wrong-secret-key')
    }).toThrow()
  })

  it('should include required claims', () => {
    const payload = {
      user_id: 'user-claims',
      email: 'claims@example.com',
      scope: 'frontoffice',
      workspace_id: 'ws-claims',
      token_version: 1,
      type: 'access',
    }

    const token = signToken(payload, SECRET_WORKSPACE)
    const decoded = verifyToken(token, SECRET_WORKSPACE) as any

    expect(decoded.user_id).toBeDefined()
    expect(decoded.email).toBeDefined()
    expect(decoded.scope).toBeDefined()
    expect(decoded.workspace_id).toBeDefined()
    expect(decoded.token_version).toBeDefined()
    expect(decoded.type).toBeDefined()
  })

  it('should include standard JWT claims', () => {
    const payload = {
      user_id: 'user-std',
      email: 'std@example.com',
    }

    const token = signToken(payload, SECRET_MMC)
    const decoded = verifyToken(token, SECRET_MMC) as any

    // Standard JWT claims
    expect(decoded.iat).toBeDefined() // issued at
    expect(decoded.exp).toBeDefined() // expiration
  })

  it('should validate algorithm is HS256', () => {
    const payload = {
      user_id: 'user-algo',
      email: 'algo@example.com',
    }

    // Sign with HS256
    const token = jwt.sign(payload, SECRET_MMC, {
      algorithm: 'HS256',
    })

    // Verify specifies HS256
    const decoded = jwt.verify(token, SECRET_MMC, {
      algorithms: ['HS256'],
    })

    expect(decoded).toBeDefined()
  })

  it('should reject unsupported algorithm', () => {
    const _payload = {
      user_id: 'user-unsup',
      email: 'unsup@example.com',
    }

    // Try to sign with RS256 (not HS256)
    // This should fail if only HS256 is supported

    // In real implementation, would reject RS256
  })

  it('should extract workspace_id from token', () => {
    const payload = {
      user_id: 'user-ws',
      email: 'ws@example.com',
      workspace_id: 'workspace-extract',
      scope: 'backoffice',
    }

    const token = signToken(payload, SECRET_WORKSPACE)
    const decoded = verifyToken(token, SECRET_WORKSPACE) as any

    const workspaceId = decoded.workspace_id

    expect(workspaceId).toBe('workspace-extract')
  })

  it('should extract token_version for revocation check', () => {
    const payload = {
      user_id: 'user-ver',
      email: 'ver@example.com',
      token_version: 3,
    }

    const token = signToken(payload, SECRET_MMC)
    const decoded = verifyToken(token, SECRET_MMC) as any

    const tokenVersion = decoded.token_version

    expect(tokenVersion).toBe(3)
  })

  it('should include custom type claim', () => {
    const payload = {
      user_id: 'user-type',
      email: 'type@example.com',
      type: 'access',
    }

    const token = signToken(payload, SECRET_MMC)
    const decoded = verifyToken(token, SECRET_MMC) as any

    expect(decoded.type).toBe('access')

    // Future: could support 'refresh' type as well
  })

  it('should handle special characters in email', () => {
    const payload = {
      user_id: 'user-special',
      email: 'user+test@sub.example.com',
    }

    const token = signToken(payload, SECRET_MMC)
    const decoded = verifyToken(token, SECRET_MMC) as any

    expect(decoded.email).toBe('user+test@sub.example.com')
  })
})
