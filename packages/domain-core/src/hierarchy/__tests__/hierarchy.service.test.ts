import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HierarchyError } from '../hierarchy.errors'
import {
  createHierarchyNode,
  deleteHierarchyNode,
  getHierarchySubtree,
  listHierarchyNodes,
  updateHierarchyNode,
} from '../hierarchy.service'
import type { AuditContext, DbClient } from '../hierarchy.types'

type MockFn = ReturnType<typeof vi.fn>

const AUDIT: AuditContext = {
  user_id: 'staff-001',
  correlation_id: 'corr-001',
  workspace_slug: 'alpha',
  workspace_id: 'ws-001',
}

describe('hierarchy.service', () => {
  let db: DbClient

  beforeEach(() => {
    db = { query: vi.fn() }
  })

  it('creates a root node with valid input', async () => {
    const mockQuery = db.query as MockFn
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'node-001',
            name: 'Root',
            parent_id: null,
            description: null,
            status: 'ENABLED',
            created_at: new Date('2026-03-19T00:00:00Z'),
            updated_at: new Date('2026-03-19T00:00:00Z'),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const result = await createHierarchyNode(db, { name: 'Root' }, AUDIT)

    expect(result.name).toBe('Root')
    expect(result.parent_id).toBeNull()
  })

  it('rejects blank names', async () => {
    await expect(createHierarchyNode(db, { name: '   ' }, AUDIT)).rejects.toBeInstanceOf(
      HierarchyError
    )
  })

  it('detects a cycle during reparent', async () => {
    const mockQuery = db.query as MockFn
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'node-001',
            name: 'Node',
            parent_id: null,
            description: null,
            status: 'ENABLED',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'node-001',
            name: 'Node',
            parent_id: null,
            description: null,
            status: 'ENABLED',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'node-002',
            name: 'Child',
            parent_id: 'node-001',
            description: null,
            status: 'ENABLED',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 'node-002' }, { id: 'node-001' }], rowCount: 2 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(
      updateHierarchyNode(db, 'node-001', { parent_id: 'node-002' }, AUDIT)
    ).rejects.toMatchObject({
      code: 'HIERARCHY_NODE_CYCLE_DETECTED',
    })
  })

  it('returns a paginated flat list', async () => {
    const mockQuery = db.query as MockFn
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 }).mockResolvedValueOnce({
      rows: [
        {
          id: 'node-001',
          name: 'Root',
          parent_id: null,
          description: null,
          status: 'ENABLED',
          created_at: new Date(),
          updated_at: new Date(),
          depth: 0,
        },
      ],
      rowCount: 1,
    })

    const result = await listHierarchyNodes(db, { page: 1, per_page: 20 })
    expect(result.total).toBe(1)
    expect(result.items).toHaveLength(1)
  })

  it('returns not found for an empty subtree anchor', async () => {
    const mockQuery = db.query as MockFn
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(getHierarchySubtree(db, 'missing', AUDIT)).rejects.toMatchObject({
      code: 'HIERARCHY_NODE_NOT_FOUND',
    })
  })

  it('blocks delete when children exist', async () => {
    const mockQuery = db.query as MockFn
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'node-001',
            name: 'Root',
            parent_id: null,
            description: null,
            status: 'ENABLED',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(deleteHierarchyNode(db, 'node-001', AUDIT)).rejects.toMatchObject({
      code: 'HIERARCHY_NODE_HAS_CHILDREN',
    })
  })
})
