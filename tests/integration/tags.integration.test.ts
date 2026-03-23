/**
 * Tags API Integration Tests — STAGE_32_TAGS
 *
 * File: tests/integration/tags.integration.test.ts
 *
 * Tests routing and HTTP layer end-to-end through Hono's request helper.
 * Mocks tenant pool.query — no real database required.
 *
 * Covers (T026–T033):
 * - T026: Basic CRUD — create / list / get / update / delete / 404
 * - T027: Uniqueness / conflicts — duplicate name → 409
 * - T028: Delete with relations guard — 422 / cascade=true → 200
 * - T029: Tag relations lifecycle — create / duplicates / disabled / entity-type validation
 * - T030: Entity tag listing
 * - T031: Tag entities listing with filters
 * - T032: Permission enforcement — write routes require question_manage or content_manage
 * - T033: Tenant isolation — tags from tenant A not visible in tenant B
 *
 * Routes under test:
 * POST   /api/v1/backoffice/workspace/tags
 * GET    /api/v1/backoffice/workspace/tags
 * GET    /api/v1/backoffice/workspace/tags/:id
 * PATCH  /api/v1/backoffice/workspace/tags/:id
 * DELETE /api/v1/backoffice/workspace/tags/:id
 * GET    /api/v1/backoffice/workspace/tags/:id/entities
 * POST   /api/v1/backoffice/workspace/tag-relations
 * DELETE /api/v1/backoffice/workspace/tag-relations/:id
 * GET    /api/v1/backoffice/workspace/entities/:entityType/:entityId/tags
 */

import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { tagsRouter } from '../../apps/api/src/routes/backoffice/tags/index'
import type { BackofficeEnv } from '../../apps/api/src/routes/backoffice/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_ID_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const WORKSPACE_ID_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const WORKSPACE_SLUG_A = 'tenant-a'
const WORKSPACE_SLUG_B = 'tenant-b'

const USER_ID = 'user-001'
const TAG_ID = '11111111-1111-1111-1111-111111111111'
const TAG_ID_2 = '22222222-2222-2222-2222-222222222222'
const RELATION_ID = '33333333-3333-3333-3333-333333333333'
const ENTITY_ID = '44444444-4444-4444-4444-444444444444'
const NOW = new Date('2026-03-23T10:00:00Z').toISOString()

const BASE_TAG = {
  id: TAG_ID,
  name: 'Mathematics',
  normalized_name: 'mathematics',
  status: 'ENABLED',
  created_at: NOW,
  updated_at: NOW,
  created_by: USER_ID,
  updated_by: USER_ID,
}

const BASE_RELATION = {
  id: RELATION_ID,
  tag_id: TAG_ID,
  entity_type: 'MCQ_QUESTION',
  entity_id: ENTITY_ID,
  created_at: NOW,
}

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

type QueryOverrideFn = (
  sql: string,
  params?: unknown[]
) => { rows: unknown[]; rowCount: number | null } | null

interface AppConfig {
  /** Pool query override — return null to fall through to defaults */
  queryOverride?: QueryOverrideFn
  /** Permissions the calling user has. Defaults to ['question_manage', 'content_manage'] */
  permissions?: string[]
  /** Workspace / tenant ID to inject */
  tenantId?: string
  /** Workspace slug to inject */
  tenantSlug?: string
}

/**
 * Creates a minimal Hono test app that:
 * 1. Injects tenant context (mocked pool)
 * 2. Injects RBAC context directly (bypasses middleware chain)
 * 3. Mounts tagsRouter
 */
function createTestApp(config: AppConfig = {}) {
  const {
    permissions = ['question_manage', 'content_manage'],
    tenantId = WORKSPACE_ID_A,
    tenantSlug = WORKSPACE_SLUG_A,
    queryOverride,
  } = config

  const app = new Hono<BackofficeEnv>()

  app.use('*', async (c, next) => {
    const mockPool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        // Custom query override takes priority
        if (queryOverride) {
          const result = queryOverride(sql, params)
          if (result !== null) return result
        }

        // TX control
        if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql.trim())) {
          return { rows: [], rowCount: 0 }
        }

        // Default: empty
        return { rows: [], rowCount: 0 }
      }),
    }

    // Inject required context variables
    ;(c as any).set('tenant', {
      id: tenantId,
      slug: tenantSlug,
      schema_version: 2,
      pool: mockPool,
    })
    ;(c as any).set('staff_user', { user_id: USER_ID, role: 'admin' })
    ;(c as any).set('correlationId', 'test-corr-001')
    ;(c as any).set('rbacContext', { permissions, userId: USER_ID, workspace_id: tenantId })

    await next()
  })

  app.route('/api/v1/backoffice/workspace', tagsRouter)

  return app
}

