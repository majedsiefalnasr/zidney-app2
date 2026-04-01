/**
 * Traditional Exams Validation Schemas
 *
 * File: packages/validation/src/backoffice/traditional-exams.schemas.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 *
 * Zod schemas for all traditional exam API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 100

const moduleTypeSchema = z.enum(['TOPIC', 'EXERCISE'])
const examStatusSchema = z.enum(['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ENABLED', 'DISABLED'])

// ── Path Params ──────────────────────────────────────────────────────────────

export const examIdParamSchema = z.object({
  examId: z.string().uuid('examId must be a valid UUID'),
})

export const sectionIdParamSchema = z.object({
  examId: z.string().uuid('examId must be a valid UUID'),
  sectionId: z.string().uuid('sectionId must be a valid UUID'),
})

export const subsectionIdParamSchema = z.object({
  examId: z.string().uuid('examId must be a valid UUID'),
  sectionId: z.string().uuid('sectionId must be a valid UUID'),
  subsectionId: z.string().uuid('subsectionId must be a valid UUID'),
})

export const questionIdParamSchema = z.object({
  examId: z.string().uuid('examId must be a valid UUID'),
  sectionId: z.string().uuid('sectionId must be a valid UUID'),
  subsectionId: z.string().uuid('subsectionId must be a valid UUID'),
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
  module_type: moduleTypeSchema.optional(),
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
  semesterId: z.string().uuid('semesterId must be a valid UUID').nullable().optional(),
  templateId: z.string().uuid('templateId must be a valid UUID'),
  durationMinutes: z.number().int().min(1).nullable().optional(),
  passPercentage: z.number().min(0.01).max(100, 'passPercentage must be at most 100'),
  moduleType: moduleTypeSchema,
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
    subjectId: z.string().uuid().optional(),
    divisionId: z.union([z.string().uuid(), z.null()]).optional(),
    semesterId: z.union([z.string().uuid(), z.null()]).optional(),
    durationMinutes: z.union([z.number().int().min(1), z.null()]).optional(),
    passPercentage: z.number().min(0.01).max(100).optional(),
    moduleType: moduleTypeSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  })

// ── Upsert Settings Body ────────────────────────────────────────────────────

export const upsertSettingsBodySchema = z.object({
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  showResultsImmediately: z.boolean().optional(),
  allowBackNavigation: z.boolean().optional(),
  autoSubmitOnTimeout: z.boolean().optional(),
  showQuestionScore: z.boolean().optional(),
  requireAnswerBeforeNext: z.boolean().optional(),
  showRemainingTime: z.boolean().optional(),
  allowFlagQuestions: z.boolean().optional(),
  enableAutoGrading: z.boolean().optional(),
  messageTemplateId: z.union([z.string().uuid(), z.null()]).optional(),
})

// ── Workflow Transition Body ─────────────────────────────────────────────────

export const transitionBodySchema = z.object({
  to: examStatusSchema,
  reason: z.string().max(2000).optional(),
})

// ── Assign Questions Body ────────────────────────────────────────────────────

const assignQuestionEntrySchema = z.object({
  questionId: z.string().uuid('questionId must be a valid UUID'),
  score: z.number().min(0.01, 'score must be greater than 0'),
})

export const assignQuestionsBodySchema = z.object({
  questions: z.array(assignQuestionEntrySchema).min(1, 'at least one question is required'),
})

// ── Reorder Questions Body ───────────────────────────────────────────────────

export const reorderQuestionsBodySchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1, 'at least one questionId is required'),
})

// ── Update Section Body ──────────────────────────────────────────────────────

export const updateSectionBodySchema = z
  .object({
    headerContent: z.string().max(10000).optional(),
    orderIndex: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  })

// ── Update Subsection Body ───────────────────────────────────────────────────

export const updateSubsectionBodySchema = z
  .object({
    headerContent: z.string().max(10000).optional(),
    orderIndex: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  })

// ── Inferred Types ───────────────────────────────────────────────────────────

export type ExamIdParam = z.infer<typeof examIdParamSchema>
export type SectionIdParam = z.infer<typeof sectionIdParamSchema>
export type SubsectionIdParam = z.infer<typeof subsectionIdParamSchema>
export type QuestionIdParam = z.infer<typeof questionIdParamSchema>
export type ListExamsQuery = z.infer<typeof listExamsQuerySchema>
export type CreateExamBody = z.infer<typeof createExamBodySchema>
export type UpdateExamBody = z.infer<typeof updateExamBodySchema>
export type UpsertSettingsBody = z.infer<typeof upsertSettingsBodySchema>
export type TransitionBody = z.infer<typeof transitionBodySchema>
export type AssignQuestionsBody = z.infer<typeof assignQuestionsBodySchema>
export type ReorderQuestionsBody = z.infer<typeof reorderQuestionsBodySchema>
export type UpdateSectionBody = z.infer<typeof updateSectionBodySchema>
export type UpdateSubsectionBody = z.infer<typeof updateSubsectionBodySchema>
