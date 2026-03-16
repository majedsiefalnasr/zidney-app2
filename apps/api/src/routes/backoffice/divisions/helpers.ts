/**
 * Divisions Route Helpers — STAGE_22
 *
 * File: apps/api/src/routes/backoffice/divisions/helpers.ts
 *
 * Shared utilities for all 8 division route handlers:
 *   - getDb(c)              — extracts the tenant-scoped Pool (satisfies DbClient)
 *   - buildAuditCtx(c)      — builds AuditContext from Hono Variables
 *   - divisionErrorResponse — maps DivisionsError to the standard JSON envelope
 *   - isValidUuid           — lightweight UUID format guard
 *
 * Constitutional Compliance:
 * ✓ No business logic — pure extraction and mapping utilities
 * ✓ All DB access flows through the tenant-scoped Pool injected by middleware
 * ✓ Structured error response matches platform envelope: { success, data, error }
 */

import type { AuditContext } from '@zidney/domain-core/divisions'
import { DivisionsError } from '@zidney/domain-core/divisions'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'

import type { BackofficeEnv } from '../types'

const logger = createLogger('backoffice-divisions')

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------------
// getDb
// ---------------------------------------------------------------------------

/**
 * Extracts the tenant-scoped pg.Pool from Hono context.
 *
 * pg.Pool is structurally compatible with the divisions DbClient interface —
 * pool.query(sql, params) returns { rows, rowCount } as expected.
 */
export function getDb(c: Context<BackofficeEnv>) {
  return c.get('tenant').pool
}

// ---------------------------------------------------------------------------
// buildAuditCtx
// ---------------------------------------------------------------------------

/**
 * Builds an AuditContext from the current Hono request context.
 * All fields are injected by upstream middleware before handlers execute.
 */
export function buildAuditCtx(c: Context<BackofficeEnv>): AuditContext {
  const tenant = c.get('tenant')
  const staff_user = c.get('staff_user')
  const correlationId = c.get('correlationId') || 'unknown'

  return {
    user_id: staff_user?.user_id ?? 'unknown',
    request_id: correlationId,
    workspace_slug: tenant?.slug ?? 'unknown',
    workspace_id: tenant?.id ?? 'unknown',
  }
}

// ---------------------------------------------------------------------------
// divisionErrorResponse
// ---------------------------------------------------------------------------

/**
 * Maps a thrown error to its canonical HTTP response.
 *
 * DivisionsError → uses err.httpStatus + err.code + err.message
 * Any other error → 500 with INTERNAL_ERROR code, detail masked from client
 */
export function divisionErrorResponse(c: Context, err: unknown): Response {
  if (err instanceof DivisionsError) {
    const status = err.httpStatus as 404 | 409 | 422 | 423
    return c.json(
      {
        success: false,
        data: null,
        error: { code: err.code, message: err.message },
      },
      status
    )
  }

  // Unexpected error — mask detail from client, log with correlation_id
  const correlationId = (c as Context<BackofficeEnv>).get('correlationId') || 'unknown'
  logger.error({
    event: 'divisions_unexpected_error',
    correlation_id: correlationId,
    error: err instanceof Error ? err.message : String(err),
  })

  return c.json(
    {
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    },
    500
  )
}

// ---------------------------------------------------------------------------
// isValidUuid
// ---------------------------------------------------------------------------

/**
 * Returns true if the string is a valid RFC 4122 UUID.
 * Used for fast path-param validation before calling service functions.
 */
export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}
