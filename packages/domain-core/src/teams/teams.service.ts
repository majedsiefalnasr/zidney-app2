/**
 * Teams Domain — Service Layer (Business Logic)
 *
 * File: packages/domain-core/src/teams/teams.service.ts
 * Stage: STAGE_26_TEAMS
 * Date: 2026-03-19
 *
 * All service functions that write data wrap their work in a BEGIN/COMMIT
 * transaction. The ROLLBACK path is guaranteed by the try/catch in every
 * write function. Read functions do not open transactions.
 *
 * Constitutional Compliance:
 * ✓ Pure domain logic — no HTTP, no framework imports
 * ✓ All writes are transactional (BEGIN/COMMIT/ROLLBACK)
 * ✓ Server-authoritative time (via DB NOW())
 * ✓ Idempotent assign: returns normally if already assigned
 * ✓ NOWAIT lock on team row for concurrent-safe assignment
 * ✓ No cross-tenant access
 */

import { createLogger } from '@zidney/logger'
import { TeamsError } from './teams.errors'
import {
  checkStaffExistsInWorkspace,
  countReportingReferences,
  countStaffInTeam,
  countTeamsForType,
  deleteStaffTeamAssignment,
  findStaffTeamAssignment,
  findTeamById,
  findTeamMembers,
  findTeams,
  findTeamTypeById,
  findTeamTypes,
  insertTeam,
  insertTeamType,
  lockTeamForUpdate,
  softDeleteTeam,
  softDeleteTeamType,
  teamNameExists,
  teamTypeNameExists,
  updateTeamRow,
  updateTeamTypeRow,
  upsertStaffTeamAssignment,
} from './teams.repository'
import type {
  AuditContext,
  CreateTeamInput,
  CreateTeamTypeInput,
  DbClient,
  ListTeamMembersInput,
  ListTeamMembersResult,
  ListTeamsInput,
  ListTeamsResult,
  ListTeamTypesInput,
  ListTeamTypesResult,
  StaffTeamRow,
  TeamRow,
  TeamTypeRow,
  UpdateTeamInput,
  UpdateTeamTypeInput,
} from './teams.types'

const logger = createLogger('teams-service')

// ---------------------------------------------------------------------------
// Team Type Service Functions
// ---------------------------------------------------------------------------

/**
 * TX 7.1 — List Team Types (read-only, no transaction required)
 */
export async function listTeamTypes(
  db: DbClient,
  input: ListTeamTypesInput
): Promise<ListTeamTypesResult> {
  const { rows, total } = await findTeamTypes(db, {
    limit: input.limit + 1,
    cursor: input.cursor,
    status: input.status,
  })
  let nextCursor: string | null = null
  if (rows.length > input.limit) {
    const last = rows[input.limit - 1] as TeamTypeRow
    nextCursor = `${last.created_at.toISOString()}|${last.id}`
    rows.splice(input.limit)
  }
  return { items: rows, total, nextCursor }
}

/**
 * TX 7.2 — Create Team Type
 * Checks for duplicate name, then inserts.
 */
