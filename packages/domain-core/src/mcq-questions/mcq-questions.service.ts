/**
 * MCQ Questions — Service Layer
 *
 * File: packages/domain-core/src/mcq-questions/mcq-questions.service.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
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

import { checkQuestionReferences } from './mcq-questions.dependency-registry'
import { McqQuestionError } from './mcq-questions.errors'
import * as repo from './mcq-questions.repository'
import { sanitizeRichText } from './mcq-questions.sanitize'
import type {
  AuditContext,
  CreateMcqQuestionInput,
  DbClient,
  ListMcqQuestionsInput,
  ListMcqQuestionsResult,
  McqQuestionDetail,
  McqQuestionStatus,
  UpdateMcqQuestionInput,
} from './mcq-questions.types'
import { validateOptionsForType } from './mcq-questions.validators'

const logger = createLogger('mcq-questions:service')

// ---------------------------------------------------------------------------
// Read Operations (no TX)
// ---------------------------------------------------------------------------

/** Get a question with its options and all classification links. */
export async function getQuestion(
  db: DbClient,
  questionId: string,
  audit: AuditContext
): Promise<McqQuestionDetail> {
  const question = await repo.findQuestionById(db, questionId)
  if (!question) throw new McqQuestionError('QUESTION_NOT_FOUND')

  const [options, categories, tags, baskets] = await Promise.all([
    repo.findOptionsByQuestionId(db, questionId),
    repo.findCategoriesByQuestionId(db, questionId),
    repo.findTagsByQuestionId(db, questionId),
    repo.findBasketsByQuestionId(db, questionId),
  ])

  logger.info('question.fetched', {
    question_id: questionId,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })

  return { ...question, options, categories, tags, baskets }
}

