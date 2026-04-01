/**
 * Traditional Exams Router — /traditional-exams and /traditional-exams/:examId/...
 *
 * File: apps/api/src/routes/backoffice/traditional-exams/index.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 *
 * Routes (order matters — static paths before parameterised):
 *   GET    /traditional-exams                                                                                         → [readGuard]       listExamsHandler
 *   POST   /traditional-exams                                                                                         → [writeGuard]      createExamHandler
 *   GET    /traditional-exams/:examId                                                                                 → [readGuard]       getExamHandler
 *   PATCH  /traditional-exams/:examId                                                                                 → [writeGuard]      updateExamHandler
 *   DELETE /traditional-exams/:examId                                                                                 → [writeGuard]      deleteExamHandler
 *   POST   /traditional-exams/:examId/workflow/transition                                                             → [transitionGuard] transitionExamHandler
 *   GET    /traditional-exams/:examId/settings                                                                        → [readGuard]       getSettingsHandler
 *   PUT    /traditional-exams/:examId/settings                                                                        → [writeGuard]      upsertSettingsHandler
 *   GET    /traditional-exams/:examId/sections                                                                        → [readGuard]       listSectionsHandler
 *   PATCH  /traditional-exams/:examId/sections/:sectionId                                                             → [writeGuard]      updateSectionHandler
 *   PUT    /traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions/reorder                  → [writeGuard]      reorderQuestionsHandler
 *   GET    /traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions                          → [readGuard]       listSubsectionQuestionsHandler
 *   POST   /traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions                          → [writeGuard]      assignQuestionsHandler
 *   PATCH  /traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId                                    → [writeGuard]      updateSubsectionHandler
 *   DELETE /traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions/:questionId               → [writeGuard]      removeQuestionHandler
 *
 * Read guard:       requireAnyPermission(['exam_manage', 'content_manage', 'content_read'])
 * Write guard:      requireAnyPermission(['exam_manage', 'content_manage'])
 * Transition guard: requireAnyPermission(['exam_manage', 'content_manage', 'content_review'])
 */

import { Hono } from 'hono'

import { requireAnyPermission } from '../../../middleware/auth/resolve-rbac'
import type { BackofficeEnv } from '../types'
import { assignQuestionsHandler } from './assign-questions'
import { createExamHandler } from './create-exam'
import { deleteExamHandler } from './delete-exam'
import { getExamHandler } from './get-exam'
import { getSettingsHandler } from './get-settings'
import { listExamsHandler } from './list-exams'
import { listSectionsHandler } from './list-sections'
import { listSubsectionQuestionsHandler } from './list-subsection-questions'
import { removeQuestionHandler } from './remove-question'
import { reorderQuestionsHandler } from './reorder-questions'
import { transitionExamHandler } from './transition-exam'
import { updateExamHandler } from './update-exam'
import { updateSectionHandler } from './update-section'
import { updateSubsectionHandler } from './update-subsection'
import { upsertSettingsHandler } from './upsert-settings'

export function createTraditionalExamsRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  const readGuard = requireAnyPermission(['exam_manage', 'content_manage', 'content_read'])
  const writeGuard = requireAnyPermission(['exam_manage', 'content_manage'])
  const transitionGuard = requireAnyPermission(['exam_manage', 'content_manage', 'content_review'])

  // Exam CRUD
  router.get('/traditional-exams', readGuard, listExamsHandler)
  router.post('/traditional-exams', writeGuard, createExamHandler)
  router.get('/traditional-exams/:examId', readGuard, getExamHandler)
  router.patch('/traditional-exams/:examId', writeGuard, updateExamHandler)
  router.delete('/traditional-exams/:examId', writeGuard, deleteExamHandler)

  // Workflow transition (static path segment before parameterised sub-resource routes)
  router.post(
    '/traditional-exams/:examId/workflow/transition',
    transitionGuard,
    transitionExamHandler
  )

  // Settings
  router.get('/traditional-exams/:examId/settings', readGuard, getSettingsHandler)
  router.put('/traditional-exams/:examId/settings', writeGuard, upsertSettingsHandler)

  // Sections
  router.get('/traditional-exams/:examId/sections', readGuard, listSectionsHandler)
  router.patch('/traditional-exams/:examId/sections/:sectionId', writeGuard, updateSectionHandler)

  // Subsections
  router.patch(
    '/traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId',
    writeGuard,
    updateSubsectionHandler
  )

  // Questions (static /reorder before parameterised /:questionId)
  router.put(
    '/traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions/reorder',
    writeGuard,
    reorderQuestionsHandler
  )
  router.get(
    '/traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions',
    readGuard,
    listSubsectionQuestionsHandler
  )
  router.post(
    '/traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions',
    writeGuard,
    assignQuestionsHandler
  )
  router.delete(
    '/traditional-exams/:examId/sections/:sectionId/subsections/:subsectionId/questions/:questionId',
    writeGuard,
    removeQuestionHandler
  )

  return router
}

export const traditionalExamsRouter = createTraditionalExamsRouter()
