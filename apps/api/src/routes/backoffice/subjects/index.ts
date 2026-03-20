/**
 * Subjects Router — /subjects
 *
 * File: apps/api/src/routes/backoffice/subjects/index.ts
 * Stage: STAGE_28_SUBJECTS
 *
 * Routes (order matters — static paths before parameterised):
 *   GET    /subjects             → listSubjectsHandler
 *   POST   /subjects             → createSubjectHandler
 *   GET    /subjects/runtime     → getActiveSubjectsHandler  (must precede /:id)
 *   GET    /subjects/:id         → getSubjectHandler
 *   PATCH  /subjects/:id         → updateSubjectHandler
 *   POST   /subjects/:id/transition → transitionSubjectHandler
 *   DELETE /subjects/:id         → deleteSubjectHandler
 */

import { Hono } from 'hono'
import type { BackofficeEnv } from '../types'
import { createSubjectHandler } from './create-subject'
import { deleteSubjectHandler } from './delete-subject'
import { getActiveSubjectsHandler } from './get-active-subjects'
import { getSubjectHandler } from './get-subject'
import { listSubjectsHandler } from './list-subjects'
import { transitionSubjectHandler } from './transition-subject'
import { updateSubjectHandler } from './update-subject'

export function createSubjectsRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  router.get('/subjects', listSubjectsHandler)
  router.post('/subjects', createSubjectHandler)
  // Static path /subjects/runtime MUST be declared before /subjects/:id
  router.get('/subjects/runtime', getActiveSubjectsHandler)
  router.get('/subjects/:id', getSubjectHandler)
  router.patch('/subjects/:id', updateSubjectHandler)
  router.post('/subjects/:id/transition', transitionSubjectHandler)
  router.delete('/subjects/:id', deleteSubjectHandler)

  return router
}

export const subjectsRouter = createSubjectsRouter()
