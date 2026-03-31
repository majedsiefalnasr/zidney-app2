/**
 * Traditional Questions — Service Layer
 *
 * File: packages/domain-core/src/traditional-questions/traditional-questions.service.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
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

import { checkQuestionReferences } from './traditional-questions.dependency-registry'
import { TraditionalQuestionError } from './traditional-questions.errors'
import * as repo from './traditional-questions.repository'
import { sanitizeRichText } from './traditional-questions.sanitize'
import type {
  AuditContext,
  CreateTraditionalQuestionInput,
  DbClient,
  ListTraditionalQuestionsInput,
  ListTraditionalQuestionsResult,
  TraditionalQuestionDetail,
  TraditionalQuestionStatus,
  UpdateTraditionalQuestionInput,
} from './traditional-questions.types'
import { validateCorrectAnswer } from './traditional-questions.validators'

const logger = createLogger('traditional-questions:service')

// ---------------------------------------------------------------------------
// Read Operations (no TX)
// ---------------------------------------------------------------------------

/** Get a question with all classification links. */
export async function getQuestion(
  db: DbClient,
  questionId: string,
  audit: AuditContext
): Promise<TraditionalQuestionDetail> {
  const question = await repo.findQuestionById(db, questionId)
  if (!question) throw new TraditionalQuestionError('TRAD_QUESTION_NOT_FOUND')

  const [categories, tags] = await Promise.all([
    repo.findCategoriesByQuestionId(db, questionId),
    repo.findTagsByQuestionId(db, questionId),
  ])

  logger.info('traditional_question.fetched', {
    question_id: questionId,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })

  return { ...question, categories, tags }
}

/** Filtered, paginated list of questions (metadata only). */
export async function listQuestions(
  db: DbClient,
  input: ListTraditionalQuestionsInput,
  audit: AuditContext
): Promise<ListTraditionalQuestionsResult> {
  const [data, total] = await Promise.all([
    repo.findQuestions(db, input),
    repo.countQuestions(db, input),
  ])

  logger.info('traditional_questions.listed', {
    total,
    page: input.page,
    per_page: input.per_page,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })

  return { data, total, page: input.page, per_page: input.per_page }
}

// ---------------------------------------------------------------------------
// Write Operations (with TX)
// ---------------------------------------------------------------------------

