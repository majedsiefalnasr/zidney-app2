/**
 * Traditional Questions Router — /traditional-questions and /traditional-questions/:questionId/...
 *
 * File: apps/api/src/routes/backoffice/traditional-questions/index.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 *
 * Routes (order matters — static paths before parameterised):
 *   GET    /traditional-questions                                                → [readGuard]       listQuestionsHandler
 *   POST   /traditional-questions                                                → [writeGuard]      createQuestionHandler
 *   GET    /traditional-questions/:questionId                                    → [readGuard]       getQuestionHandler
 *   PATCH  /traditional-questions/:questionId                                    → [writeGuard]      updateQuestionHandler
 *   DELETE /traditional-questions/:questionId                                    → [writeGuard]      deleteQuestionHandler
 *   POST   /traditional-questions/:questionId/workflow/transition                → [transitionGuard] transitionQuestionHandler
 *   POST   /traditional-questions/:questionId/categories                        → [writeGuard]      linkCategoryHandler
 *   DELETE /traditional-questions/:questionId/categories/:categoryValueId       → [writeGuard]      unlinkCategoryHandler
 *   POST   /traditional-questions/:questionId/tags                              → [writeGuard]      linkTagHandler
 *   DELETE /traditional-questions/:questionId/tags/:tagId                       → [writeGuard]      unlinkTagHandler
 *
 * Read guard:       requireAnyPermission(['question_manage', 'content_manage', 'content_read'])
 * Write guard:      requireAnyPermission(['question_manage', 'content_manage'])
 * Transition guard: requireAnyPermission(['question_manage', 'content_manage', 'content_review'])
 */

import { Hono } from 'hono'

import { requireAnyPermission } from '../../../middleware/auth/resolve-rbac'
import type { BackofficeEnv } from '../types'
import { createQuestionHandler } from './create-question'
import { deleteQuestionHandler } from './delete-question'
import { getQuestionHandler } from './get-question'
import { linkCategoryHandler } from './link-category'
import { linkTagHandler } from './link-tag'
import { listQuestionsHandler } from './list-questions'
import { transitionQuestionHandler } from './transition-question'
import { unlinkCategoryHandler } from './unlink-category'
import { unlinkTagHandler } from './unlink-tag'
import { updateQuestionHandler } from './update-question'

export function createTraditionalQuestionsRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  const readGuard = requireAnyPermission(['question_manage', 'content_manage', 'content_read'])
  const writeGuard = requireAnyPermission(['question_manage', 'content_manage'])
  const transitionGuard = requireAnyPermission([
    'question_manage',
    'content_manage',
    'content_review',
  ])

  // Question CRUD
  router.get('/traditional-questions', readGuard, listQuestionsHandler)
  router.post('/traditional-questions', writeGuard, createQuestionHandler)
  router.get('/traditional-questions/:questionId', readGuard, getQuestionHandler)
  router.patch('/traditional-questions/:questionId', writeGuard, updateQuestionHandler)
  router.delete('/traditional-questions/:questionId', writeGuard, deleteQuestionHandler)

  // Workflow transition (static path segment before parameterised classification routes)
  router.post(
    '/traditional-questions/:questionId/workflow/transition',
    transitionGuard,
    transitionQuestionHandler
  )

  // Classification: Categories
  router.post('/traditional-questions/:questionId/categories', writeGuard, linkCategoryHandler)
  router.delete(
    '/traditional-questions/:questionId/categories/:categoryValueId',
    writeGuard,
    unlinkCategoryHandler
  )

  // Classification: Tags
  router.post('/traditional-questions/:questionId/tags', writeGuard, linkTagHandler)
  router.delete('/traditional-questions/:questionId/tags/:tagId', writeGuard, unlinkTagHandler)

  return router
}

export const traditionalQuestionsRouter = createTraditionalQuestionsRouter()
