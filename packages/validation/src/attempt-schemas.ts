/**
 * Attempt Engine Validation Schemas — STAGE_06
 *
 * Purpose: Input validation for all attempt operations
 * Used by: Route handlers for POST /attempts, POST /progress, POST /submit
 *
 * Tasks:
 * - T019: Attempt creation validation schema
 * - T020: Progress update validation schema
 * - T021: Submission validation logic
 *
 * Phase: B – Middleware Integration
 * Stage: STAGE_06_ATTEMPT_ENGINE_FOUNDATION
 *
 * Constitutional Compliance:
 * - All validation is parameterized (no injection)
 * - Validation happens BEFORE business logic
 * - Clear error messages for invalid requests
 * - Type-safe validation with strict TypeScript
 */

import { Logger } from '@zidney/logging'
import { z } from 'zod'

// ============================================================================
// T019: Attempt Creation Validation Schema
// ============================================================================

/**
 * Validate attempt creation request (POST /attempts)
 *
 * Request body should contain:
 * - exam_id: UUID of exam to attempt
 * - attempt_notes: Optional notes from student
 */
export const createAttemptRequestSchema = z.object({
  exam_id: z
    .string()
    .uuid('exam_id must be a valid UUID')
    .describe('UUID of exam to attempt'),
  attempt_notes: z
    .string()
    .max(1000, 'attempt_notes must be under 1000 characters')
    .optional()
    .describe('Optional notes from student'),
})

export type CreateAttemptRequest = z.infer<typeof createAttemptRequestSchema>

/**
 * Validate attempt creation request and return typed result
 */
export function validateCreateAttemptRequest(
  body: any,
  logger: Logger,
  correlation_id: string
): { valid: boolean; data?: CreateAttemptRequest; errors?: string[] } {
  try {
    const result = createAttemptRequestSchema.parse(body)
    return { valid: true, data: result }
  } catch (error) {
    const errors = (error as z.ZodError).errors.map((e) => {
      const path = e.path.join('.')
      return `${path || 'body'}: ${e.message}`
    })

    logger.warn('Attempt creation validation failed', {
      correlation_id,
      errors,
      body: body ? Object.keys(body).join(',') : 'empty',
    })

    return { valid: false, errors }
  }
}

// ============================================================================
// T020: Progress Update Validation Schema
// ============================================================================

/**
 * Single question response submission
 * question_id: UUID of question being answered
 * user_answer: Typed answer (format depends on question_type)
 * flagged: Boolean indicating if student flagged for review
 */
export const questionResponseSchema = z.object({
  question_id: z
    .string()
    .uuid('question_id must be a valid UUID')
    .describe('UUID of question'),
  user_answer: z.unknown().describe('Answer in question-type-specific format'),
  flagged: z
    .boolean()
    .default(false)
    .describe('Is question flagged for review?'),
})

export type QuestionResponse = z.infer<typeof questionResponseSchema>

/**
 * Progress update request schema (POST /attempts/:id/progress)
 *
 * Request body should contain:
 * - responses: Array of question responses
 */
export const updateProgressRequestSchema = z.object({
  responses: z
    .array(questionResponseSchema)
    .min(1, 'Must provide at least one response')
    .max(500, 'Cannot submit more than 500 responses at once')
    .describe('Array of question responses'),
})

export type UpdateProgressRequest = z.infer<typeof updateProgressRequestSchema>

/**
 * Validate progress update request
 */
export function validateUpdateProgressRequest(
  body: any,
  logger: Logger,
  correlation_id: string
): {
  valid: boolean
  data?: UpdateProgressRequest
  errors?: string[]
} {
  try {
    const result = updateProgressRequestSchema.parse(body)

    // Additional validation: Check response count
    if (result.responses.length === 0) {
      return {
        valid: false,
        errors: ['responses: Must provide at least one response'],
      }
    }

    return { valid: true, data: result }
  } catch (error) {
    const errors = (error as z.ZodError).errors.map((e) => {
      const path = e.path.join('.')
      return `${path || 'body'}: ${e.message}`
    })

    logger.warn('Progress update validation failed', {
      correlation_id,
      errors,
      response_count: body?.responses?.length,
    })

    return { valid: false, errors }
  }
}

// ============================================================================
// T021: Submission Validation Logic
// ============================================================================

/**
 * Submission reason enum
 */
export enum SubmissionReason {
  MANUAL_SUBMIT = 'MANUAL_SUBMIT',
  AUTO_TIMEOUT = 'AUTO_TIMEOUT',
  AUTO_REDIRECT = 'AUTO_REDIRECT',
}

/**
 * Submission request schema (POST /attempts/:id/submit)
 *
 * Request body should contain:
 * - submission_reason: Why is attempt being submitted?
 * - idempotency_key: Optional UUID for request deduplication
 */
export const submitAttemptRequestSchema = z.object({
  submission_reason: z
    .enum(['MANUAL_SUBMIT', 'AUTO_TIMEOUT', 'AUTO_REDIRECT'])
    .default('MANUAL_SUBMIT')
    .describe('Reason for submission'),
  idempotency_key: z
    .string()
    .uuid('idempotency_key must be a valid UUID')
    .optional()
    .describe('Optional UUID for request deduplication'),
})

