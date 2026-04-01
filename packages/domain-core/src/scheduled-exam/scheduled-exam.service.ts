/**
 * Scheduled Exam — Service Orchestration
 *
 * File: packages/domain-core/src/scheduled-exam/scheduled-exam.service.ts
 * Stage: STAGE_38_SCHEDULED_EXAM_ENGINE
 *
 * Orchestrates business logic. startScheduledAttempt requires a PoolClient
 * (transaction context) to use pg_try_advisory_xact_lock.
 */

import { createLogger } from '@zidney/logger'
import { SCHEDULED_EXAM_ERROR_CODES, ScheduledExamError } from './scheduled-exam.errors'
import * as repo from './scheduled-exam.repository'
import type {
  AttemptStartResult,
  AuditContext,
  CreateScheduledExamInput,
  DbClient,
  HeartbeatResult,
  ListScheduledExamsInput,
  ScheduledExamRow,
  SubmitResult,
  UpdateScheduledExamInput,
} from './scheduled-exam.types'
import { computeBaseExamHash } from './scheduled-exam-hash'
import { computeAttemptEndTime, computeRemainingSeconds, isWindowOpen } from './scheduled-exam-time'
import { canTransitionToEnabled, getImmutableFields } from './scheduled-exam-workflow'

const logger = createLogger('scheduled-exam:service')

export async function createScheduledExam(
  db: DbClient,
  workspaceId: string,
  input: CreateScheduledExamInput,
  audit: AuditContext
): Promise<ScheduledExamRow> {
  if (input.window_end <= input.window_start) {
    throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.INVALID_TIME_WINDOW)
  }
  const existing = await repo.findByCode(db, input.code, workspaceId)
  if (existing) {
    throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.CODE_CONFLICT)
  }
  const row = await repo.insert(db, workspaceId, input, audit)
  logger.info('scheduled_exam_created', {
    workspace_id: workspaceId,
    scheduled_exam_id: row.id,
    correlation_id: audit.correlation_id,
  })
  return row
}

export async function getScheduledExams(
  db: DbClient,
  input: ListScheduledExamsInput
): Promise<{ items: ScheduledExamRow[]; total: number }> {
  const [items, total] = await Promise.all([
    repo.findAll(db, input),
    repo.countAll(db, input.workspace_id, input.status),
  ])
  return { items, total }
}

export async function updateScheduledExam(
  db: DbClient,
  id: string,
  workspaceId: string,
  input: UpdateScheduledExamInput,
  audit: AuditContext
): Promise<ScheduledExamRow> {
  const exam = await repo.findById(db, id, workspaceId)
  if (!exam) throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.NOT_FOUND)

  const attemptCount = await repo.countAttempts(db, id, workspaceId)
  const immutableFields = getImmutableFields(exam.status, attemptCount)

  for (const field of immutableFields) {
    const camelField = field.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
    if (field in input || camelField in input) {
      throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.FIELD_IMMUTABLE)
    }
  }

  const updated = await repo.update(db, id, workspaceId, input, audit)
  if (!updated) throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.NOT_FOUND)
  return updated
}

export async function deleteScheduledExam(
  db: DbClient,
  id: string,
  workspaceId: string,
  audit: AuditContext
): Promise<void> {
  const exam = await repo.findById(db, id, workspaceId)
  if (!exam) throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.NOT_FOUND)
  const attemptCount = await repo.countAttempts(db, id, workspaceId)
  if (attemptCount > 0) throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.HAS_ATTEMPTS)
  if (exam.status === 'ENABLED') {
    throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.WORKFLOW_INVALID_TRANSITION)
  }
  await repo.softDelete(db, id, workspaceId, audit)
  logger.info('scheduled_exam_deleted', {
    workspace_id: workspaceId,
    scheduled_exam_id: id,
    correlation_id: audit.correlation_id,
  })
}

