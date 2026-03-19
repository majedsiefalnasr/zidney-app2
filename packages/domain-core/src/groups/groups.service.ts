/**
 * Groups Domain Service
 *
 * File: packages/domain-core/src/groups/groups.service.ts
 * Stage: STAGE_24_GROUPS
 * Date: 2026-03-19
 *
 * All 11 service functions for the Groups domain.
 * Uses injected DbClient — no direct Pool instantiation.
 *
 * Transaction discipline:
 * - All write operations (create/update/delete) are wrapped in
 *   BEGIN … COMMIT / ROLLBACK blocks.
 * - assignStudentToGroup uses SELECT FOR UPDATE on the groups row to prevent
 *   max_members race conditions.
 * - deleteGroup uses SAVEPOINT guards for table-not-yet-created references
 *   (exam_group_targets, ads_group_targets) — 42P01 safe-pass per AD-05.
 *
 * Constitutional Compliance:
 * ✓ Database-per-tenant — no cross-tenant queries
 * ✓ No direct Pool import — all DB access via injected DbClient
 * ✓ Server-authoritative time (NOW() for all timestamps)
 * ✓ Structured logging via @zidney/logger — no console.log
 * ✓ Forward-only — no mutations outside the tenant resolver context
 * ✓ SELECT FOR UPDATE on groups row for max_members enforcement
 */

import { createLogger } from '@zidney/logger'

import { GroupsError } from './groups.errors'
import {
  countStaffInGroup,
  countStudentsInGroup,
  countStudentsInGroupExcluding,
  deleteStaffGroupAssignment,
  findDepartmentDivisionId,
  findGroupById,
  findGroups,
  findStaffById,
  findStaffGroups,
  findStudentById,
  findStudentGroup,
  groupNameExists,
  insertGroup,
  lockGroupForUpdate,
  softDeleteGroup,
  updateGroupRow,
  updateStudentGroupId,
  upsertStaffGroupAssignment,
} from './groups.repository'
import type {
  AuditContext,
  CreateGroupInput,
  DbClient,
  GroupRow,
  ListGroupsInput,
  ListGroupsResult,
  StudentGroupResult,
  UpdateGroupInput,
} from './groups.types'

const logger = createLogger('groups-service')

// ---------------------------------------------------------------------------
// 1 — listGroups
// ---------------------------------------------------------------------------

export async function listGroups(db: DbClient, input: ListGroupsInput): Promise<ListGroupsResult> {
  const { limit, cursor, status, department_id } = input

  const { rows, total } = await findGroups(db, { limit: limit + 1, cursor, status, department_id })

  let nextCursor: string | null = null
  if (rows.length > limit) {
    const last = rows[limit - 1] as GroupRow
    nextCursor = `${last.created_at.toISOString()}|${last.id}`
    rows.splice(limit)
  }

  return { items: rows, nextCursor, total }
}

// ---------------------------------------------------------------------------
// 2 — createGroup
// ---------------------------------------------------------------------------

export async function createGroup(
  db: DbClient,
  input: CreateGroupInput,
  audit: AuditContext
): Promise<GroupRow> {
  const { name, department_id, max_members, description } = input

  await db.query('BEGIN')
  try {
    // Uniqueness check (case-insensitive among active groups)
    const isDuplicate = await groupNameExists(db, name)
    if (isDuplicate) {
      throw new GroupsError('GROUP_NAME_DUPLICATE')
    }

    const group = await insertGroup(db, {
      name,
      department_id: department_id ?? null,
      max_members: max_members ?? null,
      description: description ?? null,
    })

    await db.query('COMMIT')

    logger.info('Group created', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      event: 'GROUP_CREATED',
      group_id: group.id,
      name: group.name,
    })

    return group
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof GroupsError) throw err
    logger.error('createGroup transaction failed', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      error: String(err),
    })
    throw err
  }
}

// ---------------------------------------------------------------------------
// 3 — getGroupById
// ---------------------------------------------------------------------------

export async function getGroupById(db: DbClient, id: string): Promise<GroupRow | null> {
  return findGroupById(db, id)
}

