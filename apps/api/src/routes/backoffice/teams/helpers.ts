/**
 * Teams Route Helpers — STAGE_26
 *
 * File: apps/api/src/routes/backoffice/teams/helpers.ts
 *
 * Shared utilities, error mappers, and context builders for teams routes.
 */

import {
  type AuditContext,
  type DbClient,
  TEAMS_ERROR_HTTP_STATUS,
  TEAMS_ERROR_MESSAGES,
  TeamsError,
  type TeamsErrorCode,
} from '@zidney/domain-core/teams'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

const logger = createLogger('backoffice-teams')

// ---------------------------------------------------------------------------
// Database Access
// ---------------------------------------------------------------------------

/**
 * Extract tenant database client from Hono context.
 */
export function getDb(c: Context): DbClient {
  const tenant = c.get('tenant')
  if (!tenant?.pool) {
    logger.error('Tenant pool not available in context', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
    })
    throw new Error('Tenant pool not initialized')
  }
  return tenant.pool
}

// ---------------------------------------------------------------------------
// Audit Context
// ---------------------------------------------------------------------------

/**
 * Build audit context from Hono request context.
 */
export function buildAuditCtx(c: Context): AuditContext {
  const user = c.get('user')
  if (!user?.id) {
    logger.error('User not present in context', {
      correlation_id: c.get('correlation_id'),
    })
    throw new Error('User not authenticated')
  }

  return {
    user_id: user.id,
    correlation_id: c.get('correlation_id') || '',
    workspace_slug: c.get('workspace_slug') || '',
    workspace_id: c.get('workspace_id') || '',
  }
}

// ---------------------------------------------------------------------------
// Error Response Mapping
// ---------------------------------------------------------------------------

interface ErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
  }
}

/**
 * Map a teams-domain error (or raw PG error) to an HTTP response.
 *
 * PG error codes are checked FIRST because a raw pg error thrown
 * by the pool driver is not an instanceof TeamsError.
 *
 *   55P03 — lock not available (NOWAIT refused)
 *   23503 — foreign key violation (staff_id or team_type_id missing)
 */
export function teamsErrorResponse(c: Context, err: unknown): Response {
  const correlationId = c.get('correlation_id')
  const workspaceId = c.get('workspace_id')

  // Check raw Postgres error codes first.
  if (err !== null && typeof err === 'object' && 'code' in err) {
    const pgCode = (err as { code: string }).code
    if (pgCode === '55P03') {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'TEAM_LOCK_CONTENTION',
            message: TEAMS_ERROR_MESSAGES.TEAM_LOCK_CONTENTION,
          },
        },
        422
      )
    }
    if (pgCode === '23503') {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'STAFF_NOT_FOUND',
            message: TEAMS_ERROR_MESSAGES.STAFF_NOT_FOUND,
          },
        },
        404
      )
    }
  }

  // Handle structured domain errors.
  if (err instanceof TeamsError) {
    logger.warn('Teams domain error', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      error_code: err.code,
      error_message: err.message,
    })

    const httpStatus = TEAMS_ERROR_HTTP_STATUS[err.code as TeamsErrorCode] || 500
    const response: ErrorResponse = {
      success: false,
      data: null,
      error: {
        code: err.code,
        message: err.message || TEAMS_ERROR_MESSAGES[err.code as TeamsErrorCode] || 'Unknown error',
      },
    }
    return c.json(response, httpStatus)
  }

  // Zod validation errors.
  if (
    err !== null &&
    typeof err === 'object' &&
    'name' in err &&
    (err as { name: string }).name === 'ZodError'
  ) {
    return c.json(
      {
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request data' },
      },
      422
    )
  }

  // Fallback 500.
  logger.error('Unexpected error in teams route', {
    correlation_id: correlationId,
    workspace_id: workspaceId,
    error_name: err instanceof Error ? err.name : typeof err,
    error_message: err instanceof Error ? err.message : String(err),
  })

  return c.json(
    {
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    },
    500
  )
}

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a string is a valid UUID v4.
 */
export function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

// ---------------------------------------------------------------------------
// JSON Response Envelope
// ---------------------------------------------------------------------------

interface SuccessResponse<T> {
  success: true
  data: T
  error: null
}

/**
 * Wrap arbitrary data in success envelope.
 */
export function successResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    error: null,
  }
}
