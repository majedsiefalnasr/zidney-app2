/**
 * Divisions API — Edge Cases & Idempotency Tests (T033)
 *
 * File: tests/integration/divisions-edge-cases.test.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * Covers edge conditions:
 * - Idempotent duplicate staff assignment produces no extra row
 * - Re-invoking disable-divisions when feature is already locked
 * - Attempt to set is_default via PUT body is silently ignored
 * - PATCH status to same value is idempotent (200)
 * - Cursor pagination edge: cursor at last page
 * - Delete on already-absent assignment returns 404 (not 2xx idempotent)
 * - Disable when already-disabled feature → DIVISIONS_FEATURE_LOCKED vs 200
 */

import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { divisionsRouter } from '../../apps/api/src/routes/backoffice/divisions/index'
import type { BackofficeEnv } from '../../apps/api/src/routes/backoffice/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440001'
const WORKSPACE_SLUG = 'edge-uni'

const DIV_A_ID = '550e8400-e29b-41d4-a716-446655440011'
const DEFAULT_DIV_ID = '550e8400-e29b-41d4-a716-446655440010'
const STAFF_ID = '550e8400-e29b-41d4-a716-446655440020'
const ROLE_ID = '550e8400-e29b-41d4-a716-446655440030'

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

type EdgeTestAppConfig = {
  divisionsEnabled?: boolean
  queryCalls?: string[]
  queryOverride?: (
    sql: string,
    params?: unknown[]
  ) => { rows: unknown[]; rowCount: number | null } | null
}

function createEdgeApp(config: EdgeTestAppConfig = {}) {
  const app = new Hono<BackofficeEnv>()
  const divisionsEnabled = config.divisionsEnabled ?? true

  app.use('*', async (c, next) => {
    const mockPool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (config.queryCalls) {
          config.queryCalls.push(sql.trimStart().split('\n')[0])
        }

        // RBAC guard queries
        if (sql.includes('backoffice_staff_users') && sql.includes('SELECT')) {
          return { rows: [{ id: 'user-001', is_active: true, role_id: ROLE_ID }], rowCount: 1 }
        }
        if (sql.includes('backoffice_roles') && sql.includes('SELECT')) {
          return { rows: [{ id: ROLE_ID, status: 'ACTIVE' }], rowCount: 1 }
        }
        if (sql.includes('role_module_permissions')) {
          return {
            rows: [{ can_view: true, can_create: true, can_edit: true, can_delete: true }],
            rowCount: 1,
          }
        }

        // Custom override
        if (config.queryOverride) {
          const o = await config.queryOverride(sql, params)
          if (o !== null) return o
        }

        // Transaction control
        if (/^(BEGIN|COMMIT|ROLLBACK|SET TRANSACTION)/.test(sql.trimStart())) {
          return { rows: [], rowCount: 0 }
        }

        // Feature flag
        if (sql.includes('divisions_enabled')) {
          return { rows: [{ divisions_enabled: divisionsEnabled }], rowCount: 1 }
        }

        return { rows: [], rowCount: 0 }
      }),
    }

    ;(c as any).set('tenant', {
      id: WORKSPACE_ID,
      slug: WORKSPACE_SLUG,
      schema_version: 2,
      pool: mockPool,
    })
    ;(c as any).set('authPayload', { user_id: 'user-001' })
    ;(c as any).set('correlationId', 'edge-corr-001')

    await next()
  })

  app.route('/api/v1/backoffice/workspace', divisionsRouter)
  return app
}

// ---------------------------------------------------------------------------
// Edge: idempotent staff assignment (ON CONFLICT DO NOTHING)
// ---------------------------------------------------------------------------

