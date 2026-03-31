/**
 * Traditional Questions Validation Schemas
 *
 * File: packages/validation/src/backoffice/traditional-questions.schemas.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 *
 * Zod schemas for all traditional questions API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 100

const questionTypeSchema = z.enum(['TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER'])
const questionStatusSchema = z.enum(['DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED'])

// ── Path Params ──────────────────────────────────────────────────────────────

export const questionIdParamSchema = z.object({
  questionId: z.string().uuid('questionId must be a valid UUID'),
})

export const questionCategoryParamSchema = z.object({
  questionId: z.string().uuid('questionId must be a valid UUID'),
  categoryValueId: z.string().uuid('categoryValueId must be a valid UUID'),
})

export const questionTagParamSchema = z.object({
  questionId: z.string().uuid('questionId must be a valid UUID'),
  tagId: z.string().uuid('tagId must be a valid UUID'),
})

// ── Correct Answer Schemas (per question type) ───────────────────────────────

const trueFalseAnswerSchema = z.object({
  value: z.boolean(),
})

const fillBlankAnswerSchema = z.object({
  accepted_values: z.array(z.string().min(1)).min(1, 'at least one accepted value is required'),
})

const shortAnswerAnswerSchema = z
  .object({
    model_answer: z.string().min(1, 'model_answer must be non-empty'),
  })
  .nullable()

const correctAnswerSchema = z.union([
  trueFalseAnswerSchema,
  fillBlankAnswerSchema,
  shortAnswerAnswerSchema,
  z.null(),
])

const correctionCriteriaSchema = z.record(z.string(), z.unknown()).nullable().optional()

// ── List Questions Query ─────────────────────────────────────────────────────

export const listQuestionsQuerySchema = z.object({
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
  lesson_id: z.string().uuid().optional(),
  subsection_id: z.string().uuid().optional(),
  question_type: questionTypeSchema.optional(),
  status: questionStatusSchema.optional(),
  category_value_id: z.string().uuid().optional(),
  tag_id: z.string().uuid().optional(),
  search: z.string().max(255).optional(),
})

// ── Create Question Body ─────────────────────────────────────────────────────

export const createQuestionBodySchema = z.object({
  subjectId: z.string().uuid('subjectId must be a valid UUID'),
  divisionId: z.string().uuid('divisionId must be a valid UUID').nullable().optional(),
  lessonId: z.string().uuid('lessonId must be a valid UUID').nullable().optional(),
  subsectionId: z.string().uuid('subsectionId must be a valid UUID'),
  questionType: questionTypeSchema,
  language: z.string().min(1, 'language is required').max(10),
  content: z.string().min(1, 'content is required').max(50000),
  correctAnswer: correctAnswerSchema.optional(),
  correctionCriteria: correctionCriteriaSchema,
  score: z.number().positive('score must be positive'),
})

// ── Update Question Body ─────────────────────────────────────────────────────
// Note: questionType, subjectId, subsectionId are immutable — not in update schema.

export const updateQuestionBodySchema = z
  .object({
    divisionId: z.union([z.string().uuid(), z.null()]).optional(),
    lessonId: z.union([z.string().uuid(), z.null()]).optional(),
    language: z.string().min(1).max(10).optional(),
    content: z.string().min(1).max(50000).optional(),
    correctAnswer: z.union([correctAnswerSchema, z.null()]).optional(),
    correctionCriteria: z.union([z.record(z.string(), z.unknown()), z.null()]).optional(),
    score: z.number().positive().optional(),
    updatedAt: z.string().datetime('updatedAt must be an ISO 8601 datetime'),
  })
  .refine(
    (data) => {
      const { updatedAt: _, ...rest } = data
      return Object.keys(rest).length > 0
    },
    { message: 'At least one field besides updatedAt must be provided for update' }
  )

// ── Workflow Transition Body ─────────────────────────────────────────────────

export const transitionQuestionBodySchema = z.object({
  to: questionStatusSchema,
})

// ── Classification Link Bodies ───────────────────────────────────────────────

export const linkCategoryBodySchema = z.object({
  categoryValueId: z.string().uuid('categoryValueId must be a valid UUID'),
})

export const linkTagBodySchema = z.object({
  tagId: z.string().uuid('tagId must be a valid UUID'),
})

// ── Inferred Types ───────────────────────────────────────────────────────────

export type QuestionIdParam = z.infer<typeof questionIdParamSchema>
export type QuestionCategoryParam = z.infer<typeof questionCategoryParamSchema>
export type QuestionTagParam = z.infer<typeof questionTagParamSchema>
export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>
export type CreateQuestionBody = z.infer<typeof createQuestionBodySchema>
export type UpdateQuestionBody = z.infer<typeof updateQuestionBodySchema>
export type TransitionQuestionBody = z.infer<typeof transitionQuestionBodySchema>
export type LinkCategoryBody = z.infer<typeof linkCategoryBodySchema>
export type LinkTagBody = z.infer<typeof linkTagBodySchema>
