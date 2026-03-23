/**
 * Baskets — Service Layer
 *
 * File: packages/domain-core/src/baskets/baskets.service.ts
 * Stage: STAGE_33_MCQ_BASKETS
 *
 * Pure domain logic. No HTTP, no framework dependencies.
 * All write operations are wrapped in explicit BEGIN / COMMIT / ROLLBACK.
 * Server-authoritative time — NOW() used inside DB; never Date.now() here.
 *
 * Workflow transitions are delegated to the workflow engine.
 * The engine owns its own transaction — no outer TX must be opened here.
 */

import { createLogger } from '@zidney/logger'

import { executeTransition } from '../workflow/workflow.engine'
import { WorkflowState } from '../workflow/workflow.states'
import type { WorkflowTransitionResult } from '../workflow/workflow.types'
import { BasketError } from './baskets.errors'
import {
  checkAutoSelectionReference,
  checkExamConfigReference,
  checkQuestionExists,
  countBasketQuestionRows,
  countBasketQuestions,
  countBaskets,
  deleteBasketQuestion,
  deleteBasketRow,
  findBasketByCode,
  findBasketById,
  findBasketQuestion,
  findBasketQuestions,
  findBaskets,
  insertBasket,
  insertBasketQuestion,
  updateBasketRow,
} from './baskets.repository'
import type {
  AuditContext,
  BasketQuestionRow,
  BasketStatus,
  BasketWithCount,
  CreateBasketInput,
  DbClient,
  LinkQuestionInput,
  ListBasketQuestionsInput,
  ListBasketQuestionsResult,
  ListBasketsInput,
  ListBasketsResult,
  UpdateBasketInput,
} from './baskets.types'

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const logger = createLogger('baskets:service')

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

/** Get a single basket by ID including its computed question_count. Throws BASKET_NOT_FOUND if missing. */
export async function getBasket(
  db: DbClient,
  basketId: string,
  _audit: AuditContext
): Promise<BasketWithCount> {
  const basket = await findBasketById(db, basketId)
  if (!basket) throw new BasketError('BASKET_NOT_FOUND')
  return basket
}

/** List baskets with optional type / status / search filters and pagination. */
export async function listBaskets(
  db: DbClient,
  input: ListBasketsInput,
  _audit: AuditContext
): Promise<ListBasketsResult> {
  const page = Math.max(1, input.page)
  const perPage = Math.min(100, Math.max(1, input.perPage))
  const opts = { ...input, page, perPage }

  const [total, items] = await Promise.all([
    countBaskets(db, { type: opts.type, status: opts.status, search: opts.search }),
    findBaskets(db, opts),
  ])

  return { items, total, page, perPage }
}

/** List basket-question links (paginated) for a given basket. Throws BASKET_NOT_FOUND if basket missing. */
export async function listBasketQuestions(
  db: DbClient,
  basketId: string,
  input: Omit<ListBasketQuestionsInput, 'basket_id'>,
  _audit: AuditContext
): Promise<ListBasketQuestionsResult> {
  const basket = await findBasketById(db, basketId)
  if (!basket) throw new BasketError('BASKET_NOT_FOUND')

  const page = Math.max(1, input.page)
  const perPage = Math.min(100, Math.max(1, input.perPage))
  const opts: ListBasketQuestionsInput = { basket_id: basketId, page, perPage }

  const [total, items] = await Promise.all([
    countBasketQuestionRows(db, { basket_id: basketId }),
    findBasketQuestions(db, opts),
  ])

  return { items, total, page, perPage }
}

// ---------------------------------------------------------------------------
// Write Operations
// ---------------------------------------------------------------------------

/**
 * Create a new basket in DRAFT status.
 * Enforces unique code within the tenant DB.
 */