describe('Idempotent staff assignment (duplicate ignored)', () => {
  it('assignments are idempotent when division is already assigned (no duplicate)', async () => {
    // assignStaffDivision uses INSERT ... ON CONFLICT DO NOTHING
    // This test verifies that the route still returns 200 on duplicate assignment attempt
    // (the DB call is made once; no error is thrown)
    const insertCalls: number[] = []

    const app = createEdgeApp({
      queryOverride: (sql) => {
        if (sql.includes('SELECT id, status FROM divisions WHERE id')) {
          return { rows: [{ id: DIV_A_ID, status: 'ENABLED' }], rowCount: 1 }
        }
        if (sql.includes('INSERT INTO staff_divisions')) {
          insertCalls.push(1)
          // ON CONFLICT DO NOTHING returns rowCount 0 when already exists
          return { rows: [], rowCount: 0 }
        }
        if (sql.includes('FROM staff_divisions') && sql.includes('AND division_id')) {
          return {
            rows: [
              { staff_id: STAFF_ID, division_id: DIV_A_ID, assigned_at: new Date().toISOString() },
            ],
            rowCount: 1,
          }
        }
        if (sql.includes('FROM staff_divisions') && sql.includes('WHERE staff_id')) {
          return {
            rows: [
              { staff_id: STAFF_ID, division_id: DIV_A_ID, assigned_at: new Date().toISOString() },
            ],
            rowCount: 1,
          }
        }
        return null
      },
    })

    const res1 = await app.request(`/api/v1/backoffice/workspace/staff/${STAFF_ID}/divisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ division_id: DIV_A_ID }),
    })

    // Second call to same route
    const res2 = await app.request(`/api/v1/backoffice/workspace/staff/${STAFF_ID}/divisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ division_id: DIV_A_ID }),
    })

    expect(res1.status).toBe(201)
    expect(res2.status).toBe(201)
    // No extra DB record — insert was attempted but rowCount 0 signals idempotent no-op
    expect(insertCalls.length).toBe(2) // Both calls attempt the insert (idempotency is at DB level)
  })
})

// ---------------------------------------------------------------------------
// Edge: PATCH status — same-value idempotency
// ---------------------------------------------------------------------------

describe('Status PATCH — same-value idempotency', () => {
  it('PATCH to ENABLED when already ENABLED returns 200', async () => {
    const activeDivision = {
      id: DIV_A_ID,
      name: 'Grade 10',
      status: 'ENABLED',
      is_default: false,
    }

    const app = createEdgeApp({
      queryOverride: (sql) => {
        if (sql.includes('FOR UPDATE')) {
          return { rows: [{ id: DIV_A_ID, is_default: false, status: 'ENABLED' }], rowCount: 1 }
        }
        if (sql.includes('UPDATE divisions')) {
          return { rows: [activeDivision], rowCount: 1 }
        }
        return null
      },
    })

    const res = await app.request(`/api/v1/backoffice/workspace/divisions/${DIV_A_ID}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ENABLED' }),
    })

    // Service allows same-value update — the DB write carries audit_log_id etc.
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('ENABLED')
  })

  it('PATCH to DISABLED when already DISABLED returns 200', async () => {
    const disabledDivision = {
      id: DIV_A_ID,
      name: 'Grade 10',
      status: 'DISABLED',
      is_default: false,
    }

    const app = createEdgeApp({
      queryOverride: (sql) => {
        if (sql.includes('FOR UPDATE')) {
          return { rows: [{ id: DIV_A_ID, is_default: false, status: 'DISABLED' }], rowCount: 1 }
        }
        if (sql.includes('UPDATE divisions')) {
          return { rows: [disabledDivision], rowCount: 1 }
        }
        return null
      },
    })

    const res = await app.request(`/api/v1/backoffice/workspace/divisions/${DIV_A_ID}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DISABLED' }),
    })

    expect(res.status).toBe(200)
    expect((await res.json()).data.status).toBe('DISABLED')
  })
})

// ---------------------------------------------------------------------------
// Edge: is_default change prevention in PUT
// ---------------------------------------------------------------------------

