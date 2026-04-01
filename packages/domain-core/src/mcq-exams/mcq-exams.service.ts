/**
 * MCQ Exams — Service Layer
 *
 * File: packages/domain-core/src/mcq-exams/mcq-exams.service.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 *
 * Orchestrates business logic, manages transactions (BEGIN/COMMIT/ROLLBACK),
 * delegates workflow transitions to the shared workflow engine.
 *
 * No HTTP/framework imports — pure domain logic only.
 */

import { createLogger } from '@zidney/logger'

import { executeTransition } from '../workflow/workflow.engine'
import { WorkflowState } from '../workflow/workflow.states'
import type { WorkflowTransitionResult } from '../workflow/workflow.types'

import { checkExamReferences } from './mcq-exams.dependency-registry'
import { McqExamError } from './mcq-exams.errors'
import * as repo from './mcq-exams.repository'
import type {
  AddExamQuestionsInput,
  AuditContext,
  CreateMcqExamInput,
  DbClient,
  ListMcqExamsInput,
  ListMcqExamsResult,
  McqExamAutoCriteriaRow,
  McqExamDetail,
  McqExamQuestionRow,
  McqExamRow,
  McqExamSettingsRow,
  McqExamStatus,
  ReorderQuestionsInput,
  SetCriteriaInput,
  UpdateMcqExamInput,
  UpsertExamSettingsInput,
} from './mcq-exams.types'
import { validateCriteriaSum, validatePassValue } from './mcq-exams.validators'

const logger = createLogger('mcq-exams:service')

// ---------------------------------------------------------------------------
// Read Operations (no TX)
// ---------------------------------------------------------------------------

/** Get an exam with settings, questions, and criteria. */
export async function getExam(
  db: DbClient,
  examId: string,
  audit: AuditContext
): Promise<McqExamDetail> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) throw new McqExamError('MCQ_EXAM_NOT_FOUND')

  const [settings, questions, criteria] = await Promise.all([
    repo.findSettingsByExamId(db, examId),
    repo.findQuestionsByExamId(db, examId),
    repo.findCriteriaByExamId(db, examId),
  ])

  logger.info('exam.fetched', {
    exam_id: examId,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })

  return { ...exam, settings, questions, criteria }
}

/** Filtered, paginated list of exams (metadata only). */
export async function listExams(
  db: DbClient,
  input: ListMcqExamsInput,
  audit: AuditContext
): Promise<ListMcqExamsResult> {
  const [data, total] = await Promise.all([repo.findExams(db, input), repo.countExams(db, input)])

  logger.info('exams.listed', {
    total,
    page: input.page,
    per_page: input.per_page,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })

  return { data, total, page: input.page, per_page: input.per_page }
}

/** Get settings for an exam. */
export async function getSettings(
  db: DbClient,
  examId: string,
  audit: AuditContext
): Promise<McqExamSettingsRow> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) throw new McqExamError('MCQ_EXAM_NOT_FOUND')

  const settings = await repo.findSettingsByExamId(db, examId)
  if (!settings) throw new McqExamError('MCQ_EXAM_SETTINGS_NOT_FOUND')

  logger.info('exam.settings.fetched', {
    exam_id: examId,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })

  return settings
}

/** Get questions linked to an exam. */
export async function getQuestions(
  db: DbClient,
  examId: string,
  audit: AuditContext
): Promise<McqExamQuestionRow[]> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) throw new McqExamError('MCQ_EXAM_NOT_FOUND')

  const questions = await repo.findQuestionsByExamId(db, examId)

  logger.info('exam.questions.fetched', {
    exam_id: examId,
    count: questions.length,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })

  return questions
}

/** Get auto criteria for an exam. */
export async function getCriteria(
  db: DbClient,
  examId: string,
  audit: AuditContext
): Promise<McqExamAutoCriteriaRow[]> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) throw new McqExamError('MCQ_EXAM_NOT_FOUND')

  const criteria = await repo.findCriteriaByExamId(db, examId)

  logger.info('exam.criteria.fetched', {
    exam_id: examId,
    count: criteria.length,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })

  return criteria
}

// ---------------------------------------------------------------------------
// Write Operations (with TX)
// ---------------------------------------------------------------------------

