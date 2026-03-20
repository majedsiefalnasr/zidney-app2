/**
 * Teams Route Integration Tests — STAGE_26
 *
 * File: apps/api/src/routes/backoffice/teams/__tests__/teams.integration.test.ts
 *
 * Tests route handlers by mocking the domain service layer.
 * Verifies: request parsing, response shape, error mapping, HTTP status codes.
 */

import type { Context } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock domain service (must be hoisted before handler imports)
// ---------------------------------------------------------------------------

vi.mock('@zidney/domain-core/teams', () => ({
  TeamsError: class TeamsError extends Error {
    code: string
    httpStatus: number
    constructor(code: string) {
      const messages: Record<string, [string, number]> = {
        TEAM_TYPE_NOT_FOUND: ['Team type not found.', 404],
        TEAM_TYPE_NAME_DUPLICATE: ['Team type name duplicate.', 409],
        TEAM_TYPE_HAS_TEAMS: ['Team type has teams.', 409],
        TEAM_TYPE_DISABLED: ['Team type is disabled.', 422],
        TEAM_NOT_FOUND: ['Team not found.', 404],
        TEAM_NAME_DUPLICATE: ['Team name duplicate.', 409],
        TEAM_HAS_ASSIGNMENTS: ['Team has assignments.', 409],
        TEAM_DISABLED: ['Team is disabled.', 422],
        TEAM_MAX_MEMBERS_EXCEEDED: ['Team capacity exceeded.', 422],
        TEAM_LOCK_CONTENTION: ['Team lock contention.', 409],
        STAFF_NOT_FOUND: ['Staff not found.', 404],
        TEAM_STAFF_ASSIGNMENT_NOT_FOUND: ['Assignment not found.', 404],
      }
      const [msg, status] = messages[code] ?? ['Unknown error.', 500]
      super(msg)
      this.name = 'TeamsError'
      this.code = code
      this.httpStatus = status
    }
  },
  listTeamTypes: vi.fn(),
  createTeamType: vi.fn(),
  getTeamTypeById: vi.fn(),
  updateTeamType: vi.fn(),
  deleteTeamType: vi.fn(),
  listTeams: vi.fn(),
  createTeam: vi.fn(),
  getTeamById: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  listTeamMembers: vi.fn(),
  assignStaffToTeam: vi.fn(),
  removeStaffFromTeam: vi.fn(),
}))

vi.mock('@zidney/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

// ---------------------------------------------------------------------------
// Mock helpers — bypass getDb/buildAuditCtx and replace teamsErrorResponse
// with a code-based lookup so the mock TeamsError class works correctly
// ---------------------------------------------------------------------------

const TEAMS_HTTP_STATUS: Record<string, number> = {
  TEAM_TYPE_NOT_FOUND: 404,
  TEAM_TYPE_NAME_DUPLICATE: 409,
  TEAM_TYPE_HAS_TEAMS: 409,
  TEAM_TYPE_DISABLED: 422,
  TEAM_NOT_FOUND: 404,
  TEAM_NAME_DUPLICATE: 409,
  TEAM_HAS_ASSIGNMENTS: 409,
  TEAM_DISABLED: 422,
  TEAM_MAX_MEMBERS_EXCEEDED: 422,
  TEAM_LOCK_CONTENTION: 409,
  STAFF_NOT_FOUND: 404,
  TEAM_STAFF_ASSIGNMENT_NOT_FOUND: 404,
}

vi.mock('../helpers', () => ({
  getDb: vi.fn(() => ({})),
  buildAuditCtx: vi.fn(() => ({
    user_id: 'user-001',
    correlation_id: 'corr-001',
    workspace_slug: 'test-ws',
    workspace_id: 'ws-001',
  })),
  successResponse: (data: unknown) => ({ success: true, data, error: null }),
  teamsErrorResponse: (c: { json: (data: unknown, status?: number) => unknown }, err: unknown) => {
    if (err !== null && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code
      const status = TEAMS_HTTP_STATUS[code] ?? 500
      return c.json({ success: false, data: null, error: { code, message: code } }, status)
    }
    if (
      err !== null &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name: string }).name === 'ZodError'
    ) {
      return c.json(
        {
          success: false,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request data' },
        },
        422
      )
    }
    return c.json(
      {
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      },
      500
    )
  },
}))

// ---------------------------------------------------------------------------
// Import handlers (after vi.mock hoisting)
// ---------------------------------------------------------------------------

import {
  assignStaffToTeam,
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
} from '@zidney/domain-core/teams'

