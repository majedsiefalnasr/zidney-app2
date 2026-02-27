/**
 * JWT Signing & Verification
 *
 * File: packages/domain-core/src/auth/jwt-handler.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Cryptographically secure JWT signing and verification for all auth domains.
 * Implements stateless token-based authentication with version enforcement.
 *
 * Architecture:
 * - Algorithm: HS256 (HMAC with SHA-256)
 * - Signing Key: Shared secret (environment variable)
 * - Token Lifetime: Short-lived (15 minutes for Phase 1)
 * - Claim Validation: scope, workspace_id, token_version, schema_version, product_version
 *
 * Compliance:
 * - RFC 7519: JSON Web Token (JWT) standard
 * - ADR-0006: Server-authoritative time only
 * - AGENTS.md: Strong validation on every request
 */

import * as jwt from 'jsonwebtoken'
import {
  AuthError,
  AuthErrorCode,
  JwtPayload,
  JwtPayloadBackoffice,
  JwtPayloadFrontoffice,
  JwtPayloadMmc,
} from './types'

/**
 * JWT Configuration
 */
interface JwtConfig {
  secret: string
  expiresIn: string // e.g., '15m', '1h'
  algorithm: jwt.Algorithm
}

// Default JWT configuration
const DEFAULT_JWT_CONFIG: JwtConfig = {
  secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  expiresIn: '15m', // Short-lived tokens for security
  algorithm: 'HS256',
}

/**
 * Get JWT configuration from environment
 * Validates that secret is set (throws if missing in production)
 */
function getJwtConfig(): JwtConfig {
  const secret = process.env.JWT_SECRET

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production')
  }

  return {
    secret: secret || DEFAULT_JWT_CONFIG.secret,
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_JWT_CONFIG.expiresIn,
    algorithm: DEFAULT_JWT_CONFIG.algorithm,
  }
}

/**
 * Sign a JWT token for MMC user
 *
 * @param user - MMC user object
 * @returns Signed JWT token string
 * @throws Error if signing fails
 *
 * Claims included:
 * - scope: 'MMC' (prevents confusion with tenant tokens)
 * - user_id: User UUID
 * - user_email: User email (for audit trail)
 * - role: 'ADMIN' or 'OPERATOR'
 * - token_version: Current user.token_version (allows invalidation)
 * - schema_version: Global schema version
 * - product_version: Product version from license
 * - iat, exp: Issued-at and expiration timestamps
 *
 * Critical: NO workspace_id in MMC token (prevents cross-workspace token use)
 */
export async function signMmcToken(user: {
  id: string
  email: string
  role: 'ADMIN' | 'OPERATOR'
  token_version: number
}): Promise<string> {
  const config = getJwtConfig()

  const payload: JwtPayloadMmc = {
    scope: 'MMC',
    user_id: user.id,
    user_email: user.email,
    role: user.role,
    token_version: user.token_version,
    schema_version: process.env.SCHEMA_VERSION || '1.0.0',
    product_version: process.env.PRODUCT_VERSION || '1.0.0',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
  }

  return jwt.sign(
    payload as unknown as Record<string, unknown>,
    config.secret,
    {
      algorithm: config.algorithm,
      noTimestamp: false, // Let jwt lib manage iat/exp
    }
  )
}

/**
 * Sign a JWT token for Backoffice user
 *
 * @param user - Backoffice user object
 * @param workspaceId - Workspace ID (required for scope)
 * @param schemaVersion - Current schema version
 * @param productVersion - Current product version
 * @param permissions - Permission codes (optional)
 * @returns Signed JWT token string
 *
 * Critical Claims:
 * - scope: 'BACKOFFICE' (requires tenant routes only)
 * - workspace_id: Required (for route authorization)
 * - token_version: For forced invalidation
 * - schema_version: Captures current schema state
 */
export async function signBackofficeToken(
  user: {
    id: string
    email: string
    role: 'ADMIN' | 'INSTRUCTOR' | 'STAFF'
    token_version: number
  },
  options: {
    workspaceId: string
    schemaVersion: string
    productVersion: string
    permissions?: string[]
  }
): Promise<string> {
  const config = getJwtConfig()

  const payload: JwtPayloadBackoffice = {
    scope: 'BACKOFFICE',
    user_id: user.id,
    user_email: user.email,
    workspace_id: options.workspaceId,
    role: user.role,
    token_version: user.token_version,
    schema_version: options.schemaVersion,
    product_version: options.productVersion,
    permissions: options.permissions || [],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
  }

  return jwt.sign(
    payload as unknown as Record<string, unknown>,
    config.secret,
    {
      algorithm: config.algorithm,
    }
  )
}

/**
 * Sign a JWT token for Frontoffice (student) user
 *
 * @param user - Student user object
 * @param workspaceId - Required workspace context
 * @param divisionId - Required division context
 * @param subscriptionStatus - Student subscription status
 * @param schemaVersion - Current schema version
 * @param productVersion - Current product version
 * @returns Signed JWT token string
 *
 * Critical Claims:
 * - scope: 'FRONTOFFICE' (student-only routes)
 * - workspace_id: Required
 * - division_id: Required (students belong to exactly one division)
 * - subscription_status: For content access control
 */
