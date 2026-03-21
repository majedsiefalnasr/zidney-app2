/**
 * Lessons Router — /lessons
 *
 * File: apps/api/src/routes/backoffice/lessons/index.ts
 * Stage: STAGE_29_LESSONS
 *
 * Routes (order matters — static paths before parameterised):
 *   GET    /lessons             → listLessonsHandler
 *   POST   /lessons             → createLessonHandler
 *   GET    /lessons/runtime     → getActiveLessonsHandler  (must precede /:id)
 *   GET    /lessons/:id         → getLessonHandler
 *   PATCH  /lessons/:id         → updateLessonHandler
 *   DELETE /lessons/:id         → deleteLessonHandler
 */

import { Hono } from 'hono'
import type { BackofficeEnv } from '../types'
import { createLessonHandler } from './create-lesson'
import { deleteLessonHandler } from './delete-lesson'
import { getActiveLessonsHandler } from './get-active-lessons'
import { getLessonHandler } from './get-lesson'
import { listLessonsHandler } from './list-lessons'
import { updateLessonHandler } from './update-lesson'

export function createLessonsRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  router.get('/lessons', listLessonsHandler)
  router.post('/lessons', createLessonHandler)
  // Static path /lessons/runtime MUST be declared before /lessons/:id
  router.get('/lessons/runtime', getActiveLessonsHandler)
  router.get('/lessons/:id', getLessonHandler)
  router.patch('/lessons/:id', updateLessonHandler)
  router.delete('/lessons/:id', deleteLessonHandler)

  return router
}

export const lessonsRouter = createLessonsRouter()