import { assignStaffTeamHandler } from '../assign-staff-team'
import { createTeamHandler } from '../create-team'
import { createTeamTypeHandler } from '../create-team-type'
import { deleteTeamHandler } from '../delete-team'
import { deleteTeamTypeHandler } from '../delete-team-type'
import { getTeamHandler } from '../get-team'
import { getTeamMembersHandler } from '../get-team-members'
import { getTeamTypeHandler } from '../get-team-type'
import { listTeamTypesHandler } from '../list-team-types'
import { listTeamsHandler } from '../list-teams'
import { removeStaffTeamHandler } from '../remove-staff-team'
import { updateTeamHandler } from '../update-team'
import { updateTeamTypeHandler } from '../update-team-type'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-19T12:00:00Z')

// Valid UUIDs required by zod .uuid() validation
const TYPE_ID = '11111111-1111-1111-1111-111111111111'
const TEAM_ID = '22222222-2222-2222-2222-222222222222'
const STAFF_ID = '33333333-3333-3333-3333-333333333333'

const mockTeamType = {
  id: TYPE_ID,
  name: 'Engineering',
  description: null,
  status: 'ENABLED' as const,
  deleted_at: null,
  created_at: NOW,
  updated_at: NOW,
}

const mockTeam = {
  id: TEAM_ID,
  name: 'Backend',
  team_type_id: TYPE_ID,
  max_members: null,
  description: null,
  status: 'ENABLED' as const,
  deleted_at: null,
  created_at: NOW,
  updated_at: NOW,
}

const mockAssignment = {
  staff_id: STAFF_ID,
  team_id: TEAM_ID,
  created_at: NOW,
}

// ---------------------------------------------------------------------------
// Context factory
// ---------------------------------------------------------------------------

function makeCtx(
  overrides: {
    params?: Record<string, string>
    query?: Record<string, string>
    body?: Record<string, unknown>
  } = {}
): Context {
  const params = overrides.params ?? {}
  const query = overrides.query ?? {}
  return {
    req: {
      // Called with no args → return full object; with key → return that key
      param: vi.fn((key?: string) => (key === undefined ? params : (params[key] ?? ''))),
      json: vi.fn(async () => overrides.body ?? {}),
      // Called with no args → return full object; with key → return that key
      query: vi.fn((key?: string) => (key === undefined ? query : (query[key] ?? ''))),
    },
    get: vi.fn((key: string) => {
      const vals: Record<string, string> = {
        correlation_id: 'corr-001',
        workspace_id: 'ws-001',
        workspace_slug: 'test-ws',
        user_id: 'user-001',
        user_type: 'ADMIN',
      }
      return vals[key] ?? ''
    }),
    set: vi.fn(),
    json: vi.fn((data: unknown, status?: number) => ({ data, status })),
  } as unknown as Context
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTeamsError(code: string): TeamsError {
  // @ts-expect-error — TeamsError may not match the real type in vi.mock scope
  return new TeamsError(code)
}

// ---------------------------------------------------------------------------
// listTeamTypes
// ---------------------------------------------------------------------------

describe('GET /team-types — listTeamTypesHandler', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('returns 200 with items and pagination', async () => {
    vi.mocked(listTeamTypes).mockResolvedValueOnce({
      items: [mockTeamType],
      total: 1,
      nextCursor: null,
    })

    const c = makeCtx({ query: { limit: '20' } })
    const res = (await listTeamTypesHandler(c)) as any

    expect(res.status).toBe(200)
    expect(vi.mocked(c.json).mock.calls[0]?.[0]).toMatchObject({
      success: true,
      data: { items: [expect.objectContaining({ id: TYPE_ID })], total: 1 },
    })
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(listTeamTypes).mockRejectedValueOnce(new Error('db down'))

    const c = makeCtx({ query: { limit: '20' } })
    await listTeamTypesHandler(c)

    expect(vi.mocked(c.json).mock.calls[0]?.[0]).toMatchObject({ success: false })
  })
})

// ---------------------------------------------------------------------------
// createTeamType
// ---------------------------------------------------------------------------

describe('POST /team-types — createTeamTypeHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 on success', async () => {
    vi.mocked(createTeamType).mockResolvedValueOnce(mockTeamType)

    const c = makeCtx({ body: { name: 'Engineering' } })
    await createTeamTypeHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 201)
  })

  it('returns 409 on TEAM_TYPE_NAME_DUPLICATE', async () => {
    vi.mocked(createTeamType).mockRejectedValueOnce(makeTeamsError('TEAM_TYPE_NAME_DUPLICATE'))

    const c = makeCtx({ body: { name: 'Engineering' } })
    await createTeamTypeHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'TEAM_TYPE_NAME_DUPLICATE' }),
      }),
      409
    )
  })
})

// ---------------------------------------------------------------------------
// getTeamTypeById
// ---------------------------------------------------------------------------