export type SubmitAttemptRequest = z.infer<typeof submitAttemptRequestSchema>

/**
 * Validate submission request
 */
export function validateSubmitAttemptRequest(
  body: any,
  logger: Logger,
  correlation_id: string
): {
  valid: boolean
  data?: SubmitAttemptRequest
  errors?: string[]
} {
  try {
    const result = submitAttemptRequestSchema.parse(body)
    return { valid: true, data: result }
  } catch (error) {
    const errors = (error as z.ZodError).errors.map((e) => {
      const path = e.path.join('.')
      return `${path || 'body'}: ${e.message}`
    })

    logger.warn('Submission validation failed', {
      correlation_id,
      errors,
      body: body ? Object.keys(body).join(',') : 'empty',
    })

    return { valid: false, errors }
  }
}

/**
 * Additional business logic validation for submission
 * (Called after schema validation)
 *
 * Validates:
 * 1. Attempt exists and belongs to user
 * 2. Attempt is IN_PROGRESS
 * 3. Not already submitted
 * 4. Within time limit (or grace period)
 */
export interface SubmissionBusinessValidation {
  valid: boolean
  error?: {
    code: string
    message: string
    http_status: number
  }
}

/**
 * Validate submission business logic
 *
 * Usage:
 * ```
 * const validation = await validateSubmissionBusiness(
 *   tenantDb,
 *   attempt_id,
 *   user_id,
 *   workspace_id,
 *   logger,
 *   correlation_id
 * )
 *
 * if (!validation.valid) {
 *   return c.json(
 *     { success: false, data: null, error: validation.error },
 *     validation.error!.http_status
 *   )
 * }
 * ```
 */
export async function validateSubmissionBusiness(
  tenantDb: any,
  attempt_id: string,
  user_id: string,
  workspace_id: string,
  logger: Logger,
  correlation_id: string
): Promise<SubmissionBusinessValidation> {
  try {
    // Query attempt
    const result = await tenantDb.query(
      `
      SELECT
        id,
        status,
        user_id,
        submitted_at,
        started_at,
        time_limit_snapshot
      FROM attempts
      WHERE
        id = $1
        AND workspace_id = $2
        AND user_id = $3
      LIMIT 1
      `,
      [attempt_id, workspace_id, user_id]
    )

    // Attempt not found or doesn't belong to user
    if (result.rows.length === 0) {
      logger.warn('Submission validation: Attempt not found', {
        correlation_id,
        attempt_id,
        workspace_id,
        user_id,
      })
      return {
        valid: false,
        error: {
          code: 'ATTEMPT_NOT_FOUND',
          message: 'Attempt not found or does not belong to this user',
          http_status: 404,
        },
      }
    }

    const attempt = result.rows[0]

    // Verify status is IN_PROGRESS
    if (attempt.status !== 'IN_PROGRESS') {
      logger.warn('Submission validation: Attempt not in progress', {
        correlation_id,
        attempt_id,
        status: attempt.status,
      })

      if (attempt.status === 'SUBMITTED' || attempt.status === 'FINALIZED') {
        return {
          valid: false,
          error: {
            code: 'ATTEMPT_ALREADY_SUBMITTED',
            message: 'Attempt has already been submitted',
            http_status: 409,
          },
        }
      }

      return {
        valid: false,
        error: {
          code: 'ATTEMPT_INVALID_STATUS',
          message: `Cannot submit attempt with status: ${attempt.status}`,
          http_status: 409,
        },
      }
    }

    // Verify not already submitted
    if (attempt.submitted_at !== null) {
      logger.warn('Submission validation: Already has submitted_at', {
        correlation_id,
        attempt_id,
        submitted_at: attempt.submitted_at,
      })
      return {
        valid: false,
        error: {
          code: 'ATTEMPT_ALREADY_SUBMITTED',
          message: 'Attempt has already been submitted',
          http_status: 409,
        },
      }
    }

    // Verify within time limit (+ 30s grace period)
    const time_limit_ms = attempt.time_limit_snapshot
    const grace_period_ms = 30 * 1000 // 30 seconds
    const elapsed_ms =
      new Date().getTime() - new Date(attempt.started_at).getTime()
    const max_allowed_ms = time_limit_ms + grace_period_ms

    if (elapsed_ms > max_allowed_ms) {
      logger.warn('Submission validation: Attempt expired', {
        correlation_id,
        attempt_id,
        elapsed_ms,
        time_limit_ms,
        grace_period_ms,
      })
      return {
        valid: false,
        error: {
          code: 'ATTEMPT_EXPIRED',
          message: 'Attempt has exceeded time limit and grace period',
          http_status: 410, // Gone
        },
      }
    }

    logger.debug('Submission validation passed', {
      correlation_id,
      attempt_id,
      status: attempt.status,
    })

    return { valid: true }
  } catch (error) {
    logger.error('Submission business validation error', {
      correlation_id,
      attempt_id,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Failed to validate submission',
        http_status: 500,
      },
    }
  }
}

export default {
  validateCreateAttemptRequest,
  validateUpdateProgressRequest,
  validateSubmitAttemptRequest,
  validateSubmissionBusiness,
}