export async function signFrontofficeToken(
  user: {
    id: string
    email: string
    token_version: number
  },
  options: {
    workspaceId: string
    divisionId: string
    subscriptionStatus: 'ACTIVE' | 'EXPIRED' | 'PENDING'
    schemaVersion: string
    productVersion: string
  }
): Promise<string> {
  const config = getJwtConfig()

  const payload: JwtPayloadFrontoffice = {
    scope: 'FRONTOFFICE',
    user_id: user.id,
    user_email: user.email,
    workspace_id: options.workspaceId,
    division_id: options.divisionId,
    role: 'STUDENT',
    token_version: user.token_version,
    subscription_status: options.subscriptionStatus,
    schema_version: options.schemaVersion,
    product_version: options.productVersion,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
  }

  return jwt.sign(
    payload as unknown as Record<string, unknown>,
    config.secret,
    {
      algorithm: config.algorithm,
    }
  )
}

/**
 * Verify and decode JWT token
 *
 * Validates:
 * 1. Signature (prevents tampering)
 * 2. Expiration (prevents replay of old tokens)
 * 3. Basic structure

 *
 * Returns decoded payload or throws AuthError
 *
 * @param token - JWT token string (with "Bearer " prefix removed)
 * @returns Decoded JWT payload
 * @throws AuthError if token invalid/expired/malformed
 */
export async function verifyAndDecodeToken(token: string): Promise<JwtPayload> {
  if (!token || typeof token !== 'string') {
    throw new AuthError(
      AuthErrorCode.TOKEN_INVALID,
      'Token must be a non-empty string',
      401
    )
  }

  try {
    const config = getJwtConfig()
    const payload = jwt.verify(token, config.secret, {
      algorithms: [config.algorithm],
    }) as unknown as JwtPayload

    return payload
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError(AuthErrorCode.TOKEN_EXPIRED, 'Token has expired', 401)
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthError(
        AuthErrorCode.TOKEN_INVALID,
        'Invalid token signature',
        401
      )
    }
    throw new AuthError(
      AuthErrorCode.TOKEN_INVALID,
      'Token verification failed',
      401
    )
  }
}

/**
 * Extract token from Authorization header
 *
 * Expected format: "Bearer <token>"
 *
 * @param authHeader - Authorization header value
 * @returns Token string (without "Bearer " prefix)
 * @throws AuthError if header malformed
 *
 * Example:
 * ```
 * const token = extractTokenFromHeader('Bearer eyJhbGc...')
 * // token = 'eyJhbGc...'
 * ```
 */
export function extractTokenFromHeader(authHeader: string | undefined): string {
  if (!authHeader || typeof authHeader !== 'string') {
    throw new AuthError(
      AuthErrorCode.TOKEN_INVALID,
      'Missing Authorization header',
      401
    )
  }

  const parts = authHeader.split(' ')

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthError(
      AuthErrorCode.TOKEN_INVALID,
      'Authorization header must be in format "Bearer <token>"',
      401
    )
  }

  return parts[1]!
}

/**
 * Validate JWT claims for security consistency
 *
 * Checks done here (additional to standard JWT verification):
 * 1. scope is valid (MMC, BACKOFFICE, or FRONTOFFICE)
 * 2. workspace_id present for tenant tokens (not MMC)
 * 3. token_version is valid integer
 * 4. schema_version matches expected (raises 426 if not)
 * 5. product_version compatible (raises 426 if not)
 *
 * @param payload - Decoded JWT payload
 * @param expectedWorkspaceId - For tenant tokens (validates workspace isolation)
 * @param expectedSchemaVersion - Current schema version (detects upgrade mismatches)
 * @returns true if all validations pass
 * @throws AuthError if validation fails
 */
export async function validateJwtClaims(
  payload: JwtPayload,
  expectedWorkspaceId?: string,
  expectedSchemaVersion?: string
): Promise<boolean> {
  // Validate scope
  if (!['MMC', 'BACKOFFICE', 'FRONTOFFICE'].includes(payload.scope)) {
    throw new AuthError(
      AuthErrorCode.INVALID_SCOPE,
      `Invalid token scope: ${payload.scope}`,
      401
    )
  }

  // For tenant tokens, workspace_id is mandatory
  if (payload.scope !== 'MMC') {
    const tenantPayload = payload as
      | JwtPayloadBackoffice
      | JwtPayloadFrontoffice
    if (!tenantPayload.workspace_id) {
      throw new AuthError(
        AuthErrorCode.MISSING_WORKSPACE_ID,
        'Tenant token missing workspace_id',
        401
      )
    }

    // Workspace isolation: token workspace must match request context
    if (
      expectedWorkspaceId &&
      tenantPayload.workspace_id !== expectedWorkspaceId
    ) {
      throw new AuthError(
        AuthErrorCode.WORKSPACE_MISMATCH,
        'Token workspace does not match request workspace',
        401,
        {
          tokenWorkspace: tenantPayload.workspace_id,
          expectedWorkspace: expectedWorkspaceId,
        }
      )
    }
  }

  // Validate token_version (safety check)
  if (typeof payload.token_version !== 'number' || payload.token_version < 0) {
    throw new AuthError(
      AuthErrorCode.TOKEN_INVALID,
      'Invalid token_version claim',
      401
    )
  }

  // Schema version validation (triggers upgrade flow if mismatch)
  if (
    expectedSchemaVersion &&
    payload.schema_version !== expectedSchemaVersion
  ) {
    throw new AuthError(
      AuthErrorCode.SCHEMA_MISMATCH,
      'Token schema version does not match workspace schema version',
      426,
      { tokenSchemaVersion: payload.schema_version, expectedSchemaVersion }
    )
  }

  return true
}