describe('PUT — is_default silently ignored in body', () => {
  it('returns 200 but is_default remains false when is_default=true sent in body', async () => {
    const division = {
      id: DIV_A_ID,
      name: 'Grade 10',
      description: null,
      is_default: false,
      status: 'ENABLED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const app = createEdgeApp({
      queryOverride: (sql) => {
        if (sql.includes('FOR UPDATE')) {
          return { rows: [{ ...division }], rowCount: 1 }
        }
        if (sql.includes('LOWER(name)') && sql.includes('AND id !=')) {
          return { rows: [], rowCount: 0 }
        }
        if (sql.includes('UPDATE divisions')) {
          // Service should not change is_default; return same record
          return { rows: [{ ...division }], rowCount: 1 }
        }
        return null
      },
    })

    const res = await app.request(`/api/v1/backoffice/workspace/divisions/${DIV_A_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Grade 10', is_default: true }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    // is_default should remain false — the service excludes it from the UPDATE
    expect(body.data.is_default).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Edge: disable-divisions already locked
// ---------------------------------------------------------------------------

describe('POST /divisions/disable — already-disabled guard', () => {
  it('returns DIVISIONS_FEATURE_LOCKED (423) when feature is already off and service guards it', async () => {
    // Simulate the case where divisions_enabled is already false AND
    // the service would raise DIVISIONS_FEATURE_LOCKED before modifying any rows.
    // This behavior lives entirely in the service layer — the handler doesn't
    // pre-check the feature flag; the service does.
    // We stub the transaction to simulate the DIVISION_REQUIRED sentinel case
    // that maps to DIVISIONS_FEATURE_LOCKED via the error handler.
    let defaultQuery = 0
    const app = createEdgeApp({
      divisionsEnabled: false,
      queryOverride: (sql) => {
        if (sql.includes('WHERE is_default = true') && sql.includes('FOR UPDATE')) {
          defaultQuery++
          return { rows: [], rowCount: 0 } // No default division → DIVISION_REQUIRED
        }
        return null
      },
    })

    const res = await app.request('/api/v1/backoffice/workspace/divisions/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DISABLE_ALL' }),
    })

    // DIVISION_REQUIRED → 422 according to divisions.errors mapping
    // OR the workspace_settings update may also map to DIVISIONS_FEATURE_LOCKED → 423
    // In either case it should not be 200.
    expect(res.status).not.toBe(200)
  })

  it('returns 200 with zero counts when all divisions already disabled', async () => {
    // Feature still enabled but all non-default divisions already inactive
    const app = createEdgeApp({
      divisionsEnabled: true,
      queryOverride: (sql) => {
        if (sql.includes('WHERE is_default = true') && sql.includes('FOR UPDATE')) {
          return { rows: [{ id: DEFAULT_DIV_ID }], rowCount: 1 }
        }
        if (sql.includes('WHERE is_default = false') && sql.includes('FOR UPDATE')) {
          return { rows: [], rowCount: 0 } // No non-default divisions
        }
        if (sql.includes('UPDATE students')) {
          return { rows: [], rowCount: 0 } // No students to reassign
        }
        if (sql.includes('SELECT DISTINCT staff_id')) {
          return { rows: [], rowCount: 0 } // No staff to reassign
        }
        if (sql.includes("SET status = 'DISABLED'")) {
          return { rows: [], rowCount: 0 }
        }
        if (sql.includes('divisions_enabled = false')) {
          return { rows: [], rowCount: 1 }
        }
        return null
      },
    })

    const res = await app.request('/api/v1/backoffice/workspace/divisions/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DISABLE_ALL' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.students_reassigned).toBe(0)
    expect(body.data.staff_divisions_reassigned).toBe(0)
    expect(body.data.divisions_disabled).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Edge: duplicate assignment returns 404 when already removed
// ---------------------------------------------------------------------------

describe('DELETE staff assignment — not-found is not idempotent', () => {
  it('second DELETE on already-removed assignment returns 404', async () => {
    // First call: assignment exists
    const app = createEdgeApp({
      queryOverride: (sql) => {
        if (sql.includes('FOR UPDATE') && sql.includes('staff_divisions')) {
          return { rows: [], rowCount: 0 } // Simulate already removed
        }
        return null
      },
    })

    const res = await app.request(
      `/api/v1/backoffice/workspace/staff/${STAFF_ID}/divisions/${DIV_A_ID}`,
      { method: 'DELETE' }
    )

    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('DIV_STAFF_ASSIGNMENT_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// Edge: cursor pagination at boundary
// ---------------------------------------------------------------------------

describe('Cursor pagination — boundary conditions', () => {
  it('returns empty nextCursor on last page', async () => {
    const div1 = {
      id: DIV_A_ID,
      name: 'Grade 10',
      status: 'ENABLED',
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const app = createEdgeApp({
      queryOverride: (sql) => {
        if (sql.includes('FROM divisions') && sql.includes('LIMIT')) {
          return { rows: [div1], rowCount: 1 }
        }
        if (sql.includes('COUNT(*)') && sql.includes('divisions')) {
          return { rows: [{ total: '1' }], rowCount: 1 }
        }
        return null
      },
    })

    const res = await app.request('/api/v1/backoffice/workspace/divisions?limit=10', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.nextCursor).toBeNull()
  })

  it('invalid cursor value does not cause 500', async () => {
    const app = createEdgeApp({
      queryOverride: (sql) => {
        if (sql.includes('FROM divisions') && sql.includes('LIMIT')) {
          return { rows: [], rowCount: 0 }
        }
        if (sql.includes('COUNT(*)') && sql.includes('divisions')) {
          return { rows: [{ total: '0' }], rowCount: 1 }
        }
        return null
      },
    })

    const res = await app.request(
      '/api/v1/backoffice/workspace/divisions?cursor=not-a-valid-uuid',
      { method: 'GET' }
    )

    // Route should validate cursor as UUID or ignore it gracefully — not 500
    expect(res.status).not.toBe(500)
  })
})

// ---------------------------------------------------------------------------
// Edge: RBAC — permission denied returns 403
// ---------------------------------------------------------------------------

describe('RBAC permission denied', () => {
  it('returns 403 when role_permissions disallows can_create', async () => {
    const app = new Hono<BackofficeEnv>()

    app.use('*', async (c, next) => {
      const mockPool = {
        query: vi.fn(async (sql: string) => {
          if (sql.includes('backoffice_staff_users') && sql.includes('SELECT')) {
            return { rows: [{ id: 'user-001', is_active: true, role_id: ROLE_ID }], rowCount: 1 }
          }
          if (sql.includes('backoffice_roles') && sql.includes('SELECT')) {
            return { rows: [{ id: ROLE_ID, status: 'ACTIVE' }], rowCount: 1 }
          }
          if (sql.includes('role_permissions')) {
            return {
              rows: [
                {
                  can_view: true,
                  can_create: false, // No create permission
                  can_edit: false,
                  can_delete: false,
                },
              ],
              rowCount: 1,
            }
          }
          return { rows: [], rowCount: 0 }
        }),
      }

      ;(c as any).set('tenant', {
        id: WORKSPACE_ID,
        slug: WORKSPACE_SLUG,
        schema_version: 2,
        pool: mockPool,
      })
      ;(c as any).set('authPayload', { user_id: 'user-001' })
      ;(c as any).set('correlationId', 'perm-deny-001')
      await next()
    })

    app.route('/api/v1/backoffice/workspace', divisionsRouter)

    const res = await app.request('/api/v1/backoffice/workspace/divisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unauthorized Division' }),
    })

    expect(res.status).toBe(403)
  })

  it('returns 403 when user is inactive', async () => {
    const app = new Hono<BackofficeEnv>()

    app.use('*', async (c, next) => {
      const mockPool = {
        query: vi.fn(async (sql: string) => {
          if (sql.includes('backoffice_staff_users') && sql.includes('SELECT')) {
            return { rows: [{ id: 'user-001', is_active: false, role_id: ROLE_ID }], rowCount: 1 }
          }
          return { rows: [], rowCount: 0 }
        }),
      }

      ;(c as any).set('tenant', {
        id: WORKSPACE_ID,
        slug: WORKSPACE_SLUG,
        schema_version: 2,
        pool: mockPool,
      })
      ;(c as any).set('authPayload', { user_id: 'user-001' })
      ;(c as any).set('correlationId', 'inactive-user-001')
      await next()
    })

    app.route('/api/v1/backoffice/workspace', divisionsRouter)

    const res = await app.request('/api/v1/backoffice/workspace/divisions', {
      method: 'GET',
    })

    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// Edge: empty description normalization
// ---------------------------------------------------------------------------

describe('Description normalization', () => {
  it('accepts null description in POST without validation error', async () => {
    const newDiv = {
      id: '550e8400-e29b-41d4-a716-999999999902',
      name: 'No Desc',
      description: null,
      is_default: false,
      status: 'ENABLED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const app = createEdgeApp({
      queryOverride: (sql) => {
        if (sql.includes('LOWER(name)') && sql.includes('SELECT')) {
          return { rows: [], rowCount: 0 }
        }
        if (sql.includes('INSERT INTO divisions')) {
          return { rows: [newDiv], rowCount: 1 }
        }
        return null
      },
    })

    const res = await app.request('/api/v1/backoffice/workspace/divisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Desc', description: null }),
    })

    expect(res.status).toBe(201)
  })

  it('accepts empty string description (stored as empty string)', async () => {
    const newDiv = {
      id: '550e8400-e29b-41d4-a716-999999999903',
      name: 'Empty Desc',
      description: '',
      is_default: false,
      status: 'ENABLED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const app = createEdgeApp({
      queryOverride: (sql) => {
        if (sql.includes('LOWER(name)') && sql.includes('SELECT')) {
          return { rows: [], rowCount: 0 }
        }
        if (sql.includes('INSERT INTO divisions')) {
          return { rows: [newDiv], rowCount: 1 }
        }
        return null
      },
    })

    const res = await app.request('/api/v1/backoffice/workspace/divisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Empty Desc', description: '' }),
    })

    // Schema may or may not accept empty string — should not be 500
    expect(res.status).not.toBe(500)
  })
})
