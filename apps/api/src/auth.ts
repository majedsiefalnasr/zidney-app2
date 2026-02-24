/**
 * Compatibility re-export for auth route modules that import ../../auth.
 * The canonical implementations live in domain-core.
 */
import * as jwt from 'jsonwebtoken'
import {
  generateDummyHash,
  hashPassword,
  verifyPassword,
} from '@zidney/domain-core/auth'

export * from '@zidney/domain-core/auth'

type LegacyScope = 'mmc' | 'backoffice' | 'frontoffice'

export interface LegacyJwtPayload {
  user_id: string
  email: string
  scope: LegacyScope
  workspace_id?: string
  token_version?: number
  type?: string
  iat?: number
  exp?: number
  [key: string]: unknown
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'dev-secret-change-in-production'
}

function normalizeScope(scope: string | undefined): LegacyScope | undefined {
  if (!scope) return undefined
  return scope.toLowerCase() as LegacyScope
}

/**
 * Backward-compatible namespace used by existing auth routes.
 */
export const password = {
  hashPassword,
  verifyPassword,
  getDummyHash: generateDummyHash,
}

/**
 * Backward-compatible JWT API used by existing auth routes.
 * New code should prefer domain-core sign/verify helpers directly.
 */
export const jwtCompat = {
  signToken(payload: LegacyJwtPayload, _scopeHint?: string): string {
    return jwt.sign(payload, getJwtSecret(), { algorithm: 'HS256' })
  },

  verifyToken(token: string, expectedScope?: LegacyScope): LegacyJwtPayload {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    }) as LegacyJwtPayload

    if (
      expectedScope &&
      normalizeScope(decoded.scope) !== normalizeScope(expectedScope)
    ) {
      throw new Error('Token scope mismatch')
    }

    return decoded
  },
}

// Keep the historical `auth.jwt.*` surface that routes currently import.
export { jwtCompat as jwt }
