import { createLogger } from '@zidney/logger'
import { Jwt } from 'hono/utils/jwt'
import type { JWTPayload } from 'hono/utils/jwt/types'

const logger = createLogger('ws-auth')

export interface WebSocketJWTClaims extends JWTPayload {
  workspace_id: string
  workspace_slug: string
  user_id: string
  attempt_id: string
  roles: string[]
  iat: number
  exp: number
}

/**
 * T033: Validate WebSocket JWT token
 *
 * Validates JWT signature and claims for WebSocket connections
 * Ensures:
 * - JWT signature is valid
 * - Token is not expired
 * - workspace_id and attempt_id claims are present
 * - Required role claims exist
 */
export async function validateWebSocketJWT(
  token: string,
  jwtSecret: string,
  attemptId: string,
  workspaceId: string
): Promise<WebSocketJWTClaims | null> {
  try {
    // Verify JWT signature and expiration
    const payload = (await Jwt.verify(token, jwtSecret, 'HS256')) as JWTPayload

    if (!payload) {
      logger.warn(`WebSocket JWT verification failed: invalid signature`)
      return null
    }

    // Cast to our expected claims structure
    const claims = payload as WebSocketJWTClaims

    // Validate required claims exist
    if (
      !claims.workspace_id ||
      !claims.user_id ||
      !claims.attempt_id ||
      !Array.isArray(claims.roles)
    ) {
      logger.warn(`WebSocket JWT validation failed: missing required claims`, {
        has_workspace_id: !!claims.workspace_id,
        has_user_id: !!claims.user_id,
        has_attempt_id: !!claims.attempt_id,
        has_roles: Array.isArray(claims.roles),
      })
      return null
    }

    // Validate workspace_id matches context
    if (claims.workspace_id !== workspaceId) {
      logger.warn(`WebSocket JWT validation failed: workspace mismatch`, {
        claimed_workspace_id: claims.workspace_id,
        context_workspace_id: workspaceId,
      })
      return null
    }

    // Validate attempt_id matches URL parameter
    if (claims.attempt_id !== attemptId) {
      logger.warn(`WebSocket JWT validation failed: attempt ID mismatch`, {
        claimed_attempt_id: claims.attempt_id,
        url_attempt_id: attemptId,
      })
      return null
    }

    // Validate expiration explicitly (in case verify doesn't catch it)
    const currentTime = Math.floor(Date.now() / 1000)
    if (claims.exp && claims.exp < currentTime) {
      logger.warn(`WebSocket JWT validation failed: token expired`, {
        expiration_time: claims.exp,
        current_time: currentTime,
      })
      return null
    }

    return claims
  } catch (error) {
    logger.warn(`WebSocket JWT verification error`, {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Extract JWT token from request headers
 * Expects: Authorization: Bearer <token>
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null
  }

  const match = authHeader.match(/^Bearer\s+([^\s]+)$/)
  return match?.[1] ?? null
}

/**
 * Check if user has required role for WebSocket operations
 */
export function hasRequiredRole(claims: WebSocketJWTClaims, requiredRoles: string[]): boolean {
  return requiredRoles.some((role) => claims.roles.includes(role))
}