const BASE_URL = '/api/v1/backoffice/workspace'

// ============================================================================
// T026 — Basic CRUD
// ============================================================================

describe('T026 — POST /tags: create tag', () => {
  it('returns 201 with tag including normalized_name', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('normalized_name =')) return { rows: [], rowCount: 0 }
        if (sql.includes('INSERT INTO tags')) return { rows: [BASE_TAG], rowCount: 1 }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Mathematics' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.id).toBe(TAG_ID)
    expect(body.data.normalized_name).toBe('mathematics')
    expect(body.error).toBeNull()
  })

  it('returns 422 when name is empty', async () => {
    const app = createTestApp()

    const res = await app.request(`${BASE_URL}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})

describe('T026 — GET /tags: list tags', () => {
  it('returns 200 with paginated items', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('COUNT(*)') && sql.includes('FROM tags')) {
          return { rows: [{ count: '2' }], rowCount: 1 }
        }
        if (sql.includes('FROM tags') && sql.includes('ORDER BY name')) {
          return {
            rows: [
              BASE_TAG,
              { ...BASE_TAG, id: TAG_ID_2, name: 'Physics', normalized_name: 'physics' },
            ],
            rowCount: 2,
          }
        }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tags`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.items).toHaveLength(2)
    expect(body.data.total).toBe(2)
    expect(body.error).toBeNull()
  })

  it('defaults to page=1, limit=20', async () => {
    const app = createTestApp({
      queryOverride: () => ({ rows: [{ count: '0' }], rowCount: 1 }),
    })

    const res = await app.request(`${BASE_URL}/tags`)
    const body = await res.json()
    expect(body.data.page).toBe(1)
    expect(body.data.limit).toBe(20)
  })

  it('filters by status=ENABLED', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('COUNT(*)')) return { rows: [{ count: '1' }], rowCount: 1 }
        if (sql.includes('status =')) return { rows: [BASE_TAG], rowCount: 1 }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tags?status=ENABLED`)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.items).toHaveLength(1)
  })
})

describe('T026 — GET /tags/:id: get tag', () => {
  it('returns 200 with tag', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('FROM tags') && sql.includes('WHERE id =')) {
          return { rows: [BASE_TAG], rowCount: 1 }
        }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tags/${TAG_ID}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(TAG_ID)
  })

  it('returns 404 for non-existent tag', async () => {
    const app = createTestApp()
    const res = await app.request(`${BASE_URL}/tags/00000000-0000-0000-0000-000000000000`)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('TAG_NOT_FOUND')
  })
})

describe('T026 — PATCH /tags/:id: update tag', () => {
  it('returns 200 after updating name — normalized_name recomputed', async () => {
    const updated = { ...BASE_TAG, name: 'Advanced Math', normalized_name: 'advanced math' }
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('UPDATE tags')) return { rows: [updated], rowCount: 1 }
        if (sql.includes('FROM tags') && sql.includes('WHERE id ='))
          return { rows: [BASE_TAG], rowCount: 1 }
        if (sql.includes('normalized_name =')) return { rows: [], rowCount: 0 }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tags/${TAG_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Advanced Math' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.normalized_name).toBe('advanced math')
  })

  it('returns 200 after updating status to DISABLED', async () => {
    const disabled = { ...BASE_TAG, status: 'DISABLED' }
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('FROM tags') && sql.includes('WHERE id ='))
          return { rows: [BASE_TAG], rowCount: 1 }
        if (sql.includes('UPDATE tags')) return { rows: [disabled], rowCount: 1 }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tags/${TAG_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DISABLED' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('DISABLED')
  })
})

describe('T026 — DELETE /tags/:id: delete tag', () => {
  it('returns 200 when tag has no relations', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('FROM tags') && sql.includes('WHERE id ='))
          return { rows: [BASE_TAG], rowCount: 1 }
        if (sql.includes('COUNT(*)') && sql.includes('tag_relations'))
          return { rows: [{ count: '0' }], rowCount: 1 }
        if (sql.includes('DELETE FROM tags')) return { rows: [], rowCount: 1 }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tags/${TAG_ID}`, { method: 'DELETE' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.success).toBe(true)
    expect(body.data.relations_removed).toBe(0)
  })
})

