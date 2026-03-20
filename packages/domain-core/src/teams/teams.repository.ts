/**
 * Teams Domain — Repository (Raw DB Queries)
 *
 * File: packages/domain-core/src/teams/teams.repository.ts
 * Stage: STAGE_26_TEAMS
 * Date: 2026-03-19
 *
 * Pure database query functions. Accepts an injected DbClient — no pg.Pool
 * instantiation, no HTTP logic, no framework dependencies.
 *
 * All functions that write data are called within a service-layer transaction
 * (after BEGIN has been issued by the service caller).
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data access only
 * ✓ No framework dependencies beyond TypeScript
 * ✓ No direct Pool import — DbClient injected
 * ✓ All writes are called within a service-layer transaction
 * ✓ Academic isolation: no joins into academic/exam/content tables
 */

import type { DbClient, StaffTeamRow, TeamRow, TeamTypeRow } from './teams.types'

// ---------------------------------------------------------------------------
// Internal DB row types (all fields extend Record<string, unknown>)
// ---------------------------------------------------------------------------

interface TeamTypeDbRow extends Record<string, unknown> {
  id: string
  name: string
  description: string | null
  status: 'ENABLED' | 'DISABLED'
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
}

interface TeamDbRow extends Record<string, unknown> {
  id: string
  name: string
  team_type_id: string | null
  max_members: number | null
  description: string | null
  status: 'ENABLED' | 'DISABLED'
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
}

interface StaffTeamDbRow extends Record<string, unknown> {
  staff_id: string
  team_id: string
  created_at: Date
}

interface CountRow extends Record<string, unknown> {
  total: string
}

interface MemberCountRow extends Record<string, unknown> {
  count: string
}

interface ExistsRow extends Record<string, unknown> {
  exists: boolean
}

