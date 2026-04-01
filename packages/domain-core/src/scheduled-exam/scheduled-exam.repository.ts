/**
 * Scheduled Exam — Repository
 *
 * File: packages/domain-core/src/scheduled-exam/scheduled-exam.repository.ts
 * Stage: STAGE_38_SCHEDULED_EXAM_ENGINE
 *
 * Pure repository functions accepting DbClient. Uses raw pg queries (no Drizzle).
 */

import type {
  AuditContext,
  CreateScheduledExamInput,
  DbClient,
  ListScheduledExamsInput,
  ScheduledExamRow,
  ScheduledExamStatus,
  UpdateScheduledExamInput,
} from './scheduled-exam.types'

export async function findById(
  db: DbClient,
  id: string,
  workspaceId: string
): Promise<ScheduledExamRow | null> {
  const res = await db.query<ScheduledExamRow>(
    'SELECT * FROM scheduled_exams WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL',
    [id, workspaceId]
  )
  return res.rows[0] ?? null
}

export async function findByCode(
  db: DbClient,
  code: string,
  workspaceId: string
): Promise<ScheduledExamRow | null> {
  const res = await db.query<ScheduledExamRow>(
    'SELECT * FROM scheduled_exams WHERE code = $1 AND workspace_id = $2 AND deleted_at IS NULL',
    [code, workspaceId]
  )
  return res.rows[0] ?? null
}

export async function findAll(
  db: DbClient,
  input: ListScheduledExamsInput
): Promise<ScheduledExamRow[]> {
  const { workspace_id, status, page = 1, per_page = 20 } = input
  const offset = (page - 1) * per_page

  if (status) {
    const res = await db.query<ScheduledExamRow>(
      'SELECT * FROM scheduled_exams WHERE workspace_id = $1 AND status = $2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $3 OFFSET $4',
      [workspace_id, status, per_page, offset]
    )
    return res.rows
  }

  const res = await db.query<ScheduledExamRow>(
    'SELECT * FROM scheduled_exams WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [workspace_id, per_page, offset]
  )
  return res.rows
}

export async function countAll(
  db: DbClient,
  workspace_id: string,
  status?: ScheduledExamStatus
): Promise<number> {
  if (status) {
    const res = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM scheduled_exams WHERE workspace_id = $1 AND status = $2 AND deleted_at IS NULL',
      [workspace_id, status]
    )
    return parseInt(res.rows[0]?.count ?? '0', 10)
  }
  const res = await db.query<{ count: string }>(
    'SELECT COUNT(*) as count FROM scheduled_exams WHERE workspace_id = $1 AND deleted_at IS NULL',
    [workspace_id]
  )
  return parseInt(res.rows[0]?.count ?? '0', 10)
}

export async function countAttempts(
  db: DbClient,
  scheduledExamId: string,
  workspaceId: string
): Promise<number> {
  const res = await db.query<{ count: string }>(
    'SELECT COUNT(*) as count FROM attempts WHERE scheduled_exam_id = $1 AND workspace_id = $2',
    [scheduledExamId, workspaceId]
  )
  return parseInt(res.rows[0]?.count ?? '0', 10)
}

export async function insert(
  db: DbClient,
  workspaceId: string,
  input: CreateScheduledExamInput,
  audit: AuditContext
): Promise<ScheduledExamRow> {
  const res = await db.query<ScheduledExamRow>(
    `INSERT INTO scheduled_exams (
      base_exam_id, base_exam_type, workspace_id, title, code, instructions,
      total_marks, pass_mark, duration_minutes, window_start, window_end,
      question_pool_id, created_by, updated_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
    RETURNING *`,
    [
      input.base_exam_id,
      input.base_exam_type,
      workspaceId,
      input.title,
      input.code,
      input.instructions ?? null,
      input.total_marks,
      input.pass_mark,
      input.duration_minutes ?? null,
      input.window_start,
      input.window_end,
      input.question_pool_id ?? null,
      audit.user_id,
    ]
  )
  const row = res.rows[0]
  if (!row) throw new Error('INSERT returned no row')
  return row
}