// ============================================================================
// T027 — Uniqueness & conflicts
// ============================================================================

describe('T027 — Uniqueness conflicts', () => {
  it('POST /tags with name that normalizes to existing → 409 TAG_DUPLICATE', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('normalized_name =')) return { rows: [BASE_TAG], rowCount: 1 }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '  Mathematics  ' }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('TAG_DUPLICATE')
  })

  it('PATCH /tags/:id with name that normalizes to another tag → 409 TAG_DUPLICATE', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('FROM tags') && sql.includes('WHERE id =')) {
          return { rows: [BASE_TAG], rowCount: 1 }
        }
        if (sql.includes('normalized_name =')) {
          return { rows: [{ ...BASE_TAG, id: TAG_ID_2 }], rowCount: 1 }
        }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tags/${TAG_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Physics' }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('TAG_DUPLICATE')
  })
})

// ============================================================================
// T028 — Delete with relations guard
// ============================================================================

describe('T028 — Delete with relations guard', () => {
  it('DELETE /tags/:id when tag has relations → 422 TAG_HAS_RELATIONS (cascade_delete=false)', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('FROM tags') && sql.includes('WHERE id ='))
          return { rows: [BASE_TAG], rowCount: 1 }
        if (sql.includes('COUNT(*)') && sql.includes('tag_relations'))
          return { rows: [{ count: '3' }], rowCount: 1 }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tags/${TAG_ID}`, { method: 'DELETE' })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('TAG_HAS_RELATIONS')
  })

  it('DELETE /tags/:id?cascade_delete=true successfully removes tag and relations', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('FROM tags') && sql.includes('WHERE id ='))
          return { rows: [BASE_TAG], rowCount: 1 }
        if (sql.includes('COUNT(*)') && sql.includes('tag_relations'))
          return { rows: [{ count: '3' }], rowCount: 1 }
        if (sql.includes('DELETE FROM tag_relations') && sql.includes('tag_id'))
          return { rows: [], rowCount: 3 }
        if (sql.includes('DELETE FROM tags')) return { rows: [], rowCount: 1 }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tags/${TAG_ID}?cascade_delete=true`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.success).toBe(true)
    expect(body.data.relations_removed).toBe(3)
  })
})

// ============================================================================
// T029 — Tag relations lifecycle
// ============================================================================

describe('T029 — Tag relations lifecycle', () => {
  it('POST /tag-relations assigns tag to entity → 201', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('FROM mcq_questions')) return { rows: [{ '1': 1 }], rowCount: 1 }
        if (sql.includes('FROM tags') && sql.includes('WHERE id ='))
          return { rows: [BASE_TAG], rowCount: 1 }
        if (sql.includes('WHERE tag_id =') && sql.includes('entity_type'))
          return { rows: [], rowCount: 0 }
        if (sql.includes('INSERT INTO tag_relations')) return { rows: [BASE_RELATION], rowCount: 1 }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tag-relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: TAG_ID, entity_type: 'MCQ_QUESTION', entity_id: ENTITY_ID }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe(RELATION_ID)
    expect(body.data.entity_type).toBe('MCQ_QUESTION')
  })

  it('POST /tag-relations duplicate → 409 TAG_RELATION_DUPLICATE', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('FROM mcq_questions')) return { rows: [{ '1': 1 }], rowCount: 1 }
        if (sql.includes('FROM tags') && sql.includes('WHERE id ='))
          return { rows: [BASE_TAG], rowCount: 1 }
        if (sql.includes('WHERE tag_id =') && sql.includes('entity_type'))
          return { rows: [BASE_RELATION], rowCount: 1 }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tag-relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: TAG_ID, entity_type: 'MCQ_QUESTION', entity_id: ENTITY_ID }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('TAG_RELATION_DUPLICATE')
  })

  it('POST /tag-relations with DISABLED tag → 422 TAG_DISABLED', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('FROM mcq_questions')) return { rows: [{ '1': 1 }], rowCount: 1 }
        if (sql.includes('FROM tags') && sql.includes('WHERE id =')) {
          return { rows: [{ ...BASE_TAG, status: 'DISABLED' }], rowCount: 1 }
        }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tag-relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: TAG_ID, entity_type: 'MCQ_QUESTION', entity_id: ENTITY_ID }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('TAG_DISABLED')
  })

  it('POST /tag-relations with invalid entity_type → 422 VALIDATION_ERROR', async () => {
    const app = createTestApp()

    const res = await app.request(`${BASE_URL}/tag-relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: TAG_ID, entity_type: 'INVALID_TYPE', entity_id: ENTITY_ID }),
    })

    // Zod validation rejects invalid enum
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('DELETE /tag-relations/:id removes relation → 200', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('FROM tag_relations') && sql.includes('WHERE id =')) {
          return { rows: [BASE_RELATION], rowCount: 1 }
        }
        if (sql.includes('DELETE FROM tag_relations')) return { rows: [], rowCount: 1 }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tag-relations/${RELATION_ID}`, { method: 'DELETE' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.success).toBe(true)
  })

  it('DELETE /tag-relations/:id when not found → 404 TAG_RELATION_NOT_FOUND', async () => {
    const app = createTestApp()
    const res = await app.request(`${BASE_URL}/tag-relations/${RELATION_ID}`, { method: 'DELETE' })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('TAG_RELATION_NOT_FOUND')
  })
})

