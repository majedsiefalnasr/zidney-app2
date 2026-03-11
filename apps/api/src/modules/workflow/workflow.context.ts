/**
 * Workflow Context Builder
 *
 * File: apps/api/src/modules/workflow/workflow.context.ts
 * Stage: STAGE_20_STATUS_WORKFLOW_ENGINE
 * Date: 2026-03-01
 *
 * Extracts WorkflowContext from the Hono request context and validated
 * request body. Reads tenant slug, tenant id, actor id, permissions,
 * and correlation id entirely from middleware-set context variables.
 *
 * Constitutional Compliance:
 * ✓ workspaceSlug and workspaceId come from tenant resolver context,
 *   NOT from request body (ADR-0001, tenant isolation rule)
 * ✓ actorId comes from JWT payload set by auth middleware
 * ✓ correlationId propagated from x-correlation-id header
 * ✓ No DB access — pure context extraction
 * ✓ No business logic
 */

import { randomUUID } from 'node:crypto'
import type { WorkflowState } from '@zidney/domain-core'
import type { Context } from 'hono'

import type { TransitionRequestBody } from './workflow.validation'

/**
 * Build a WorkflowContext from the Hono request context (c) and
 * validated request body, plus the entity route parameters.
 *
 * @param c          - Hono context
 * @param entityType - From :entityType path param
 * @param entityId   - From :entityId path param
 * @param body       - Validated TransitionRequestBody
 * @returns WorkflowContext ready for executeTransition()
 */
export function buildWorkflowContext(
  c: Context,
  entityType: string,
  entityId: string,
  body: TransitionRequestBody
): import('@zidney/domain-core').WorkflowContext {
  const tenant = c.get('tenant')
  const staffUser = c.get('staff_user')

  // correlationId propagated from global correlationId middleware or generated
  const correlationId: string =
    c.get('correlationId') ?? c.req.header('x-correlation-id') ?? randomUUID()

  // permissions[] resolved by auth middleware — falls back to empty array
  // if not yet set (route handler should ensure auth middleware runs first)
  const permissions: string[] = (c.get('permissions') as string[]) ?? []

  return {
    entityType,
    entityId,
    targetState: body.target_state as WorkflowState,
    actorId: staffUser?.user_id ?? 'unknown',
    permissions,
    reason: body.reason,
    correlationId,
    // workspaceSlug and workspaceId MUST come from tenant resolver,
    // never from request body — tenant isolation guarantee
    workspaceSlug: tenant?.slug ?? 'unknown',
    workspaceId: tenant?.id ?? 'unknown',
  }
}