export async function update(
  db: DbClient,
  id: string,
  workspaceId: string,
  input: UpdateScheduledExamInput,
  audit: AuditContext
): Promise<ScheduledExamRow | null> {
  const updates: string[] = []
  const values: unknown[] = []
  let idx = 1

  const fieldMap: Record<string, unknown> = {
    title: input.title,
    instructions: input.instructions,
    total_marks: input.total_marks,
    pass_mark: input.pass_mark,
    duration_minutes: input.duration_minutes,
    window_start: input.window_start,
    window_end: input.window_end,
    question_pool_id: input.question_pool_id,
  }

  for (const [col, val] of Object.entries(fieldMap)) {
    if (val !== undefined) {
      updates.push(`${col} = $${idx++}`)
      values.push(val)
    }
  }

  if (updates.length === 0) return findById(db, id, workspaceId)

  updates.push(`updated_at = NOW()`, `updated_by = $${idx++}`)
  values.push(audit.user_id)

  const whereIdx1 = idx++
  const whereIdx2 = idx

  values.push(id, workspaceId)

  const res = await db.query<ScheduledExamRow>(
    `UPDATE scheduled_exams SET ${updates.join(', ')} WHERE id = $${whereIdx1} AND workspace_id = $${whereIdx2} AND deleted_at IS NULL RETURNING *`,
    values
  )
  return res.rows[0] ?? null
}

export async function softDelete(
  db: DbClient,
  id: string,
  workspaceId: string,
  audit: AuditContext
): Promise<boolean> {
  const res = await db.query(
    'UPDATE scheduled_exams SET deleted_at = NOW(), updated_by = $3 WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL',
    [id, workspaceId, audit.user_id]
  )
  return (res.rowCount ?? 0) > 0
}

export async function updateWorkflowStatus(
  db: DbClient,
  id: string,
  workspaceId: string,
  status: ScheduledExamStatus,
  extraFields: Record<string, unknown>,
  audit: AuditContext
): Promise<ScheduledExamRow | null> {
  // Allowlist for columns that can be updated via extraFields (prevents SQL injection)
  const ALLOWED_COLUMNS = new Set(['base_exam_snapshot', 'base_exam_hash', 'base_exam_modified'])

  const updates = ['status = $3', 'updated_at = NOW()', 'updated_by = $4']
  const values: unknown[] = [id, workspaceId, status, audit.user_id]
  let idx = 5

  for (const [col, val] of Object.entries(extraFields)) {
    if (!ALLOWED_COLUMNS.has(col)) {
      throw new Error(`Column '${col}' is not allowed in updateWorkflowStatus`)
    }
    updates.push(`${col} = $${idx++}`)
    values.push(val)
  }

  const res = await db.query<ScheduledExamRow>(
    `UPDATE scheduled_exams SET ${updates.join(', ')} WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL RETURNING *`,
    values
  )
  return res.rows[0] ?? null
}

export async function setBaseExamModified(
  db: DbClient,
  baseExamId: string,
  workspaceId: string
): Promise<number> {
  const res = await db.query(
    "UPDATE scheduled_exams SET base_exam_modified = true, updated_at = NOW() WHERE base_exam_id = $1 AND workspace_id = $2 AND status IN ('DRAFT','UNDER_REVIEW','APPROVED') AND deleted_at IS NULL",
    [baseExamId, workspaceId]
  )
  return res.rowCount ?? 0
}

export async function findApprovedByBaseExamId(
  db: DbClient,
  baseExamId: string,
  workspaceId: string
): Promise<ScheduledExamRow[]> {
  const res = await db.query<ScheduledExamRow>(
    "SELECT * FROM scheduled_exams WHERE base_exam_id = $1 AND workspace_id = $2 AND status = 'APPROVED' AND deleted_at IS NULL",
    [baseExamId, workspaceId]
  )
  return res.rows
}

export async function findEnabledByBaseExamId(
  db: DbClient,
  baseExamId: string,
  workspaceId: string
): Promise<ScheduledExamRow[]> {
  const res = await db.query<ScheduledExamRow>(
    "SELECT * FROM scheduled_exams WHERE base_exam_id = $1 AND workspace_id = $2 AND status = 'ENABLED' AND deleted_at IS NULL",
    [baseExamId, workspaceId]
  )
  return res.rows
}
