import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createHierarchyNode,
  deleteHierarchyNode,
  getHierarchyNode,
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

  // ============================= CREATE TESTS =============================
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

  it('creates a node with parent, description, and custom status', async () => {
    const mockQuery = db.query as MockFn
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'parent-001',
            name: 'Parent',
            parent_id: null,
            description: null,
            status: 'ENABLED',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'node-002',
            name: 'Child',
            parent_id: 'parent-001',
            description: 'A child node',
            status: 'DISABLED',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const result = await createHierarchyNode(
      db,
      {
        name: 'Child',
        parent_id: 'parent-001',
        description: 'A child node',
        status: 'DISABLED',
      },
      AUDIT
    )

    expect(result.name).toBe('Child')
    expect(result.parent_id).toBe('parent-001')
    expect(result.description).toBe('A child node')
    expect(result.status).toBe('DISABLED')
  })

  // ============================= READ TESTS =============================
  it('fetches a specific hierarchy node by id', async () => {
    const mockQuery = db.query as MockFn
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'node-001',
          name: 'Test Node',
          parent_id: null,
          description: 'test',
          status: 'ENABLED',
          created_at: new Date(),
          updated_at: new Date(),
          depth: 0,
        },
      ],
      rowCount: 1,
    })

    const result = await getHierarchyNode(db, 'node-001')

    expect(result.id).toBe('node-001')
    expect(result.name).toBe('Test Node')
  })

  it('throws not found when node does not exist', async () => {
    const mockQuery = db.query as MockFn
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(getHierarchyNode(db, 'missing')).rejects.toMatchObject({
      code: 'HIERARCHY_NODE_NOT_FOUND',
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

  it('lists paginated nodes with status filter', async () => {
    const mockQuery = db.query as MockFn
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 }).mockResolvedValueOnce({
      rows: [
        {
          id: 'node-001',
          name: 'Enabled Node',
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

    const result = await listHierarchyNodes(db, { page: 1, per_page: 20, status: 'ENABLED' })
    expect(result.total).toBe(2)
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

  // ============================= UPDATE TESTS =============================
  it('rejects self-reference when attempting reparent to self', async () => {
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
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(
      updateHierarchyNode(db, 'node-001', { parent_id: 'node-001' }, AUDIT)
    ).rejects.toMatchObject({
      code: 'HIERARCHY_NODE_SELF_REFERENCE',
    })
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

  it('rejects update of non-existent node', async () => {
    const mockQuery = db.query as MockFn
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(
      updateHierarchyNode(db, 'missing', { name: 'New Name' }, AUDIT)
    ).rejects.toMatchObject({
      code: 'HIERARCHY_NODE_NOT_FOUND',
    })
  })

  it('rejects blank name on update', async () => {
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
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(updateHierarchyNode(db, 'node-001', { name: '   ' }, AUDIT)).rejects.toMatchObject(
      {
        code: 'VALIDATION_ERROR',
      }
    )
  })

  it('rejects duplicate name when updating with new name', async () => {
    const mockQuery = db.query as MockFn
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'node-001',
            name: 'Old Name',
            parent_id: null,
            description: null,
            status: 'ENABLED',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ exists: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(
      updateHierarchyNode(db, 'node-001', { name: 'Duplicate Name' }, AUDIT)
    ).rejects.toMatchObject({
      code: 'HIERARCHY_NODE_NAME_DUPLICATE',
    })
  })

  // ============================= DELETE TESTS =============================
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

  it('successfully deletes a node with no children or staff assignments', async () => {
    const mockQuery = db.query as MockFn
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'node-001',
            name: 'Leaf Node',
            parent_id: 'parent-001',
            description: null,
            status: 'ENABLED',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const result = await deleteHierarchyNode(db, 'node-001', AUDIT)

    expect(result.deleted).toBe(true)
  })

  it('rejects delete of non-existent node', async () => {
    const mockQuery = db.query as MockFn
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(deleteHierarchyNode(db, 'missing', AUDIT)).rejects.toMatchObject({
      code: 'HIERARCHY_NODE_NOT_FOUND',
    })
  })

  // ============================= ERROR HANDLING TESTS =============================
  it('handles database errors during create', async () => {
    const mockQuery = db.query as MockFn
    const pgError = new Error('duplicate key')
    ;(pgError as any).code = '23505'

    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockRejectedValueOnce(pgError)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(createHierarchyNode(db, { name: 'Test' }, AUDIT)).rejects.toMatchObject({
      code: 'HIERARCHY_NODE_NAME_DUPLICATE',
    })
  })

  it('rethrows unexpected database errors during create', async () => {
    const mockQuery = db.query as MockFn
    const unexpectedError = new Error('database connection lost')

    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockRejectedValueOnce(unexpectedError)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(createHierarchyNode(db, { name: 'Test' }, AUDIT)).rejects.toBe(unexpectedError)
  })
})