type TransactionalClient = DbClient

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function mapTeamTypeRow(r: TeamTypeDbRow): TeamTypeRow {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    status: r.status,
    deleted_at: r.deleted_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

function mapTeamRow(r: TeamDbRow): TeamRow {
  return {
    id: r.id,
    name: r.name,
    team_type_id: r.team_type_id,
    max_members: r.max_members !== null ? Number(r.max_members) : null,
    description: r.description,
    status: r.status,
    deleted_at: r.deleted_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

function mapStaffTeamRow(r: StaffTeamDbRow): StaffTeamRow {
  return {
    staff_id: r.staff_id,
    team_id: r.team_id,
    created_at: r.created_at,
  }
}

// ---------------------------------------------------------------------------
// Team Type Queries
// ---------------------------------------------------------------------------

/** Check if a team type name already exists among active records (case-insensitive). */
export async function teamTypeNameExists(
  db: DbClient,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const params: unknown[] = [name]
  let sql = `SELECT 1 FROM team_types WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL`
  if (excludeId) {
    params.push(excludeId)
    sql += ` AND id <> $2::uuid`
  }
  const result = await db.query<{ '?column?': number }>(sql, params)
  return result.rows.length > 0
}

/** Find a single active team type by ID. Returns null if not found or soft-deleted. */
export async function findTeamTypeById(db: DbClient, id: string): Promise<TeamTypeRow | null> {
  const result = await db.query<TeamTypeDbRow>(
    `SELECT id, name, description, status, deleted_at, created_at, updated_at
     FROM team_types
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  const row = result.rows[0]
  return row ? mapTeamTypeRow(row) : null
}

/**
 * List active team types with optional status filter and keyset pagination.
 * Always filters WHERE deleted_at IS NULL.
 */
export async function findTeamTypes(
  db: DbClient,
  input: {
    limit: number
    cursor?: string
    status?: 'ENABLED' | 'DISABLED'
  }
): Promise<{ rows: TeamTypeRow[]; total: number }> {
  const params: unknown[] = []
  const conditions: string[] = ['deleted_at IS NULL']

  if (input.status) {
    params.push(input.status)
    conditions.push(`status = $${params.length}`)
  }

  // Count params (before cursor)
  const countParams = [...params]
  const countWhere = conditions.join(' AND ')

  if (input.cursor) {
    const [cursorTs, cursorId] = input.cursor.split('|')
    params.push(cursorTs, cursorId)
    conditions.push(
      `(created_at, id) > ($${params.length - 1}::timestamptz, $${params.length}::uuid)`
    )
  }

  const where = conditions.join(' AND ')

  const countResult = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS total FROM team_types WHERE ${countWhere}`,
    countParams.length > 0 ? countParams : undefined
  )
  const total = parseInt(countResult.rows[0]?.total ?? '0', 10)

  params.push(input.limit)
  const dataResult = await db.query<TeamTypeDbRow>(
    `SELECT id, name, description, status, deleted_at, created_at, updated_at
     FROM team_types
     WHERE ${where}
     ORDER BY created_at ASC, id ASC
     LIMIT $${params.length}`,
    params
  )

  return { rows: dataResult.rows.map(mapTeamTypeRow), total }
}

/** Insert a new team type row. Returns the created row. */
export async function insertTeamType(
  db: TransactionalClient,
  input: { name: string; description?: string | null }
): Promise<TeamTypeRow> {
  const result = await db.query<TeamTypeDbRow>(
    `INSERT INTO team_types (name, description, status, created_at, updated_at)
     VALUES ($1, $2, 'ENABLED', NOW(), NOW())
     RETURNING id, name, description, status, deleted_at, created_at, updated_at`,
    [input.name, input.description ?? null]
  )
  return mapTeamTypeRow(result.rows[0] as TeamTypeDbRow)
}

/** Update an existing team type row. Returns the updated row. */
export async function updateTeamTypeRow(
  db: TransactionalClient,
  id: string,
  input: {
    name?: string
    description?: string | null
    status?: 'ENABLED' | 'DISABLED'
  }
): Promise<TeamTypeRow> {
  const setClauses: string[] = ['updated_at = NOW()']
  const params: unknown[] = []

  if (input.name !== undefined) {
    params.push(input.name)
    setClauses.push(`name = $${params.length}`)
  }
  if ('description' in input) {
    params.push(input.description ?? null)
    setClauses.push(`description = $${params.length}`)
  }
  if (input.status !== undefined) {
    params.push(input.status)
    setClauses.push(`status = $${params.length}`)
  }

  params.push(id)
  const result = await db.query<TeamTypeDbRow>(
    `UPDATE team_types
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length}::uuid AND deleted_at IS NULL
     RETURNING id, name, description, status, deleted_at, created_at, updated_at`,
    params
  )
  return mapTeamTypeRow(result.rows[0] as TeamTypeDbRow)
}

/** Soft-delete a team type by setting deleted_at = NOW(). */
export async function softDeleteTeamType(db: TransactionalClient, id: string): Promise<void> {
  await db.query(
    `UPDATE team_types SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
}

/** Count active teams that are classified under a given team type. */
export async function countTeamsForType(db: DbClient, teamTypeId: string): Promise<number> {
  const result = await db.query<MemberCountRow>(
    `SELECT COUNT(*)::text AS count FROM teams WHERE team_type_id = $1 AND deleted_at IS NULL`,
    [teamTypeId]
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

// ---------------------------------------------------------------------------
// Team Queries
// ---------------------------------------------------------------------------

/** Check if a team name already exists among active teams (case-insensitive). */
export async function teamNameExists(
  db: DbClient,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const params: unknown[] = [name]
  let sql = `SELECT 1 FROM teams WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL`
  if (excludeId) {
    params.push(excludeId)
    sql += ` AND id <> $2::uuid`
  }
  const result = await db.query<{ '?column?': number }>(sql, params)
  return result.rows.length > 0
}

/** Find a single active team by ID. Returns null if not found or soft-deleted. */
export async function findTeamById(db: DbClient, id: string): Promise<TeamRow | null> {
  const result = await db.query<TeamDbRow>(
    `SELECT id, name, team_type_id, max_members, description,
            status, deleted_at, created_at, updated_at
     FROM teams
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  const row = result.rows[0]
  return row ? mapTeamRow(row) : null
}

/**
 * List active teams with optional filters and keyset pagination.
 * Always filters WHERE deleted_at IS NULL.
 */
export async function findTeams(
  db: DbClient,
  input: {
    limit: number
    cursor?: string
    status?: 'ENABLED' | 'DISABLED'
    team_type_id?: string
  }
): Promise<{ rows: TeamRow[]; total: number }> {
  const params: unknown[] = []
  const conditions: string[] = ['deleted_at IS NULL']

  if (input.status) {
    params.push(input.status)
    conditions.push(`status = $${params.length}`)
  }

  if (input.team_type_id) {
    params.push(input.team_type_id)
    conditions.push(`team_type_id = $${params.length}::uuid`)
  }

  // Count params (before cursor)
  const countParams = [...params]
  const countWhere = conditions.join(' AND ')

  if (input.cursor) {
    const [cursorTs, cursorId] = input.cursor.split('|')
    params.push(cursorTs, cursorId)
    conditions.push(
      `(created_at, id) > ($${params.length - 1}::timestamptz, $${params.length}::uuid)`
    )
  }

  const where = conditions.join(' AND ')

  const countResult = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS total FROM teams WHERE ${countWhere}`,
    countParams.length > 0 ? countParams : undefined
  )
  const total = parseInt(countResult.rows[0]?.total ?? '0', 10)

  params.push(input.limit)
  const dataResult = await db.query<TeamDbRow>(
    `SELECT id, name, team_type_id, max_members, description,
            status, deleted_at, created_at, updated_at
     FROM teams
     WHERE ${where}
     ORDER BY created_at ASC, id ASC
     LIMIT $${params.length}`,
    params
  )

  return { rows: dataResult.rows.map(mapTeamRow), total }
}

/** Insert a new team row. Returns the created row. */
export async function insertTeam(
  db: TransactionalClient,
  input: {
    name: string
    team_type_id?: string | null
    max_members?: number | null
    description?: string | null
  }
): Promise<TeamRow> {
  const result = await db.query<TeamDbRow>(
    `INSERT INTO teams (name, team_type_id, max_members, description, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'ENABLED', NOW(), NOW())
     RETURNING id, name, team_type_id, max_members, description,
               status, deleted_at, created_at, updated_at`,
    [input.name, input.team_type_id ?? null, input.max_members ?? null, input.description ?? null]
  )
  return mapTeamRow(result.rows[0] as TeamDbRow)
}

/** Update an existing team row. Returns the updated row. */
export async function updateTeamRow(
  db: TransactionalClient,
  id: string,
  input: {
    name?: string
    team_type_id?: string | null
    max_members?: number | null
    description?: string | null
    status?: 'ENABLED' | 'DISABLED'
  }
): Promise<TeamRow> {
  const setClauses: string[] = ['updated_at = NOW()']
  const params: unknown[] = []

  if (input.name !== undefined) {
    params.push(input.name)
    setClauses.push(`name = $${params.length}`)
  }
  if ('team_type_id' in input) {
    params.push(input.team_type_id ?? null)
    setClauses.push(`team_type_id = $${params.length}`)
  }
  if ('max_members' in input) {
    params.push(input.max_members ?? null)
    setClauses.push(`max_members = $${params.length}`)
  }
  if ('description' in input) {
    params.push(input.description ?? null)
    setClauses.push(`description = $${params.length}`)
  }
  if (input.status !== undefined) {
    params.push(input.status)
    setClauses.push(`status = $${params.length}`)
  }

  params.push(id)
  const result = await db.query<TeamDbRow>(
    `UPDATE teams
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length}::uuid AND deleted_at IS NULL
     RETURNING id, name, team_type_id, max_members, description,
               status, deleted_at, created_at, updated_at`,
    params
  )
  return mapTeamRow(result.rows[0] as TeamDbRow)
}

/** Soft-delete a team by setting deleted_at = NOW(). */
export async function softDeleteTeam(db: TransactionalClient, id: string): Promise<void> {
  await db.query(
    `UPDATE teams SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
}

/**
 * Lock a team row for update using SELECT ... FOR UPDATE NOWAIT.
 * Returns the row or null if not found / soft-deleted.
 * Must be called inside an open BEGIN transaction.
 * Throws a PG error with code '55P03' if the lock is not immediately available.
 */
export async function lockTeamForUpdate(
  db: TransactionalClient,
  id: string
): Promise<TeamRow | null> {
  const result = await db.query<TeamDbRow>(
    `SELECT id, name, team_type_id, max_members, description,
            status, deleted_at, created_at, updated_at
     FROM teams
     WHERE id = $1 AND deleted_at IS NULL
     FOR UPDATE NOWAIT`,
    [id]
  )
  const row = result.rows[0]
  return row ? mapTeamRow(row) : null
}

// ---------------------------------------------------------------------------
// Staff Assignment Queries
// ---------------------------------------------------------------------------

/** Count the number of active staff assignments for a team. */
export async function countStaffInTeam(db: DbClient, teamId: string): Promise<number> {
  const result = await db.query<MemberCountRow>(
    `SELECT COUNT(*)::text AS count FROM staff_teams WHERE team_id = $1`,
    [teamId]
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

/** Find a specific staff-team assignment. Returns null if not found. */
export async function findStaffTeamAssignment(
  db: DbClient,
  staffId: string,
  teamId: string
): Promise<StaffTeamRow | null> {
  const result = await db.query<StaffTeamDbRow>(
    `SELECT staff_id, team_id, created_at
     FROM staff_teams
     WHERE staff_id = $1 AND team_id = $2`,
    [staffId, teamId]
  )
  const row = result.rows[0]
  return row ? mapStaffTeamRow(row) : null
}

/**
 * List staff assignments for a team with keyset pagination on created_at.
 * Cursor is "{created_at ISO}|{staff_id}".
 */
export async function findTeamMembers(
  db: DbClient,
  teamId: string,
  pagination: { limit: number; cursor?: string }
): Promise<{ rows: StaffTeamRow[]; total: number }> {
  const params: unknown[] = [teamId]

  const countResult = await db.query<CountRow>(
    `SELECT COUNT(*)::text AS total FROM staff_teams WHERE team_id = $1`,
    [teamId]
  )
  const total = parseInt(countResult.rows[0]?.total ?? '0', 10)

  let cursorClause = ''
  if (pagination.cursor) {
    const [cursorTs, cursorStaffId] = pagination.cursor.split('|')
    params.push(cursorTs, cursorStaffId)
    cursorClause = `AND (created_at, staff_id) > ($${params.length - 1}::timestamptz, $${params.length}::uuid)`
  }

  params.push(pagination.limit)
  const dataResult = await db.query<StaffTeamDbRow>(
    `SELECT staff_id, team_id, created_at
     FROM staff_teams
     WHERE team_id = $1 ${cursorClause}
     ORDER BY created_at ASC, staff_id ASC
     LIMIT $${params.length}`,
    params
  )

  return { rows: dataResult.rows.map(mapStaffTeamRow), total }
}

/**
 * Insert a staff-team assignment using ON CONFLICT DO NOTHING for idempotency.
 * DB-level safety net for the idempotent assignment endpoint.
 */
export async function upsertStaffTeamAssignment(
  db: TransactionalClient,
  staffId: string,
  teamId: string
): Promise<void> {
  await db.query(
    `INSERT INTO staff_teams (staff_id, team_id, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (staff_id, team_id) DO NOTHING`,
    [staffId, teamId]
  )
}

/**
 * Delete a specific staff-team assignment.
 * Returns true if the row was deleted, false if not found.
 */
export async function deleteStaffTeamAssignment(
  db: TransactionalClient,
  staffId: string,
  teamId: string
): Promise<boolean> {
  const result = await db.query(`DELETE FROM staff_teams WHERE staff_id = $1 AND team_id = $2`, [
    staffId,
    teamId,
  ])
  return (result.rowCount ?? 0) > 0
}

/**
 * Check whether a staff user exists (is not deleted) in the current workspace.
 * Returns false if staff_id does not exist or is soft-deleted.
 */
export async function checkStaffExistsInWorkspace(db: DbClient, staffId: string): Promise<boolean> {
  const result = await db.query<ExistsRow>(
    `SELECT EXISTS (
       SELECT 1 FROM backoffice_staff_users
       WHERE id = $1 AND deleted_at IS NULL
     ) AS exists`,
    [staffId]
  )
  return result.rows[0]?.exists === true
}

/**
 * Count reporting references for a team.
 * Uses a SAVEPOINT-guarded query that catches error code 42P01
 * (undefined_table) so this function returns 0 safely until
 * reporting tables are created in a future migration.
 */
export async function countReportingReferences(db: DbClient, _teamId: string): Promise<number> {
  const savepointName = 'count_reporting_refs'
  try {
    await db.query(`SAVEPOINT ${savepointName}`)
    // Placeholder: replace with real reporting table query when available.
    // For now this always returns 0 — forward-proof until reporting tables exist.
    const result = await db.query<MemberCountRow>(`SELECT 0::text AS count`, undefined)
    await db.query(`RELEASE SAVEPOINT ${savepointName}`)
    return parseInt(result.rows[0]?.count ?? '0', 10)
  } catch (err: unknown) {
    if (
      err !== null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === '42P01'
    ) {
      await db.query(`ROLLBACK TO SAVEPOINT ${savepointName}`)
      await db.query(`RELEASE SAVEPOINT ${savepointName}`)
      return 0
    }
    throw err
  }
}
