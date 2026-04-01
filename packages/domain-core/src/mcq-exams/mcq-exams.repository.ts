/**
 * MCQ Exams — Repository
 *
 * File: packages/domain-core/src/mcq-exams/mcq-exams.repository.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 *
 * Pure SQL functions. No transactions opened here — all TX management is in the service layer.
 * No imports from apps/* — pure domain functions only.
 */

import type {
  CriteriaEntry,
  DbClient,
  ListMcqExamsInput,
  McqExamAutoCriteriaRow,
  McqExamPassType,
  McqExamQuestionRow,
  McqExamRow,
  McqExamSelectionMode,
  McqExamSettingsRow,
  McqExamStatus,
  QuestionOrderEntry,
} from './mcq-exams.types'

// ---------------------------------------------------------------------------
// Internal Row Mapper Types
// ---------------------------------------------------------------------------

interface ExamDbRow extends Record<string, unknown> {
  id: string
  subject_id: string
  division_id: string | null
  name: string
  code: string
  description: string | null
  language: string
  total_questions: number
  duration_minutes: number | null
  pass_type: string
  pass_value: string | number
  allow_multiple_attempts: boolean
  selection_mode: string
  status: string
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
}

interface SettingsDbRow extends Record<string, unknown> {
  id: string
  exam_id: string
  allow_relax_mode: boolean
  allow_chrono_mode: boolean
  allow_rush_mode: boolean
  allow_review_answers: boolean
  allow_review_hints: boolean
  allow_result_effects: boolean
  show_results_after_submit: boolean
  show_correct_answers: boolean
  show_explanations: boolean
  enable_certificate: boolean
  message_template_id: string | null
  created_at: Date
  updated_at: Date
}

interface ExamQuestionDbRow extends Record<string, unknown> {
  id: string
  exam_id: string
  question_id: string
  order_index: number
  created_at: Date
}

interface CriteriaDbRow extends Record<string, unknown> {
  id: string
  exam_id: string
  lesson_ids: string[] | null
  category_value_ids: string[] | null
  tag_ids: string[] | null
  basket_ids: string[] | null
  percentage: number
  created_at: Date
  updated_at: Date
}

interface CountRow extends Record<string, unknown> {
  count: string
}

// ---------------------------------------------------------------------------
// Private Helpers
// ---------------------------------------------------------------------------

function mapExamRow(row: ExamDbRow): McqExamRow {
  return {
    id: row.id,
    subject_id: row.subject_id,
    division_id: row.division_id,
    name: row.name,
    code: row.code,
    description: row.description,
    language: row.language,
    total_questions: Number(row.total_questions),
    duration_minutes: row.duration_minutes != null ? Number(row.duration_minutes) : null,
    pass_type: row.pass_type as McqExamPassType,
    pass_value: Number(row.pass_value),
    allow_multiple_attempts: row.allow_multiple_attempts,
    selection_mode: row.selection_mode as McqExamSelectionMode,
    status: row.status as McqExamStatus,
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
  }
}

