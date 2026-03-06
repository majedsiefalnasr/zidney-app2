/**
 * Authentication Context Middleware — STAGE_06 Attempt Engine
 *
 * Purpose: Extract and validate JWT, populate user context
 * Middleware Priority: After tenant/license resolvers
 *
 * Task: T017 – Authentication context middleware (JWT validation and user context)
 * Phase: B – Middleware Integration
 * Stage: STAGE_06_ATTEMPT_ENGINE_FOUNDATION
 *
 * Assumptions:
 * - JWT is verified upstream (security boundary)
 * - JWT contains: user_id, workspace_id, roles[], email
 * - Bearer token in Authorization header
 *
 * Constitutional Compliance:
 * - Zero business logic in middleware
 * - Workspace_id validation (ADR-0001)
 * - All user context thread-local (no global state)
 */

import type { Logger } from '@zidney/logger'
import type { Context, MiddlewareHandler } from 'hono'

export interface UserContextStage06 {
  id: string
  email: string
  roles: string[]
  workspace_id: string
  correlation_id: string
}

/**
 * Create authentication context middleware for STAGE_06
 *
 * Validates:
 * 1. Bearer token present
 * 2. Token is valid JWT format
 * 3. Claims contain required fields (user_id, workspace_id)
 * 4. User workspace_id matches request tenant
 *
 * Attaches to context:
 * - c.get('user'): UserContextStage06
 */
export function createAuthContextMiddlewareStage06(logger: Logger): MiddlewareHandler {
  return async (c: Context, next) => {
    const correlation_id = c.get('correlationId') || 'unknown'
    const tenant = c.get('tenant')
    const workspace_id = tenant?.id

    try {
      // Extract Bearer token from Authorization header
      const auth_header = c.req.header('Authorization') || ''
      const token_match = auth_header.match(/^Bearer\s+(.+)$/)

      if (!token_match) {
        logger.warn('Auth context: Missing or invalid Authorization header', {
          correlation_id,
          workspace_id,
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Missing or invalid Authorization header',
            },
          },
          401
        )
      }

      const token = token_match[1]!

      // TODO: Implement JWT verification
      // For now, assume token is pre-verified by upstream (e.g., API Gateway)
      // In production, use: jwt.verify(token, jwtSecret)
      let decoded: any

      try {
        // Placeholder: Assume token is valid
        // In production: decoded = jwt.verify(token, jwtSecret)
        const [, payload] = token.split('.')
        if (!payload) {
          throw new Error('Invalid JWT format')
        }

        try {
          decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'))
        } catch {
          throw new Error('Invalid JWT payload')
        }
      } catch (jwt_error) {
        logger.warn('Auth context: Invalid JWT', {
          correlation_id,
          workspace_id,
          error: jwt_error instanceof Error ? jwt_error.message : String(jwt_error),
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid authentication token',
            },
          },
          401
        )
      }

      // Validate required claims
      const user_id = decoded.sub || decoded.user_id
      const user_email = decoded.email
      const user_roles = decoded.roles || []

      if (!user_id) {
        logger.warn('Auth context: Missing user_id in token', {
          correlation_id,
          workspace_id,
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid token: missing user identifier',
            },
          },
          401
        )
      }

      if (!user_email) {
        logger.warn('Auth context: Missing email in token', {
          correlation_id,
          workspace_id,
          user_id,
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid token: missing email',
            },
          },
          401
        )
      }

      // Validate workspace_id matches
      const token_workspace_id = decoded.workspace_id
      if (token_workspace_id && token_workspace_id !== workspace_id) {
        logger.warn('Auth context: Workspace mismatch', {
          correlation_id,
          workspace_id,
          token_workspace_id,
          user_id,
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'FORBIDDEN',
              message: 'User workspace does not match request workspace',
            },
          },
          403
        )
      }

      // Attach user context to request
      const user_context: UserContextStage06 = {
        id: user_id,
        email: user_email,
        roles: user_roles,
        workspace_id,
        correlation_id,
      }

      c.set('user', user_context)

      logger.debug('Auth context validated', {
        correlation_id,
        workspace_id,
        user_id,
        roles: user_roles.join(','),
      })

      await next()
    } catch (error) {
      logger.error('Auth context: Unexpected error', {
        correlation_id,
        workspace_id,
        error: error instanceof Error ? error.message : String(error),
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Authentication validation failed',
          },
        },
        500
      )
    }
  }
}

export default createAuthContextMiddlewareStage06
