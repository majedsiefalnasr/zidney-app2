/**
 * Teams Domain Unit Tests — STAGE_26
 *
 * File: packages/domain-core/src/teams/__tests__/teams.service.test.ts
 *
 * Tests for business logic: name uniqueness, type–team relationship guards,
 * NOWAIT lock contention (55P03), idempotent assignment, capacity enforcement,
 * soft-delete visibility, and error-guard paths.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  type AuditContext,
  assignStaffToTeam,
  type CreateTeamInput,
  type CreateTeamTypeInput,
  createTeam,
  createTeamType,
  deleteTeam,
  deleteTeamType,
  getTeamById,
  getTeamTypeById,
  listTeamMembers,
  listTeams,
  listTeamTypes,
  removeStaffFromTeam,
  TeamsError,
  updateTeam,
  updateTeamType,
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

const makeTeamType = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'type-001',
  name: 'Engineering',
  description: null,
  status: 'ENABLED' as const,
  deleted_at: null,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
})

const makeTeam = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'team-001',
  name: 'Backend',
  team_type_id: 'type-001',
  max_members: null,
  description: null,
  status: 'ENABLED' as const,
  deleted_at: null,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
})

const makeStaffTeam = (overrides: Partial<Record<string, unknown>> = {}) => ({
  staff_id: 'staff-001',
  team_id: 'team-001',
  created_at: NOW,
  ...overrides,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb(
  matcher: (sql: string, params?: unknown[]) => { rows: unknown[]; rowCount: number | null }
) {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => matcher(sql, params)),
  }
}

// ---------------------------------------------------------------------------
// 1. listTeamTypes — pagination cursor
// ---------------------------------------------------------------------------

describe('listTeamTypes', () => {
  it('returns items and nextCursor when more rows exist than limit', async () => {
    const types = Array.from({ length: 3 }, (_, i) =>
      makeTeamType({ id: `type-00${i + 1}`, name: `Type ${i + 1}` })
    )

    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '5' }], rowCount: 1 }
      return { rows: types, rowCount: types.length }
    })

    const result = await listTeamTypes(db as any, { limit: 2 })

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBeTruthy()
    expect(result.total).toBe(5)
  })

  it('returns null nextCursor when results fit within limit', async () => {
    const types = [makeTeamType()]

    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '1' }], rowCount: 1 }
      return { rows: types, rowCount: 1 }
    })

    const result = await listTeamTypes(db as any, { limit: 20 })

    expect(result.items).toHaveLength(1)
    expect(result.nextCursor).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 2. createTeamType — duplicate name
// ---------------------------------------------------------------------------

describe('createTeamType', () => {
  it('throws TEAM_TYPE_NAME_DUPLICATE when name already exists', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      // teamTypeNameExists returns a row
      if (sql.includes('LOWER(name)')) return { rows: [{ '?column?': 1 }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createTeamType(db as any, { name: 'Engineering' } as CreateTeamTypeInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_TYPE_NAME_DUPLICATE'
    )
  })

  it('creates and returns the new team type when name is unique', async () => {
    const newType = makeTeamType({ id: 'type-new' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('LOWER(name)')) return { rows: [], rowCount: 0 } // no duplicate
      if (sql.includes('INSERT INTO team_types')) return { rows: [newType], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await createTeamType(
      db as any,
      { name: 'Engineering' } as CreateTeamTypeInput,
      auditCtx
    )

    expect(result.id).toBe('type-new')
    expect(result.status).toBe('ENABLED')
  })
})

// ---------------------------------------------------------------------------
// 3. updateTeamType — not found and duplicate
// ---------------------------------------------------------------------------

describe('updateTeamType', () => {
  it('throws TEAM_TYPE_NOT_FOUND when type does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(updateTeamType(db as any, 'missing', { name: 'New' }, auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_TYPE_NOT_FOUND'
    )
  })

  it('throws TEAM_TYPE_NAME_DUPLICATE when new name is already taken', async () => {
    const existing = makeTeamType()

    let nameCheckCalled = 0
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('LOWER(name)')) {
        nameCheckCalled++
        return { rows: [{ '?column?': 1 }], rowCount: 1 } // always duplicate
      }
      // findTeamTypeById
      return { rows: [existing], rowCount: 1 }
    })

    void nameCheckCalled
    await expect(
      updateTeamType(db as any, 'type-001', { name: 'Other' }, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_TYPE_NAME_DUPLICATE'
    )
  })
})

// ---------------------------------------------------------------------------
// 4. deleteTeamType — child guard
// ---------------------------------------------------------------------------

describe('deleteTeamType', () => {
  it('throws TEAM_TYPE_NOT_FOUND when type does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteTeamType(db as any, 'missing', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_TYPE_NOT_FOUND'
    )
  })

  it('throws TEAM_TYPE_HAS_TEAMS when active teams reference the type', async () => {
    const existing = makeTeamType()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('COUNT(*)') && sql.includes('team_type_id'))
        return { rows: [{ count: '2' }], rowCount: 1 } // 2 child teams
      // findTeamTypeById
      return { rows: [existing], rowCount: 1 }
    })

    await expect(deleteTeamType(db as any, 'type-001', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_TYPE_HAS_TEAMS'
    )
  })

  it('soft-deletes type when no child teams exist', async () => {
    const existing = makeTeamType()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('COUNT(*)') && sql.includes('team_type_id'))
        return { rows: [{ count: '0' }], rowCount: 1 }
      if (sql.includes('UPDATE team_types')) return { rows: [existing], rowCount: 1 }
      return { rows: [existing], rowCount: 1 }
    })

    // deleteTeamType returns void — just assert it resolves without error
    await expect(deleteTeamType(db as any, 'type-001', auditCtx)).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 5. createTeam — type validation
// ---------------------------------------------------------------------------

describe('createTeam', () => {
  it('throws TEAM_NAME_DUPLICATE when team name already exists', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      // teamNameExists → duplicate
      if (sql.includes('LOWER(name)') && sql.includes('teams'))
        return { rows: [{ '?column?': 1 }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createTeam(db as any, { name: 'Backend' } as CreateTeamInput, auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_NAME_DUPLICATE'
    )
  })

  it('throws TEAM_TYPE_NOT_FOUND when team_type_id references a missing type', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('LOWER(name)') && sql.includes('teams')) return { rows: [], rowCount: 0 } // no name duplicate
      // findTeamTypeById returns nothing
      if (sql.includes('FROM team_types')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createTeam(
        db as any,
        { name: 'Frontend', team_type_id: 'missing-type' } as CreateTeamInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_TYPE_NOT_FOUND'
    )
  })

  it('throws TEAM_TYPE_DISABLED when team_type_id references a disabled type', async () => {
    const disabledType = makeTeamType({ status: 'DISABLED' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('LOWER(name)') && sql.includes('teams')) return { rows: [], rowCount: 0 }
      if (sql.includes('FROM team_types')) return { rows: [disabledType], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createTeam(
        db as any,
        { name: 'Frontend', team_type_id: 'type-001' } as CreateTeamInput,
        auditCtx
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_TYPE_DISABLED'
    )
  })
})

// ---------------------------------------------------------------------------
// 6. deleteTeam — member guard
// ---------------------------------------------------------------------------

describe('deleteTeam', () => {
  it('throws TEAM_NOT_FOUND when team does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteTeam(db as any, 'missing', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_NOT_FOUND'
    )
  })

  it('throws TEAM_HAS_ASSIGNMENTS when staff are still assigned', async () => {
    const team = makeTeam()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('COUNT(*)') && sql.includes('staff_teams'))
        return { rows: [{ count: '3' }], rowCount: 1 } // 3 members
      return { rows: [team], rowCount: 1 }
    })

    await expect(deleteTeam(db as any, 'team-001', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_HAS_ASSIGNMENTS'
    )
  })
})

// ---------------------------------------------------------------------------
// 7. getTeamById — soft-delete visibility
// ---------------------------------------------------------------------------

describe('getTeamById', () => {
  it('returns team when found', async () => {
    const team = makeTeam()
    const db = makeDb(() => ({ rows: [team], rowCount: 1 }))

    const result = await getTeamById(db as any, 'team-001')
    expect(result?.id).toBe('team-001')
  })

  it('throws TEAM_NOT_FOUND for a soft-deleted team (repository filters it out)', async () => {
    // Repository always filters deleted_at IS NULL — so missing/deleted both throw
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))

    await expect(getTeamById(db as any, 'deleted-team')).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_NOT_FOUND'
    )
  })
})

// ---------------------------------------------------------------------------
// 8. getTeamTypeById
// ---------------------------------------------------------------------------

describe('getTeamTypeById', () => {
  it('throws TEAM_TYPE_NOT_FOUND when type does not exist', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))

    await expect(getTeamTypeById(db as any, 'missing')).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_TYPE_NOT_FOUND'
    )
  })
})

// ---------------------------------------------------------------------------
// 9. assignStaffToTeam — NOWAIT lock contention
// ---------------------------------------------------------------------------

describe('assignStaffToTeam — NOWAIT lock contention', () => {
  it('throws TEAM_LOCK_CONTENTION when 55P03 is received from lockTeamForUpdate', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) {
        // Simulated by throwing in the query fn
        throw Object.assign(new Error('lock not available'), { code: '55P03' })
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(assignStaffToTeam(db as any, 'team-001', 'staff-001', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_LOCK_CONTENTION'
    )
  })
})

// ---------------------------------------------------------------------------
// 10. assignStaffToTeam — idempotent (already assigned)
// ---------------------------------------------------------------------------

describe('assignStaffToTeam — idempotent', () => {
  it('returns existing assignment without error when staff is already in team', async () => {
    const team = makeTeam()
    const existing = makeStaffTeam()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [team], rowCount: 1 }
      // checkStaffExistsInWorkspace — queries backoffice_staff_users
      if (sql.includes('backoffice_staff_users')) return { rows: [{ exists: true }], rowCount: 1 }
      // findStaffTeamAssignment → already assigned
      if (sql.includes('FROM staff_teams')) return { rows: [existing], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await assignStaffToTeam(db as any, 'team-001', 'staff-001', auditCtx)
    expect(result.staff_id).toBe('staff-001')
    expect(result.team_id).toBe('team-001')
  })
})

// ---------------------------------------------------------------------------
// 11. assignStaffToTeam — disabled team guard
// ---------------------------------------------------------------------------

describe('assignStaffToTeam — disabled team', () => {
  it('throws TEAM_DISABLED when team is locked but disabled', async () => {
    const disabledTeam = makeTeam({ status: 'DISABLED' })

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [disabledTeam], rowCount: 1 }
      // staff exists — service checks staff before TEAM_DISABLED guard
      if (sql.includes('backoffice_staff_users')) return { rows: [{ exists: true }], rowCount: 1 }
      // not yet assigned
      if (sql.includes('FROM staff_teams')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(assignStaffToTeam(db as any, 'team-001', 'staff-001', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_DISABLED'
    )
  })
})

// ---------------------------------------------------------------------------
// 12. assignStaffToTeam — capacity exceeded
// ---------------------------------------------------------------------------

describe('assignStaffToTeam — capacity exceeded', () => {
  it('throws TEAM_MAX_MEMBERS_EXCEEDED when team is at capacity', async () => {
    const teamWithCap = makeTeam({ max_members: 5 })

    // Track call count to distinguish findStaffTeamAssignment (first call) from countStaffInTeam
    let staffTeamsCallCount = 0
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [teamWithCap], rowCount: 1 }
      // checkStaffExistsInWorkspace
      if (sql.includes('backoffice_staff_users')) return { rows: [{ exists: true }], rowCount: 1 }
      // findStaffTeamAssignment → not yet assigned (first staff_teams query)
      // countStaffInTeam → at capacity (second staff_teams query)
      if (sql.includes('staff_teams')) {
        staffTeamsCallCount++
        if (staffTeamsCallCount === 1) return { rows: [], rowCount: 0 } // not assigned
        return { rows: [{ count: '5' }], rowCount: 1 } // at capacity
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(assignStaffToTeam(db as any, 'team-001', 'staff-001', auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_MAX_MEMBERS_EXCEEDED'
    )
  })
})

// ---------------------------------------------------------------------------
// 13. assignStaffToTeam — staff not found
// ---------------------------------------------------------------------------

describe('assignStaffToTeam — staff not found', () => {
  it('throws STAFF_NOT_FOUND when staff member does not exist in workspace', async () => {
    const team = makeTeam()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE NOWAIT')) return { rows: [team], rowCount: 1 }
      // checkStaffExistsInWorkspace — returns exists: false
      if (sql.includes('backoffice_staff_users')) return { rows: [{ exists: false }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      assignStaffToTeam(db as any, 'team-001', 'staff-ghost', auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'STAFF_NOT_FOUND'
    )
  })
})

// ---------------------------------------------------------------------------
// 14. removeStaffFromTeam — assignment not found
// ---------------------------------------------------------------------------

describe('removeStaffFromTeam', () => {
  it('throws TEAM_STAFF_ASSIGNMENT_NOT_FOUND when assignment does not exist', async () => {
    const team = makeTeam()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      // findTeamById → exists
      if (sql.includes('FROM teams')) return { rows: [team], rowCount: 1 }
      // findStaffTeamAssignment → not found
      if (sql.includes('FROM staff_teams')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      removeStaffFromTeam(db as any, 'team-001', 'staff-ghost', auditCtx)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_STAFF_ASSIGNMENT_NOT_FOUND'
    )
  })

  it('removes assignment successfully when assignment exists', async () => {
    const team = makeTeam()
    const assignment = makeStaffTeam()

    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [], rowCount: 0 }
      if (sql.includes('FROM teams')) return { rows: [team], rowCount: 1 }
      if (sql.includes('FROM staff_teams')) return { rows: [assignment], rowCount: 1 }
      if (sql.includes('DELETE FROM staff_teams')) return { rows: [assignment], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    // removeStaffFromTeam returns void
    await expect(
      removeStaffFromTeam(db as any, 'team-001', 'staff-001', auditCtx)
    ).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 15. listTeams
// ---------------------------------------------------------------------------

describe('listTeams', () => {
  it('returns paginated items with nextCursor when more exist', async () => {
    const teams = Array.from({ length: 3 }, (_, i) =>
      makeTeam({ id: `team-00${i + 1}`, name: `Team ${i + 1}` })
    )

    const db = makeDb((sql) => {
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '10' }], rowCount: 1 }
      return { rows: teams, rowCount: teams.length }
    })

    const result = await listTeams(db as any, { limit: 2 })

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBeTruthy()
    expect(result.total).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// 16. listTeamMembers
// ---------------------------------------------------------------------------

describe('listTeamMembers', () => {
  it('throws TEAM_NOT_FOUND when team does not exist', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }))

    await expect(listTeamMembers(db as any, 'missing', { limit: 20 })).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_NOT_FOUND'
    )
  })

  it('returns member list when team exists', async () => {
    const team = makeTeam()
    const member = makeStaffTeam()

    const db = makeDb((sql) => {
      if (sql.includes('FROM teams')) return { rows: [team], rowCount: 1 }
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '1' }], rowCount: 1 }
      if (sql.includes('FROM staff_teams')) return { rows: [member], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const result = await listTeamMembers(db as any, 'team-001', { limit: 20 })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.staff_id).toBe('staff-001')
  })
})

// ---------------------------------------------------------------------------
// 17. updateTeam — not found
// ---------------------------------------------------------------------------

describe('updateTeam', () => {
  it('throws TEAM_NOT_FOUND when team does not exist', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(updateTeam(db as any, 'missing', { name: 'NewName' }, auditCtx)).rejects.toSatisfy(
      (err: unknown) => err instanceof TeamsError && err.code === 'TEAM_NOT_FOUND'
    )
  })
})