export async function enableScheduledExam(
  db: DbClient,
  id: string,
  workspaceId: string,
  baseExamSnapshot: Record<string, unknown>,
  audit: AuditContext
): Promise<ScheduledExamRow> {
  const exam = await repo.findById(db, id, workspaceId)
  if (!exam) throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.NOT_FOUND)
  const attemptCount = await repo.countAttempts(db, id, workspaceId)
  const transition = canTransitionToEnabled(exam.status, exam.base_exam_modified, attemptCount)
  if (!transition.allowed) {
    throw new ScheduledExamError(
      SCHEDULED_EXAM_ERROR_CODES.WORKFLOW_INVALID_TRANSITION,
      transition.reason
    )
  }
  const hash = computeBaseExamHash({
    title: exam.title,
    instructions: exam.instructions ?? null,
    totalMarks: parseFloat(exam.total_marks),
    passMark: parseFloat(exam.pass_mark),
    durationMinutes: exam.duration_minutes ?? null,
    questionPoolId: exam.question_pool_id ?? null,
  })
  const updated = await repo.updateWorkflowStatus(
    db,
    id,
    workspaceId,
    'ENABLED',
    {
      base_exam_snapshot: baseExamSnapshot,
      base_exam_hash: hash,
      base_exam_modified: false,
    },
    audit
  )
  if (!updated) throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.NOT_FOUND)
  logger.info('scheduled_exam_enabled', {
    workspace_id: workspaceId,
    scheduled_exam_id: id,
    correlation_id: audit.correlation_id,
  })
  return updated
}

export async function reApproveScheduledExam(
  db: DbClient,
  id: string,
  workspaceId: string,
  audit: AuditContext
): Promise<ScheduledExamRow> {
  const exam = await repo.findById(db, id, workspaceId)
  if (!exam) throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.NOT_FOUND)
  if (exam.status !== 'APPROVED') {
    throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.WORKFLOW_INVALID_TRANSITION)
  }
  if (!exam.base_exam_modified) {
    throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.RE_APPROVE_NOT_REQUIRED)
  }
  const updated = await repo.updateWorkflowStatus(
    db,
    id,
    workspaceId,
    'APPROVED',
    { base_exam_modified: false },
    audit
  )
  if (!updated) throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.NOT_FOUND)
  logger.info('scheduled_exam_re_approved', {
    workspace_id: workspaceId,
    scheduled_exam_id: id,
    correlation_id: audit.correlation_id,
  })
  return updated
}

// ---------------------------------------------------------------------------
// Attempt Operations — require PoolClient for transaction + advisory lock
// ---------------------------------------------------------------------------

export interface ScheduledAttemptClient {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount?: number | null }>
}

export async function startScheduledAttempt(
  db: ScheduledAttemptClient,
  scheduledExamId: string,
  workspaceId: string,
  userId: string,
  audit: AuditContext
): Promise<AttemptStartResult> {
  // Advisory lock per spec — prevents concurrent start attempts for same user+exam
  const lockRes = await db.query<{ acquired: boolean }>(
    "SELECT pg_try_advisory_xact_lock(hashtext($1 || ':' || $2)) as acquired",
    [userId, scheduledExamId]
  )
  if (!lockRes.rows[0]?.acquired) {
    throw new ScheduledExamError(
      SCHEDULED_EXAM_ERROR_CODES.ALREADY_ATTEMPTED,
      'Concurrent start attempt in progress'
    )
  }

  const exam = await repo.findById(db as DbClient, scheduledExamId, workspaceId)
  if (!exam) throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.NOT_FOUND)
  if (exam.status !== 'ENABLED')
    throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.NOT_ENABLED)

  const now = new Date()
  if (!isWindowOpen(exam.window_start, exam.window_end, now)) {
    throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.WINDOW_NOT_OPEN)
  }

  // Check single-attempt rule (ABORTED attempts do not count)
  const existingAttempt = await db.query<{ id: string }>(
    "SELECT id FROM attempts WHERE scheduled_exam_id = $1 AND user_id = $2 AND workspace_id = $3 AND status NOT IN ('ABORTED')",
    [scheduledExamId, userId, workspaceId]
  )
  if ((existingAttempt.rows.length ?? 0) > 0) {
    throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.ALREADY_ATTEMPTED)
  }

  const scheduledEndTime = computeAttemptEndTime(exam.window_end, now, exam.duration_minutes)

  // Direct INSERT for scheduled attempt (snapshot captured at ENABLE time in base_exam_snapshot)
  const insertRes = await db.query<{ id: string }>(
    `INSERT INTO attempts (
      workspace_id, user_id, attempt_type, exam_id,
      question_snapshot, question_order, grading_config_snapshot,
      mode, flags_snapshot, exam_version, expected_schema_version, expected_product_version,
      started_at, server_start_time, status,
      is_scheduled, scheduled_exam_id, scheduled_end_time, last_heartbeat_at
    ) VALUES (
      $1, $2, 'MCQ_SCHEDULED', $3,
      $4::jsonb, ARRAY[]::text[], $5::jsonb,
      'CHRONO', '{}'::jsonb, '1.0.0', 0, '1.0.0',
      NOW(), NOW(), 'IN_PROGRESS',
      true, $3, $6, NOW()
    ) RETURNING id`,
    [
      workspaceId,
      userId,
      scheduledExamId,
      JSON.stringify(exam.base_exam_snapshot ?? {}),
      JSON.stringify({}),
      scheduledEndTime,
    ]
  )

  const attemptId = insertRes.rows[0]?.id

  logger.info('scheduled_attempt_started', {
    workspace_id: workspaceId,
    scheduled_exam_id: scheduledExamId,
    attempt_id: attemptId,
    user_id: userId,
    correlation_id: audit.correlation_id,
  })

  return {
    attempt_id: attemptId,
    remaining_seconds: computeRemainingSeconds(scheduledEndTime, now),
    scheduled_end_time: scheduledEndTime,
  }
}