export async function createTeamType(
  db: DbClient,
  input: CreateTeamTypeInput,
  audit: AuditContext
): Promise<TeamTypeRow> {
  await db.query('BEGIN')
  try {
    const duplicate = await teamTypeNameExists(db, input.name)
    if (duplicate) {
      throw new TeamsError('TEAM_TYPE_NAME_DUPLICATE')
    }

    const row = await insertTeamType(db, {
      name: input.name,
      description: input.description,
    })

    await db.query('COMMIT')

    logger.info('Team type created', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      team_type_id: row.id,
      team_type_name: row.name,
    })

    return row
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

/**
 * Read a single team type by ID (read-only).
 */
export async function getTeamTypeById(db: DbClient, id: string): Promise<TeamTypeRow> {
  const row = await findTeamTypeById(db, id)
  if (!row) throw new TeamsError('TEAM_TYPE_NOT_FOUND')
  return row
}

/**
 * TX 7.3 — Update Team Type
 * Validates existence, checks name uniqueness when changing name, updates.
 */
export async function updateTeamType(
  db: DbClient,
  id: string,
  input: UpdateTeamTypeInput,
  audit: AuditContext
): Promise<TeamTypeRow> {
  await db.query('BEGIN')
  try {
    const existing = await findTeamTypeById(db, id)
    if (!existing) throw new TeamsError('TEAM_TYPE_NOT_FOUND')

    if (input.name !== undefined) {
      const duplicate = await teamTypeNameExists(db, input.name, id)
      if (duplicate) throw new TeamsError('TEAM_TYPE_NAME_DUPLICATE')
    }

    const updated = await updateTeamTypeRow(db, id, {
      name: input.name,
      description: input.description,
      status: input.status,
    })

    await db.query('COMMIT')

    logger.info('Team type updated', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      team_type_id: id,
    })

    return updated
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

/**
 * TX 7.4 — Delete Team Type (soft)
 * Guards: must not have active child teams.
 */
export async function deleteTeamType(db: DbClient, id: string, audit: AuditContext): Promise<void> {
  await db.query('BEGIN')
  try {
    const existing = await findTeamTypeById(db, id)
    if (!existing) throw new TeamsError('TEAM_TYPE_NOT_FOUND')

    const childCount = await countTeamsForType(db, id)
    if (childCount > 0) throw new TeamsError('TEAM_TYPE_HAS_TEAMS')

    await softDeleteTeamType(db, id)

    await db.query('COMMIT')

    logger.info('Team type soft-deleted', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      team_type_id: id,
    })
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// Team Service Functions
// ---------------------------------------------------------------------------

/**
 * TX 7.5 — List Teams (read-only, no transaction required)
 */
export async function listTeams(db: DbClient, input: ListTeamsInput): Promise<ListTeamsResult> {
  const { rows, total } = await findTeams(db, {
    limit: input.limit,
    cursor: input.cursor,
    status: input.status,
    team_type_id: input.team_type_id,
  })
  let nextCursor: string | null = null
  if (rows.length > input.limit) {
    const last = rows[input.limit - 1] as TeamRow
    nextCursor = `${last.created_at.toISOString()}|${last.id}`
    rows.splice(input.limit)
  }
  return { items: rows, total, nextCursor }
}

/**
 * Create Team
 * Validates team type if provided, checks name uniqueness, then inserts.
 */
export async function createTeam(
  db: DbClient,
  input: CreateTeamInput,
  audit: AuditContext
): Promise<TeamRow> {
  await db.query('BEGIN')
  try {
    if (input.team_type_id) {
      const teamType = await findTeamTypeById(db, input.team_type_id)
      if (!teamType) throw new TeamsError('TEAM_TYPE_NOT_FOUND')
      if (teamType.status === 'DISABLED') throw new TeamsError('TEAM_TYPE_DISABLED')
    }

    const duplicate = await teamNameExists(db, input.name)
    if (duplicate) throw new TeamsError('TEAM_NAME_DUPLICATE')

    const row = await insertTeam(db, {
      name: input.name,
      team_type_id: input.team_type_id,
      max_members: input.max_members,
      description: input.description,
    })

    await db.query('COMMIT')

    logger.info('Team created', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      team_id: row.id,
      team_name: row.name,
    })

    return row
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

/**
 * Read a single team by ID (read-only).
 */
export async function getTeamById(db: DbClient, id: string): Promise<TeamRow> {
  const row = await findTeamById(db, id)
  if (!row) throw new TeamsError('TEAM_NOT_FOUND')
  return row
}

/**
 * TX 7.6 — Update Team
 * Validates existence, validates team type if changed, checks name uniqueness, updates.
 */
export async function updateTeam(
  db: DbClient,
  id: string,
  input: UpdateTeamInput,
  audit: AuditContext
): Promise<TeamRow> {
  await db.query('BEGIN')
  try {
    const existing = await findTeamById(db, id)
    if (!existing) throw new TeamsError('TEAM_NOT_FOUND')

    if ('team_type_id' in input && input.team_type_id) {
      const teamType = await findTeamTypeById(db, input.team_type_id)
      if (!teamType) throw new TeamsError('TEAM_TYPE_NOT_FOUND')
      if (teamType.status === 'DISABLED') throw new TeamsError('TEAM_TYPE_DISABLED')
    }

    if (input.name !== undefined) {
      const duplicate = await teamNameExists(db, input.name, id)
      if (duplicate) throw new TeamsError('TEAM_NAME_DUPLICATE')
    }

    const updated = await updateTeamRow(db, id, {
      name: input.name,
      team_type_id: input.team_type_id,
      max_members: input.max_members,
      description: input.description,
      status: input.status,
    })

    await db.query('COMMIT')

    logger.info('Team updated', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      team_id: id,
    })

    return updated
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

/**
 * Delete Team (soft)
 * Guards: must not have active staff assignments; must not be referenced by reporting.
 */
export async function deleteTeam(db: DbClient, id: string, audit: AuditContext): Promise<void> {
  await db.query('BEGIN')
  try {
    const existing = await findTeamById(db, id)
    if (!existing) throw new TeamsError('TEAM_NOT_FOUND')

    const memberCount = await countStaffInTeam(db, id)
    if (memberCount > 0) throw new TeamsError('TEAM_HAS_ASSIGNMENTS')

    const reportingCount = await countReportingReferences(db, id)
    if (reportingCount > 0) throw new TeamsError('TEAM_REFERENCED_BY_REPORTING')

    await softDeleteTeam(db, id)

    await db.query('COMMIT')

    logger.info('Team soft-deleted', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      team_id: id,
    })
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// Staff Assignment Service Functions
// ---------------------------------------------------------------------------

/**
 * List Team Members (read-only).
 */
export async function listTeamMembers(
  db: DbClient,
  teamId: string,
  input: ListTeamMembersInput
): Promise<ListTeamMembersResult> {
  const existing = await findTeamById(db, teamId)
  if (!existing) throw new TeamsError('TEAM_NOT_FOUND')

  const { rows, total } = await findTeamMembers(db, teamId, {
    limit: input.limit + 1,
    cursor: input.cursor,
  })
  let nextCursor: string | null = null
  if (rows.length > input.limit) {
    const last = rows[input.limit - 1] as StaffTeamRow
    nextCursor = `${last.created_at.toISOString()}|${last.staff_id}`
    rows.splice(input.limit)
  }
  return { items: rows, total, nextCursor }
}

/**
 * TX 7.7 — Assign Staff to Team
 *
 * Lock order: team row (FOR UPDATE NOWAIT) first.
 * Idempotent: if the assignment already exists, commits immediately and returns.
 * Capacity: checked against max_members if set.
 * NOWAIT: PG error 55P03 is caught and rethrown as TEAM_LOCK_CONTENTION.
 */
export async function assignStaffToTeam(
  db: DbClient,
  teamId: string,
  staffId: string,
  audit: AuditContext
): Promise<StaffTeamRow> {
  await db.query('BEGIN')
  try {
    // Acquire row-level lock with NOWAIT to surface contention quickly.
    let team: TeamRow | null
    try {
      team = await lockTeamForUpdate(db, teamId)
    } catch (lockErr: unknown) {
      if (
        lockErr !== null &&
        typeof lockErr === 'object' &&
        'code' in lockErr &&
        (lockErr as { code: string }).code === '55P03'
      ) {
        throw new TeamsError('TEAM_LOCK_CONTENTION')
      }
      throw lockErr
    }

    if (!team) throw new TeamsError('TEAM_NOT_FOUND')

    // Validate staff exists in this workspace.
    const staffExists = await checkStaffExistsInWorkspace(db, staffId)
    if (!staffExists) throw new TeamsError('STAFF_NOT_FOUND')

    // Idempotency: if already assigned, commit and return the existing row.
    const existingAssignment = await findStaffTeamAssignment(db, staffId, teamId)
    if (existingAssignment) {
      await db.query('COMMIT')
      return existingAssignment
    }

    // Guard: team must be enabled.
    if (team.status === 'DISABLED') throw new TeamsError('TEAM_DISABLED')

    // Guard: capacity check.
    if (team.max_members !== null) {
      const count = await countStaffInTeam(db, teamId)
      if (count >= team.max_members) throw new TeamsError('TEAM_MAX_MEMBERS_EXCEEDED')
    }

    await upsertStaffTeamAssignment(db, staffId, teamId)

    await db.query('COMMIT')

    logger.info('Staff assigned to team', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      team_id: teamId,
      staff_id: staffId,
    })

    // Read back the created assignment for the response.
    const created = await findStaffTeamAssignment(db, staffId, teamId)
    // The row was just inserted — this cast is safe.
    return created as StaffTeamRow
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

/**
 * TX 7.8 — Remove Staff from Team
 * Validates team, validates assignment exists, deletes.
 */
export async function removeStaffFromTeam(
  db: DbClient,
  teamId: string,
  staffId: string,
  audit: AuditContext
): Promise<void> {
  await db.query('BEGIN')
  try {
    const team = await findTeamById(db, teamId)
    if (!team) throw new TeamsError('TEAM_NOT_FOUND')

    const assignment = await findStaffTeamAssignment(db, staffId, teamId)
    if (!assignment) throw new TeamsError('TEAM_STAFF_ASSIGNMENT_NOT_FOUND')

    await deleteStaffTeamAssignment(db, staffId, teamId)

    await db.query('COMMIT')

    logger.info('Staff removed from team', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      team_id: teamId,
      staff_id: staffId,
    })
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}
