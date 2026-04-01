/**
 * MCQ Exams Router — /mcq-exams and /mcq-exams/:examId/...
 *
 * File: apps/api/src/routes/backoffice/mcq-exams/index.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 *
 * Routes (order matters — static paths before parameterised):
 *   GET    /mcq-exams                                                    → [readGuard]       listExamsHandler
 *   POST   /mcq-exams                                                    → [writeGuard]      createExamHandler
 *   GET    /mcq-exams/:examId                                            → [readGuard]       getExamHandler
 *   PATCH  /mcq-exams/:examId                                            → [writeGuard]      updateExamHandler
 *   DELETE /mcq-exams/:examId                                            → [writeGuard]      deleteExamHandler
 *   POST   /mcq-exams/:examId/workflow/transition                        → [transitionGuard] transitionExamHandler
 *   GET    /mcq-exams/:examId/settings                                   → [readGuard]       getSettingsHandler
 *   PUT    /mcq-exams/:examId/settings                                   → [writeGuard]      upsertSettingsHandler
 *   GET    /mcq-exams/:examId/questions                                  → [readGuard]       getQuestionsHandler
 *   POST   /mcq-exams/:examId/questions                                  → [writeGuard]      addQuestionsHandler
 *   DELETE /mcq-exams/:examId/questions/:questionId                      → [writeGuard]      removeQuestionHandler
 *   PUT    /mcq-exams/:examId/questions/reorder                          → [writeGuard]      reorderQuestionsHandler
 *   GET    /mcq-exams/:examId/criteria                                   → [readGuard]       getCriteriaHandler
 *   PUT    /mcq-exams/:examId/criteria                                   → [writeGuard]      setCriteriaHandler
 *
 * Read guard:       requireAnyPermission(['exam_manage', 'content_manage', 'content_read'])
 * Write guard:      requireAnyPermission(['exam_manage', 'content_manage'])
 * Transition guard: requireAnyPermission(['exam_manage', 'content_manage', 'content_review'])
 */

import { Hono } from 'hono'

import { requireAnyPermission } from '../../../middleware/auth/resolve-rbac'
import type { BackofficeEnv } from '../types'
import { addQuestionsHandler } from './add-questions'
import { createExamHandler } from './create-exam'
import { deleteExamHandler } from './delete-exam'
import { getCriteriaHandler } from './get-criteria'
import { getExamHandler } from './get-exam'
import { getQuestionsHandler } from './get-questions'
import { getSettingsHandler } from './get-settings'
import { listExamsHandler } from './list-exams'
import { removeQuestionHandler } from './remove-question'
import { reorderQuestionsHandler } from './reorder-questions'
import { setCriteriaHandler } from './set-criteria'
import { transitionExamHandler } from './transition-exam'
import { updateExamHandler } from './update-exam'
import { upsertSettingsHandler } from './upsert-settings'

export function createMcqExamsRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  const readGuard = requireAnyPermission(['exam_manage', 'content_manage', 'content_read'])
  const writeGuard = requireAnyPermission(['exam_manage', 'content_manage'])
  const transitionGuard = requireAnyPermission(['exam_manage', 'content_manage', 'content_review'])

  // Exam CRUD
  router.get('/mcq-exams', readGuard, listExamsHandler)
  router.post('/mcq-exams', writeGuard, createExamHandler)
  router.get('/mcq-exams/:examId', readGuard, getExamHandler)
  router.patch('/mcq-exams/:examId', writeGuard, updateExamHandler)
  router.delete('/mcq-exams/:examId', writeGuard, deleteExamHandler)

  // Workflow transition (static path segment before parameterised sub-resource routes)
  router.post('/mcq-exams/:examId/workflow/transition', transitionGuard, transitionExamHandler)

  // Settings
  router.get('/mcq-exams/:examId/settings', readGuard, getSettingsHandler)
  router.put('/mcq-exams/:examId/settings', writeGuard, upsertSettingsHandler)

  // Questions (static /reorder before parameterised /:questionId)
  router.get('/mcq-exams/:examId/questions', readGuard, getQuestionsHandler)
  router.post('/mcq-exams/:examId/questions', writeGuard, addQuestionsHandler)
  router.put('/mcq-exams/:examId/questions/reorder', writeGuard, reorderQuestionsHandler)
  router.delete('/mcq-exams/:examId/questions/:questionId', writeGuard, removeQuestionHandler)

  // Criteria
  router.get('/mcq-exams/:examId/criteria', readGuard, getCriteriaHandler)
  router.put('/mcq-exams/:examId/criteria', writeGuard, setCriteriaHandler)

  return router
}

export const mcqExamsRouter = createMcqExamsRouter()