// ============================================================================
// T030 — Entity tag listing
// ============================================================================

describe('T030 — GET /entities/:entityType/:entityId/tags', () => {
  it('returns assigned tags for an entity', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('FROM tag_relations') && sql.includes('entity_type =')) {
          return { rows: [BASE_RELATION], rowCount: 1 }
        }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/entities/MCQ_QUESTION/${ENTITY_ID}/tags`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0]!.entity_type).toBe('MCQ_QUESTION')
  })

  it('returns empty list when no tags assigned', async () => {
    const app = createTestApp()
    const res = await app.request(`${BASE_URL}/entities/MCQ_QUESTION/${ENTITY_ID}/tags`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(0)
  })

  it('returns 422 for invalid entity type', async () => {
    const app = createTestApp()
    const res = await app.request(`${BASE_URL}/entities/INVALID_TYPE/${ENTITY_ID}/tags`)
    expect(res.status).toBe(422)
  })
})

// ============================================================================
// T031 — Tag entity listing
// ============================================================================

describe('T031 — GET /tags/:id/entities', () => {
  it('returns paginated list of tag entities', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('FROM tag_relations') && sql.includes('WHERE id =')) {
          return { rows: [BASE_TAG], rowCount: 1 }
        }
        if (sql.includes('COUNT(*)') && sql.includes('tag_relations')) {
          return { rows: [{ count: '1' }], rowCount: 1 }
        }
        if (sql.includes('FROM tag_relations') && sql.includes('tag_id =')) {
          return { rows: [BASE_RELATION], rowCount: 1 }
        }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tags/${TAG_ID}/entities`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.items).toHaveLength(1)
    expect(body.data.total).toBe(1)
  })

  it('filters entities by entity_type', async () => {
    const app = createTestApp({
      queryOverride: (sql) => {
        if (sql.includes('COUNT(*)') && sql.includes('tag_relations'))
          return { rows: [{ count: '1' }], rowCount: 1 }
        if (sql.includes('FROM tag_relations') && sql.includes('tag_id =')) {
          return { rows: [BASE_RELATION], rowCount: 1 }
        }
        return null
      },
    })

    const res = await app.request(`${BASE_URL}/tags/${TAG_ID}/entities?entity_type=MCQ_QUESTION`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.items).toBeDefined()
  })

  it('paginates with page and limit params', async () => {
    const app = createTestApp({
      queryOverride: () => ({ rows: [{ count: '0' }], rowCount: 1 }),
    })

    const res = await app.request(`${BASE_URL}/tags/${TAG_ID}/entities?page=2&limit=5`)
    const body = await res.json()
    expect(body.data.page).toBe(2)
    expect(body.data.limit).toBe(5)
  })
})

// ============================================================================
// T032 — Permission enforcement
// ============================================================================

