/**
 * Workflow API Validation Schemas
 *
 * File: apps/api/src/modules/workflow/workflow.validation.ts
 * Stage: STAGE_20_STATUS_WORKFLOW_ENGINE
 * Date: 2026-03-01
 *
 * Zod schemas for workflow transition API request body validation.
 *
 * Constitutional Compliance:
 * ✓ All inputs validated with Zod before any DB or domain service call
 * ✓ No business logic — pure schema definitions
 * ✓ No DB imports
 */

import { z } from 'zod'

// -------------------------------------------------------------------------
// TransitionRequestSchema — POST body for transition endpoint
// -------------------------------------------------------------------------

/**
 * Zod schema for the POST /:entityType/:entityId/transition request body.
 *
 * target_state: One of the four valid WorkflowState values.
 * reason:       Optional justification — required by engine for backward
 *               transitions (validation deferred to engine per FR-005).
 */
export const TransitionRequestSchema = z.object({
  target_state: z.enum(['COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED'], {
    errorMap: () => ({
      message: "target_state must be one of 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED'",
    }),
  }),
  reason: z.string().optional(),
})

/** Inferred TypeScript type for the validated request body */
export type TransitionRequestBody = z.infer<typeof TransitionRequestSchema>