describe('GET /team-types/:id — getTeamTypeByIdHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with the team type', async () => {
    vi.mocked(getTeamTypeById).mockResolvedValueOnce(mockTeamType)

    const c = makeCtx({ params: { id: TYPE_ID } })
    await getTeamTypeHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })

  it('returns 404 on TEAM_TYPE_NOT_FOUND', async () => {
    vi.mocked(getTeamTypeById).mockRejectedValueOnce(makeTeamsError('TEAM_TYPE_NOT_FOUND'))

    const c = makeCtx({ params: { id: TYPE_ID } })
    await getTeamTypeHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'TEAM_TYPE_NOT_FOUND' }),
      }),
      404
    )
  })
})

// ---------------------------------------------------------------------------
// updateTeamType
// ---------------------------------------------------------------------------

describe('PATCH /team-types/:id — updateTeamTypeHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on success', async () => {
    vi.mocked(updateTeamType).mockResolvedValueOnce(mockTeamType)

    const c = makeCtx({ params: { id: TYPE_ID }, body: { name: 'Renamed' } })
    await updateTeamTypeHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })

  it('returns 409 on TEAM_TYPE_NAME_DUPLICATE', async () => {
    vi.mocked(updateTeamType).mockRejectedValueOnce(makeTeamsError('TEAM_TYPE_NAME_DUPLICATE'))

    const c = makeCtx({ params: { id: TYPE_ID }, body: { name: 'Dup' } })
    await updateTeamTypeHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 409)
  })
})

// ---------------------------------------------------------------------------
// deleteTeamType
// ---------------------------------------------------------------------------

describe('DELETE /team-types/:id — deleteTeamTypeHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on success', async () => {
    vi.mocked(deleteTeamType).mockResolvedValueOnce(undefined)

    const c = makeCtx({ params: { id: TYPE_ID } })
    await deleteTeamTypeHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })

  it('returns 409 on TEAM_TYPE_HAS_TEAMS', async () => {
    vi.mocked(deleteTeamType).mockRejectedValueOnce(makeTeamsError('TEAM_TYPE_HAS_TEAMS'))

    const c = makeCtx({ params: { id: TYPE_ID } })
    await deleteTeamTypeHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'TEAM_TYPE_HAS_TEAMS' }),
      }),
      409
    )
  })
})

// ---------------------------------------------------------------------------
// listTeams
// ---------------------------------------------------------------------------

describe('GET /teams — listTeamsHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with team list', async () => {
    vi.mocked(listTeams).mockResolvedValueOnce({
      items: [mockTeam],
      total: 1,
      nextCursor: null,
    })

    const c = makeCtx({ query: { limit: '20' } })
    await listTeamsHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })
})

// ---------------------------------------------------------------------------
// createTeam
// ---------------------------------------------------------------------------

describe('POST /teams — createTeamHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 on success', async () => {
    vi.mocked(createTeam).mockResolvedValueOnce(mockTeam)

    const c = makeCtx({ body: { name: 'Backend' } })
    await createTeamHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 201)
  })

  it('returns 422 on TEAM_TYPE_DISABLED', async () => {
    vi.mocked(createTeam).mockRejectedValueOnce(makeTeamsError('TEAM_TYPE_DISABLED'))

    const c = makeCtx({ body: { name: 'Backend', team_type_id: TYPE_ID } })
    await createTeamHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'TEAM_TYPE_DISABLED' }),
      }),
      422
    )
  })

  it('returns 409 on TEAM_NAME_DUPLICATE', async () => {
    vi.mocked(createTeam).mockRejectedValueOnce(makeTeamsError('TEAM_NAME_DUPLICATE'))

    const c = makeCtx({ body: { name: 'Backend' } })
    await createTeamHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 409)
  })
})

// ---------------------------------------------------------------------------
// getTeamById
// ---------------------------------------------------------------------------

describe('GET /teams/:id — getTeamByIdHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with team', async () => {
    vi.mocked(getTeamById).mockResolvedValueOnce(mockTeam)

    const c = makeCtx({ params: { id: TEAM_ID } })
    await getTeamHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })

  it('returns 404 on TEAM_NOT_FOUND', async () => {
    vi.mocked(getTeamById).mockRejectedValueOnce(makeTeamsError('TEAM_NOT_FOUND'))

    const c = makeCtx({ params: { id: TEAM_ID } })
    await getTeamHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'TEAM_NOT_FOUND' }),
      }),
      404
    )
  })
})

// ---------------------------------------------------------------------------
// updateTeam
// ---------------------------------------------------------------------------

