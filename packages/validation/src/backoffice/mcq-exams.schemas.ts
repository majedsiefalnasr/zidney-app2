/**
 * MCQ Exams Validation Schemas
 *
 * File: packages/validation/src/backoffice/mcq-exams.schemas.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 *
 * Zod schemas for all MCQ exams API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 100

const selectionModeSchema = z.enum(['MANUAL', 'AUTOMATIC'])
const passTypeSchema = z.enum(['PERCENTAGE', 'SCORE'])
const examStatusSchema = z.enum(['DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED'])

// ── Path Params ──────────────────────────────────────────────────────────────

export const examIdParamSchema = z.object({
  examId: z.string().uuid('examId must be a valid UUID'),
})

export const examQuestionParamSchema = z.object({
  examId: z.string().uuid('examId must be a valid UUID'),
  questionId: z.string().uuid('questionId must be a valid UUID'),
})

// ── List Exams Query ─────────────────────────────────────────────────────────

export const listExamsQuerySchema = z.object({
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
  subject_id: z.string().uuid().optional(),
  division_id: z.string().uuid().optional(),
  selection_mode: selectionModeSchema.optional(),
  status: examStatusSchema.optional(),
  search: z.string().max(255).optional(),
})

// ── Create Exam Body ─────────────────────────────────────────────────────────

export const createExamBodySchema = z.object({
  name: z.string().min(1, 'name is required').max(500),
  code: z
    .string()
    .min(1, 'code is required')
    .max(100)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'code must contain only alphanumeric characters, hyphens, and underscores'
    ),
  description: z.string().max(5000).nullable().optional(),
  subjectId: z.string().uuid('subjectId must be a valid UUID'),
  divisionId: z.string().uuid('divisionId must be a valid UUID').nullable().optional(),
  language: z.string().min(1, 'language is required').max(10),
  totalQuestions: z.number().int().min(1, 'totalQuestions must be at least 1'),
  durationMinutes: z.number().int().min(1).nullable().optional(),
  passType: passTypeSchema,
  passValue: z.number().min(0.01, 'passValue must be greater than 0'),
  allowMultipleAttempts: z.boolean().optional().default(false),
  selectionMode: selectionModeSchema,
})

// ── Update Exam Body ─────────────────────────────────────────────────────────

export const updateExamBodySchema = z
  .object({
    name: z.string().min(1).max(500).optional(),
    code: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
    description: z.union([z.string().max(5000), z.null()]).optional(),
    divisionId: z.union([z.string().uuid(), z.null()]).optional(),
    language: z.string().min(1).max(10).optional(),
    totalQuestions: z.number().int().min(1).optional(),
    durationMinutes: z.union([z.number().int().min(1), z.null()]).optional(),
    passType: passTypeSchema.optional(),
    passValue: z.number().min(0.01).optional(),
    allowMultipleAttempts: z.boolean().optional(),
    selectionMode: selectionModeSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  })

// ── Upsert Settings Body ────────────────────────────────────────────────────

export const upsertSettingsBodySchema = z.object({
  allowRelaxMode: z.boolean().optional(),
  allowChronoMode: z.boolean().optional(),
  allowRushMode: z.boolean().optional(),
  allowReviewAnswers: z.boolean().optional(),
  allowReviewHints: z.boolean().optional(),
  allowResultEffects: z.boolean().optional(),
  showResultsAfterSubmit: z.boolean().optional(),
  showCorrectAnswers: z.boolean().optional(),
  showExplanations: z.boolean().optional(),
  enableCertificate: z.boolean().optional(),
  messageTemplateId: z.union([z.string().uuid(), z.null()]).optional(),
})

// ── Add Questions Body ───────────────────────────────────────────────────────

const questionOrderEntrySchema = z.object({
  questionId: z.string().uuid('questionId must be a valid UUID'),
  orderIndex: z.number().int().min(0),
})

export const addQuestionsBodySchema = z.object({
  questions: z.array(questionOrderEntrySchema).min(1, 'at least one question is required'),
})

// ── Reorder Questions Body ───────────────────────────────────────────────────

export const reorderQuestionsBodySchema = z.object({
  order: z.array(questionOrderEntrySchema).min(1, 'at least one question order entry is required'),
})

// ── Set Criteria Body ────────────────────────────────────────────────────────

const criteriaEntrySchema = z
  .object({
    lessonIds: z.array(z.string().uuid()).nullable().optional(),
    categoryValueIds: z.array(z.string().uuid()).nullable().optional(),
    tagIds: z.array(z.string().uuid()).nullable().optional(),
    basketIds: z.array(z.string().uuid()).nullable().optional(),
    categoryIds: z.array(z.string().uuid()).nullable().optional(),
    semesterId: z.string().uuid().nullable().optional(),
    percentage: z.number().int().min(1).max(100).nullable().optional(),
    fixedCount: z.number().int().min(1).nullable().optional(),
  })
  .refine((d) => (d.percentage != null) !== (d.fixedCount != null), {
    message: 'Exactly one of percentage or fixedCount must be provided per criteria entry',
  })

export const setCriteriaBodySchema = z.object({
  criteria: z.array(criteriaEntrySchema).min(1, 'at least one criteria entry is required'),
})

// ── Workflow Transition Body ─────────────────────────────────────────────────

export const transitionExamBodySchema = z.object({
  to: examStatusSchema,
})

// ── Inferred Types ───────────────────────────────────────────────────────────

export type ExamIdParam = z.infer<typeof examIdParamSchema>
export type ExamQuestionParam = z.infer<typeof examQuestionParamSchema>
export type ListExamsQuery = z.infer<typeof listExamsQuerySchema>
export type CreateExamBody = z.infer<typeof createExamBodySchema>
export type UpdateExamBody = z.infer<typeof updateExamBodySchema>
export type UpsertSettingsBody = z.infer<typeof upsertSettingsBodySchema>
export type AddQuestionsBody = z.infer<typeof addQuestionsBodySchema>
export type ReorderQuestionsBody = z.infer<typeof reorderQuestionsBodySchema>
export type SetCriteriaBody = z.infer<typeof setCriteriaBodySchema>
export type TransitionExamBody = z.infer<typeof transitionExamBodySchema>
