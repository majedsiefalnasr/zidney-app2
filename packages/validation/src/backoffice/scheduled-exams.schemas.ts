/**
 * Scheduled Exams Validation Schemas
 *
 * File: packages/validation/src/backoffice/scheduled-exams.schemas.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 *
 * Zod schemas for all scheduled exam API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 100

const examTypeSchema = z.enum(['MCQ', 'TRADITIONAL'])
const workflowStatusSchema = z.enum(['APPROVED', 'ENABLED'])

// ── Path Params ──────────────────────────────────────────────────────────────

export const scheduledExamIdParamSchema = z.object({
  scheduledExamId: z.string().uuid('scheduledExamId must be a valid UUID'),
})

export const attemptIdParamSchema = z.object({
  attemptId: z.string().uuid('attemptId must be a valid UUID'),
})

// ── List Scheduled Exams Query ────────────────────────────────────────────────

export const listScheduledExamsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_PAGE))
    .pipe(z.number().int().min(1)),
  per_page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_PER_PAGE))
    .pipe(z.number().int().min(1).max(MAX_PER_PAGE)),
  base_exam_id: z.string().uuid().optional(),
  exam_type: examTypeSchema.optional(),
  workflow_status: workflowStatusSchema.optional(),
  search: z.string().max(255).optional(),
})

// ── Create Scheduled Exam Body ────────────────────────────────────────────────

export const createScheduledExamSchema = z
  .object({
    base_exam_id: z.string().uuid('base_exam_id must be a valid UUID'),
    exam_type: examTypeSchema,
    name: z.string().min(1, 'name is required').max(255),
    code: z
      .string()
      .min(1, 'code is required')
      .max(100)
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        'code must contain only alphanumeric characters, hyphens, and underscores'
      ),
    start_datetime: z
      .string()
      .datetime({ message: 'start_datetime must be a valid ISO 8601 UTC datetime' }),
    end_datetime: z
      .string()
      .datetime({ message: 'end_datetime must be a valid ISO 8601 UTC datetime' }),
    late_tolerance_minutes: z.number().int().min(0).default(5),
    allow_single_attempt: z.boolean().default(false),
    reminder_before_start: z.boolean().default(false),
    reminder_before_end: z.boolean().default(false),
  })
  .refine((data) => new Date(data.end_datetime) > new Date(data.start_datetime), {
    message: 'end_datetime must be after start_datetime',
    path: ['end_datetime'],
  })

// ── Update Scheduled Exam Body ────────────────────────────────────────────────

export const updateScheduledExamSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    code: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
    start_datetime: z.string().datetime().optional(),
    end_datetime: z.string().datetime().optional(),
    late_tolerance_minutes: z.number().int().min(0).optional(),
    allow_single_attempt: z.boolean().optional(),
    reminder_before_start: z.boolean().optional(),
    reminder_before_end: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.start_datetime && data.end_datetime) {
        return new Date(data.end_datetime) > new Date(data.start_datetime)
      }
      return true
    },
    {
      message: 'end_datetime must be after start_datetime',
      path: ['end_datetime'],
    }
  )

// ── Workflow Transition Body ──────────────────────────────────────────────────

export const workflowTransitionSchema = z.object({
  action: z.literal('ENABLE'),
  base_exam_snapshot: z.record(z.unknown()).optional(),
})

// ── Re-approve Body ───────────────────────────────────────────────────────────

export const reApproveSchema = z.object({}).optional()