export async function recordHeartbeat(
  db: DbClient,
  attemptId: string,
  workspaceId: string,
  userId: string,
  audit: AuditContext
): Promise<HeartbeatResult> {
  const res = await db.query<{
    id: string
    scheduled_end_time: Date
    status: string
    scheduled_exam_id: string
    user_id: string
  }>(
    'SELECT id, scheduled_end_time, status, scheduled_exam_id, user_id FROM attempts WHERE id = $1 AND workspace_id = $2',
    [attemptId, workspaceId]
  )
  const attempt = res.rows[0]
  if (!attempt) throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.ATTEMPT_NOT_FOUND)
  if (attempt.user_id !== userId)
    throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.ATTEMPT_NOT_FOUND)
  if (attempt.status !== 'IN_PROGRESS') {
    throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.ATTEMPT_ALREADY_SUBMITTED)
  }

  const now = new Date()
  await db.query('UPDATE attempts SET last_heartbeat_at = NOW() WHERE id = $1', [attemptId])

  const remainingSeconds = computeRemainingSeconds(attempt.scheduled_end_time, now)
  const autoSubmitScheduled = remainingSeconds <= 60 && remainingSeconds > 0

  if (autoSubmitScheduled) {
    logger.info('heartbeat_auto_submit_enqueued', {
      attempt_id: attemptId,
      remaining_seconds: remainingSeconds,
      correlation_id: audit.correlation_id,
    })
  }

  return { remaining_seconds: remainingSeconds, auto_submit_scheduled: autoSubmitScheduled }
}

export async function submitAttempt(
  db: DbClient,
  attemptId: string,
  workspaceId: string,
  userId: string,
  audit: AuditContext
): Promise<SubmitResult> {
  const res = await db.query<{
    id: string
    status: string
    user_id: string
    auto_submitted: boolean
    submitted_at: Date
  }>(
    'SELECT id, status, user_id, auto_submitted, submitted_at FROM attempts WHERE id = $1 AND workspace_id = $2',
    [attemptId, workspaceId]
  )
  const attempt = res.rows[0]
  if (!attempt) throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.ATTEMPT_NOT_FOUND)
  if (attempt.user_id !== userId)
    throw new ScheduledExamError(SCHEDULED_EXAM_ERROR_CODES.ATTEMPT_NOT_FOUND)

  // Idempotent — already submitted returns 200 with auto_submitted info
  if (attempt.status === 'SUBMITTED') {
    return {
      attempt_id: attemptId,
      auto_submitted: attempt.auto_submitted,
      submitted_at: attempt.submitted_at,
    }
  }

  const now = new Date()
  await db.query(
    "UPDATE attempts SET status = 'SUBMITTED', submitted_at = NOW(), updated_at = NOW() WHERE id = $1",
    [attemptId]
  )

  logger.info('scheduled_attempt_submitted', {
    workspace_id: workspaceId,
    attempt_id: attemptId,
    user_id: userId,
    correlation_id: audit.correlation_id,
  })

  return {
    attempt_id: attemptId,
    auto_submitted: false,
    submitted_at: now,
  }
}

export async function notifyBaseExamModified(
  db: DbClient,
  baseExamId: string,
  audit: AuditContext
): Promise<void> {
  const count = await repo.setBaseExamModified(db, baseExamId)
  logger.info('base_exam_modified_flag_set', {
    base_exam_id: baseExamId,
    affected_exams: count,
    correlation_id: audit.correlation_id,
  })
}
