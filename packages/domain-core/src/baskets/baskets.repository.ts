/**
 * Baskets — Repository
 *
 * File: packages/domain-core/src/baskets/baskets.repository.ts
 * Stage: STAGE_33_MCQ_BASKETS
 *
 * Pure SQL functions. No transactions opened here — all TX management is in the service layer.
 * No imports from apps/* — pure domain functions only.
 *
 * NOTE on checkExamConfigReference / checkAutoSelectionReference:
 *   The tables `exam_configurations` and `auto_selection_rules` are provisioned in future stages.
 *   A PostgreSQL error 42P01 (undefined_table) is caught and treated as zero references.
 *   This means deletion is safe when those tables do not yet exist.
 *   Enforcement becomes automatic once the tables are provisioned (AD-004).
 *
 * NOTE on checkQuestionExists:
 *   The table `mcq_questions` may not be present in all tenant DBs provisioned before Stage 023.
 *   Catch 42P01 and treat as "not found" to avoid false negatives.
 */

import type {
  BasketQuestionRow,
  BasketRow,
  BasketStatus,
  BasketType,
  BasketWithCount,
  DbClient,
  ListBasketQuestionsInput,
  ListBasketsInput,
} from './baskets.types'

// ---------------------------------------------------------------------------
// Internal Row Mapper Types
// ---------------------------------------------------------------------------

interface BasketDbRow extends Record<string, unknown> {
  id: string
  name: string
  code: string
  type: string
  max_questions: number | null
  description: string | null
  status: string
  status_updated_at: Date | null
  status_updated_by: string | null
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
}

interface BasketWithCountDbRow extends BasketDbRow {
  question_count: string // PostgreSQL COUNT returns string
}

interface BasketQuestionDbRow extends Record<string, unknown> {
  id: string
  basket_id: string
  question_id: string
  created_at: Date
}

interface CountRow extends Record<string, unknown> {
  count: string
}

// ---------------------------------------------------------------------------
// Private Helpers
// ---------------------------------------------------------------------------

function mapBasketRow(row: BasketDbRow): BasketRow {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    type: row.type as BasketType,
    max_questions: row.max_questions,
    description: row.description,
    status: row.status as BasketStatus,
    status_updated_at: row.status_updated_at,
    status_updated_by: row.status_updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
  }
}

function mapBasketWithCount(row: BasketWithCountDbRow): BasketWithCount {
  return {
    ...mapBasketRow(row),
    question_count: parseInt(row.question_count, 10),
  }
}

function mapBasketQuestionRow(row: BasketQuestionDbRow): BasketQuestionRow {
  return {
    id: row.id,
    basket_id: row.basket_id,
    question_id: row.question_id,
    created_at: row.created_at,
  }
}

// ---------------------------------------------------------------------------
// Basket Read Functions
// ---------------------------------------------------------------------------

/** Find a basket by ID with its computed question_count. */
export async function findBasketById(
  db: DbClient,
  basketId: string
): Promise<BasketWithCount | null> {
  const result = await db.query<BasketWithCountDbRow>(
    `SELECT b.id, b.name, b.code, b.type, b.max_questions, b.description, b.status,
            b.status_updated_at, b.status_updated_by,
            b.created_at, b.updated_at, b.created_by, b.updated_by,
            COUNT(bq.id)::text AS question_count
       FROM mcq_baskets b
       LEFT JOIN mcq_basket_questions bq ON bq.basket_id = b.id
      WHERE b.id = $1
      GROUP BY b.id`,
    [basketId]
  )
  return result.rows[0] ? mapBasketWithCount(result.rows[0]) : null
}