// ---------------------------------------------------------------------------
// 4 — updateGroup
// ---------------------------------------------------------------------------

export async function updateGroup(
  db: DbClient,
  id: string,
  input: UpdateGroupInput,
  audit: AuditContext
): Promise<GroupRow> {
  await db.query('BEGIN')
  try {
    const existing = await findGroupById(db, id)
    if (!existing) {
      throw new GroupsError('GROUP_NOT_FOUND')
    }

    // Name uniqueness check (if renaming)
    if (input.name !== undefined && input.name.toLowerCase() !== existing.name.toLowerCase()) {
      const isDuplicate = await groupNameExists(db, input.name, id)
      if (isDuplicate) {
        throw new GroupsError('GROUP_NAME_DUPLICATE')
      }
    }

    const updated = await updateGroupRow(db, id, input)

    await db.query('COMMIT')

    logger.info('Group updated', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      event: 'GROUP_UPDATED',
      group_id: id,
    })

    return updated
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof GroupsError) throw err
    logger.error('updateGroup transaction failed', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      error: String(err),
    })
    throw err
  }
}

// ---------------------------------------------------------------------------
// 5 — deleteGroup (soft delete + assignment guards + SAVEPOINT for 42P01)
// ---------------------------------------------------------------------------

export async function deleteGroup(db: DbClient, id: string, audit: AuditContext): Promise<void> {
  await db.query('BEGIN')
  try {
    const existing = await findGroupById(db, id)
    if (!existing) {
      throw new GroupsError('GROUP_NOT_FOUND')
    }

    // Student assignment guard
    const studentCount = await countStudentsInGroup(db, id)
    if (studentCount > 0) {
      throw new GroupsError('GROUP_HAS_ASSIGNMENTS')
    }

    // Staff assignment guard
    const staffCount = await countStaffInGroup(db, id)
    if (staffCount > 0) {
      throw new GroupsError('GROUP_HAS_ASSIGNMENTS')
    }

    // SAVEPOINT guard: exam_group_targets reference (AD-05)
    // Table may not exist in early tenants — 42P01 must not abort the transaction.
    await db.query('SAVEPOINT before_exam_check')
    try {
      const examResult = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM exam_group_targets WHERE group_id = $1`,
        [id]
      )
      const examCount = parseInt(examResult.rows[0]?.count ?? '0', 10)
      if (examCount > 0) {
        await db.query('RELEASE SAVEPOINT before_exam_check')
        throw new GroupsError('GROUP_REFERENCED_BY_EXAM')
      }
      await db.query('RELEASE SAVEPOINT before_exam_check')
    } catch (savepointErr) {
      const errMsg = String(savepointErr)
      // 42P01 = undefined_table — table does not exist yet; treat as zero references
      if (
        errMsg.includes('42P01') ||
        errMsg.toLowerCase().includes('does not exist') ||
        errMsg.toLowerCase().includes('relation "exam_group_targets"')
      ) {
        await db.query('ROLLBACK TO SAVEPOINT before_exam_check')
        await db.query('RELEASE SAVEPOINT before_exam_check')
      } else if (savepointErr instanceof GroupsError) {
        await db.query('RELEASE SAVEPOINT before_exam_check')
        throw savepointErr
      } else {
        await db.query('RELEASE SAVEPOINT before_exam_check')
        throw savepointErr
      }
    }

    // SAVEPOINT guard: ads_group_targets reference (AD-08)
    await db.query('SAVEPOINT before_ads_check')
    try {
      const adsResult = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ads_group_targets WHERE group_id = $1`,
        [id]
      )
      const adsCount = parseInt(adsResult.rows[0]?.count ?? '0', 10)
      if (adsCount > 0) {
        await db.query('RELEASE SAVEPOINT before_ads_check')
        throw new GroupsError('GROUP_REFERENCED_BY_ADS')
      }
      await db.query('RELEASE SAVEPOINT before_ads_check')
    } catch (savepointErr) {
      const errMsg = String(savepointErr)
      if (
        errMsg.includes('42P01') ||
        errMsg.toLowerCase().includes('does not exist') ||
        errMsg.toLowerCase().includes('relation "ads_group_targets"')
      ) {
        await db.query('ROLLBACK TO SAVEPOINT before_ads_check')
        await db.query('RELEASE SAVEPOINT before_ads_check')
      } else if (savepointErr instanceof GroupsError) {
        await db.query('RELEASE SAVEPOINT before_ads_check')
        throw savepointErr
      } else {
        await db.query('RELEASE SAVEPOINT before_ads_check')
        throw savepointErr
      }
    }

    await softDeleteGroup(db, id)

    await db.query('COMMIT')

    logger.info('Group deleted', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      event: 'GROUP_DELETED',
      group_id: id,
    })
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof GroupsError) throw err
    logger.error('deleteGroup transaction failed', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      error: String(err),
    })
    throw err
  }
}

