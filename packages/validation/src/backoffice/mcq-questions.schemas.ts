/**
 * MCQ Questions Validation Schemas
 *
 * File: packages/validation/src/backoffice/mcq-questions.schemas.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 *
 * Zod schemas for all MCQ questions API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 100

const questionTypeSchema = z.enum(['SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'ARRANGEMENT'])
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

export const questionBasketParamSchema = z.object({
  questionId: z.string().uuid('questionId must be a valid UUID'),
  basketId: z.string().uuid('basketId must be a valid UUID'),
})

// ── Option Schema ────────────────────────────────────────────────────────────

const optionInputSchema = z.object({
  content: z.string().min(1, 'option content is required').max(50000),
  isCorrect: z.boolean(),
  orderIndex: z.number().int().min(0),
})

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
  question_type: questionTypeSchema.optional(),
  status: questionStatusSchema.optional(),
  category_value_id: z.string().uuid().optional(),
  tag_id: z.string().uuid().optional(),
  basket_id: z.string().uuid().optional(),
  is_revision_only: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined))
    .pipe(z.boolean().optional()),
  is_exam_only: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined))
    .pipe(z.boolean().optional()),
  search: z.string().max(255).optional(),
})

// ── Create Question Body ─────────────────────────────────────────────────────

export const createQuestionBodySchema = z.object({
  subjectId: z.string().uuid('subjectId must be a valid UUID'),
  divisionId: z.string().uuid('divisionId must be a valid UUID').nullable().optional(),
  lessonId: z.string().uuid('lessonId must be a valid UUID').nullable().optional(),
  questionType: questionTypeSchema,
  language: z.string().min(1, 'language is required').max(10),
  content: z.string().min(1, 'content is required').max(50000),
  explanation: z.string().max(50000).nullable().optional(),
  isRevisionOnly: z.boolean().optional().default(false),
  isExamOnly: z.boolean().optional().default(false),
  options: z.array(optionInputSchema).min(1, 'at least one option is required'),
})

// ── Update Question Body ─────────────────────────────────────────────────────

export const updateQuestionBodySchema = z
  .object({
    subjectId: z.string().uuid().optional(),
    divisionId: z.union([z.string().uuid(), z.null()]).optional(),
    lessonId: z.union([z.string().uuid(), z.null()]).optional(),
    questionType: questionTypeSchema.optional(),
    language: z.string().min(1).max(10).optional(),
    content: z.string().min(1).max(50000).optional(),
    explanation: z.union([z.string().max(50000), z.null()]).optional(),
    isRevisionOnly: z.boolean().optional(),
    isExamOnly: z.boolean().optional(),
    options: z.array(optionInputSchema).min(1).optional(),
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

export const linkBasketBodySchema = z.object({
  basketId: z.string().uuid('basketId must be a valid UUID'),
})

// ── Inferred Types ───────────────────────────────────────────────────────────

export type QuestionIdParam = z.infer<typeof questionIdParamSchema>
export type QuestionCategoryParam = z.infer<typeof questionCategoryParamSchema>
export type QuestionTagParam = z.infer<typeof questionTagParamSchema>
export type QuestionBasketParam = z.infer<typeof questionBasketParamSchema>
export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>
export type CreateQuestionBody = z.infer<typeof createQuestionBodySchema>
export type UpdateQuestionBody = z.infer<typeof updateQuestionBodySchema>
export type TransitionQuestionBody = z.infer<typeof transitionQuestionBodySchema>
export type LinkCategoryBody = z.infer<typeof linkCategoryBodySchema>
export type LinkTagBody = z.infer<typeof linkTagBodySchema>
export type LinkBasketBody = z.infer<typeof linkBasketBodySchema>
