/**
 * Traditional Questions — Repository
 *
 * File: packages/domain-core/src/traditional-questions/traditional-questions.repository.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 *
 * Pure SQL functions. No transactions opened here — all TX management is in the service layer.
 * No imports from apps/* — pure domain functions only.
 *
 * NOTE on cross-domain existence checks (checkSubjectExists, checkSubsectionExists, etc.):
 *   Tables may not exist in older tenant DBs. PostgreSQL error 42P01 (undefined_table)
 *   is caught and treated as "not found" to avoid false negatives.
 */

import type {
  DbClient,
  ListTraditionalQuestionsInput,
  TraditionalQuestionCategoryRow,
  TraditionalQuestionRow,
  TraditionalQuestionStatus,
  TraditionalQuestionTagRow,
  TraditionalQuestionType,
} from './traditional-questions.types'

// ---------------------------------------------------------------------------
// Internal Row Mapper Types
// ---------------------------------------------------------------------------

interface QuestionDbRow extends Record<string, unknown> {
  id: string
  subject_id: string
  division_id: string | null
  lesson_id: string | null
  subsection_id: string
  question_type: string
  language: string
  content: string
  correct_answer: Record<string, unknown> | null
  correction_criteria: Record<string, unknown> | null
  score: string
  status: string
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
  status_updated_at: Date | null
  status_updated_by: string | null
}

interface CategoryLinkDbRow extends Record<string, unknown> {
  id: string
  question_id: string
  category_value_id: string
}

interface TagLinkDbRow extends Record<string, unknown> {
  id: string
  question_id: string
  tag_id: string
}

interface CountRow extends Record<string, unknown> {
  count: string
}

// ---------------------------------------------------------------------------
// Private Helpers
// ---------------------------------------------------------------------------

function mapQuestionRow(row: QuestionDbRow): TraditionalQuestionRow {
  return {
    id: row.id,
    subject_id: row.subject_id,
    division_id: row.division_id,
    lesson_id: row.lesson_id,
    subsection_id: row.subsection_id,
    question_type: row.question_type as TraditionalQuestionType,
    language: row.language,
    content: row.content,
    correct_answer: row.correct_answer,
    correction_criteria: row.correction_criteria,
    score: row.score,
    status: row.status as TraditionalQuestionStatus,
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
    status_updated_at: row.status_updated_at,
    status_updated_by: row.status_updated_by,
  }
}

function mapCategoryRow(row: CategoryLinkDbRow): TraditionalQuestionCategoryRow {
  return { id: row.id, question_id: row.question_id, category_value_id: row.category_value_id }
}

function mapTagRow(row: TagLinkDbRow): TraditionalQuestionTagRow {
  return { id: row.id, question_id: row.question_id, tag_id: row.tag_id }
}

function isDatabaseError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err
}

// ---------------------------------------------------------------------------
// Question Read Functions
// ---------------------------------------------------------------------------

const QUESTION_COLUMNS = `
  id, subject_id, division_id, lesson_id, subsection_id, question_type, language,
  content, correct_answer, correction_criteria, score, status,
  deleted_at, created_at, updated_at, created_by, updated_by,
  status_updated_at, status_updated_by`

/** Find a question by ID (active only — excluded if soft-deleted). */
export async function findQuestionById(
  db: DbClient,
  questionId: string
): Promise<TraditionalQuestionRow | null> {
  const result = await db.query<QuestionDbRow>(
    `SELECT ${QUESTION_COLUMNS} FROM traditional_questions WHERE id = $1 AND deleted_at IS NULL`,
    [questionId]
  )
  return result.rows[0] ? mapQuestionRow(result.rows[0]) : null
}

/** Find a question by ID including soft-deleted records. Used for deletion logic. */
export async function findQuestionByIdIncludeDeleted(
  db: DbClient,
  questionId: string
): Promise<TraditionalQuestionRow | null> {
  const result = await db.query<QuestionDbRow>(
    `SELECT ${QUESTION_COLUMNS} FROM traditional_questions WHERE id = $1`,
    [questionId]
  )
  return result.rows[0] ? mapQuestionRow(result.rows[0]) : null
}

/** Find category links for a question. */
export async function findCategoriesByQuestionId(
  db: DbClient,
  questionId: string
): Promise<TraditionalQuestionCategoryRow[]> {
  const result = await db.query<CategoryLinkDbRow>(
    `SELECT id, question_id, category_value_id
       FROM traditional_question_categories
      WHERE question_id = $1`,
    [questionId]
  )
  return result.rows.map(mapCategoryRow)
}