// ---------------------------------------------------------------------------
// 6 — assignStudentToGroup (SELECT FOR UPDATE for max_members enforcement)
// ---------------------------------------------------------------------------

export async function assignStudentToGroup(
  db: DbClient,
  studentId: string,
  groupId: string,
  audit: AuditContext
): Promise<StudentGroupResult> {
  await db.query('BEGIN')
  try {
    // Step 1: Verify student exists
    const student = await findStudentById(db, studentId)
    if (!student) {
      throw new GroupsError('STUDENT_NOT_FOUND')
    }

    // Step 2: Lock group row for update (prevents concurrent max_members race)
    const group = await lockGroupForUpdate(db, groupId)
    if (!group) {
      throw new GroupsError('GROUP_NOT_FOUND')
    }
    if (group.status === 'DISABLED') {
      throw new GroupsError('GROUP_DISABLED')
    }

    // Step 3: Division mismatch check (only for department-scoped groups)
    if (group.department_id) {
      const dept = await findDepartmentDivisionId(db, group.department_id)
      if (dept?.division_id && student.division_id && dept.division_id !== student.division_id) {
        throw new GroupsError('GROUP_DIVISION_MISMATCH')
      }
    }

    // Step 4: max_members enforcement (idempotent re-assignment: exclude this student)
    if (group.max_members !== null) {
      const isReassign = student.group_id === groupId
      const memberCount = isReassign
        ? await countStudentsInGroupExcluding(db, groupId, studentId)
        : await countStudentsInGroup(db, groupId)
      if (memberCount >= group.max_members) {
        throw new GroupsError('GROUP_MAX_MEMBERS_EXCEEDED')
      }
    }

    // Step 5: Assign student
    await updateStudentGroupId(db, studentId, groupId)

    await db.query('COMMIT')

    logger.info('Student assigned to group', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      event: 'GROUP_STUDENT_ASSIGNED',
      group_id: groupId,
      student_id: studentId,
    })

    return { student_id: studentId, group_id: groupId }
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof GroupsError) throw err
    logger.error('assignStudentToGroup transaction failed', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      error: String(err),
    })
    throw err
  }
}

// ---------------------------------------------------------------------------
// 7 — removeStudentFromGroup
// ---------------------------------------------------------------------------

export async function removeStudentFromGroup(
  db: DbClient,
  studentId: string,
  audit: AuditContext
): Promise<StudentGroupResult> {
  await db.query('BEGIN')
  try {
    const student = await findStudentById(db, studentId)
    if (!student) {
      throw new GroupsError('STUDENT_NOT_FOUND')
    }
    if (!student.group_id) {
      throw new GroupsError('GROUP_STUDENT_ASSIGNMENT_NOT_FOUND')
    }

    await updateStudentGroupId(db, studentId, null)

    await db.query('COMMIT')

    logger.info('Student removed from group', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      event: 'GROUP_STUDENT_REMOVED',
      student_id: studentId,
    })

    return { student_id: studentId, group_id: null }
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof GroupsError) throw err
    logger.error('removeStudentFromGroup transaction failed', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      error: String(err),
    })
    throw err
  }
}