/** Create an exam atomically. Returns the created exam row. */
export async function createExam(
  db: DbClient,
  input: CreateMcqExamInput,
  audit: AuditContext
): Promise<McqExamRow> {
  // 1. Validate pass_value
  const passValidation = validatePassValue(input.pass_type, input.pass_value)
  if (!passValidation.valid) throw new McqExamError('MCQ_EXAM_INVALID_PASS_VALUE')

  // 2. Validate subject exists
  const subjectExists = await repo.checkSubjectExists(db, input.subject_id)
  if (!subjectExists) throw new McqExamError('MCQ_EXAM_NOT_FOUND')

  // 3. Validate division if provided
  if (input.division_id) {
    const divisionExists = await repo.checkDivisionExists(db, input.division_id)
    if (!divisionExists) throw new McqExamError('MCQ_EXAM_NOT_FOUND')
  }

  // 4. Begin transaction
  const client = await getTransactionClient(db)
  try {
    await client.query('BEGIN', [])

    const exam = await repo.insertExam(client, {
      name: input.name,
      code: input.code,
      description: input.description ?? null,
      subject_id: input.subject_id,
      division_id: input.division_id ?? null,
      language: input.language,
      total_questions: input.total_questions,
      duration_minutes: input.duration_minutes ?? null,
      pass_type: input.pass_type,
      pass_value: input.pass_value,
      allow_multiple_attempts: input.allow_multiple_attempts ?? false,
      selection_mode: input.selection_mode,
      actor_id: audit.user_id,
    })

    await client.query('COMMIT', [])

    logger.info('exam.created', {
      exam_id: exam.id,
      code: input.code,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return exam
  } catch (err: unknown) {
    await client.query('ROLLBACK', [])
    if (err instanceof McqExamError) throw err
    const pgErr = err as { code?: string }
    if (pgErr?.code === '23505') throw new McqExamError('MCQ_EXAM_CODE_EXISTS')
    throw err
  }
}

/** Update mutable fields on an existing exam. */
export async function updateExam(
  db: DbClient,
  examId: string,
  input: UpdateMcqExamInput,
  audit: AuditContext
): Promise<McqExamRow> {
  const existing = await repo.findExamById(db, examId)
  if (!existing) throw new McqExamError('MCQ_EXAM_NOT_FOUND')

  // subject_id is immutable after creation
  if (input.subject_id !== undefined) {
    throw new McqExamError('MCQ_EXAM_SUBJECT_IMMUTABLE')
  }

  // selection_mode locked after ENABLED or after attempts exist
  if (input.selection_mode !== undefined && input.selection_mode !== existing.selection_mode) {
    if (existing.status === 'ENABLED') {
      throw new McqExamError('MCQ_EXAM_SELECTION_LOCKED')
    }
    // TODO: check attempts table (future stage) — currently always passes
  }

  // Validate pass_value if changing pass_type or pass_value
  const effectivePassType = input.pass_type ?? existing.pass_type
  const effectivePassValue = input.pass_value ?? existing.pass_value
  if (input.pass_type !== undefined || input.pass_value !== undefined) {
    const passValidation = validatePassValue(effectivePassType, effectivePassValue)
    if (!passValidation.valid) throw new McqExamError('MCQ_EXAM_INVALID_PASS_VALUE')
  }

  const client = await getTransactionClient(db)
  try {
    await client.query('BEGIN', [])

    // SELECT FOR UPDATE to prevent concurrent modification
    const locked = await repo.findExamForUpdate(client, examId)
    if (!locked) throw new McqExamError('MCQ_EXAM_NOT_FOUND')

    const updated = await repo.updateExam(client, examId, {
      name: input.name,
      code: input.code,
      description: input.description,
      division_id: input.division_id,
      language: input.language,
      total_questions: input.total_questions,
      duration_minutes: input.duration_minutes,
      pass_type: input.pass_type,
      pass_value: input.pass_value,
      allow_multiple_attempts: input.allow_multiple_attempts,
      selection_mode: input.selection_mode,
      actor_id: audit.user_id,
    })

    await client.query('COMMIT', [])

    logger.info('exam.updated', {
      exam_id: examId,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return updated
  } catch (err: unknown) {
    await client.query('ROLLBACK', [])
    if (err instanceof McqExamError) throw err
    const pgErr = err as { code?: string }
    if (pgErr?.code === '23505') throw new McqExamError('MCQ_EXAM_CODE_EXISTS')
    throw err
  }
}

/** Soft-delete an exam after guard checks. */
export async function deleteExam(
  db: DbClient,
  examId: string,
  audit: AuditContext
): Promise<{ deleted: true }> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) throw new McqExamError('MCQ_EXAM_NOT_FOUND')

  // Cannot delete an ENABLED exam
  if (exam.status === 'ENABLED') {
    throw new McqExamError('MCQ_EXAM_STATUS_LOCKED')
  }

  // Check extensible dependency guards
  const refResult = await checkExamReferences(db, examId)
  if (refResult.isActiveAttempt) {
    throw new McqExamError('MCQ_EXAM_DELETION_BLOCKED')
  }
  if (refResult.hasReferences) {
    throw new McqExamError('MCQ_EXAM_DELETION_BLOCKED')
  }

  const client = await getTransactionClient(db)
  try {
    await client.query('BEGIN', [])

    await repo.softDeleteExam(client, examId, audit.user_id)

    await client.query('COMMIT', [])

    logger.info('exam.deleted', {
      exam_id: examId,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return { deleted: true }
  } catch (err: unknown) {
    await client.query('ROLLBACK', [])
    if (err instanceof McqExamError) throw err
    throw err
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Create or update exam settings (UPSERT). */
export async function upsertSettings(
  db: DbClient,
  examId: string,
  input: UpsertExamSettingsInput,
  audit: AuditContext
): Promise<McqExamSettingsRow> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) throw new McqExamError('MCQ_EXAM_NOT_FOUND')

  const client = await getTransactionClient(db)
  try {
    await client.query('BEGIN', [])

    const settings = await repo.upsertSettings(client, examId, input)

    await client.query('COMMIT', [])

    logger.info('exam.settings.upserted', {
      exam_id: examId,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return settings
  } catch (err: unknown) {
    await client.query('ROLLBACK', [])
    if (err instanceof McqExamError) throw err
    throw err
  }
}

// ---------------------------------------------------------------------------
// Questions (manual selection)
// ---------------------------------------------------------------------------

/** Add questions to an exam (validates each question). */
export async function addQuestions(
  db: DbClient,
  examId: string,
  input: AddExamQuestionsInput,
  audit: AuditContext
): Promise<McqExamQuestionRow[]> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) throw new McqExamError('MCQ_EXAM_NOT_FOUND')

  // TODO: check attempts exist (future stage) — currently always passes

  // Validate each question
  for (const entry of input.questions) {
    const check = await repo.checkQuestionForExam(
      db,
      entry.question_id,
      exam.subject_id,
      exam.division_id
    )
    if (!check.exists) throw new McqExamError('MCQ_EXAM_NOT_FOUND')
    if (!check.enabled) throw new McqExamError('MCQ_EXAM_QUESTION_NOT_ENABLED')
    if (!check.subject_match) throw new McqExamError('MCQ_EXAM_QUESTION_SUBJECT_MISMATCH')
    if (exam.division_id && !check.division_match) {
      throw new McqExamError('MCQ_EXAM_QUESTION_DIVISION_MISMATCH')
    }
  }

  const client = await getTransactionClient(db)
  try {
    await client.query('BEGIN', [])

    const questions = await repo.insertExamQuestions(client, examId, input.questions)

    await client.query('COMMIT', [])

    logger.info('exam.questions.added', {
      exam_id: examId,
      count: input.questions.length,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return questions
  } catch (err: unknown) {
    await client.query('ROLLBACK', [])
    if (err instanceof McqExamError) throw err
    const pgErr = err as { code?: string }
    if (pgErr?.code === '23505') throw new McqExamError('MCQ_EXAM_QUESTION_DUPLICATE')
    throw err
  }
}

/** Remove a single question from an exam. */
export async function removeQuestion(
  db: DbClient,
  examId: string,
  questionId: string,
  audit: AuditContext
): Promise<{ removed: true }> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) throw new McqExamError('MCQ_EXAM_NOT_FOUND')

  // TODO: check attempts exist (future stage) — currently always passes

  const client = await getTransactionClient(db)
  try {
    await client.query('BEGIN', [])

    const removed = await repo.removeExamQuestion(client, examId, questionId)
    if (!removed) throw new McqExamError('MCQ_EXAM_NOT_FOUND')

    await client.query('COMMIT', [])

    logger.info('exam.question.removed', {
      exam_id: examId,
      question_id: questionId,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return { removed: true }
  } catch (err: unknown) {
    await client.query('ROLLBACK', [])
    if (err instanceof McqExamError) throw err
    throw err
  }
}

/** Reorder questions (delete all + re-insert with new order_index values). */
export async function reorderQuestions(
  db: DbClient,
  examId: string,
  input: ReorderQuestionsInput,
  audit: AuditContext
): Promise<McqExamQuestionRow[]> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) throw new McqExamError('MCQ_EXAM_NOT_FOUND')

  // TODO: check attempts exist (future stage) — currently always passes

  const client = await getTransactionClient(db)
  try {
    await client.query('BEGIN', [])

    await repo.deleteAllExamQuestions(client, examId)
    const questions = await repo.insertExamQuestions(client, examId, input.order)

    await client.query('COMMIT', [])

    logger.info('exam.questions.reordered', {
      exam_id: examId,
      count: input.order.length,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return questions
  } catch (err: unknown) {
    await client.query('ROLLBACK', [])
    if (err instanceof McqExamError) throw err
    throw err
  }
}

// ---------------------------------------------------------------------------
// Auto Criteria
// ---------------------------------------------------------------------------

/** Replace all auto criteria for an exam (delete + insert in single TX). */
export async function setCriteria(
  db: DbClient,
  examId: string,
  input: SetCriteriaInput,
  audit: AuditContext
): Promise<McqExamAutoCriteriaRow[]> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) throw new McqExamError('MCQ_EXAM_NOT_FOUND')

  // TODO: check attempts exist (future stage) — currently always passes

  // Validate criteria sum = 100
  const sumValidation = validateCriteriaSum(input)
  if (!sumValidation.valid) throw new McqExamError('MCQ_EXAM_AUTO_SUM_INVALID')

  const client = await getTransactionClient(db)
  try {
    await client.query('BEGIN', [])

    const criteria = await repo.replaceCriteria(client, examId, input.criteria)

    await client.query('COMMIT', [])

    logger.info('exam.criteria.set', {
      exam_id: examId,
      count: input.criteria.length,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return criteria
  } catch (err: unknown) {
    await client.query('ROLLBACK', [])
    if (err instanceof McqExamError) throw err
    throw err
  }
}

// ---------------------------------------------------------------------------
// Workflow Transition
// ---------------------------------------------------------------------------

/**
 * Transition exam status via the shared workflow engine.
 * Pre-guard for ENABLED: settings exist, delivery mode enabled, chrono/duration
 * consistency, manual question count, auto criteria sum.
 * The workflow engine owns its own transaction. No outer TX here.
 */
export async function transitionExamStatus(
  db: DbClient,
  examId: string,
  targetStatus: McqExamStatus,
  audit: AuditContext & { enginePermissions: string[] }
): Promise<WorkflowTransitionResult> {
  const exam = await repo.findExamById(db, examId)
  if (!exam) throw new McqExamError('MCQ_EXAM_NOT_FOUND')

  // Pre-enable validation (plan.md §3.5)
  if (targetStatus === 'ENABLED') {
    await validatePreEnable(db, exam)
  }

  const result = await executeTransition(db, {
    entityType: 'mcq_exam',
    entityId: examId,
    targetState: WorkflowState[targetStatus],
    actorId: audit.user_id ?? '',
    permissions: audit.enginePermissions,
    correlationId: audit.correlation_id,
    workspaceSlug: audit.workspace_slug,
    workspaceId: audit.workspace_id,
  })

  logger.info('exam.status.transitioned', {
    exam_id: examId,
    target_status: targetStatus,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })

  return result
}

// ---------------------------------------------------------------------------
// Pre-Enable Validation (§3.5)
// ---------------------------------------------------------------------------

async function validatePreEnable(db: DbClient, exam: McqExamRow): Promise<void> {
  // 1. Settings must exist
  const settings = await repo.findSettingsByExamId(db, exam.id)
  if (!settings) throw new McqExamError('MCQ_EXAM_SETTINGS_NOT_FOUND')

  // 2. At least one delivery mode enabled
  if (!settings.allow_relax_mode && !settings.allow_chrono_mode && !settings.allow_rush_mode) {
    throw new McqExamError('MCQ_EXAM_NO_DELIVERY_MODE')
  }

  // 3. Chrono mode requires duration_minutes
  if (settings.allow_chrono_mode && exam.duration_minutes == null) {
    throw new McqExamError('MCQ_EXAM_CHRONO_NO_DURATION')
  }

  // 4. Manual mode: linked question count == total_questions
  if (exam.selection_mode === 'MANUAL') {
    const questionCount = await repo.countQuestionsByExamId(db, exam.id)
    if (questionCount !== exam.total_questions) {
      throw new McqExamError('MCQ_EXAM_MANUAL_COUNT_MISMATCH')
    }
  }

  // 5. Automatic mode: criteria percentages must sum to 100
  if (exam.selection_mode === 'AUTOMATIC') {
    const criteria = await repo.findCriteriaByExamId(db, exam.id)
    const sum = criteria.reduce((acc, c) => acc + c.percentage, 0)
    if (sum !== 100) {
      throw new McqExamError('MCQ_EXAM_AUTO_SUM_INVALID')
    }
  }
}

// ---------------------------------------------------------------------------
// TX Helper
// ---------------------------------------------------------------------------

/**
 * Get a transaction-capable client from the pool.
 * If the DbClient already has a `connect` method (pg.Pool), acquire a dedicated client.
 * Otherwise the caller is already a PoolClient — use it directly.
 */
async function getTransactionClient(db: DbClient): Promise<DbClient> {
  if ('connect' in db && typeof db.connect === 'function') {
    return (await db.connect()) as unknown as DbClient
  }
  return db
}
