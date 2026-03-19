/**
 * Groups Domain Unit Tests — STAGE_24
 *
 * File: packages/domain-core/src/groups/__tests__/groups.service.test.ts
 *
 * Tests for business logic: name uniqueness, max_members enforcement, division mismatch,
 * SAVEPOINT 42P01 safe-pass, idempotent assignment, and error guard paths.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  type AuditContext,
  assignStaffToGroup,
  assignStudentToGroup,
  type CreateGroupInput,
  createGroup,
  deleteGroup,
  GroupsError,
  getGroupById,
  getStaffGroups,
  getStudentGroup,
  listGroups,
  removeStaffFromGroup,
  removeStudentFromGroup,
  type UpdateGroupInput,
  updateGroup,
} from '../index'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const auditCtx: AuditContext = {
  user_id: 'user-001',
  correlation_id: 'corr-001',
  workspace_slug: 'test-ws',
  workspace_id: 'ws-001',
}

const NOW = new Date('2026-03-19T12:00:00Z')

const makeGroup = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'group-001',
  name: 'Alpha',
  department_id: null,
  max_members: null,
  description: null,
  status: 'ENABLED' as const,
  deleted_at: null,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
})

// ---------------------------------------------------------------------------
// Helpers for building mock DbClients
// ---------------------------------------------------------------------------

function makeDb(
  matcher: (sql: string, params?: unknown[]) => { rows: unknown[]; rowCount: number }
) {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => matcher(sql, params)),
  }
}

// ---------------------------------------------------------------------------
// 1. listGroups
// ---------------------------------------------------------------------------

describe('listGroups', () => {
  it('returns items and nextCursor when there are more results than the limit', async () => {
    // Return limit+1 rows so pagination cursor is generated
    const groups = Array.from({ length: 3 }, (_, i) =>
      makeGroup({ id: `group-00${i + 1}`, name: `Group ${i + 1}` })
    )

    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '5' }], rowCount: 1 }
      return { rows: groups, rowCount: groups.length }
    })

    const result = await listGroups(db as any, { limit: 2 })

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBeTruthy()
    expect(result.total).toBe(5)
  })

  it('returns null nextCursor when results fit within limit', async () => {
    const groups = [makeGroup()]

    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '1' }], rowCount: 1 }
      return { rows: groups, rowCount: 1 }
    })

    const result = await listGroups(db as any, { limit: 20 })

    expect(result.items).toHaveLength(1)
    expect(result.nextCursor).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 2. createGroup
// ---------------------------------------------------------------------------

describe('createGroup', () => {
  it('throws GROUP_NAME_DUPLICATE when name already exists among active groups', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      // groupNameExists returns a row → duplicate
      if (sql.includes('LOWER(name)')) return { rows: [{ '?column?': 1 }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createGroup(db as any, { name: 'Alpha' } as CreateGroupInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'GROUP_NAME_DUPLICATE'
    )
  })

  it('creates a group and returns the new row', async () => {
    const newGroup = makeGroup({ id: 'group-new' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('LOWER(name)')) return { rows: [], rowCount: 0 } // no duplicate
      if (sql.includes('INSERT INTO groups')) return { rows: [newGroup], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await createGroup(
      db as any,
      { name: 'Beta', department_id: undefined } as CreateGroupInput,
      auditCtx
    )

    expect(result.id).toBe('group-new')
    expect(result.status).toBe('ENABLED')
  })
})

// ---------------------------------------------------------------------------
// 3. getGroupById
// ---------------------------------------------------------------------------

describe('getGroupById', () => {
  it('returns the group when found', async () => {
    const group = makeGroup()
    const db = makeDb(() => ({ rows: [group], rowCount: 1 }))

    const result = await getGroupById(db as any, 'group-001')
    expect(result?.id).toBe('group-001')
  })

  it('returns null when group not found', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))

    const result = await getGroupById(db as any, 'missing')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 4. updateGroup
// ---------------------------------------------------------------------------

describe('updateGroup', () => {
  it('throws GROUP_NOT_FOUND when group does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      // findGroupById returns nothing
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateGroup(db as any, 'missing', { name: 'NewName' } as UpdateGroupInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'GROUP_NOT_FOUND'
    )
  })

  it('throws GROUP_NAME_DUPLICATE when renaming to a taken name', async () => {
    const existing = makeGroup({ id: 'group-001', name: 'Alpha' })

    let callCount = 0
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('LOWER(name)')) {
        // Second call = duplicate check
        callCount++
        if (callCount === 1) return { rows: [{ '?column?': 1 }], rowCount: 1 }
        return { rows: [], rowCount: 0 }
      }
      if (sql.includes('SELECT id, name, department_id') || sql.includes('FROM groups')) {
        return { rows: [existing], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      updateGroup(db as any, 'group-001', { name: 'Beta' } as UpdateGroupInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'GROUP_NAME_DUPLICATE'
    )
  })

  it('updates and returns group when all checks pass', async () => {
    const existing = makeGroup({ id: 'group-001', name: 'Alpha' })
    const updated = makeGroup({ id: 'group-001', name: 'Alpha Updated' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('LOWER(name)')) return { rows: [], rowCount: 0 } // no duplicate
      if (sql.includes('RETURNING id, name')) return { rows: [updated], rowCount: 1 }
      // findGroupById
      return { rows: [existing], rowCount: 1 }
    })

    const result = await updateGroup(
      db as any,
      'group-001',
      { name: 'Alpha Updated' } as UpdateGroupInput,
      auditCtx
    )
    expect(result.name).toBe('Alpha Updated')
  })
})

// ---------------------------------------------------------------------------
// 5. deleteGroup
// ---------------------------------------------------------------------------

describe('deleteGroup', () => {
  it('throws GROUP_NOT_FOUND when group does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteGroup(db as any, 'missing', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'GROUP_NOT_FOUND'
    )
  })

  it('throws GROUP_HAS_ASSIGNMENTS when students are enrolled', async () => {
    const group = makeGroup()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      // findGroupById
      if (sql.includes('FROM groups') && sql.includes('deleted_at IS NULL')) {
        return { rows: [group], rowCount: 1 }
      }
      // countStudentsInGroup
      if (sql.includes('FROM students WHERE group_id')) {
        return { rows: [{ count: '3' }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteGroup(db as any, 'group-001', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'GROUP_HAS_ASSIGNMENTS'
    )
  })

  it('throws GROUP_REFERENCED_BY_EXAM when exam target rows exist', async () => {
    const group = makeGroup()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
        return { rows: [], rowCount: 0 }
      }
      if (sql.includes('SAVEPOINT before_exam_check')) return { rows: [], rowCount: 0 }
      if (sql.includes('SAVEPOINT before_ads_check')) return { rows: [], rowCount: 0 }
      if (sql.includes('RELEASE SAVEPOINT')) return { rows: [], rowCount: 0 }
      if (sql.includes('ROLLBACK TO SAVEPOINT')) return { rows: [], rowCount: 0 }
      if (sql.includes('FROM groups') && sql.includes('deleted_at IS NULL')) {
        return { rows: [group], rowCount: 1 }
      }
      if (sql.includes('FROM students WHERE group_id'))
        return { rows: [{ count: '0' }], rowCount: 1 }
      if (sql.includes('FROM staff_groups WHERE group_id'))
        return { rows: [{ count: '0' }], rowCount: 1 }
      if (sql.includes('exam_group_targets')) return { rows: [{ count: '2' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteGroup(db as any, 'group-001', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'GROUP_REFERENCED_BY_EXAM'
    )
  })

  it('safely ignores missing exam_group_targets table (42P01 safe-pass)', async () => {
    const group = makeGroup()
    let deleteGroupCalled = false

    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
        if (sql.includes('ROLLBACK') && !sql.includes('SAVEPOINT')) return { rows: [], rowCount: 0 }
        if (sql.includes('SAVEPOINT')) return { rows: [], rowCount: 0 }
        if (sql.includes('RELEASE SAVEPOINT')) return { rows: [], rowCount: 0 }
        if (sql.includes('ROLLBACK TO SAVEPOINT')) return { rows: [], rowCount: 0 }
        if (sql.includes('FROM groups') && sql.includes('deleted_at IS NULL')) {
          return { rows: [group], rowCount: 1 }
        }
        if (sql.includes('FROM students WHERE group_id'))
          return { rows: [{ count: '0' }], rowCount: 1 }
        if (sql.includes('FROM staff_groups WHERE group_id'))
          return { rows: [{ count: '0' }], rowCount: 1 }
        if (sql.includes('exam_group_targets')) {
          throw new Error('ERROR: 42P01: relation "exam_group_targets" does not exist')
        }
        if (sql.includes('ads_group_targets')) {
          throw new Error('ERROR: 42P01: relation "ads_group_targets" does not exist')
        }
        if (sql.includes('UPDATE groups SET deleted_at')) {
          deleteGroupCalled = true
          return { rows: [], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      }),
    }

    await deleteGroup(db as any, 'group-001', auditCtx)
    expect(deleteGroupCalled).toBe(true)
  })

  it('soft-deletes successfully when no dependencies', async () => {
    const group = makeGroup()
    let softDeleteCalled = false

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('SAVEPOINT') || sql.includes('RELEASE') || sql.includes('ROLLBACK TO')) {
        return { rows: [], rowCount: 0 }
      }
      if (sql.includes('FROM groups') && sql.includes('deleted_at IS NULL')) {
        return { rows: [group], rowCount: 1 }
      }
      if (sql.includes('FROM students WHERE group_id'))
        return { rows: [{ count: '0' }], rowCount: 1 }
      if (sql.includes('FROM staff_groups WHERE group_id'))
        return { rows: [{ count: '0' }], rowCount: 1 }
      if (sql.includes('exam_group_targets')) return { rows: [{ count: '0' }], rowCount: 1 }
      if (sql.includes('ads_group_targets')) return { rows: [{ count: '0' }], rowCount: 1 }
      if (sql.includes('UPDATE groups SET deleted_at')) {
        softDeleteCalled = true
        return { rows: [], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    await deleteGroup(db as any, 'group-001', auditCtx)
    expect(softDeleteCalled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 6. assignStudentToGroup
// ---------------------------------------------------------------------------

describe('assignStudentToGroup', () => {
  it('throws STUDENT_NOT_FOUND when student does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      assignStudentToGroup(db as any, 'missing-student', 'group-001', auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'STUDENT_NOT_FOUND'
    )
  })

  it('throws GROUP_NOT_FOUND when group does not exist', async () => {
    const student = { id: 'stu-1', division_id: null, group_id: null }

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FROM students WHERE id')) return { rows: [student], rowCount: 1 }
      // lockGroupForUpdate returns nothing
      return { rows: [], rowCount: 0 }
    })

    await expect(
      assignStudentToGroup(db as any, 'stu-1', 'missing-group', auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'GROUP_NOT_FOUND'
    )
  })

  it('throws GROUP_DISABLED when group status is DISABLED', async () => {
    const student = { id: 'stu-1', division_id: null, group_id: null }
    const group = makeGroup({ status: 'DISABLED' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FROM students WHERE id')) return { rows: [student], rowCount: 1 }
      if (sql.includes('FOR UPDATE')) return { rows: [group], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(assignStudentToGroup(db as any, 'stu-1', 'group-001', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'GROUP_DISABLED'
    )
  })

  it('throws GROUP_DIVISION_MISMATCH when student and group are in different divisions', async () => {
    const student = { id: 'stu-1', division_id: 'div-A', group_id: null }
    const group = makeGroup({ department_id: 'dept-X' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FROM students WHERE id')) return { rows: [student], rowCount: 1 }
      if (sql.includes('FOR UPDATE')) return { rows: [group], rowCount: 1 }
      // findDepartmentDivisionId returns dept in different division
      if (sql.includes('FROM departments WHERE id')) {
        return { rows: [{ division_id: 'div-B' }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(assignStudentToGroup(db as any, 'stu-1', 'group-001', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'GROUP_DIVISION_MISMATCH'
    )
  })

  it('throws GROUP_MAX_MEMBERS_EXCEEDED when group is at capacity', async () => {
    const student = { id: 'stu-1', division_id: null, group_id: null }
    const group = makeGroup({ max_members: 5 })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FROM students WHERE id')) return { rows: [student], rowCount: 1 }
      if (sql.includes('FOR UPDATE')) return { rows: [group], rowCount: 1 }
      if (sql.includes('FROM students WHERE group_id'))
        return { rows: [{ count: '5' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(assignStudentToGroup(db as any, 'stu-1', 'group-001', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'GROUP_MAX_MEMBERS_EXCEEDED'
    )
  })

  it('counts excluding the student when re-assigning (idempotent)', async () => {
    // Student is already in group-001; re-assigning — exclude them from count
    const student = { id: 'stu-1', division_id: null, group_id: 'group-001' }
    const group = makeGroup({ max_members: 1 }) // capacity 1 — only this student

    let excludingQueryCalled = false
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('FROM students WHERE id')) return { rows: [student], rowCount: 1 }
      if (sql.includes('FOR UPDATE')) return { rows: [group], rowCount: 1 }
      // countStudentsInGroupExcluding (excludes this student — count = 0, not exceeding)
      if (sql.includes('AND id <> $2')) {
        excludingQueryCalled = true
        return { rows: [{ count: '0' }], rowCount: 1 }
      }
      if (sql.includes('UPDATE students SET group_id')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await assignStudentToGroup(db as any, 'stu-1', 'group-001', auditCtx)
    expect(excludingQueryCalled).toBe(true)
    expect(result.group_id).toBe('group-001')
  })

  it('assigns student when all checks pass', async () => {
    const student = { id: 'stu-1', division_id: null, group_id: null }
    const group = makeGroup()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('FROM students WHERE id')) return { rows: [student], rowCount: 1 }
      if (sql.includes('FOR UPDATE')) return { rows: [group], rowCount: 1 }
      if (sql.includes('UPDATE students SET group_id')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await assignStudentToGroup(db as any, 'stu-1', 'group-001', auditCtx)
    expect(result).toEqual({ student_id: 'stu-1', group_id: 'group-001' })
  })
})

// ---------------------------------------------------------------------------
// 7. removeStudentFromGroup
// ---------------------------------------------------------------------------

describe('removeStudentFromGroup', () => {
  it('throws STUDENT_NOT_FOUND when student does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(removeStudentFromGroup(db as any, 'missing', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'STUDENT_NOT_FOUND'
    )
  })

  it('throws GROUP_STUDENT_ASSIGNMENT_NOT_FOUND when student has no group', async () => {
    const student = { id: 'stu-1', division_id: null, group_id: null }

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FROM students WHERE id')) return { rows: [student], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(removeStudentFromGroup(db as any, 'stu-1', auditCtx)).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof GroupsError && err.code === 'GROUP_STUDENT_ASSIGNMENT_NOT_FOUND'
    )
  })

  it('removes student group assignment successfully', async () => {
    const student = { id: 'stu-1', division_id: null, group_id: 'group-001' }

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('FROM students WHERE id')) return { rows: [student], rowCount: 1 }
      if (sql.includes('UPDATE students SET group_id')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await removeStudentFromGroup(db as any, 'stu-1', auditCtx)
    expect(result).toEqual({ student_id: 'stu-1', group_id: null })
  })
})

// ---------------------------------------------------------------------------
// 8. getStudentGroup
// ---------------------------------------------------------------------------

describe('getStudentGroup', () => {
  it('throws STUDENT_NOT_FOUND when student does not exist', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))

    await expect(getStudentGroup(db as any, 'missing')).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'STUDENT_NOT_FOUND'
    )
  })

  it('returns null when student has no group', async () => {
    const student = { id: 'stu-1', division_id: null, group_id: null }

    const db = makeDb((sql) => {
      if (sql.includes('FROM students WHERE id')) return { rows: [student], rowCount: 1 }
      // findStudentGroup (JOIN) returns nothing
      return { rows: [], rowCount: 0 }
    })

    const result = await getStudentGroup(db as any, 'stu-1')
    expect(result).toBeNull()
  })

  it('returns the group when student has a group', async () => {
    const student = { id: 'stu-1', division_id: null, group_id: 'group-001' }
    const group = makeGroup()

    const db = makeDb((sql) => {
      if (sql.includes('FROM students WHERE id')) return { rows: [student], rowCount: 1 }
      if (sql.includes('FROM groups g')) return { rows: [group], rowCount: 1 }
      return { rows: [group], rowCount: 1 } // fallback for JOIN
    })

    const result = await getStudentGroup(db as any, 'stu-1')
    expect(result?.id).toBe('group-001')
  })
})

// ---------------------------------------------------------------------------
// 9. assignStaffToGroup
// ---------------------------------------------------------------------------

describe('assignStaffToGroup', () => {
  it('throws STAFF_NOT_FOUND when staff does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      assignStaffToGroup(db as any, 'missing-staff', 'group-001', auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'STAFF_NOT_FOUND'
    )
  })

  it('throws GROUP_DISABLED when group is disabled', async () => {
    const staff = { id: 'staff-1', division_id: null }
    const group = makeGroup({ status: 'DISABLED' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('backoffice_staff_users bsu')) return { rows: [staff], rowCount: 1 }
      if (sql.includes('FOR UPDATE')) return { rows: [group], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(assignStaffToGroup(db as any, 'staff-1', 'group-001', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'GROUP_DISABLED'
    )
  })

  it('assigns staff and returns updated group list', async () => {
    const staff = { id: 'staff-1', division_id: null }
    const group = makeGroup()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('backoffice_staff_users bsu')) return { rows: [staff], rowCount: 1 }
      if (sql.includes('FOR UPDATE')) return { rows: [group], rowCount: 1 }
      if (sql.includes('INSERT INTO staff_groups')) return { rows: [], rowCount: 1 }
      // findStaffGroups
      if (sql.includes('FROM staff_groups sg')) return { rows: [group], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await assignStaffToGroup(db as any, 'staff-1', 'group-001', auditCtx)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('group-001')
  })
})

// ---------------------------------------------------------------------------
// 10. removeStaffFromGroup
// ---------------------------------------------------------------------------

describe('removeStaffFromGroup', () => {
  it('throws GROUP_STAFF_ASSIGNMENT_NOT_FOUND when assignment does not exist', async () => {
    const staff = { id: 'staff-1', division_id: null }
    const group = makeGroup()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('backoffice_staff_users bsu')) return { rows: [staff], rowCount: 1 }
      if (sql.includes('FROM groups WHERE id')) return { rows: [group], rowCount: 1 }
      // deleteStaffGroupAssignment returns 0 rows → no assignment
      if (sql.includes('DELETE FROM staff_groups')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      removeStaffFromGroup(db as any, 'staff-1', 'group-001', auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof GroupsError && err.code === 'GROUP_STAFF_ASSIGNMENT_NOT_FOUND'
    )
  })

  it('removes assignment and returns remaining groups', async () => {
    const staff = { id: 'staff-1', division_id: null }
    const group = makeGroup()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('backoffice_staff_users bsu')) return { rows: [staff], rowCount: 1 }
      if (sql.includes('FROM groups WHERE id')) return { rows: [group], rowCount: 1 }
      if (sql.includes('DELETE FROM staff_groups')) return { rows: [], rowCount: 1 }
      // findStaffGroups — no remaining groups
      if (sql.includes('FROM staff_groups sg')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    const result = await removeStaffFromGroup(db as any, 'staff-1', 'group-001', auditCtx)
    expect(result).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 11. getStaffGroups
// ---------------------------------------------------------------------------

describe('getStaffGroups', () => {
  it('throws STAFF_NOT_FOUND when staff does not exist', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))

    await expect(getStaffGroups(db as any, 'missing')).rejects.toSatisfy(
      (err: unknown) => err instanceof GroupsError && err.code === 'STAFF_NOT_FOUND'
    )
  })

  it('returns empty array when staff has no group assignments', async () => {
    const staff = { id: 'staff-1', division_id: null }

    const db = makeDb((sql) => {
      if (sql.includes('backoffice_staff_users bsu')) return { rows: [staff], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await getStaffGroups(db as any, 'staff-1')
    expect(result).toHaveLength(0)
  })

  it('returns list of groups for staff', async () => {
    const staff = { id: 'staff-1', division_id: null }
    const group = makeGroup()

    const db = makeDb((sql) => {
      if (sql.includes('backoffice_staff_users bsu')) return { rows: [staff], rowCount: 1 }
      // findStaffGroups JOIN query
      return { rows: [group], rowCount: 1 }
    })

    const result = await getStaffGroups(db as any, 'staff-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('group-001')
  })
})
