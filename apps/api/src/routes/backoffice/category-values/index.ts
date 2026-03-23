/**
 * Category Values Router — /category-values
 *
 * File: apps/api/src/routes/backoffice/category-values/index.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 *
 * Routes (order matters — static paths before parameterised):
 *   GET    /category-values          → listCategoryValuesHandler
 *   POST   /category-values          → [writeGuard] createCategoryValueHandler
 *   GET    /category-values/:id      → getCategoryValueHandler
 *   PATCH  /category-values/:id      → [writeGuard] updateCategoryValueHandler
 *   DELETE /category-values/:id      → [writeGuard] deleteCategoryValueHandler
 *
 * Write guard: requireAnyPermission(['question_manage', 'classification_manage'])
 */

import { Hono } from 'hono'

import { requireAnyPermission } from '../../../middleware/auth/resolve-rbac'
import type { BackofficeEnv } from '../types'
import { createCategoryValueHandler } from './create-category-value'
import { deleteCategoryValueHandler } from './delete-category-value'
import { getCategoryValueHandler } from './get-category-value'
import { listCategoryValuesHandler } from './list-category-values'
import { updateCategoryValueHandler } from './update-category-value'

export function createCategoryValuesRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  const writeGuard = requireAnyPermission(['question_manage', 'classification_manage'])

  router.get('/category-values', listCategoryValuesHandler)
  router.post('/category-values', writeGuard, createCategoryValueHandler)
  router.get('/category-values/:id', getCategoryValueHandler)
  router.patch('/category-values/:id', writeGuard, updateCategoryValueHandler)
  router.delete('/category-values/:id', writeGuard, deleteCategoryValueHandler)

  return router
}

export const categoryValuesRouter = createCategoryValuesRouter()
