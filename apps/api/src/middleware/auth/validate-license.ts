/**
 * Schema Version Validation Middleware
 *
 * File: apps/api/src/middleware/auth/validate-schema-version.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Ensure JWT token schema_version matches workspace schema_version.
 * Triggers upgrade flow (426 Upgrade Required) when mismatch detected.
 *
 * Scenario - Why This Matters:
 * 1. Workspace running schema v1.0.0, user logs in → token includes schema_version: "1.0.0"
 * 2. Admin triggers workspace upgrade → schema now v1.0.1
 * 3. User's old token still has schema_version: "1.0.0"
 * 4. Request arrives with v1.0.0 token, workspace is v1.0.1
 * 5. Rejection: 426 Upgrade Required
 * 6. Client redirects user to login (gets new token with v1.0.1)
 *
 * Purpose: Prevent incompatible API usage during schema transitions
 *
 * Errors:
 * - 426: Token schema version incompatible (user must re-authenticate)
 */

import { logSchemaMismatch } from '@zidney/domain-core/auth'
import { logger } from '@zidney/logger'
import type { Context, Next } from 'hono'

/**
 * Validate that token schema_version matches workspace schema_version
 *
 * Execution Order: 5th (after JWT validation + token version check)
 * Reason: Don't fetch workspace if token invalid
 */
export async function validateSchemaVersionMiddleware(c: Context, next: Next) {
  const correlationId = c.get('correlationId') || 'unknown'

  try {
    // Check if authenticated (skip if not)
    const isAuthenticated = c.get('isAuthenticated')
    if (!isAuthenticated) {
      await next()
      return
    }

    const authPayload = c.get('authPayload')
    if (!authPayload) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'AUTH_CONTEXT_MISSING',
            message: 'Authentication context not required for this route',
          },
        },
        401
      )
    }

    const userId = c.get('userId') || 'unknown'
    const workspaceSlug = c.get('workspaceSlug') || 'unknown'
    const tenantDb = c.get('tenantDb')

    if (!tenantDb) {
      // Some routes (like MMC) don't have tenant DB context
      await next()
      return
    }

    // Fetch workspace schema version
    const workspaceResult = await tenantDb.query(`SELECT schema_version FROM workspaces LIMIT 1`)

    if (workspaceResult.rows.length === 0) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'WORKSPACE_NOT_FOUND',
            message: 'Workspace schema not found',
          },
        },
        500
      )
    }

    const workspace = workspaceResult.rows[0]
    const currentSchemaVersion = workspace.schema_version
    const tokenSchemaVersion = authPayload.schema_version

    // Check version match
    if (tokenSchemaVersion !== currentSchemaVersion) {
      // Version mismatch - schema was upgraded after token issuance
      await logSchemaMismatch(
        correlationId,
        userId,
        workspaceSlug,
        tokenSchemaVersion,
        currentSchemaVersion
      )

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'SCHEMA_MISMATCH',
            message:
              'Your session is incompatible with the current schema version. Please login again.',
          },
        },
        426 // HTTP 426 Upgrade Required
      )
    }

    // Schema match - continue
    await next()
  } catch (error) {
    logger.error('Schema version validation error:', { error })
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Schema validation failed',
        },
      },
      500
    )
  }
}
