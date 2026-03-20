/**
 * Semesters Router — /semesters
 *
 * File: apps/api/src/routes/backoffice/semesters/index.ts
 * Stage: STAGE_27_SEMESTERS
 *
 * Routes:
 *   GET    /semesters          → listSemestersHandler
 *   POST   /semesters          → createSemesterHandler
 *   GET    /semesters/:id      → getSemesterHandler
 *   PATCH  /semesters/:id      → updateSemesterHandler
 *   DELETE /semesters/:id      → deleteSemesterHandler
 */

import { Hono } from 'hono'
import type { BackofficeEnv } from '../types'
import { createSemesterHandler } from './create-semester'
import { deleteSemesterHandler } from './delete-semester'
import { getSemesterHandler } from './get-semester'
import { listSemestersHandler } from './list-semesters'
import { updateSemesterHandler } from './update-semester'

export function createSemestersRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  router.get('/semesters', listSemestersHandler)
  router.post('/semesters', createSemesterHandler)
  router.get('/semesters/:id', getSemesterHandler)
  router.patch('/semesters/:id', updateSemesterHandler)
  router.delete('/semesters/:id', deleteSemesterHandler)

  return router
}

export const semestersRouter = createSemestersRouter()