/** Find baskets matching optional filters with pagination. */
export async function findBaskets(
  db: DbClient,
  input: ListBasketsInput
): Promise<BasketWithCount[]> {
  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (input.type) {
    conditions.push(`b.type = $${idx++}`)
    params.push(input.type)
  }
  if (input.status) {
    conditions.push(`b.status = $${idx++}`)
    params.push(input.status)
  }
  if (input.search) {
    conditions.push(`(b.name ILIKE $${idx} OR b.code ILIKE $${idx})`)
    idx++
    params.push(`%${input.search}%`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const offset = (input.page - 1) * input.perPage
  params.push(input.perPage, offset)

  const result = await db.query<BasketWithCountDbRow>(
    `SELECT b.id, b.name, b.code, b.type, b.max_questions, b.description, b.status,
            b.status_updated_at, b.status_updated_by,
            b.created_at, b.updated_at, b.created_by, b.updated_by,
            COUNT(bq.id)::text AS question_count
       FROM mcq_baskets b
       LEFT JOIN mcq_basket_questions bq ON bq.basket_id = b.id
      ${where}
      GROUP BY b.id
      ORDER BY b.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  )
  return result.rows.map(mapBasketWithCount)
}

/** Count baskets matching optional filters. */
export async function countBaskets(
  db: DbClient,
  input: Pick<ListBasketsInput, 'type' | 'status' | 'search'>
): Promise<number> {
  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (input.type) {
    conditions.push(`type = $${idx++}`)
    params.push(input.type)
  }
  if (input.status) {
    conditions.push(`status = $${idx++}`)
    params.push(input.status)
  }
  if (input.search) {
    conditions.push(`(name ILIKE $${idx} OR code ILIKE $${idx})`)
    idx++
    params.push(`%${input.search}%`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS count FROM mcq_baskets ${where}`,
    params
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

/** Find a basket by its unique code (for duplicate-check). */
export async function findBasketByCode(db: DbClient, code: string): Promise<BasketRow | null> {
  const result = await db.query<BasketDbRow>(
    `SELECT id, name, code, type, max_questions, description, status,
            status_updated_at, status_updated_by,
            created_at, updated_at, created_by, updated_by
       FROM mcq_baskets
      WHERE code = $1
      LIMIT 1`,
    [code]
  )
  return result.rows[0] ? mapBasketRow(result.rows[0]) : null
}

// ---------------------------------------------------------------------------
// Basket Write Functions
// ---------------------------------------------------------------------------

/** Insert a new basket row. Returns the full inserted row. */
export async function insertBasket(
  db: DbClient,
  data: {
    name: string
    code: string
    type: string
    max_questions?: number | null
    description?: string | null
    actor_id: string | null
  }
): Promise<BasketRow> {
  const result = await db.query<BasketDbRow>(
    `INSERT INTO mcq_baskets (name, code, type, max_questions, description, status, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, 'DRAFT', $6, $6)
     RETURNING id, name, code, type, max_questions, description, status,
               status_updated_at, status_updated_by,
               created_at, updated_at, created_by, updated_by`,
    [
      data.name,
      data.code,
      data.type,
      data.max_questions ?? null,
      data.description ?? null,
      data.actor_id,
    ]
  )
  return mapBasketRow(result.rows[0])
}

/** Update mutable basket fields. Returns updated row or null if not found. */
export async function updateBasketRow(
  db: DbClient,
  basketId: string,
  data: {
    name?: string
    code?: string
    max_questions?: number | null
    description?: string | null
    actor_id: string | null
  }
): Promise<BasketRow | null> {
  const setClauses: string[] = ['updated_at = NOW()', 'updated_by = $1']
  const params: unknown[] = [data.actor_id]
  let idx = 2

  if (data.name !== undefined) {
    setClauses.push(`name = $${idx++}`)
    params.push(data.name)
  }
  if (data.code !== undefined) {
    setClauses.push(`code = $${idx++}`)
    params.push(data.code)
  }
  if ('max_questions' in data) {
    setClauses.push(`max_questions = $${idx++}`)
    params.push(data.max_questions ?? null)
  }
  if ('description' in data) {
    setClauses.push(`description = $${idx++}`)
    params.push(data.description ?? null)
  }

  params.push(basketId)

  const result = await db.query<BasketDbRow>(
    `UPDATE mcq_baskets
        SET ${setClauses.join(', ')}
      WHERE id = $${idx}
      RETURNING id, name, code, type, max_questions, description, status,
                status_updated_at, status_updated_by,
                created_at, updated_at, created_by, updated_by`,
    params
  )
  return result.rows[0] ? mapBasketRow(result.rows[0]) : null
}

/** Delete a basket by ID. CASCADE removes linked basket_questions. */
export async function deleteBasketRow(db: DbClient, basketId: string): Promise<void> {
  await db.query('DELETE FROM mcq_baskets WHERE id = $1', [basketId])
}

// ---------------------------------------------------------------------------
// Basket Question Functions
// ---------------------------------------------------------------------------

/** Find a specific basket–question link row. */
export async function findBasketQuestion(
  db: DbClient,
  basketId: string,
  questionId: string
): Promise<BasketQuestionRow | null> {
  const result = await db.query<BasketQuestionDbRow>(
    `SELECT id, basket_id, question_id, created_at
       FROM mcq_basket_questions
      WHERE basket_id = $1 AND question_id = $2
      LIMIT 1`,
    [basketId, questionId]
  )
  return result.rows[0] ? mapBasketQuestionRow(result.rows[0]) : null
}

/** Count questions linked to a basket. */
export async function countBasketQuestions(db: DbClient, basketId: string): Promise<number> {
  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS count FROM mcq_basket_questions WHERE basket_id = $1`,
    [basketId]
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

/** Insert a basket–question link. Returns the inserted row. */
export async function insertBasketQuestion(
  db: DbClient,
  basketId: string,
  questionId: string
): Promise<BasketQuestionRow> {
  const result = await db.query<BasketQuestionDbRow>(
    `INSERT INTO mcq_basket_questions (basket_id, question_id)
     VALUES ($1, $2)
     RETURNING id, basket_id, question_id, created_at`,
    [basketId, questionId]
  )
  return mapBasketQuestionRow(result.rows[0])
}

/** Remove a basket–question link. Returns true if deleted, false if not found. */
export async function deleteBasketQuestion(
  db: DbClient,
  basketId: string,
  questionId: string
): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM mcq_basket_questions WHERE basket_id = $1 AND question_id = $2`,
    [basketId, questionId]
  )
  return (result.rowCount ?? 0) > 0
}

/** Find basket–question links for a basket, paginated. */
export async function findBasketQuestions(
  db: DbClient,
  input: ListBasketQuestionsInput
): Promise<BasketQuestionRow[]> {
  const offset = (input.page - 1) * input.perPage
  const result = await db.query<BasketQuestionDbRow>(
    `SELECT id, basket_id, question_id, created_at
       FROM mcq_basket_questions
      WHERE basket_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3`,
    [input.basket_id, input.perPage, offset]
  )
  return result.rows.map(mapBasketQuestionRow)
}

/** Count basket–question links for a basket. */
export async function countBasketQuestionRows(
  db: DbClient,
  input: Pick<ListBasketQuestionsInput, 'basket_id'>
): Promise<number> {
  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS count FROM mcq_basket_questions WHERE basket_id = $1`,
    [input.basket_id]
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

// ---------------------------------------------------------------------------
// Cross-Domain Existence Checks
// ---------------------------------------------------------------------------

/**
 * Check whether a question row exists in mcq_questions.
 * Catch PostgreSQL 42P01 (undefined_table) and return false if the table
 * is not yet provisioned in this tenant DB variant.
 */
export async function checkQuestionExists(db: DbClient, questionId: string): Promise<boolean> {
  try {
    const result = await db.query<CountRow>(
      `SELECT 1 AS count FROM mcq_questions WHERE id = $1 LIMIT 1`,
      [questionId]
    )
    return result.rows[0] !== undefined
  } catch (err: unknown) {
    if (isDatabaseError(err) && err.code === '42P01') {
      // Table does not exist — treat as not found
      return false
    }
    throw err
  }
}

/**
 * Check whether a basket is referenced by any exam configuration.
 * Queries `information_schema.tables` first (AD-004): if the table does not
 * yet exist return false (no block). This enforces FR-019 / BR-09.
 */
export async function checkExamConfigReference(db: DbClient, basketId: string): Promise<boolean> {
  try {
    const tableCheck = await db.query<CountRow>(
      `SELECT 1 AS count
         FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'exam_configurations'
        LIMIT 1`
    )
    if (!tableCheck.rows[0]) return false

    const result = await db.query<CountRow>(
      `SELECT 1 AS count FROM exam_configurations WHERE basket_id = $1 LIMIT 1`,
      [basketId]
    )
    return result.rows[0] !== undefined
  } catch (err: unknown) {
    if (isDatabaseError(err) && err.code === '42P01') {
      return false
    }
    throw err
  }
}

/**
 * Check whether a basket is referenced by any auto-selection rule.
 * Same information_schema guard pattern as checkExamConfigReference (AD-004).
 * This enforces FR-019 / BR-10.
 */
export async function checkAutoSelectionReference(
  db: DbClient,
  basketId: string
): Promise<boolean> {
  try {
    const tableCheck = await db.query<CountRow>(
      `SELECT 1 AS count
         FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'auto_selection_rules'
        LIMIT 1`
    )
    if (!tableCheck.rows[0]) return false

    const result = await db.query<CountRow>(
      `SELECT 1 AS count FROM auto_selection_rules WHERE basket_id = $1 LIMIT 1`,
      [basketId]
    )
    return result.rows[0] !== undefined
  } catch (err: unknown) {
    if (isDatabaseError(err) && err.code === '42P01') {
      return false
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Private Utility
// ---------------------------------------------------------------------------

function isDatabaseError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err
}
