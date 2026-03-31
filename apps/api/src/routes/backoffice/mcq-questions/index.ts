/**
 * MCQ Questions Router — /mcq-questions and /mcq-questions/:questionId/...
 *
 * File: apps/api/src/routes/backoffice/mcq-questions/index.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 *
 * Routes (order matters — static paths before parameterised):
 *   GET    /mcq-questions                                                → [readGuard]       listQuestionsHandler
 *   POST   /mcq-questions                                                → [writeGuard]      createQuestionHandler
 *   GET    /mcq-questions/:questionId                                    → [readGuard]       getQuestionHandler
 *   PATCH  /mcq-questions/:questionId                                    → [writeGuard]      updateQuestionHandler
 *   DELETE /mcq-questions/:questionId                                    → [writeGuard]      deleteQuestionHandler
 *   POST   /mcq-questions/:questionId/workflow/transition                → [transitionGuard] transitionQuestionHandler
 *   POST   /mcq-questions/:questionId/categories                        → [writeGuard]      linkCategoryHandler
 *   DELETE /mcq-questions/:questionId/categories/:categoryValueId       → [writeGuard]      unlinkCategoryHandler
 *   POST   /mcq-questions/:questionId/tags                              → [writeGuard]      linkTagHandler
 *   DELETE /mcq-questions/:questionId/tags/:tagId                       → [writeGuard]      unlinkTagHandler
 *   POST   /mcq-questions/:questionId/baskets                           → [writeGuard]      linkBasketHandler
 *   DELETE /mcq-questions/:questionId/baskets/:basketId                 → [writeGuard]      unlinkBasketHandler
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
import { linkBasketHandler } from './link-basket'
import { linkCategoryHandler } from './link-category'
import { linkTagHandler } from './link-tag'
import { listQuestionsHandler } from './list-questions'
import { transitionQuestionHandler } from './transition-question'
import { unlinkBasketHandler } from './unlink-basket'
import { unlinkCategoryHandler } from './unlink-category'
import { unlinkTagHandler } from './unlink-tag'
import { updateQuestionHandler } from './update-question'

export function createMcqQuestionsRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  const readGuard = requireAnyPermission(['question_manage', 'content_manage', 'content_read'])
  const writeGuard = requireAnyPermission(['question_manage', 'content_manage'])
  const transitionGuard = requireAnyPermission([
    'question_manage',
    'content_manage',
    'content_review',
  ])

  // Question CRUD
  router.get('/mcq-questions', readGuard, listQuestionsHandler)
  router.post('/mcq-questions', writeGuard, createQuestionHandler)
  router.get('/mcq-questions/:questionId', readGuard, getQuestionHandler)
  router.patch('/mcq-questions/:questionId', writeGuard, updateQuestionHandler)
  router.delete('/mcq-questions/:questionId', writeGuard, deleteQuestionHandler)

  // Workflow transition (static path segment before parameterised classification routes)
  router.post(
    '/mcq-questions/:questionId/workflow/transition',
    transitionGuard,
    transitionQuestionHandler
  )

  // Classification: Categories
  router.post('/mcq-questions/:questionId/categories', writeGuard, linkCategoryHandler)
  router.delete(
    '/mcq-questions/:questionId/categories/:categoryValueId',
    writeGuard,
    unlinkCategoryHandler
  )

  // Classification: Tags
  router.post('/mcq-questions/:questionId/tags', writeGuard, linkTagHandler)
  router.delete('/mcq-questions/:questionId/tags/:tagId', writeGuard, unlinkTagHandler)

  // Classification: Baskets
  router.post('/mcq-questions/:questionId/baskets', writeGuard, linkBasketHandler)
  router.delete('/mcq-questions/:questionId/baskets/:basketId', writeGuard, unlinkBasketHandler)

  return router
}

export const mcqQuestionsRouter = createMcqQuestionsRouter()