/** Create a traditional question atomically. Returns the full question detail. */
export async function createQuestion(
  db: DbClient,
  input: CreateTraditionalQuestionInput,
  audit: AuditContext
): Promise<TraditionalQuestionDetail> {
  // 1. Validate subject exists
  const subjectExists = await repo.checkSubjectExists(db, input.subject_id)
  if (!subjectExists) throw new TraditionalQuestionError('TRAD_QUESTION_SUBJECT_NOT_FOUND')

  // 2. Validate subsection exists
  const subsectionExists = await repo.checkSubsectionExists(db, input.subsection_id)
  if (!subsectionExists) throw new TraditionalQuestionError('TRAD_QUESTION_SUBSECTION_NOT_FOUND')

  // 3. Validate subsection-subject match (subsection → section → exam → subject)
  const subsectionMatch = await repo.checkSubsectionSubjectMatch(
    db,
    input.subsection_id,
    input.subject_id
  )
  if (!subsectionMatch) {
    throw new TraditionalQuestionError('TRAD_QUESTION_SUBSECTION_SUBJECT_MISMATCH')
  }

  // 4. Validate division if provided
  if (input.division_id) {
    const divisionExists = await repo.checkDivisionExists(db, input.division_id)
    if (!divisionExists)
      throw new TraditionalQuestionError('TRAD_QUESTION_DIVISION_SCOPE_VIOLATION')
  }

  // 5. Validate lesson + lesson-subject match if provided
  if (input.lesson_id) {
    const lessonExists = await repo.checkLessonExists(db, input.lesson_id, input.subject_id)
    if (!lessonExists) throw new TraditionalQuestionError('TRAD_QUESTION_LESSON_SUBJECT_MISMATCH')
  }

  // 6. Validate correct_answer structure for question type
  if (input.correct_answer !== undefined && input.correct_answer !== null) {
    const validation = validateCorrectAnswer(input.question_type, input.correct_answer)
    if (!validation.valid) {
      throw new TraditionalQuestionError('TRAD_QUESTION_INVALID_CORRECT_ANSWER')
    }
  }

  // 7. Sanitise rich-text content
  const sanitizedContent = sanitizeRichText(input.content)

  // 8. Begin transaction
  const client = await getTransactionClient(db)
  try {
    await client.query('BEGIN', [])

    const question = await repo.insertQuestion(client, {
      subject_id: input.subject_id,
      division_id: input.division_id ?? null,
      lesson_id: input.lesson_id ?? null,
      subsection_id: input.subsection_id,
      question_type: input.question_type,
      language: input.language,
      content: sanitizedContent,
      correct_answer: input.correct_answer ?? null,
      correction_criteria: input.correction_criteria ?? null,
      score: input.score,
      actor_id: audit.user_id,
    })

    await client.query('COMMIT', [])

    logger.info('traditional_question.created', {
      question_id: question.id,
      question_type: input.question_type,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return { ...question, categories: [], tags: [] }
  } catch (err: unknown) {
    await client.query('ROLLBACK', [])
    if (err instanceof TraditionalQuestionError) throw err
    const pgErr = err as { code?: string }
    if (pgErr?.code === '23505') {
      throw new TraditionalQuestionError('TRAD_QUESTION_CONCURRENT_UPDATE_CONFLICT')
    }
    throw err
  }
}

/** Update mutable fields. Immutable: question_type, subject_id, subsection_id. */
export async function updateQuestion(
  db: DbClient,
  questionId: string,
  input: UpdateTraditionalQuestionInput,
  audit: AuditContext
): Promise<TraditionalQuestionDetail> {
  const existing = await repo.findQuestionById(db, questionId)
  if (!existing) throw new TraditionalQuestionError('TRAD_QUESTION_NOT_FOUND')

  // Immutability guards — type, subject, subsection are NOT in UpdateInput,
  // but guard defensively in case raw data bypasses validation layer
  // (UpdateTraditionalQuestionInput deliberately excludes these fields)

  // Validate division if changing
  if (input.division_id !== undefined && input.division_id) {
    const divisionExists = await repo.checkDivisionExists(db, input.division_id)
    if (!divisionExists)
      throw new TraditionalQuestionError('TRAD_QUESTION_DIVISION_SCOPE_VIOLATION')
  }

  // Validate lesson + lesson-subject match if changing
  if (input.lesson_id !== undefined && input.lesson_id) {
    const lessonExists = await repo.checkLessonExists(db, input.lesson_id, existing.subject_id)
    if (!lessonExists) throw new TraditionalQuestionError('TRAD_QUESTION_LESSON_SUBJECT_MISMATCH')
  }

  // Validate correct_answer structure if provided
  if ('correct_answer' in input && input.correct_answer !== undefined) {
    if (input.correct_answer !== null) {
      const validation = validateCorrectAnswer(existing.question_type, input.correct_answer)
      if (!validation.valid) {
        throw new TraditionalQuestionError('TRAD_QUESTION_INVALID_CORRECT_ANSWER')
      }
    }
  }

  // Sanitize content if provided
  const sanitizedContent = input.content ? sanitizeRichText(input.content) : undefined

  const client = await getTransactionClient(db)
  try {
    await client.query('BEGIN', [])

    // Optimistic concurrency via updated_at
    const expectedUpdatedAt =
      input.updated_at instanceof Date ? input.updated_at : new Date(input.updated_at ?? 0)
    const updated = await repo.updateQuestionRow(client, questionId, expectedUpdatedAt, {
      ...(input.division_id !== undefined ? { division_id: input.division_id ?? null } : {}),
      ...(input.lesson_id !== undefined ? { lesson_id: input.lesson_id ?? null } : {}),
      language: input.language,
      content: sanitizedContent,
      ...('correct_answer' in input ? { correct_answer: input.correct_answer ?? null } : {}),
      ...('correction_criteria' in input
        ? { correction_criteria: input.correction_criteria ?? null }
        : {}),
      score: input.score,
      actor_id: audit.user_id,
    })

    if (!updated) throw new TraditionalQuestionError('TRAD_QUESTION_CONCURRENT_UPDATE_CONFLICT')

    await client.query('COMMIT', [])

    const [categories, tags] = await Promise.all([
      repo.findCategoriesByQuestionId(db, questionId),
      repo.findTagsByQuestionId(db, questionId),
    ])

    logger.info('traditional_question.updated', {
      question_id: questionId,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return { ...updated, categories, tags }
  } catch (err: unknown) {
    await client.query('ROLLBACK', [])
    if (err instanceof TraditionalQuestionError) throw err
    const pgErr = err as { code?: string }
    if (pgErr?.code === '23505') {
      throw new TraditionalQuestionError('TRAD_QUESTION_CONCURRENT_UPDATE_CONFLICT')
    }
    throw err
  }
}

/**
 * Delete a question. Strategy:
 * - Active attempt reference → BLOCK (409)
 * - DRAFT + no references → HARD delete
 * - Otherwise → SOFT delete (set deleted_at)
 */
export async function deleteQuestion(
  db: DbClient,
  questionId: string,
  audit: AuditContext
): Promise<{ deleted: true; deleteType: 'soft' | 'hard' }> {
  const question = await repo.findQuestionById(db, questionId)
  if (!question) throw new TraditionalQuestionError('TRAD_QUESTION_NOT_FOUND')

  // Guard: check references (active attempt blocks all deletion)
  const refResult = await checkQuestionReferences(db, questionId)
  if (refResult.isActiveAttempt) {
    throw new TraditionalQuestionError('TRAD_QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT')
  }

  // Determine strategy
  const canHardDelete = question.status === 'DRAFT' && !refResult.hasReferences

  const client = await getTransactionClient(db)
  try {
    await client.query('BEGIN', [])

    if (canHardDelete) {
      await repo.deleteQuestionRow(client, questionId)
    } else {
      await repo.softDeleteQuestionRow(client, questionId, audit.user_id)
    }

    await client.query('COMMIT', [])

    const deleteType = canHardDelete ? 'hard' : 'soft'
    logger.info('traditional_question.deleted', {
      question_id: questionId,
      delete_type: deleteType,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return { deleted: true, deleteType }
  } catch (err: unknown) {
    await client.query('ROLLBACK', [])
    if (err instanceof TraditionalQuestionError) throw err
    throw err
  }
}

// ---------------------------------------------------------------------------
// Workflow Transition
// ---------------------------------------------------------------------------

/**
 * Transition question status via the shared workflow engine.
 * Pre-guard for ENABLED:
 *   - TRUE_FALSE & FILL_BLANK → correct_answer required
 *   - SHORT_ANSWER → correct_answer optional (model_answer)
 */
export async function transitionQuestionStatus(
  db: DbClient,
  questionId: string,
  targetStatus: TraditionalQuestionStatus,
  audit: AuditContext & { enginePermissions: string[] }
): Promise<WorkflowTransitionResult> {
  const question = await repo.findQuestionById(db, questionId)
  if (!question) throw new TraditionalQuestionError('TRAD_QUESTION_NOT_FOUND')

  // Pre-guard: ENABLED requires correct_answer for TRUE_FALSE and FILL_BLANK
  if (targetStatus === 'ENABLED') {
    if (
      (question.question_type === 'TRUE_FALSE' || question.question_type === 'FILL_BLANK') &&
      !question.correct_answer
    ) {
      throw new TraditionalQuestionError('TRAD_QUESTION_MISSING_CORRECT_ANSWER')
    }

    // Validate correct_answer structure if present
    if (question.correct_answer) {
      const validation = validateCorrectAnswer(question.question_type, question.correct_answer)
      if (!validation.valid) {
        throw new TraditionalQuestionError('TRAD_QUESTION_INVALID_CORRECT_ANSWER')
      }
    }
  }

  const result = await executeTransition(db, {
    entityType: 'traditional_question',
    entityId: questionId,
    targetState: WorkflowState[targetStatus],
    actorId: audit.user_id ?? '',
    permissions: audit.enginePermissions,
    correlationId: audit.correlation_id,
    workspaceSlug: audit.workspace_slug,
    workspaceId: audit.workspace_id,
  })

  logger.info('traditional_question.status.transitioned', {
    question_id: questionId,
    target_status: targetStatus,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })

  return result
}

// ---------------------------------------------------------------------------
// Classification Link/Unlink
// ---------------------------------------------------------------------------

export async function linkCategory(
  db: DbClient,
  questionId: string,
  categoryValueId: string,
  audit: AuditContext
): Promise<void> {
  const question = await repo.findQuestionById(db, questionId)
  if (!question) throw new TraditionalQuestionError('TRAD_QUESTION_NOT_FOUND')

  const exists = await repo.checkCategoryValueExists(db, categoryValueId)
  if (!exists) throw new TraditionalQuestionError('TRAD_QUESTION_CATEGORY_VALUE_NOT_FOUND')

  try {
    await repo.insertQuestionCategory(db, questionId, categoryValueId)
  } catch (err: unknown) {
    const pgErr = err as { code?: string }
    if (pgErr?.code === '23505') {
      throw new TraditionalQuestionError('TRAD_QUESTION_CATEGORY_ALREADY_LINKED')
    }
    throw err
  }

  logger.info('traditional_question.category.linked', {
    question_id: questionId,
    category_value_id: categoryValueId,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })
}

export async function unlinkCategory(
  db: DbClient,
  questionId: string,
  categoryValueId: string,
  audit: AuditContext
): Promise<void> {
  const question = await repo.findQuestionById(db, questionId)
  if (!question) throw new TraditionalQuestionError('TRAD_QUESTION_NOT_FOUND')

  const removed = await repo.deleteQuestionCategory(db, questionId, categoryValueId)
  if (!removed) throw new TraditionalQuestionError('TRAD_QUESTION_CATEGORY_NOT_FOUND')

  logger.info('traditional_question.category.unlinked', {
    question_id: questionId,
    category_value_id: categoryValueId,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })
}

export async function linkTag(
  db: DbClient,
  questionId: string,
  tagId: string,
  audit: AuditContext
): Promise<void> {
  const question = await repo.findQuestionById(db, questionId)
  if (!question) throw new TraditionalQuestionError('TRAD_QUESTION_NOT_FOUND')

  const exists = await repo.checkTagExists(db, tagId)
  if (!exists) throw new TraditionalQuestionError('TRAD_QUESTION_TAG_NOT_FOUND')

  try {
    await repo.insertQuestionTag(db, questionId, tagId)
  } catch (err: unknown) {
    const pgErr = err as { code?: string }
    if (pgErr?.code === '23505') {
      throw new TraditionalQuestionError('TRAD_QUESTION_TAG_ALREADY_LINKED')
    }
    throw err
  }

  logger.info('traditional_question.tag.linked', {
    question_id: questionId,
    tag_id: tagId,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })
}

export async function unlinkTag(
  db: DbClient,
  questionId: string,
  tagId: string,
  audit: AuditContext
): Promise<void> {
  const question = await repo.findQuestionById(db, questionId)
  if (!question) throw new TraditionalQuestionError('TRAD_QUESTION_NOT_FOUND')

  const removed = await repo.deleteQuestionTag(db, questionId, tagId)
  if (!removed) throw new TraditionalQuestionError('TRAD_QUESTION_TAG_NOT_FOUND')

  logger.info('traditional_question.tag.unlinked', {
    question_id: questionId,
    tag_id: tagId,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })
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
