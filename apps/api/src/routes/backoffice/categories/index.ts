/**
 * Categories Router — /categories
 *
 * File: apps/api/src/routes/backoffice/categories/index.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * Routes (order matters — static paths before parameterised):
 *   GET    /categories          → listCategoriesHandler
 *   POST   /categories          → createCategoryHandler
 *   GET    /categories/tree     → getCategoryTreeHandler  (MUST precede /:id)
 *   GET    /categories/:id      → getCategoryHandler
 *   PATCH  /categories/:id      → updateCategoryHandler
 *   DELETE /categories/:id      → deleteCategoryHandler
 */

import { Hono } from 'hono'

import type { BackofficeEnv } from '../types'
import { createCategoryHandler } from './create-category'
import { deleteCategoryHandler } from './delete-category'
import { getCategoryHandler } from './get-category'
import { getCategoryTreeHandler } from './get-category-tree'
import { listCategoriesHandler } from './list-categories'
import { updateCategoryHandler } from './update-category'

export function createCategoriesRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  router.get('/categories', listCategoriesHandler)
  router.post('/categories', createCategoryHandler)
  // Static path /categories/tree MUST be declared before /categories/:id
  router.get('/categories/tree', getCategoryTreeHandler)
  router.get('/categories/:id', getCategoryHandler)
  router.patch('/categories/:id', updateCategoryHandler)
  router.delete('/categories/:id', deleteCategoryHandler)

  return router
}

export const categoriesRouter = createCategoriesRouter()