export async function createBasket(
  db: DbClient,
  input: CreateBasketInput,
  audit: AuditContext
): Promise<BasketWithCount> {
  await db.query('BEGIN')
  try {
    const existing = await findBasketByCode(db, input.code)
    if (existing) throw new BasketError('BASKET_CODE_DUPLICATE')

    const row = await insertBasket(db, {
      name: input.name,
      code: input.code,
      type: input.type,
      max_questions: input.max_questions ?? null,
      description: input.description ?? null,
      actor_id: audit.user_id,
    })

    await db.query('COMMIT')

    logger.info('basket.created', {
      basket_id: row.id,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return { ...row, question_count: 0 }
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof BasketError) throw err
    const pg = err as { code?: string }
    if (pg?.code === '23505') throw new BasketError('BASKET_CODE_DUPLICATE')
    throw err
  }
}

/**
 * Update mutable basket fields (name, code, max_questions, description).
 * Enforces code uniqueness if code is being changed.
 */
export async function updateBasket(
  db: DbClient,
  basketId: string,
  input: UpdateBasketInput,
  audit: AuditContext
): Promise<BasketWithCount> {
  await db.query('BEGIN')
  try {
    const existing = await findBasketById(db, basketId)
    if (!existing) throw new BasketError('BASKET_NOT_FOUND')

    if (input.code !== undefined && input.code !== existing.code) {
      const collision = await findBasketByCode(db, input.code)
      if (collision) throw new BasketError('BASKET_CODE_DUPLICATE')
    }

    const updated = await updateBasketRow(db, basketId, {
      name: input.name,
      code: input.code,
      max_questions: input.max_questions,
      description: input.description,
      actor_id: audit.user_id,
    })
    if (!updated) throw new BasketError('BASKET_NOT_FOUND')

    // Re-fetch to include question_count
    const withCount = await findBasketById(db, basketId)
    if (!withCount) throw new BasketError('BASKET_NOT_FOUND')

    await db.query('COMMIT')

    logger.info('basket.updated', {
      basket_id: basketId,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return withCount
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof BasketError) throw err
    const pg = err as { code?: string }
    if (pg?.code === '23505') throw new BasketError('BASKET_CODE_DUPLICATE')
    throw err
  }
}

/**
 * Delete a basket.
 * Blocked when exam_configurations or auto_selection_rules reference this basket (FR-019 / AD-004).
 * CASCADE on mcq_basket_questions removes all linked question rows.
 */
export async function deleteBasket(
  db: DbClient,
  basketId: string,
  audit: AuditContext
): Promise<void> {
  await db.query('BEGIN')
  try {
    const existing = await findBasketById(db, basketId)
    if (!existing) throw new BasketError('BASKET_NOT_FOUND')

    const referencedByExam = await checkExamConfigReference(db, basketId)
    if (referencedByExam) throw new BasketError('BASKET_REFERENCED_IN_EXAM_CONFIG')

    const referencedByAutoSelection = await checkAutoSelectionReference(db, basketId)
    if (referencedByAutoSelection) throw new BasketError('BASKET_REFERENCED_IN_AUTO_SELECTION')

    await deleteBasketRow(db, basketId)

    await db.query('COMMIT')

    logger.info('basket.deleted', {
      basket_id: basketId,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof BasketError) throw err
    throw err
  }
}

/**
 * Transition a basket's workflow status.
 *
 * Pre-guards (APPROVED → ENABLED only):
 *   - BASKET_EMPTY_CANNOT_ENABLE: basket has no linked questions
 *   - BASKET_EXCEEDS_MAX_QUESTIONS: basket has more questions than its max_questions limit
 *
 * The workflow engine owns its own transaction. No outer TX is opened here.
 * Permissions (enginePermissions) must be fully resolved by the route handler
 * from the RBAC context before calling this function.
 */
export async function transitionStatus(
  db: DbClient,
  basketId: string,
  targetStatus: BasketStatus,
  audit: AuditContext & { enginePermissions: string[] }
): Promise<WorkflowTransitionResult> {
  const basket = await findBasketById(db, basketId)
  if (!basket) throw new BasketError('BASKET_NOT_FOUND')

  // Pre-guards only apply when transitioning to ENABLED
  if (targetStatus === 'ENABLED') {
    const questionCount = await countBasketQuestions(db, basketId)
    if (questionCount === 0) throw new BasketError('BASKET_EMPTY_CANNOT_ENABLE')
    if (basket.max_questions !== null && questionCount > basket.max_questions) {
      throw new BasketError('BASKET_EXCEEDS_MAX_QUESTIONS')
    }
  }

  const result = await executeTransition(db, {
    entityType: 'mcq_basket',
    entityId: basketId,
    targetState: WorkflowState[targetStatus],
    actorId: audit.user_id ?? '',
    permissions: audit.enginePermissions,
    correlationId: audit.correlation_id,
    workspaceSlug: audit.workspace_slug,
    workspaceId: audit.workspace_id,
  })

  logger.info('basket.status.transitioned', {
    basket_id: basketId,
    target_status: targetStatus,
    workspace_id: audit.workspace_id,
    correlation_id: audit.correlation_id,
  })

  return result
}

/**
 * Link a question to a basket.
 * Guards: basket exists, question exists, not already linked, max_questions cap not hit.
 */
export async function linkQuestion(
  db: DbClient,
  input: LinkQuestionInput,
  audit: AuditContext
): Promise<BasketQuestionRow> {
  await db.query('BEGIN')
  try {
    const basket = await findBasketById(db, input.basket_id)
    if (!basket) throw new BasketError('BASKET_NOT_FOUND')

    const questionExists = await checkQuestionExists(db, input.question_id)
    if (!questionExists) throw new BasketError('QUESTION_NOT_FOUND')

    const already = await findBasketQuestion(db, input.basket_id, input.question_id)
    if (already) throw new BasketError('BASKET_QUESTION_DUPLICATE')

    if (basket.max_questions !== null) {
      const count = await countBasketQuestions(db, input.basket_id)
      if (count >= basket.max_questions) throw new BasketError('BASKET_MAX_QUESTIONS_REACHED')
    }

    const row = await insertBasketQuestion(db, input.basket_id, input.question_id)

    await db.query('COMMIT')

    logger.info('basket-question.linked', {
      basket_id: input.basket_id,
      question_id: input.question_id,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })

    return row
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof BasketError) throw err
    const pg = err as { code?: string }
    if (pg?.code === '23505') throw new BasketError('BASKET_QUESTION_DUPLICATE')
    throw err
  }
}

/**
 * Unlink a question from a basket.
 * Guards: basket exists, link exists.
 */
export async function unlinkQuestion(
  db: DbClient,
  basketId: string,
  questionId: string,
  audit: AuditContext
): Promise<void> {
  await db.query('BEGIN')
  try {
    const basket = await findBasketById(db, basketId)
    if (!basket) throw new BasketError('BASKET_NOT_FOUND')

    const link = await findBasketQuestion(db, basketId, questionId)
    if (!link) throw new BasketError('BASKET_QUESTION_NOT_FOUND')

    await deleteBasketQuestion(db, basketId, questionId)

    await db.query('COMMIT')

    logger.info('basket-question.unlinked', {
      basket_id: basketId,
      question_id: questionId,
      workspace_id: audit.workspace_id,
      correlation_id: audit.correlation_id,
    })
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof BasketError) throw err
    throw err
  }
}