/** Filtered, paginated list of questions (metadata only — no nested options). */
export async function listQuestions(
  db: DbClient,
  input: ListMcqQuestionsInput,
  audit: AuditContext
): Promise<ListMcqQuestionsResult> {
  const [data, total] = await Promise.all([
    repo.findQuestions(db, input),
    repo.countQuestions(db, input),
  ])

  logger.info('questions.listed', {
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

/** Create a question with options atomically. Returns the full question detail. */
export async function createQuestion(
  db: DbClient,
  input: CreateMcqQuestionInput,
  audit: AuditContext
): Promise<McqQuestionDetail> {
  // 1. Validate subject exists
  const subjectExists = await repo.checkSubjectExists(db, input.subject_id)
  if (!subjectExists) throw new McqQuestionError('SUBJECT_NOT_FOUND')

  // 2. Validate division + lesson if provided
  if (input.division_id) {
    const divisionExists = await repo.checkDivisionExists(db, input.division_id)
    if (!divisionExists) throw new McqQuestionError('DIVISION_SCOPE_VIOLATION')
  }
  if (input.lesson_id) {
    const lessonExists = await repo.checkLessonExists(db, input.lesson_id, input.subject_id)
    if (!lessonExists) throw new McqQuestionError('LESSON_SUBJECT_MISMATCH')
  }

  // 3. Validate options configuration
  const validation = validateOptionsForType(input.question_type, input.options)
  if (!validation.valid) throw new McqQuestionError('INVALID_OPTION_CONFIGURATION')

  // 4. Sanitise rich-text content
  const sanitizedContent = sanitizeRichText(input.content)
  const sanitizedExplanation = input.explanation ? sanitizeRichText(input.explanation) : null

  // 5. Begin transaction
  const client = await getTransactionClient(db)
  try {
    await client.query('BEGIN', [])

    const question = await repo.insertQuestion(client, {
      subject_id: input.subject_id,
      division_id: input.division_id ?? null,
      lesson_id: input.lesson_id ?? null,
      question_type: input.question_type,
      language: input.language,
      content: sanitizedContent,
      explanation: sanitizedExplanation,
      is_revision_only: input.is_revision_only ?? false,
      is_exam_only: input.is_exam_only ?? false,
      actor_id: audit.user_id,
    })

    // Insert options sequentially to preserve order
    const options = []
    for (const opt of input.options) {
      const sanitizedOptionContent = sanitizeRichText(opt.content)
      const inserted = await repo.insertOption(client, {
        question_id: question.id,
        content: sanitizedOptionContent,
        is_correct: opt.is_correct,
        order_index: opt.order_index,
      })
      options.push(inserted)
    }

    await client.query('COMMIT', [])

    logger.info('question.created', {
      question_id: question.id,
      question_type: input.question_type,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return { ...question, options, categories: [], tags: [], baskets: [] }
  } catch (err: unknown) {
    await client.query('ROLLBACK', [])
    if (err instanceof McqQuestionError) throw err
    const pgErr = err as { code?: string }
    if (pgErr?.code === '23505') throw new McqQuestionError('CONCURRENT_UPDATE_CONFLICT')
    throw err
  }
}

/** Update mutable fields and optionally replace all options. */
export async function updateQuestion(
  db: DbClient,
  questionId: string,
  input: UpdateMcqQuestionInput,
  audit: AuditContext
): Promise<McqQuestionDetail> {
  const existing = await repo.findQuestionById(db, questionId)
  if (!existing) throw new McqQuestionError('QUESTION_NOT_FOUND')

  // question_type is immutable after creation
  if (input.question_type && input.question_type !== existing.question_type) {
    throw new McqQuestionError('QUESTION_TYPE_IMMUTABLE')
  }

  // Validate subject if changing
  if (input.subject_id && input.subject_id !== existing.subject_id) {
    const subjectExists = await repo.checkSubjectExists(db, input.subject_id)
    if (!subjectExists) throw new McqQuestionError('SUBJECT_NOT_FOUND')
  }

  const effectiveSubjectId = input.subject_id ?? existing.subject_id

  if (input.division_id !== undefined && input.division_id) {
    const divisionExists = await repo.checkDivisionExists(db, input.division_id)
    if (!divisionExists) throw new McqQuestionError('DIVISION_SCOPE_VIOLATION')
  }
  if (input.lesson_id !== undefined && input.lesson_id) {
    const lessonExists = await repo.checkLessonExists(db, input.lesson_id, effectiveSubjectId)
    if (!lessonExists) throw new McqQuestionError('LESSON_SUBJECT_MISMATCH')
  }

  // Validate options if provided (full replace)
  if (input.options) {
    const validation = validateOptionsForType(existing.question_type, input.options)
    if (!validation.valid) throw new McqQuestionError('INVALID_OPTION_CONFIGURATION')
  }

  // Sanitize content fields
  const sanitizedContent = input.content ? sanitizeRichText(input.content) : undefined
  const sanitizedExplanation =
    input.explanation !== undefined
      ? input.explanation
        ? sanitizeRichText(input.explanation)
        : null
      : undefined

  const client = await getTransactionClient(db)
  try {
    await client.query('BEGIN', [])

    // Optimistic concurrency via updated_at
    const expectedUpdatedAt =
      input.updated_at instanceof Date ? input.updated_at : new Date(input.updated_at ?? 0)
    const updated = await repo.updateQuestionRow(client, questionId, expectedUpdatedAt, {
      subject_id: input.subject_id,
      ...(input.division_id !== undefined ? { division_id: input.division_id ?? null } : {}),
      ...(input.lesson_id !== undefined ? { lesson_id: input.lesson_id ?? null } : {}),
      language: input.language,
      content: sanitizedContent,
      ...(sanitizedExplanation !== undefined ? { explanation: sanitizedExplanation } : {}),
      is_revision_only: input.is_revision_only,
      is_exam_only: input.is_exam_only,
      actor_id: audit.user_id,
    })

    if (!updated) throw new McqQuestionError('CONCURRENT_UPDATE_CONFLICT')

    // Replace options if provided
    let options = await repo.findOptionsByQuestionId(client, questionId)
    if (input.options) {
      await repo.deleteOptionsByQuestionId(client, questionId)
      options = []
      for (const opt of input.options) {
        const sanitizedOptContent = sanitizeRichText(opt.content)
        const inserted = await repo.insertOption(client, {
          question_id: questionId,
          content: sanitizedOptContent,
          is_correct: opt.is_correct,
          order_index: opt.order_index,
        })
        options.push(inserted)
      }
    }

    await client.query('COMMIT', [])

    const [categories, tags, baskets] = await Promise.all([
      repo.findCategoriesByQuestionId(db, questionId),
      repo.findTagsByQuestionId(db, questionId),
      repo.findBasketsByQuestionId(db, questionId),
    ])

    logger.info('question.updated', {
      question_id: questionId,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return { ...updated, options, categories, tags, baskets }
  } catch (err: unknown) {
    await client.query('ROLLBACK', [])
    if (err instanceof McqQuestionError) throw err
    const pgErr = err as { code?: string }
    if (pgErr?.code === '23505') throw new McqQuestionError('CONCURRENT_UPDATE_CONFLICT')
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
  if (!question) throw new McqQuestionError('QUESTION_NOT_FOUND')

  // Guard: check references (active attempt blocks all deletion)
  const refResult = await checkQuestionReferences(db, questionId)
  if (refResult.isActiveAttempt) {
    throw new McqQuestionError('QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT')
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
    logger.info('question.deleted', {
      question_id: questionId,
      delete_type: deleteType,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return { deleted: true, deleteType }
  } catch (err: unknown) {
    await client.query('ROLLBACK', [])
    if (err instanceof McqQuestionError) throw err
    throw err
  }
}

// ---------------------------------------------------------------------------
// Workflow Transition
// ---------------------------------------------------------------------------

/**
 * Transition question status via the shared workflow engine.
 * Pre-guard for ENABLED: question must have valid options configured.
 * The workflow engine owns its own transaction. No outer TX here.
 */
export async function transitionQuestionStatus(
  db: DbClient,
  questionId: string,
  targetStatus: McqQuestionStatus,
  audit: AuditContext & { enginePermissions: string[] }
): Promise<WorkflowTransitionResult> {
  const question = await repo.findQuestionById(db, questionId)
  if (!question) throw new McqQuestionError('QUESTION_NOT_FOUND')

  // Pre-guard: ENABLED requires valid options
  if (targetStatus === 'ENABLED') {
    const options = await repo.findOptionsByQuestionId(db, questionId)
    if (options.length === 0) throw new McqQuestionError('QUESTION_HAS_NO_OPTIONS')

    const validation = validateOptionsForType(
      question.question_type,
      options.map((o) => ({
        content: o.content,
        is_correct: o.is_correct,
        order_index: o.order_index,
      }))
    )
    if (!validation.valid) throw new McqQuestionError('INVALID_OPTION_CONFIGURATION')
  }

  const result = await executeTransition(db, {
    entityType: 'mcq_question',
    entityId: questionId,
    targetState: WorkflowState[targetStatus],
    actorId: audit.user_id ?? '',
    permissions: audit.enginePermissions,
    correlationId: audit.correlation_id,
    workspaceSlug: audit.workspace_slug,
    workspaceId: audit.workspace_id,
  })

  logger.info('question.status.transitioned', {
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
  if (!question) throw new McqQuestionError('QUESTION_NOT_FOUND')

  const exists = await repo.checkCategoryValueExists(db, categoryValueId)
  if (!exists) throw new McqQuestionError('CATEGORY_VALUE_NOT_FOUND')

  try {
    await repo.insertQuestionCategory(db, questionId, categoryValueId)
  } catch (err: unknown) {
    const pgErr = err as { code?: string }
    if (pgErr?.code === '23505') throw new McqQuestionError('QUESTION_CATEGORY_ALREADY_LINKED')
    throw err
  }

  logger.info('question.category.linked', {
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
  if (!question) throw new McqQuestionError('QUESTION_NOT_FOUND')

  const removed = await repo.deleteQuestionCategory(db, questionId, categoryValueId)
  if (!removed) throw new McqQuestionError('QUESTION_CATEGORY_NOT_FOUND')

  logger.info('question.category.unlinked', {
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
  if (!question) throw new McqQuestionError('QUESTION_NOT_FOUND')

  const exists = await repo.checkTagExists(db, tagId)
  if (!exists) throw new McqQuestionError('TAG_NOT_FOUND')

  try {
    await repo.insertQuestionTag(db, questionId, tagId)
  } catch (err: unknown) {
    const pgErr = err as { code?: string }
    if (pgErr?.code === '23505') throw new McqQuestionError('QUESTION_TAG_ALREADY_LINKED')
    throw err
  }

  logger.info('question.tag.linked', {
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
  if (!question) throw new McqQuestionError('QUESTION_NOT_FOUND')

  const removed = await repo.deleteQuestionTag(db, questionId, tagId)
  if (!removed) throw new McqQuestionError('QUESTION_TAG_NOT_FOUND')

  logger.info('question.tag.unlinked', {
    question_id: questionId,
    tag_id: tagId,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })
}

export async function linkBasket(
  db: DbClient,
  questionId: string,
  basketId: string,
  audit: AuditContext
): Promise<void> {
  const question = await repo.findQuestionById(db, questionId)
  if (!question) throw new McqQuestionError('QUESTION_NOT_FOUND')

  const basket = await repo.findBasketForLinking(db, basketId)
  if (!basket) throw new McqQuestionError('BASKET_NOT_FOUND')

  // Check max_questions limit
  if (basket.max_questions !== null) {
    const currentCount = await repo.countBasketQuestionLinks(db, basketId)
    if (currentCount >= basket.max_questions) {
      throw new McqQuestionError('BASKET_MAX_QUESTIONS_REACHED')
    }
  }

  const client = await getTransactionClient(db)
  const isNewClient = client !== db
  try {
    await client.query('BEGIN', [])
    await repo.insertQuestionBasket(client, questionId, basketId)
    await client.query('COMMIT', [])
  } catch (err: unknown) {
    await client.query('ROLLBACK', [])
    const pgErr = err as { code?: string }
    if (pgErr?.code === '23505') throw new McqQuestionError('QUESTION_BASKET_ALREADY_LINKED')
    throw err
  } finally {
    if (
      isNewClient &&
      'release' in client &&
      typeof (client as { release?: () => void }).release === 'function'
    ) {
      const releasable = client as { release: () => void }
      releasable.release()
    }
  }

  logger.info('question.basket.linked', {
    question_id: questionId,
    basket_id: basketId,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })
}

export async function unlinkBasket(
  db: DbClient,
  questionId: string,
  basketId: string,
  audit: AuditContext
): Promise<void> {
  const question = await repo.findQuestionById(db, questionId)
  if (!question) throw new McqQuestionError('QUESTION_NOT_FOUND')

  const removed = await repo.deleteQuestionBasket(db, questionId, basketId)
  if (!removed) throw new McqQuestionError('QUESTION_BASKET_NOT_FOUND')

  logger.info('question.basket.unlinked', {
    question_id: questionId,
    basket_id: basketId,
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
