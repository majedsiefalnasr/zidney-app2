/**
 * Baskets Validation Schemas
 *
 * File: packages/validation/src/backoffice/baskets.schemas.ts
 * Stage: STAGE_33_MCQ_BASKETS
 *
 * Zod schemas for all baskets API endpoints.
 * Used by route handlers to validate request bodies, path params, and query strings.
 */

import { z } from 'zod'

const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 100

const basketTypeSchema = z.enum(['LINKED', 'UNLINKED'])
const basketStatusSchema = z.enum(['DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED'])

// ── Path Params ──────────────────────────────────────────────────────────────

export const basketIdParamSchema = z.object({
  basketId: z.string().uuid('basketId must be a valid UUID'),
})

export const basketQuestionParamSchema = z.object({
  basketId: z.string().uuid('basketId must be a valid UUID'),
  questionId: z.string().uuid('questionId must be a valid UUID'),
})

// ── List Baskets Query ───────────────────────────────────────────────────────

export const listBasketsQuerySchema = z.object({
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
  type: basketTypeSchema.optional(),
  status: basketStatusSchema.optional(),
  search: z.string().max(255).optional(),
})

// ── Create Basket Body ───────────────────────────────────────────────────────

export const createBasketBodySchema = z.object({
  name: z.string().min(1, 'name is required').max(255),
  code: z.string().min(1, 'code is required').max(100),
  type: basketTypeSchema,
  maxQuestions: z.number().int().positive('maxQuestions must be a positive integer').optional(),
  description: z.string().max(5000).optional(),
})

// ── Update Basket Body ───────────────────────────────────────────────────────

export const updateBasketBodySchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    code: z.string().min(1).max(100).optional(),
    maxQuestions: z.union([z.number().int().positive(), z.null()]).optional(),
    description: z.union([z.string().max(5000), z.null()]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  })

// ── Workflow Transition Body ─────────────────────────────────────────────────

export const transitionBasketBodySchema = z.object({
  to: basketStatusSchema,
})

// ── Link Question Body ───────────────────────────────────────────────────────

export const linkQuestionBodySchema = z.object({
  questionId: z.string().uuid('questionId must be a valid UUID'),
})

// ── List Basket Questions Query ──────────────────────────────────────────────

export const listBasketQuestionsQuerySchema = z.object({
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
})

// ── Inferred Types ───────────────────────────────────────────────────────────

export type BasketIdParam = z.infer<typeof basketIdParamSchema>
export type BasketQuestionParam = z.infer<typeof basketQuestionParamSchema>
export type ListBasketsQuery = z.infer<typeof listBasketsQuerySchema>
export type CreateBasketBody = z.infer<typeof createBasketBodySchema>
export type UpdateBasketBody = z.infer<typeof updateBasketBodySchema>
export type TransitionBasketBody = z.infer<typeof transitionBasketBodySchema>
export type LinkQuestionBody = z.infer<typeof linkQuestionBodySchema>
export type ListBasketQuestionsQuery = z.infer<typeof listBasketQuestionsQuerySchema>