function mapSettingsRow(row: SettingsDbRow): McqExamSettingsRow {
  return {
    id: row.id,
    exam_id: row.exam_id,
    allow_relax_mode: row.allow_relax_mode,
    allow_chrono_mode: row.allow_chrono_mode,
    allow_rush_mode: row.allow_rush_mode,
    allow_review_answers: row.allow_review_answers,
    allow_review_hints: row.allow_review_hints,
    allow_result_effects: row.allow_result_effects,
    show_results_after_submit: row.show_results_after_submit,
    show_correct_answers: row.show_correct_answers,
    show_explanations: row.show_explanations,
    enable_certificate: row.enable_certificate,
    message_template_id: row.message_template_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapExamQuestionRow(row: ExamQuestionDbRow): McqExamQuestionRow {
  return {
    id: row.id,
    exam_id: row.exam_id,
    question_id: row.question_id,
    order_index: Number(row.order_index),
    created_at: row.created_at,
  }
}

function mapCriteriaRow(row: CriteriaDbRow): McqExamAutoCriteriaRow {
  return {
    id: row.id,
    exam_id: row.exam_id,
    lesson_ids: row.lesson_ids,
    category_value_ids: row.category_value_ids,
    tag_ids: row.tag_ids,
    basket_ids: row.basket_ids,
    percentage: Number(row.percentage),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Exam Read Functions
// ---------------------------------------------------------------------------

const EXAM_COLUMNS = `
  id, subject_id, division_id, name, code, description, language,
  total_questions, duration_minutes, pass_type, pass_value,
  allow_multiple_attempts, selection_mode, status,
  deleted_at, created_at, updated_at, created_by, updated_by`

/** Find an exam by ID (active only — excluded if soft-deleted). */
export async function findExamById(db: DbClient, examId: string): Promise<McqExamRow | null> {
  const result = await db.query<ExamDbRow>(
    `SELECT ${EXAM_COLUMNS} FROM mcq_exams WHERE id = $1 AND deleted_at IS NULL`,
    [examId]
  )
  return result.rows[0] ? mapExamRow(result.rows[0]) : null
}

/** Find an exam by ID with SELECT FOR UPDATE lock (for transitions). */
export async function findExamForUpdate(db: DbClient, examId: string): Promise<McqExamRow | null> {
  const result = await db.query<ExamDbRow>(
    `SELECT ${EXAM_COLUMNS} FROM mcq_exams WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
    [examId]
  )
  return result.rows[0] ? mapExamRow(result.rows[0]) : null
}

/** Find exams matching optional filters with pagination. */
export async function findExams(db: DbClient, input: ListMcqExamsInput): Promise<McqExamRow[]> {
  const { conditions, params, idx } = buildListWhereClause(input)
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const offset = (input.page - 1) * input.per_page
  params.push(input.per_page, offset)

  const result = await db.query<ExamDbRow>(
    `SELECT ${EXAM_COLUMNS} FROM mcq_exams
      ${where}
      ORDER BY created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  )
  return result.rows.map(mapExamRow)
}

/** Count exams matching optional filters. */
export async function countExams(db: DbClient, input: ListMcqExamsInput): Promise<number> {
  const { conditions, params } = buildListWhereClause(input)
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS count FROM mcq_exams ${where}`,
    params
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

/** Build WHERE clause for list/count queries. */
function buildListWhereClause(input: ListMcqExamsInput): {
  conditions: string[]
  params: unknown[]
  idx: number
} {
  const conditions: string[] = ['deleted_at IS NULL']
  const params: unknown[] = []
  let idx = 1

  if (input.subject_id) {
    conditions.push(`subject_id = $${idx++}`)
    params.push(input.subject_id)
  }
  if (input.division_id) {
    conditions.push(`division_id = $${idx++}`)
    params.push(input.division_id)
  }
  if (input.selection_mode) {
    conditions.push(`selection_mode = $${idx++}`)
    params.push(input.selection_mode)
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

  return { conditions, params, idx }
}

// ---------------------------------------------------------------------------
// Exam Write Functions
// ---------------------------------------------------------------------------

/** Insert a new exam row. Returns the full inserted row. */
export async function insertExam(
  db: DbClient,
  data: {
    name: string
    code: string
    description: string | null
    subject_id: string
    division_id: string | null
    language: string
    total_questions: number
    duration_minutes: number | null
    pass_type: string
    pass_value: number
    allow_multiple_attempts: boolean
    selection_mode: string
    actor_id: string | null
  }
): Promise<McqExamRow> {
  const result = await db.query<ExamDbRow>(
    `INSERT INTO mcq_exams
       (name, code, description, subject_id, division_id, language,
        total_questions, duration_minutes, pass_type, pass_value,
        allow_multiple_attempts, selection_mode, status, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'COMPLETED', $13, $13)
     RETURNING ${EXAM_COLUMNS}`,
    [
      data.name,
      data.code,
      data.description,
      data.subject_id,
      data.division_id,
      data.language,
      data.total_questions,
      data.duration_minutes,
      data.pass_type,
      data.pass_value,
      data.allow_multiple_attempts,
      data.selection_mode,
      data.actor_id,
    ]
  )
  return mapExamRow(result.rows[0] as ExamDbRow)
}

/** Update an exam row. Returns the updated row. */
export async function updateExam(
  db: DbClient,
  examId: string,
  data: {
    name?: string
    code?: string
    description?: string | null
    division_id?: string | null
    language?: string
    total_questions?: number
    duration_minutes?: number | null
    pass_type?: string
    pass_value?: number
    allow_multiple_attempts?: boolean
    selection_mode?: string
    actor_id: string | null
  }
): Promise<McqExamRow | null> {
  const setClauses: string[] = ['updated_at = NOW()', 'updated_by = $2']
  const params: unknown[] = [examId, data.actor_id]
  let idx = 3

  if (data.name !== undefined) {
    setClauses.push(`name = $${idx++}`)
    params.push(data.name)
  }
  if (data.code !== undefined) {
    setClauses.push(`code = $${idx++}`)
    params.push(data.code)
  }
  if (data.description !== undefined) {
    setClauses.push(`description = $${idx++}`)
    params.push(data.description)
  }
  if (data.division_id !== undefined) {
    setClauses.push(`division_id = $${idx++}`)
    params.push(data.division_id)
  }
  if (data.language !== undefined) {
    setClauses.push(`language = $${idx++}`)
    params.push(data.language)
  }
  if (data.total_questions !== undefined) {
    setClauses.push(`total_questions = $${idx++}`)
    params.push(data.total_questions)
  }
  if (data.duration_minutes !== undefined) {
    setClauses.push(`duration_minutes = $${idx++}`)
    params.push(data.duration_minutes)
  }
  if (data.pass_type !== undefined) {
    setClauses.push(`pass_type = $${idx++}`)
    params.push(data.pass_type)
  }
  if (data.pass_value !== undefined) {
    setClauses.push(`pass_value = $${idx++}`)
    params.push(data.pass_value)
  }
  if (data.allow_multiple_attempts !== undefined) {
    setClauses.push(`allow_multiple_attempts = $${idx++}`)
    params.push(data.allow_multiple_attempts)
  }
  if (data.selection_mode !== undefined) {
    setClauses.push(`selection_mode = $${idx++}`)
    params.push(data.selection_mode)
  }

  const result = await db.query<ExamDbRow>(
    `UPDATE mcq_exams SET ${setClauses.join(', ')}
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING ${EXAM_COLUMNS}`,
    params
  )
  return result.rows[0] ? mapExamRow(result.rows[0]) : null
}

/** Soft-delete an exam. */
export async function softDeleteExam(
  db: DbClient,
  examId: string,
  actorId: string | null
): Promise<boolean> {
  const result = await db.query(
    `UPDATE mcq_exams SET deleted_at = NOW(), updated_at = NOW(), updated_by = $2
     WHERE id = $1 AND deleted_at IS NULL`,
    [examId, actorId]
  )
  return (result.rowCount ?? 0) > 0
}

// ---------------------------------------------------------------------------
// Settings Functions
// ---------------------------------------------------------------------------

const SETTINGS_COLUMNS = `
  id, exam_id, allow_relax_mode, allow_chrono_mode, allow_rush_mode,
  allow_review_answers, allow_review_hints, allow_result_effects,
  show_results_after_submit, show_correct_answers, show_explanations,
  enable_certificate, message_template_id, created_at, updated_at`

/** Find settings for an exam. */
export async function findSettingsByExamId(
  db: DbClient,
  examId: string
): Promise<McqExamSettingsRow | null> {
  const result = await db.query<SettingsDbRow>(
    `SELECT ${SETTINGS_COLUMNS} FROM mcq_exam_settings WHERE exam_id = $1`,
    [examId]
  )
  return result.rows[0] ? mapSettingsRow(result.rows[0]) : null
}

/** Upsert settings (INSERT ON CONFLICT UPDATE). */
export async function upsertSettings(
  db: DbClient,
  examId: string,
  data: {
    allow_relax_mode: boolean
    allow_chrono_mode: boolean
    allow_rush_mode: boolean
    allow_review_answers: boolean
    allow_review_hints: boolean
    allow_result_effects: boolean
    show_results_after_submit: boolean
    show_correct_answers: boolean
    show_explanations: boolean
    enable_certificate: boolean
    message_template_id: string | null
  }
): Promise<McqExamSettingsRow> {
  const result = await db.query<SettingsDbRow>(
    `INSERT INTO mcq_exam_settings
       (exam_id, allow_relax_mode, allow_chrono_mode, allow_rush_mode,
        allow_review_answers, allow_review_hints, allow_result_effects,
        show_results_after_submit, show_correct_answers, show_explanations,
        enable_certificate, message_template_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (exam_id) DO UPDATE SET
       allow_relax_mode = EXCLUDED.allow_relax_mode,
       allow_chrono_mode = EXCLUDED.allow_chrono_mode,
       allow_rush_mode = EXCLUDED.allow_rush_mode,
       allow_review_answers = EXCLUDED.allow_review_answers,
       allow_review_hints = EXCLUDED.allow_review_hints,
       allow_result_effects = EXCLUDED.allow_result_effects,
       show_results_after_submit = EXCLUDED.show_results_after_submit,
       show_correct_answers = EXCLUDED.show_correct_answers,
       show_explanations = EXCLUDED.show_explanations,
       enable_certificate = EXCLUDED.enable_certificate,
       message_template_id = EXCLUDED.message_template_id,
       updated_at = NOW()
     RETURNING ${SETTINGS_COLUMNS}`,
    [
      examId,
      data.allow_relax_mode,
      data.allow_chrono_mode,
      data.allow_rush_mode,
      data.allow_review_answers,
      data.allow_review_hints,
      data.allow_result_effects,
      data.show_results_after_submit,
      data.show_correct_answers,
      data.show_explanations,
      data.enable_certificate,
      data.message_template_id,
    ]
  )
  return mapSettingsRow(result.rows[0] as SettingsDbRow)
}

// ---------------------------------------------------------------------------
// Exam Questions Functions
// ---------------------------------------------------------------------------

/** Find questions linked to an exam, ordered by order_index. */
export async function findQuestionsByExamId(
  db: DbClient,
  examId: string
): Promise<McqExamQuestionRow[]> {
  const result = await db.query<ExamQuestionDbRow>(
    `SELECT id, exam_id, question_id, order_index, created_at
       FROM mcq_exam_questions
      WHERE exam_id = $1
      ORDER BY order_index ASC`,
    [examId]
  )
  return result.rows.map(mapExamQuestionRow)
}

/** Count questions linked to an exam. */
export async function countQuestionsByExamId(db: DbClient, examId: string): Promise<number> {
  const result = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS count FROM mcq_exam_questions WHERE exam_id = $1`,
    [examId]
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

/** Insert a batch of exam-question links. */
export async function insertExamQuestions(
  db: DbClient,
  examId: string,
  questions: QuestionOrderEntry[]
): Promise<McqExamQuestionRow[]> {
  if (questions.length === 0) return []

  const valueParts: string[] = []
  const params: unknown[] = []
  let idx = 1

  for (const q of questions) {
    valueParts.push(`($${idx++}, $${idx++}, $${idx++})`)
    params.push(examId, q.question_id, q.order_index)
  }

  const result = await db.query<ExamQuestionDbRow>(
    `INSERT INTO mcq_exam_questions (exam_id, question_id, order_index)
     VALUES ${valueParts.join(', ')}
     RETURNING id, exam_id, question_id, order_index, created_at`,
    params
  )
  return result.rows.map(mapExamQuestionRow)
}

/** Remove a single question link from an exam. */
export async function removeExamQuestion(
  db: DbClient,
  examId: string,
  questionId: string
): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM mcq_exam_questions WHERE exam_id = $1 AND question_id = $2`,
    [examId, questionId]
  )
  return (result.rowCount ?? 0) > 0
}

/** Delete all question links for an exam (used before reorder). */
export async function deleteAllExamQuestions(db: DbClient, examId: string): Promise<void> {
  await db.query(`DELETE FROM mcq_exam_questions WHERE exam_id = $1`, [examId])
}

// ---------------------------------------------------------------------------
// Auto Criteria Functions
// ---------------------------------------------------------------------------

/** Find criteria for an exam. */
export async function findCriteriaByExamId(
  db: DbClient,
  examId: string
): Promise<McqExamAutoCriteriaRow[]> {
  const result = await db.query<CriteriaDbRow>(
    `SELECT id, exam_id, lesson_ids, category_value_ids, tag_ids, basket_ids,
            percentage, created_at, updated_at
       FROM mcq_exam_auto_criteria
      WHERE exam_id = $1
      ORDER BY created_at ASC`,
    [examId]
  )
  return result.rows.map(mapCriteriaRow)
}

/** Delete all criteria for an exam, then insert new ones. */
export async function replaceCriteria(
  db: DbClient,
  examId: string,
  criteria: CriteriaEntry[]
): Promise<McqExamAutoCriteriaRow[]> {
  await db.query(`DELETE FROM mcq_exam_auto_criteria WHERE exam_id = $1`, [examId])

  if (criteria.length === 0) return []

  const valueParts: string[] = []
  const params: unknown[] = []
  let idx = 1

  for (const c of criteria) {
    valueParts.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`)
    params.push(
      examId,
      c.lesson_ids ?? null,
      c.category_value_ids ?? null,
      c.tag_ids ?? null,
      c.basket_ids ?? null,
      c.percentage
    )
  }

  const result = await db.query<CriteriaDbRow>(
    `INSERT INTO mcq_exam_auto_criteria
       (exam_id, lesson_ids, category_value_ids, tag_ids, basket_ids, percentage)
     VALUES ${valueParts.join(', ')}
     RETURNING id, exam_id, lesson_ids, category_value_ids, tag_ids, basket_ids,
               percentage, created_at, updated_at`,
    params
  )
  return result.rows.map(mapCriteriaRow)
}

// ---------------------------------------------------------------------------
// Cross-Domain Existence Checks
// ---------------------------------------------------------------------------

/** Check if a subject exists. Error 42P01 treated as "not found". */
export async function checkSubjectExists(db: DbClient, subjectId: string): Promise<boolean> {
  try {
    const result = await db.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM subjects WHERE id = $1 AND deleted_at IS NULL`,
      [subjectId]
    )
    return parseInt(result.rows[0]?.count ?? '0', 10) > 0
  } catch (err: unknown) {
    if (isDatabaseError(err) && err.code === '42P01') return false
    throw err
  }
}

/** Check if a division exists. Error 42P01 treated as "not found". */
export async function checkDivisionExists(db: DbClient, divisionId: string): Promise<boolean> {
  try {
    const result = await db.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM divisions WHERE id = $1 AND deleted_at IS NULL`,
      [divisionId]
    )
    return parseInt(result.rows[0]?.count ?? '0', 10) > 0
  } catch (err: unknown) {
    if (isDatabaseError(err) && err.code === '42P01') return false
    throw err
  }
}

/** Check if a question exists, is ENABLED, and belongs to the given subject. */
export async function checkQuestionForExam(
  db: DbClient,
  questionId: string,
  subjectId: string,
  divisionId: string | null
): Promise<{ exists: boolean; enabled: boolean; subject_match: boolean; division_match: boolean }> {
  try {
    const result = await db.query<
      {
        id: string
        status: string
        subject_id: string
        division_id: string | null
      } & Record<string, unknown>
    >(
      `SELECT id, status, subject_id, division_id
         FROM mcq_questions
        WHERE id = $1 AND deleted_at IS NULL`,
      [questionId]
    )
    if (!result.rows[0]) {
      return { exists: false, enabled: false, subject_match: false, division_match: false }
    }
    const q = result.rows[0]
    return {
      exists: true,
      enabled: q.status === 'ENABLED',
      subject_match: q.subject_id === subjectId,
      division_match: divisionId == null || q.division_id === divisionId,
    }
  } catch (err: unknown) {
    if (isDatabaseError(err) && err.code === '42P01') {
      return { exists: false, enabled: false, subject_match: false, division_match: false }
    }
    throw err
  }
}

function isDatabaseError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err
}
