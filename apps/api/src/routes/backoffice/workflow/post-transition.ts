/**
 * Workflow Route — POST /:entityType/:entityId/transition
 *
 * File: apps/api/src/routes/backoffice/workflow/post-transition.ts
 * Stage: STAGE_20_STATUS_WORKFLOW_ENGINE
 * Date: 2026-03-01
 *
 * Handles a single workflow state transition for any registered entity type.
 * Zero business logic — delegates entirely to executeTransition() in the
 * domain package.
 *
 * Middleware chain (applied at router level in index.ts):
 *   correlationId → tenantResolver → licenseEnforcement → schemaVersion
 *   → rateLimit(60 global) → authentication → workflowRateLimit(20/actor/entityType)
 *
 * Constitutional Compliance:
 * ✓ No business logic in route handler
 * ✓ tenantDb injected via c.get('tenant').pool — no global DB singleton
 * ✓ WorkflowContext built from middleware-set context variables only
 * ✓ Standard Zidney error envelope on failure
 * ✓ Structured logging via @zidney/logger — no console.log
 */

import { executeTransition, WorkflowError } from '@zidney/domain-core'
import { createLogger } from '@zidney/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HonoContext = any

import { buildWorkflowContext } from '../../../modules/workflow/workflow.context'
import { TransitionRequestSchema } from '../../../modules/workflow/workflow.validation'

const logger = createLogger('workflow-routes')

/**
 * POST /:entityType/:entityId/transition
 *
 * Validates request, builds WorkflowContext, calls executeTransition,
 * returns standard success or error envelope.
 */
export async function handlePostTransition(c: HonoContext): Promise<Response> {
  const entityType = c.req.param('entityType') as string
  const entityId = c.req.param('entityId') as string
  const db = c.get('tenant')?.pool

  // Parse + validate request body
  let body: import('../../../modules/workflow/workflow.validation').TransitionRequestBody
  try {
    const rawBody = await c.req.json()
    const parseResult = TransitionRequestSchema.safeParse(rawBody)
    if (!parseResult.success) {
      const correlationId = c.get('correlationId') ?? c.req.header('x-correlation-id') ?? 'unknown'
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'validation_error',
            message: parseResult.error.errors
              .map(
                (e: { path: Array<string | number>; message: string }) =>
                  `${e.path.join('.')}: ${e.message}`
              )
              .join('; '),
            details: null,
            correlationId,
          },
        },
        422
      )
    }
    body = parseResult.data
  } catch {
    const correlationId = c.get('correlationId') ?? c.req.header('x-correlation-id') ?? 'unknown'
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'validation_error',
          message: 'Request body must be valid JSON.',
          details: null,
          correlationId,
        },
      },
      422
    )
  }

  // Build WorkflowContext from Hono context + validated body
  const ctx = buildWorkflowContext(c, entityType, entityId, body)

  try {
    const result = await executeTransition(db, ctx)

    return c.json(
      {
        success: true,
        data: result,
        error: null,
      },
      200
    )
  } catch (err) {
    if (err instanceof WorkflowError) {
      const status = err.httpStatus as 400 | 403 | 404 | 409 | 429
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: err.code,
            message: err.message,
            details: null,
            correlationId: ctx.correlationId,
          },
        },
        status
      )
    }

    // Unexpected error — mask from client, log server-side
    logger.error({
      event: 'workflow_route_error',
      workspace_slug: ctx.workspaceSlug,
      workspace_id: ctx.workspaceId,
      correlation_id: ctx.correlationId,
      entity_type: ctx.entityType,
      entity_id: ctx.entityId,
      actor_id: ctx.actorId,
      error: err instanceof Error ? err.message : String(err),
    })

    // Rethrow — bubble to global error handler
    throw err
  }
}
