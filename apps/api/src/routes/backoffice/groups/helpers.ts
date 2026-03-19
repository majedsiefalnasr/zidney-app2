/**
 * Groups Route Helpers — STAGE_24
 *
 * File: apps/api/src/routes/backoffice/groups/helpers.ts
 *
 * Shared utilities, error mappers, and context builders for groups routes.
 */

import {
  type AuditContext,
  type DbClient,
  GROUPS_ERROR_HTTP_STATUS,
  GROUPS_ERROR_MESSAGES,
  GroupsError,
  type GroupsErrorCode,
} from '@zidney/domain-core/groups'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

const logger = createLogger('backoffice-groups')

// ---------------------------------------------------------------------------
// Database Access
// ---------------------------------------------------------------------------

/**
 * Extract tenant database client from Hono context.
 * Ensures tenant resolver middleware has already populated context.
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
 * Ensures all audit-tracked operations include user ID, workspace context, and correlation ID.
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
 * Map GroupsError to HTTP response.
 * Handles all 13 GroupsErrorCode variants with correct HTTP status codes and message text.
 */
export function groupErrorResponse(c: Context, err: unknown): Response {
  const correlationId = c.get('correlation_id')
  const workspaceId = c.get('workspace_id')

  // If not a GroupsError, treat as generic 500
  if (!(err instanceof GroupsError)) {
    logger.error('Non-groups error in groups route', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      error_name: err instanceof Error ? err.name : typeof err,
      error_message: err instanceof Error ? err.message : String(err),
    })

    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      500
    )
  }

  // Log the groups-specific error
  logger.warn('Groups domain error', {
    correlation_id: correlationId,
    workspace_id: workspaceId,
    error_code: err.code,
    error_message: err.message,
  })

  // Get HTTP status; default to 500 if code not in map
  const httpStatus = GROUPS_ERROR_HTTP_STATUS[err.code as GroupsErrorCode] || 500

  const response: ErrorResponse = {
    success: false,
    data: null,
    error: {
      code: err.code,
      message: err.message || GROUPS_ERROR_MESSAGES[err.code as GroupsErrorCode] || 'Unknown error',
    },
  }

  return c.json(response, httpStatus)
}

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

/**
 * Check if string is a valid UUID v4.
 * Used to guard routes before processing path parameters.
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
 * Used by all GET/POST/PATCH/PUT/DELETE handlers.
 */
export function successResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    error: null,
  }
}
