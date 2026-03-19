/**
 * Hierarchy Route Helpers — STAGE_25
 */

import {
  type AuditContext,
  type DbClient,
  HIERARCHY_ERROR_HTTP_STATUS,
  HIERARCHY_ERROR_MESSAGES,
  HierarchyError,
} from '@zidney/domain-core/hierarchy'
import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'
import type { ZodError } from 'zod'

import type { BackofficeEnv } from '../types'

const logger = createLogger('backoffice-hierarchy')

function isZodError(err: unknown): err is ZodError {
  return typeof err === 'object' && err !== null && 'issues' in err
}

function toHierarchyError(
  err: unknown
): { code: string; message: string; httpStatus: number } | null {
  if (!(err instanceof HierarchyError)) {
    return null
  }

  return {
    code: err.code,
    message: err.message,
    httpStatus: err.httpStatus,
  }
}

function toPgError(err: unknown): { code?: string; constraint?: string; message?: string } | null {
  if (typeof err !== 'object' || err === null) {
    return null
  }

  const candidate = err as { code?: string; constraint?: string; message?: string }
  if (!('code' in candidate) && !('constraint' in candidate)) {
    return null
  }

  return candidate
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }

  return String(err)
}

export function getDb(c: Context<BackofficeEnv>): DbClient {
  const tenant = c.get('tenant')
  if (!tenant?.pool) {
    throw new Error('Tenant pool not initialized')
  }
  return tenant.pool
}

export function buildAuditCtx(c: Context<BackofficeEnv>): AuditContext {
  const tenant = c.get('tenant')
  const staffUser = c.get('staff_user')
  const legacyUserId = c.get('userId') as string | undefined

  return {
    user_id: staffUser?.user_id ?? legacyUserId ?? 'unknown',
    correlation_id: c.get('correlationId') ?? 'unknown',
    workspace_slug: tenant?.slug ?? 'unknown',
    workspace_id: tenant?.id ?? 'unknown',
  }
}

export function successResponse<T>(data: T) {
  return {
    success: true as const,
    data,
    error: null,
  }
}

function errorBody(code: string, message: string, correlationId: string) {
  return {
    success: false as const,
    data: null,
    error: {
      code,
      message,
      correlationId,
    },
  }
}

export function hierarchyErrorResponse(c: Context<BackofficeEnv>, err: unknown): Response {
  const correlationId = c.get('correlationId') ?? 'unknown'
  const tenant = c.get('tenant')

  if (isZodError(err)) {
    const message = err.issues[0]?.message ?? HIERARCHY_ERROR_MESSAGES.VALIDATION_ERROR
    return c.json(errorBody('VALIDATION_ERROR', message, correlationId), 422)
  }

  const hierarchyError = toHierarchyError(err)
  if (hierarchyError) {
    return c.json(
      errorBody(hierarchyError.code, hierarchyError.message, correlationId),
      hierarchyError.httpStatus as 404 | 409 | 422 | 503
    )
  }

  const pgError = toPgError(err)
  if (pgError) {
    if (pgError.code === '23505') {
      return c.json(
        errorBody(
          'HIERARCHY_NODE_NAME_DUPLICATE',
          HIERARCHY_ERROR_MESSAGES.HIERARCHY_NODE_NAME_DUPLICATE,
          correlationId
        ),
        409
      )
    }

    if (pgError.code === '23503') {
      const constraint = pgError.constraint ?? ''

      if (constraint === 'hierarchy_nodes_parent_id_fkey') {
        return c.json(
          errorBody(
            'HIERARCHY_NODE_HAS_CHILDREN',
            HIERARCHY_ERROR_MESSAGES.HIERARCHY_NODE_HAS_CHILDREN,
            correlationId
          ),
          422
        )
      }

      if (constraint === 'users_hierarchy_node_id_fkey') {
        return c.json(
          errorBody(
            'HIERARCHY_NODE_HAS_STAFF',
            HIERARCHY_ERROR_MESSAGES.HIERARCHY_NODE_HAS_STAFF,
            correlationId
          ),
          422
        )
      }

      return c.json(
        errorBody(
          'HIERARCHY_NODE_DEPENDENCY_VIOLATION',
          HIERARCHY_ERROR_MESSAGES.HIERARCHY_NODE_DEPENDENCY_VIOLATION,
          correlationId
        ),
        HIERARCHY_ERROR_HTTP_STATUS.HIERARCHY_NODE_DEPENDENCY_VIOLATION as 422
      )
    }

    if (pgError.code === '57014') {
      return c.json(
        errorBody(
          'HIERARCHY_TRAVERSAL_TIMEOUT',
          HIERARCHY_ERROR_MESSAGES.HIERARCHY_TRAVERSAL_TIMEOUT,
          correlationId
        ),
        503
      )
    }
  }

  logger.error('Unexpected hierarchy route error', {
    workspace_slug: tenant?.slug,
    workspace_id: tenant?.id,
    correlation_id: correlationId,
    error: getErrorMessage(err),
  })

  return c.json(errorBody('INTERNAL_ERROR', 'An unexpected error occurred', correlationId), 500)
}