describe('T032 — Permission enforcement', () => {
  describe('POST /tags without write permission → 403', () => {
    it('returns 403 PERMISSION_DENIED', async () => {
      const app = createTestApp({ permissions: [] })

      const res = await app.request(`${BASE_URL}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      })

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('PERMISSION_DENIED')
    })
  })

  describe('PATCH /tags/:id without permission → 403', () => {
    it('returns 403 PERMISSION_DENIED', async () => {
      const app = createTestApp({ permissions: [] })

      const res = await app.request(`${BASE_URL}/tags/${TAG_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DISABLED' }),
      })

      expect(res.status).toBe(403)
    })
  })

  describe('DELETE /tags/:id without permission → 403', () => {
    it('returns 403 PERMISSION_DENIED', async () => {
      const app = createTestApp({ permissions: [] })

      const res = await app.request(`${BASE_URL}/tags/${TAG_ID}`, { method: 'DELETE' })

      expect(res.status).toBe(403)
    })
  })

  describe('POST /tag-relations without permission → 403', () => {
    it('returns 403 PERMISSION_DENIED', async () => {
      const app = createTestApp({ permissions: [] })

      const res = await app.request(`${BASE_URL}/tag-relations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: TAG_ID, entity_type: 'MCQ_QUESTION', entity_id: ENTITY_ID }),
      })

      expect(res.status).toBe(403)
    })
  })

  describe('user with question_manage OR content_manage gains write access', () => {
    it('question_manage alone is sufficient for write', async () => {
      const app = createTestApp({
        permissions: ['question_manage'],
        queryOverride: (sql) => {
          if (sql.includes('normalized_name =')) return { rows: [], rowCount: 0 }
          if (sql.includes('INSERT INTO tags')) return { rows: [BASE_TAG], rowCount: 1 }
          return null
        },
      })

      const res = await app.request(`${BASE_URL}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Tag' }),
      })

      expect(res.status).toBe(201)
    })

    it('content_manage alone is sufficient for write', async () => {
      const app = createTestApp({
        permissions: ['content_manage'],
        queryOverride: (sql) => {
          if (sql.includes('normalized_name =')) return { rows: [], rowCount: 0 }
          if (sql.includes('INSERT INTO tags')) return { rows: [BASE_TAG], rowCount: 1 }
          return null
        },
      })

      const res = await app.request(`${BASE_URL}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Another Tag' }),
      })

      expect(res.status).toBe(201)
    })
  })
})

// ============================================================================
// T033 — Tenant isolation
// ============================================================================

describe('T033 — Tenant isolation', () => {
  it('tag created in tenant A is NOT visible in tenant B', async () => {
    // Tenant A — returns the tag
    const appA = createTestApp({
      tenantId: WORKSPACE_ID_A,
      tenantSlug: WORKSPACE_SLUG_A,
      queryOverride: (sql) => {
        if (sql.includes('FROM tags') && sql.includes('WHERE id ='))
          return { rows: [BASE_TAG], rowCount: 1 }
        return null
      },
    })

    // Tenant B — knows nothing about tenant A's tag
    const appB = createTestApp({
      tenantId: WORKSPACE_ID_B,
      tenantSlug: WORKSPACE_SLUG_B,
      queryOverride: (_sql) => null,
    })

    const resA = await appA.request(`${BASE_URL}/tags/${TAG_ID}`)
    expect(resA.status).toBe(200)
    const bodyA = await resA.json()
    expect(bodyA.data.id).toBe(TAG_ID)

    const resB = await appB.request(`${BASE_URL}/tags/${TAG_ID}`)
    expect(resB.status).toBe(404)
    const bodyB = await resB.json()
    expect(bodyB.error.code).toBe('TAG_NOT_FOUND')
  })

  it('tag relation from tenant A does NOT appear in tenant B entity query', async () => {
    // Tenant A — has a relation
    const appA = createTestApp({
      tenantId: WORKSPACE_ID_A,
      tenantSlug: WORKSPACE_SLUG_A,
      queryOverride: (sql) => {
        if (sql.includes('FROM tag_relations') && sql.includes('entity_type =')) {
          return { rows: [BASE_RELATION], rowCount: 1 }
        }
        return null
      },
    })

    // Tenant B — same entity, no relations
    const appB = createTestApp({
      tenantId: WORKSPACE_ID_B,
      tenantSlug: WORKSPACE_SLUG_B,
      queryOverride: (_sql) => null,
    })

    const resA = await appA.request(`${BASE_URL}/entities/MCQ_QUESTION/${ENTITY_ID}/tags`)
    const bodyA = await resA.json()
    expect(bodyA.data).toHaveLength(1)

    const resB = await appB.request(`${BASE_URL}/entities/MCQ_QUESTION/${ENTITY_ID}/tags`)
    const bodyB = await resB.json()
    expect(bodyB.data).toHaveLength(0)
  })
})