// ---------------------------------------------------------------------------
// 8 — getStudentGroup
// ---------------------------------------------------------------------------

export async function getStudentGroup(db: DbClient, studentId: string): Promise<GroupRow | null> {
  const student = await findStudentById(db, studentId)
  if (!student) {
    throw new GroupsError('STUDENT_NOT_FOUND')
  }
  return findStudentGroup(db, studentId)
}

// ---------------------------------------------------------------------------
// 9 — assignStaffToGroup (idempotent upsert)
// ---------------------------------------------------------------------------

export async function assignStaffToGroup(
  db: DbClient,
  staffId: string,
  groupId: string,
  audit: AuditContext
): Promise<GroupRow[]> {
  await db.query('BEGIN')
  try {
    // Verify staff exists
    const staff = await findStaffById(db, staffId)
    if (!staff) {
      throw new GroupsError('STAFF_NOT_FOUND')
    }

    // Lock group row
    const group = await lockGroupForUpdate(db, groupId)
    if (!group) {
      throw new GroupsError('GROUP_NOT_FOUND')
    }
    if (group.status === 'DISABLED') {
      throw new GroupsError('GROUP_DISABLED')
    }

    // Division mismatch check (only for department-scoped groups and staff with a division)
    if (group.department_id && staff.division_id) {
      const dept = await findDepartmentDivisionId(db, group.department_id)
      if (dept?.division_id && dept.division_id !== staff.division_id) {
        throw new GroupsError('GROUP_DIVISION_MISMATCH')
      }
    }

    // Idempotent upsert
    await upsertStaffGroupAssignment(db, staffId, groupId)

    await db.query('COMMIT')

    logger.info('Staff assigned to group', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      event: 'GROUP_STAFF_ASSIGNED',
      group_id: groupId,
      staff_id: staffId,
    })

    // Return updated list of staff's groups
    return findStaffGroups(db, staffId)
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof GroupsError) throw err
    logger.error('assignStaffToGroup transaction failed', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      error: String(err),
    })
    throw err
  }
}

// ---------------------------------------------------------------------------
// 10 — removeStaffFromGroup
// ---------------------------------------------------------------------------

export async function removeStaffFromGroup(
  db: DbClient,
  staffId: string,
  groupId: string,
  audit: AuditContext
): Promise<GroupRow[]> {
  await db.query('BEGIN')
  try {
    // Verify staff exists
    const staff = await findStaffById(db, staffId)
    if (!staff) {
      throw new GroupsError('STAFF_NOT_FOUND')
    }

    // Verify group exists (including soft-deleted — just for context; 404 regardless)
    const groupResult = await db.query<{ id: string }>(`SELECT id FROM groups WHERE id = $1`, [
      groupId,
    ])
    if (groupResult.rows.length === 0) {
      throw new GroupsError('GROUP_NOT_FOUND')
    }

    const rowCount = await deleteStaffGroupAssignment(db, staffId, groupId)
    if (rowCount === 0) {
      throw new GroupsError('GROUP_STAFF_ASSIGNMENT_NOT_FOUND')
    }

    await db.query('COMMIT')

    logger.info('Staff removed from group', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      event: 'GROUP_STAFF_REMOVED',
      group_id: groupId,
      staff_id: staffId,
    })

    // Return remaining groups for staff
    return findStaffGroups(db, staffId)
  } catch (err) {
    await db.query('ROLLBACK')
    if (err instanceof GroupsError) throw err
    logger.error('removeStaffFromGroup transaction failed', {
      correlation_id: audit.correlation_id,
      workspace_slug: audit.workspace_slug,
      error: String(err),
    })
    throw err
  }
}

// ---------------------------------------------------------------------------
// 11 — getStaffGroups
// ---------------------------------------------------------------------------

export async function getStaffGroups(db: DbClient, staffId: string): Promise<GroupRow[]> {
  const staff = await findStaffById(db, staffId)
  if (!staff) {
    throw new GroupsError('STAFF_NOT_FOUND')
  }
  return findStaffGroups(db, staffId)
}