/** Find tag links for a question. */
export async function findTagsByQuestionId(
  db: DbClient,
  questionId: string
): Promise<TraditionalQuestionTagRow[]> {
  const result = await db.query<TagLinkDbRow>(
    `SELECT id, question_id, tag_id
       FROM traditional_question_tags
      WHERE question_id = $1`,
    [questionId]
  )
  return result.rows.map(mapTagRow)
}

/** Find questions matching optional filters with pagination. */
export async function findQuestions(
  db: DbClient,
  input: ListTraditionalQuestionsInput
): Promise<TraditionalQuestionRow[]> {
  const { conditions, params, idx } = buildListWhereClause(input)
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const offset = (input.page - 1) * input.per_page
  params.push(input.per_page, offset)

  const result = await db.query<QuestionDbRow>(
    `SELECT ${QUESTION_COLUMNS} FROM traditional_questions q
      ${where}
      ORDER BY q.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  )
  return result.rows.map(mapQuestionRow)
}

/** Count questions matching optional filters. */
export async function countQuestions(
  db: DbClient,
  input: ListTraditionalQuestionsInput
): Promise<number> {
  const { conditions, params } = buildListWhereClause(input)
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS count FROM traditional_questions q ${where}`,
    params
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

/** Build WHERE clause for list/count queries. */
function buildListWhereClause(input: ListTraditionalQuestionsInput): {
  conditions: string[]
  params: unknown[]
  idx: number
} {
  const conditions: string[] = ['q.deleted_at IS NULL']
  const params: unknown[] = []
  let idx = 1

  if (input.subject_id) {
    conditions.push(`q.subject_id = $${idx++}`)
    params.push(input.subject_id)
  }
  if (input.division_id) {
    conditions.push(`q.division_id = $${idx++}`)
    params.push(input.division_id)
  }
  if (input.lesson_id) {
    conditions.push(`q.lesson_id = $${idx++}`)
    params.push(input.lesson_id)
  }
  if (input.subsection_id) {
    conditions.push(`q.subsection_id = $${idx++}`)
    params.push(input.subsection_id)
  }
  if (input.question_type) {
    conditions.push(`q.question_type = $${idx++}`)
    params.push(input.question_type)
  }
  if (input.status) {
    conditions.push(`q.status = $${idx++}`)
    params.push(input.status)
  }
  if (input.search) {
    conditions.push(`q.content ILIKE $${idx}`)
    idx++
    params.push(`%${input.search}%`)
  }
  // Classification EXISTS subqueries
  if (input.category_value_id) {
    conditions.push(
      `EXISTS (SELECT 1 FROM traditional_question_categories qc WHERE qc.question_id = q.id AND qc.category_value_id = $${idx++})`
    )
    params.push(input.category_value_id)
  }
  if (input.tag_id) {
    conditions.push(
      `EXISTS (SELECT 1 FROM traditional_question_tags qt WHERE qt.question_id = q.id AND qt.tag_id = $${idx++})`
    )
    params.push(input.tag_id)
  }

  return { conditions, params, idx }
}

// ---------------------------------------------------------------------------
// Question Write Functions
// ---------------------------------------------------------------------------

/** Insert a new question row. Returns the full inserted row. */
export async function insertQuestion(
  db: DbClient,
  data: {
    subject_id: string
    division_id: string | null
    lesson_id: string | null
    subsection_id: string
    question_type: string
    language: string
    content: string
    correct_answer: Record<string, unknown> | null
    correction_criteria: Record<string, unknown> | null
    score: number
    actor_id: string | null
  }
): Promise<TraditionalQuestionRow> {
  const result = await db.query<QuestionDbRow>(
    `INSERT INTO traditional_questions
       (subject_id, division_id, lesson_id, subsection_id, question_type, language, content,
        correct_answer, correction_criteria, score, status, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'DRAFT', $11, $11)
     RETURNING ${QUESTION_COLUMNS}`,
    [
      data.subject_id,
      data.division_id,
      data.lesson_id,
      data.subsection_id,
      data.question_type,
      data.language,
      data.content,
      data.correct_answer ? JSON.stringify(data.correct_answer) : null,
      data.correction_criteria ? JSON.stringify(data.correction_criteria) : null,
      data.score,
      data.actor_id,
    ]
  )
  return mapQuestionRow(result.rows[0] as QuestionDbRow)
}

/** Update mutable question fields. Returns updated row or null if not found / stale. */
export async function updateQuestionRow(
  db: DbClient,
  questionId: string,
  expectedUpdatedAt: Date,
  data: {
    division_id?: string | null
    lesson_id?: string | null
    language?: string
    content?: string
    correct_answer?: Record<string, unknown> | null
    correction_criteria?: Record<string, unknown> | null
    score?: number
    actor_id: string | null
  }
): Promise<TraditionalQuestionRow | null> {
  const setClauses: string[] = ['updated_at = NOW()', 'updated_by = $1']
  const params: unknown[] = [data.actor_id]
  let idx = 2

  if ('division_id' in data) {
    setClauses.push(`division_id = $${idx++}`)
    params.push(data.division_id ?? null)
  }
  if ('lesson_id' in data) {
    setClauses.push(`lesson_id = $${idx++}`)
    params.push(data.lesson_id ?? null)
  }
  if (data.language !== undefined) {
    setClauses.push(`language = $${idx++}`)
    params.push(data.language)
  }
  if (data.content !== undefined) {
    setClauses.push(`content = $${idx++}`)
    params.push(data.content)
  }
  if ('correct_answer' in data) {
    setClauses.push(`correct_answer = $${idx++}`)
    params.push(data.correct_answer ? JSON.stringify(data.correct_answer) : null)
  }
  if ('correction_criteria' in data) {
    setClauses.push(`correction_criteria = $${idx++}`)
    params.push(data.correction_criteria ? JSON.stringify(data.correction_criteria) : null)
  }
  if (data.score !== undefined) {
    setClauses.push(`score = $${idx++}`)
    params.push(data.score)
  }

  // Optimistic concurrency: only update if updated_at matches expected value
  params.push(questionId, expectedUpdatedAt)

  const result = await db.query<QuestionDbRow>(
    `UPDATE traditional_questions
        SET ${setClauses.join(', ')}
      WHERE id = $${idx} AND updated_at = $${idx + 1} AND deleted_at IS NULL
      RETURNING ${QUESTION_COLUMNS}`,
    params
  )
  return result.rows[0] ? mapQuestionRow(result.rows[0]) : null
}

/** Hard delete a question by ID. CASCADE removes classification links. */
export async function deleteQuestionRow(db: DbClient, questionId: string): Promise<void> {
  await db.query('DELETE FROM traditional_questions WHERE id = $1', [questionId])
}

/** Soft delete a question by setting deleted_at. */
export async function softDeleteQuestionRow(
  db: DbClient,
  questionId: string,
  actorId: string | null
): Promise<void> {
  await db.query(
    `UPDATE traditional_questions SET deleted_at = NOW(), updated_at = NOW(), updated_by = $2 WHERE id = $1`,
    [questionId, actorId]
  )
}

// ---------------------------------------------------------------------------
// Classification Link Functions
// ---------------------------------------------------------------------------

/** Insert a question–category link. Returns the inserted row. */
export async function insertQuestionCategory(
  db: DbClient,
  questionId: string,
  categoryValueId: string
): Promise<TraditionalQuestionCategoryRow> {
  const result = await db.query<CategoryLinkDbRow>(
    `INSERT INTO traditional_question_categories (question_id, category_value_id)
     VALUES ($1, $2)
     RETURNING id, question_id, category_value_id`,
    [questionId, categoryValueId]
  )
  return mapCategoryRow(result.rows[0] as CategoryLinkDbRow)
}

/** Delete a question–category link. Returns true if deleted. */
export async function deleteQuestionCategory(
  db: DbClient,
  questionId: string,
  categoryValueId: string
): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM traditional_question_categories WHERE question_id = $1 AND category_value_id = $2',
    [questionId, categoryValueId]
  )
  return (result.rowCount ?? 0) > 0
}

