/**
 * Baskets Router — /mcq-baskets and /mcq-baskets/:basketId/...
 *
 * File: apps/api/src/routes/backoffice/baskets/index.ts
 * Stage: STAGE_33_MCQ_BASKETS
 *
 * Routes (order matters — static paths before parameterised):
 *   GET    /mcq-baskets                                       → [readGuard]       listBasketsHandler
 *   POST   /mcq-baskets                                       → [writeGuard]      createBasketHandler
 *   GET    /mcq-baskets/:basketId                             → [readGuard]       getBasketHandler
 *   PATCH  /mcq-baskets/:basketId                             → [writeGuard]      updateBasketHandler
 *   DELETE /mcq-baskets/:basketId                             → [writeGuard]      deleteBasketHandler
 *   POST   /mcq-baskets/:basketId/workflow/transition          → [transitionGuard] transitionBasketHandler
 *   POST   /mcq-baskets/:basketId/questions                   → [writeGuard]      linkQuestionHandler
 *   DELETE /mcq-baskets/:basketId/questions/:questionId       → [writeGuard]      unlinkQuestionHandler
 *   GET    /mcq-baskets/:basketId/questions                   → [readGuard]       listBasketQuestionsHandler
 *
 * Read guard:       requireAnyPermission(['question_manage', 'content_manage', 'content_read'])
 * Write guard:      requireAnyPermission(['question_manage', 'content_manage'])
 * Transition guard: requireAnyPermission(['question_manage', 'content_manage', 'content_review'])
 */

import { Hono } from 'hono'

import { requireAnyPermission } from '../../../middleware/auth/resolve-rbac'
import type { BackofficeEnv } from '../types'
import { createBasketHandler } from './create-basket'
import { deleteBasketHandler } from './delete-basket'
import { getBasketHandler } from './get-basket'
import { linkQuestionHandler } from './link-question'
import { listBasketsHandler } from './list-baskets'
import { listBasketQuestionsHandler } from './list-questions'
import { transitionBasketHandler } from './transition-basket'
import { unlinkQuestionHandler } from './unlink-question'
import { updateBasketHandler } from './update-basket'

export function createBasketsRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  const readGuard = requireAnyPermission(['question_manage', 'content_manage', 'content_read'])
  const writeGuard = requireAnyPermission(['question_manage', 'content_manage'])
  const transitionGuard = requireAnyPermission([
    'question_manage',
    'content_manage',
    'content_review',
  ])

  // Basket CRUD
  router.get('/mcq-baskets', readGuard, listBasketsHandler)
  router.post('/mcq-baskets', writeGuard, createBasketHandler)
  router.get('/mcq-baskets/:basketId', readGuard, getBasketHandler)
  router.patch('/mcq-baskets/:basketId', writeGuard, updateBasketHandler)
  router.delete('/mcq-baskets/:basketId', writeGuard, deleteBasketHandler)

  // Workflow transition (static path segment before parameterised question routes)
  router.post(
    '/mcq-baskets/:basketId/workflow/transition',
    transitionGuard,
    transitionBasketHandler
  )

  // Basket-Question linking
  router.post('/mcq-baskets/:basketId/questions', writeGuard, linkQuestionHandler)
  router.delete('/mcq-baskets/:basketId/questions/:questionId', writeGuard, unlinkQuestionHandler)
  router.get('/mcq-baskets/:basketId/questions', readGuard, listBasketQuestionsHandler)

  return router
}

export const basketsRouter = createBasketsRouter()