describe('PATCH /teams/:id — updateTeamHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on success', async () => {
    vi.mocked(updateTeam).mockResolvedValueOnce(mockTeam)

    const c = makeCtx({ params: { id: TEAM_ID }, body: { name: 'Renamed' } })
    await updateTeamHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })
})

// ---------------------------------------------------------------------------
// deleteTeam
// ---------------------------------------------------------------------------

describe('DELETE /teams/:id — deleteTeamHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on success', async () => {
    vi.mocked(deleteTeam).mockResolvedValueOnce(undefined)

    const c = makeCtx({ params: { id: TEAM_ID } })
    await deleteTeamHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })

  it('returns 409 on TEAM_HAS_ASSIGNMENTS', async () => {
    vi.mocked(deleteTeam).mockRejectedValueOnce(makeTeamsError('TEAM_HAS_ASSIGNMENTS'))

    const c = makeCtx({ params: { id: TEAM_ID } })
    await deleteTeamHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'TEAM_HAS_ASSIGNMENTS' }),
      }),
      409
    )
  })
})

// ---------------------------------------------------------------------------
// listTeamMembers
// ---------------------------------------------------------------------------

describe('GET /teams/:id/members — listTeamMembersHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with members', async () => {
    vi.mocked(listTeamMembers).mockResolvedValueOnce({
      items: [mockAssignment],
      total: 1,
      nextCursor: null,
    })

    const c = makeCtx({ params: { id: TEAM_ID }, query: { limit: '20' } })
    await getTeamMembersHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })

  it('returns 404 on TEAM_NOT_FOUND', async () => {
    vi.mocked(listTeamMembers).mockRejectedValueOnce(makeTeamsError('TEAM_NOT_FOUND'))

    const c = makeCtx({ params: { id: TEAM_ID }, query: { limit: '20' } })
    await getTeamMembersHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })
})

// ---------------------------------------------------------------------------
// assignStaffToTeam
// ---------------------------------------------------------------------------

describe('POST /teams/:id/members — assignStaffToTeamHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 on success', async () => {
    vi.mocked(assignStaffToTeam).mockResolvedValueOnce(mockAssignment)

    // assignStaffTeam reads staffId from params, not body
    const c = makeCtx({ params: { id: TEAM_ID, staffId: STAFF_ID } })
    await assignStaffTeamHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 201)
  })

  it('returns 409 on TEAM_LOCK_CONTENTION', async () => {
    vi.mocked(assignStaffToTeam).mockRejectedValueOnce(makeTeamsError('TEAM_LOCK_CONTENTION'))

    const c = makeCtx({ params: { id: TEAM_ID, staffId: STAFF_ID } })
    await assignStaffTeamHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'TEAM_LOCK_CONTENTION' }),
      }),
      409
    )
  })

  it('returns 422 on TEAM_MAX_MEMBERS_EXCEEDED', async () => {
    vi.mocked(assignStaffToTeam).mockRejectedValueOnce(makeTeamsError('TEAM_MAX_MEMBERS_EXCEEDED'))

    const c = makeCtx({ params: { id: TEAM_ID, staffId: STAFF_ID } })
    await assignStaffTeamHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })

  it('returns 422 on TEAM_DISABLED', async () => {
    vi.mocked(assignStaffToTeam).mockRejectedValueOnce(makeTeamsError('TEAM_DISABLED'))

    const c = makeCtx({ params: { id: TEAM_ID, staffId: STAFF_ID } })
    await assignStaffTeamHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 422)
  })

  it('returns 404 on STAFF_NOT_FOUND', async () => {
    vi.mocked(assignStaffToTeam).mockRejectedValueOnce(makeTeamsError('STAFF_NOT_FOUND'))

    const c = makeCtx({ params: { id: TEAM_ID, staffId: STAFF_ID } })
    await assignStaffTeamHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })
})

// ---------------------------------------------------------------------------
// removeStaffFromTeam
// ---------------------------------------------------------------------------

describe('DELETE /teams/:id/members/:staffId — removeStaffFromTeamHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on success', async () => {
    vi.mocked(removeStaffFromTeam).mockResolvedValueOnce(undefined)

    const c = makeCtx({ params: { id: TEAM_ID, staffId: STAFF_ID } })
    await removeStaffTeamHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: true }), 200)
  })

  it('returns 404 on TEAM_STAFF_ASSIGNMENT_NOT_FOUND', async () => {
    vi.mocked(removeStaffFromTeam).mockRejectedValueOnce(
      makeTeamsError('TEAM_STAFF_ASSIGNMENT_NOT_FOUND')
    )

    const c = makeCtx({ params: { id: TEAM_ID, staffId: STAFF_ID } })
    await removeStaffTeamHandler(c)

    expect(vi.mocked(c.json)).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 404)
  })
})