/** Insert a question–tag link. Returns the inserted row. */
export async function insertQuestionTag(
  db: DbClient,
  questionId: string,
  tagId: string
): Promise<TraditionalQuestionTagRow> {
  const result = await db.query<TagLinkDbRow>(
    `INSERT INTO traditional_question_tags (question_id, tag_id)
     VALUES ($1, $2)
     RETURNING id, question_id, tag_id`,
    [questionId, tagId]
  )
  return mapTagRow(result.rows[0] as TagLinkDbRow)
}

/** Delete a question–tag link. Returns true if deleted. */
export async function deleteQuestionTag(
  db: DbClient,
  questionId: string,
  tagId: string
): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM traditional_question_tags WHERE question_id = $1 AND tag_id = $2',
    [questionId, tagId]
  )
  return (result.rowCount ?? 0) > 0
}

// ---------------------------------------------------------------------------
// Cross-Domain Existence Checks
// ---------------------------------------------------------------------------

/**
 * Check whether a subject exists.
 * Catch 42P01 in case the table is not provisioned in this tenant variant.
 */
export async function checkSubjectExists(db: DbClient, subjectId: string): Promise<boolean> {
  try {
    const result = await db.query<CountRow>(
      'SELECT 1 AS count FROM subjects WHERE id = $1 LIMIT 1',
      [subjectId]
    )
    return result.rows[0] !== undefined
  } catch (err: unknown) {
    if (isDatabaseError(err) && err.code === '42P01') return false
    throw err
  }
}

