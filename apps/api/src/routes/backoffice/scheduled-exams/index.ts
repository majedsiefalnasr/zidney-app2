/**
 * Scheduled Exams Router
 *
 * File: apps/api/src/routes/backoffice/scheduled-exams/index.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 *
 * Routes (static paths before parameterised):
 *   GET    /scheduled-exams                                         → [readGuard]    listScheduledExamsHandler
 *   POST   /scheduled-exams                                         → [writeGuard]   createScheduledExamHandler
 *   GET    /scheduled-exams/:scheduledExamId                        → [readGuard]    getScheduledExamHandler
 *   PATCH  /scheduled-exams/:scheduledExamId                        → [writeGuard]   updateScheduledExamHandler
 *   DELETE /scheduled-exams/:scheduledExamId                        → [writeGuard]   deleteScheduledExamHandler
 *   POST   /scheduled-exams/:scheduledExamId/workflow               → [writeGuard]   workflowTransitionHandler
 *   POST   /scheduled-exams/:scheduledExamId/re-approve             → [writeGuard]   reApproveHandler
 *   POST   /scheduled-exams/:scheduledExamId/attempts               → [studentGuard] startAttemptHandler
 *   POST   /scheduled-exams/attempts/:attemptId/heartbeat           → [studentGuard] heartbeatHandler
 *   POST   /scheduled-exams/attempts/:attemptId/submit              → [studentGuard] submitAttemptHandler
 *
 * Read guard:    requireAnyPermission(['exam_manage', 'content_manage', 'content_read'])
 * Write guard:   requireAnyPermission(['exam_manage', 'content_manage'])
 * Student guard: requireAnyPermission(['student'])
 */

import { Hono } from 'hono'

import { requireAnyPermission } from '../../../middleware/auth/resolve-rbac'
import type { BackofficeEnv } from '../types'
import { createScheduledExamHandler } from './create-scheduled-exam'
import { deleteScheduledExamHandler } from './delete-scheduled-exam'
import { getScheduledExamHandler } from './get-scheduled-exam'
import { heartbeatHandler } from './heartbeat'
import { listScheduledExamsHandler } from './list-scheduled-exams'
import { reApproveHandler } from './re-approve'
import { startAttemptHandler } from './start-attempt'
import { submitAttemptHandler } from './submit-attempt'
import { updateScheduledExamHandler } from './update-scheduled-exam'
import { workflowTransitionHandler } from './workflow-transition'

export function createScheduledExamsRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  const readGuard = requireAnyPermission(['exam_manage', 'content_manage', 'content_read'])
  const writeGuard = requireAnyPermission(['exam_manage', 'content_manage'])
  const studentGuard = requireAnyPermission(['student'])

  // Static sub-resource routes BEFORE parameterised /:scheduledExamId
  router.post('/scheduled-exams/attempts/:attemptId/heartbeat', studentGuard, heartbeatHandler)
  router.post('/scheduled-exams/attempts/:attemptId/submit', studentGuard, submitAttemptHandler)

  // Collection routes
  router.get('/scheduled-exams', readGuard, listScheduledExamsHandler)
  router.post('/scheduled-exams', writeGuard, createScheduledExamHandler)

  // Single resource routes
  router.get('/scheduled-exams/:scheduledExamId', readGuard, getScheduledExamHandler)
  router.patch('/scheduled-exams/:scheduledExamId', writeGuard, updateScheduledExamHandler)
  router.delete('/scheduled-exams/:scheduledExamId', writeGuard, deleteScheduledExamHandler)

  // Workflow sub-resources (parameterised by scheduledExamId)
  router.post('/scheduled-exams/:scheduledExamId/workflow', writeGuard, workflowTransitionHandler)
  router.post('/scheduled-exams/:scheduledExamId/re-approve', writeGuard, reApproveHandler)
  router.post('/scheduled-exams/:scheduledExamId/attempts', studentGuard, startAttemptHandler)

  return router
}

export const scheduledExamsRouter = createScheduledExamsRouter()