/**
 * Check whether a division exists.
 * Catch 42P01 in case the table is not provisioned.
 */
export async function checkDivisionExists(db: DbClient, divisionId: string): Promise<boolean> {
  try {
    const result = await db.query<CountRow>(
      'SELECT 1 AS count FROM divisions WHERE id = $1 LIMIT 1',
      [divisionId]
    )
    return result.rows[0] !== undefined
  } catch (err: unknown) {
    if (isDatabaseError(err) && err.code === '42P01') return false
    throw err
  }
}

/**
 * Check whether a subsection exists.
 * Catch 42P01 in case the table is not provisioned.
 */
export async function checkSubsectionExists(db: DbClient, subsectionId: string): Promise<boolean> {
  try {
    const result = await db.query<CountRow>(
      'SELECT 1 AS count FROM traditional_exam_subsections WHERE id = $1 LIMIT 1',
      [subsectionId]
    )
    return result.rows[0] !== undefined
  } catch (err: unknown) {
    if (isDatabaseError(err) && err.code === '42P01') return false
    throw err
  }
}

/**
 * Check whether a subsection belongs to an exam bound to the specified subject.
 * Traverses subsection → section → exam → subject_id.
 * Catch 42P01 in case any table in the chain is not provisioned.
 */
export async function checkSubsectionSubjectMatch(
  db: DbClient,
  subsectionId: string,
  subjectId: string
): Promise<boolean> {
  try {
    const result = await db.query<CountRow>(
      `SELECT 1 AS count
         FROM traditional_exam_subsections sub
         JOIN traditional_exam_sections sec ON sec.id = sub.section_id
         JOIN exams e ON e.id = sec.exam_id
        WHERE sub.id = $1 AND e.subject_id = $2
        LIMIT 1`,
      [subsectionId, subjectId]
    )
    return result.rows[0] !== undefined
  } catch (err: unknown) {
    // If any table in the chain doesn't exist yet (stubs or exams not provisioned),
    // skip validation — the FK constraint on subsection_id guarantees referential integrity
    if (isDatabaseError(err) && err.code === '42P01') return true
    throw err
  }
}

/**
 * Check whether a lesson exists and optionally belongs to the given subject.
 * Catch 42P01 in case the table is not provisioned.
 */
export async function checkLessonExists(
  db: DbClient,
  lessonId: string,
  subjectId?: string
): Promise<boolean> {
  try {
    if (subjectId) {
      const result = await db.query<CountRow>(
        'SELECT 1 AS count FROM lessons WHERE id = $1 AND subject_id = $2 LIMIT 1',
        [lessonId, subjectId]
      )
      return result.rows[0] !== undefined
    }
    const result = await db.query<CountRow>(
      'SELECT 1 AS count FROM lessons WHERE id = $1 LIMIT 1',
      [lessonId]
    )
    return result.rows[0] !== undefined
  } catch (err: unknown) {
    if (isDatabaseError(err) && err.code === '42P01') return false
    throw err
  }
}

/**
 * Check whether a category value exists.
 * Catch 42P01 in case the table is not provisioned.
 */
export async function checkCategoryValueExists(
  db: DbClient,
  categoryValueId: string
): Promise<boolean> {
  try {
    const result = await db.query<CountRow>(
      'SELECT 1 AS count FROM category_values WHERE id = $1 LIMIT 1',
      [categoryValueId]
    )
    return result.rows[0] !== undefined
  } catch (err: unknown) {
    if (isDatabaseError(err) && err.code === '42P01') return false
    throw err
  }
}

/**
 * Check whether a tag exists.
 * Catch 42P01 in case the table is not provisioned.
 */
export async function checkTagExists(db: DbClient, tagId: string): Promise<boolean> {
  try {
    const result = await db.query<CountRow>('SELECT 1 AS count FROM tags WHERE id = $1 LIMIT 1', [
      tagId,
    ])
    return result.rows[0] !== undefined
  } catch (err: unknown) {
    if (isDatabaseError(err) && err.code === '42P01') return false
    throw err
  }
}
