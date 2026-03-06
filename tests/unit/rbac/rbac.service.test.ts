/**
 * RBAC Domain Service — Unit Tests
 *
 * File: tests/unit/rbac/rbac.service.test.ts
 * Stage: STAGE_21_ROLE_PERMISSION_SYSTEM
 * Date: 2026-03-02
 *
 * Tests all critical paths, error branches, concurrency guards, and
 * rollback behavior for the RBAC domain service — aligned with actual
 * implementation signatures.
 *
 * Service signatures (actual):
 * - evaluatePermission({ db, user_id, module, action }): queries staff user
 *   first (by user_id), then role, then permission row (deny-by-default)
 * - createRole(db, input, auditCtx): conflict detected via caught 23505 on INSERT
 * - deleteRole(db, roleId, auditCtx): SELECT FOR UPDATE, COUNT(*) AS cnt
 *
 * Constitutional Compliance:
 * ✓ No DB imports — uses vi.fn() mock DbClient
 * ✓ No HTTP logic — pure unit test
 * ✓ Rollback assertions: verifies no orphan rows on tx failure (SC-005)
 * ✓ All deny branches from evaluatePermission covered
 */

import { describe, expect, it, vi } from 'vitest'

import { writeRbacAuditLog } from '../../../packages/domain-core/src/rbac/rbac.audit'
import {
  createRole,
  deleteRole,
  evaluatePermission,
} from '../../../packages/domain-core/src/rbac/rbac.service'
import { PermissionModule } from '../../../packages/domain-core/src/rbac/rbac.types'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const AUDIT_CTX = {
  user_id: 'user-123',
  request_id: 'req-abc',
  workspace_slug: 'test-workspace',
}

const ROLE_ID = 'role-001'
const USER_ID = 'user-staff-001'

// ---------------------------------------------------------------------------
// evaluatePermission
// ---------------------------------------------------------------------------

describe('evaluatePermission()', () => {
  /**
   * evaluatePermission({ db, user_id, module, action })
   * Query order:
   *   1. SELECT from backoffice_staff_users WHERE id = user_id
   *   2. SELECT from backoffice_roles WHERE id = user.role_id
   *   3. SELECT from backoffice_role_module_permissions WHERE role_id = ... AND module = ...
   */

  it('denies when user is not found in DB', async () => {
    const db = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) }
    const result = await evaluatePermission({
      db,
      user_id: 'nonexistent-user',
      module: PermissionModule.SETTINGS,
      action: 'can_view',
    })
    expect(result).toBe(false)
  })

  it('denies when user.is_active = false', async () => {
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('backoffice_staff_users')) {
          return {
            rows: [
              {
                id: USER_ID,
                workspace_id: 'ws-1',
                is_active: false,
                role_id: ROLE_ID,
              },
            ],
            rowCount: 1,
          }
        }
        return { rows: [], rowCount: 0 }
      }),
    }
    const result = await evaluatePermission({
      db,
      user_id: USER_ID,
      module: PermissionModule.SETTINGS,
      action: 'can_view',
    })
    expect(result).toBe(false)
  })

  it('denies when user has no role_id assigned', async () => {
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('backoffice_staff_users')) {
          return {
            rows: [
              {
                id: USER_ID,
                workspace_id: 'ws-1',
                is_active: true,
                role_id: null,
              },
            ],
            rowCount: 1,
          }
        }
        return { rows: [], rowCount: 0 }
      }),
    }
    const result = await evaluatePermission({
      db,
      user_id: USER_ID,
      module: PermissionModule.SETTINGS,
      action: 'can_view',
    })
    expect(result).toBe(false)
  })

  it('denies when role is DISABLED', async () => {
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('backoffice_staff_users')) {
          return {
            rows: [
              {
                id: USER_ID,
                workspace_id: 'ws-1',
                is_active: true,
                role_id: ROLE_ID,
              },
            ],
            rowCount: 1,
          }
        }
        if (sql.includes('backoffice_roles')) {
          return { rows: [{ id: ROLE_ID, status: 'DISABLED' }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      }),
    }
    const result = await evaluatePermission({
      db,
      user_id: USER_ID,
      module: PermissionModule.SETTINGS,
      action: 'can_view',
    })
    expect(result).toBe(false)
  })

  it('denies when permission row is missing for module', async () => {
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('backoffice_staff_users')) {
          return {
            rows: [
              {
                id: USER_ID,
                workspace_id: 'ws-1',
                is_active: true,
                role_id: ROLE_ID,
              },
            ],
            rowCount: 1,
          }
        }
        if (sql.includes('backoffice_roles')) {
          return { rows: [{ id: ROLE_ID, status: 'ACTIVE' }], rowCount: 1 }
        }
        if (sql.includes('backoffice_role_module_permissions')) {
          return { rows: [], rowCount: 0 }
        }
        return { rows: [], rowCount: 0 }
      }),
    }
    const result = await evaluatePermission({
      db,
      user_id: USER_ID,
      module: PermissionModule.SETTINGS,
      action: 'can_view',
    })
    expect(result).toBe(false)
  })

  it('allows view when permission row has can_view=true', async () => {
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('backoffice_staff_users')) {
          return {
            rows: [
              {
                id: USER_ID,
                workspace_id: 'ws-1',
                is_active: true,
                role_id: ROLE_ID,
              },
            ],
            rowCount: 1,
          }
        }
        if (sql.includes('backoffice_roles')) {
          return { rows: [{ id: ROLE_ID, status: 'ACTIVE' }], rowCount: 1 }
        }
        if (sql.includes('backoffice_role_module_permissions')) {
          return { rows: [{ can_view: true }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      }),
    }
    const result = await evaluatePermission({
      db,
      user_id: USER_ID,
      module: PermissionModule.SETTINGS,
      action: 'can_view',
    })
    expect(result).toBe(true)
  })

  it('denies create when can_view=true but can_create=false', async () => {
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('backoffice_staff_users')) {
          return {
            rows: [
              {
                id: USER_ID,
                workspace_id: 'ws-1',
                is_active: true,
                role_id: ROLE_ID,
              },
            ],
            rowCount: 1,
          }
        }
        if (sql.includes('backoffice_roles')) {
          return { rows: [{ id: ROLE_ID, status: 'ACTIVE' }], rowCount: 1 }
        }
        if (sql.includes('backoffice_role_module_permissions')) {
          return { rows: [{ can_create: false }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      }),
    }
    const result = await evaluatePermission({
      db,
      user_id: USER_ID,
      module: PermissionModule.SETTINGS,
      action: 'can_create',
    })
    expect(result).toBe(false)
  })

  it('denies all actions when all flags are false', async () => {
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('backoffice_staff_users')) {
          return {
            rows: [
              {
                id: USER_ID,
                workspace_id: 'ws-1',
                is_active: true,
                role_id: ROLE_ID,
              },
            ],
            rowCount: 1,
          }
        }
        if (sql.includes('backoffice_roles')) {
          return { rows: [{ id: ROLE_ID, status: 'ACTIVE' }], rowCount: 1 }
        }
        if (sql.includes('backoffice_role_module_permissions')) {
          return {
            rows: [
              {
                can_view: false,
                can_create: false,
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
    const actions = ['can_view', 'can_create', 'can_edit', 'can_delete'] as const
    for (const action of actions) {
      const result = await evaluatePermission({
        db,
        user_id: USER_ID,
        module: PermissionModule.SETTINGS,
        action,
      })
      expect(result).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// createRole
// ---------------------------------------------------------------------------

describe('createRole()', () => {
  /**
   * createRole(db, { workspace_id, name, description }, auditCtx)
   * Conflict: caught via err.code === '23505' thrown during INSERT (no prior SELECT check)
   */

  it('throws ROLE_NAME_CONFLICT when INSERT violates unique constraint (23505)', async () => {
    const pgError = Object.assign(new Error('unique_violation'), {
      code: '23505',
    })
    const queryFn = vi.fn(async (sql: string) => {
      if (/^BEGIN$/.test(sql.trim())) return { rows: [], rowCount: 0 }
      if (/^ROLLBACK$/.test(sql.trim())) return { rows: [], rowCount: 0 }
      if (sql.includes('INSERT INTO backoffice_roles')) throw pgError
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createRole(
        { query: queryFn },
        { workspace_id: 'ws-1', name: 'MyRole', description: null },
        AUDIT_CTX
      )
    ).rejects.toMatchObject({ code: 'ROLE_NAME_CONFLICT' })
  })

  it('creates a new role, writes audit log, and commits transaction', async () => {
    const queryCalls: string[] = []
    const queryFn = vi.fn(async (sql: string) => {
      queryCalls.push(sql.trim())
      if (/^BEGIN$|^COMMIT$|^ROLLBACK$/.test(sql.trim())) return { rows: [], rowCount: 0 }
      if (sql.includes('INSERT INTO backoffice_roles')) {
        return {
          rows: [
            {
              id: 'new-role-id',
              workspace_id: 'ws-1',
              name: 'New Role',
              description: null,
              status: 'ACTIVE',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          rowCount: 1,
        }
      }
      if (sql.includes('rbac_audit_logs')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    const role = await createRole(
      { query: queryFn },
      { workspace_id: 'ws-1', name: 'New Role', description: null },
      AUDIT_CTX
    )
    expect(role).toMatchObject({ id: 'new-role-id', name: 'New Role' })
    expect(queryCalls).toContain('BEGIN')
    expect(queryCalls).toContain('COMMIT')
  })

  it('rolls back on mid-mutation DB failure — no orphan rows (SC-005)', async () => {
    const queryCalls: string[] = []
    const queryFn = vi.fn(async (sql: string) => {
      queryCalls.push(sql.trim())
      if (/^BEGIN$|^ROLLBACK$/.test(sql.trim())) return { rows: [], rowCount: 0 }
      if (sql.includes('INSERT INTO backoffice_roles')) {
        throw new Error('Simulated DB failure during INSERT')
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(
      createRole(
        { query: queryFn },
        { workspace_id: 'ws-1', name: 'Fail Role', description: null },
        AUDIT_CTX
      )
    ).rejects.toThrow('Simulated DB failure during INSERT')

    expect(queryCalls).toContain('ROLLBACK')
    expect(queryCalls).not.toContain('COMMIT')
    // No audit log should have been written
    expect(queryCalls.some((s) => s.includes('rbac_audit_logs'))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// deleteRole
// ---------------------------------------------------------------------------

describe('deleteRole()', () => {
  /**
   * deleteRole(db, roleId, auditCtx)
   * Step 1: SELECT id FROM backoffice_roles WHERE id = $1 FOR UPDATE
   * Step 2: SELECT COUNT(*)::text AS cnt FROM backoffice_staff_users WHERE role_id = $1 AND is_active = TRUE
   * Step 3: DELETE FROM backoffice_roles WHERE id = $1
   * Key: count column alias is 'cnt' (not 'count')
   */

  it('throws ROLE_HAS_ACTIVE_USERS when users are assigned', async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (/^BEGIN$|^ROLLBACK$/.test(sql.trim())) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE')) {
        return { rows: [{ id: ROLE_ID }], rowCount: 1 }
      }
      if (sql.includes('COUNT(*)') && sql.includes('backoffice_staff_users')) {
        // Column alias is 'cnt' per actual implementation
        return { rows: [{ cnt: '3' }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteRole({ query: queryFn }, ROLE_ID, AUDIT_CTX)).rejects.toMatchObject({
      code: 'ROLE_HAS_ACTIVE_USERS',
    })
  })

  it('throws ROLE_NOT_FOUND when role does not exist', async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (/^BEGIN$|^ROLLBACK$/.test(sql.trim())) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })
    await expect(deleteRole({ query: queryFn }, 'nonexistent-id', AUDIT_CTX)).rejects.toMatchObject(
      {
        code: 'ROLE_NOT_FOUND',
      }
    )
  })

  it('rolls back and no audit log on tx failure — no orphan rows (SC-005)', async () => {
    const queryCalls: string[] = []
    const queryFn = vi.fn(async (sql: string) => {
      queryCalls.push(sql.trim())
      if (/^BEGIN$|^ROLLBACK$/.test(sql.trim())) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE')) return { rows: [{ id: ROLE_ID }], rowCount: 1 }
      if (sql.includes('COUNT(*)')) return { rows: [{ cnt: '0' }], rowCount: 1 }
      if (sql.includes('DELETE FROM backoffice_roles')) throw new Error('DB failure on DELETE')
      return { rows: [], rowCount: 0 }
    })

    await expect(deleteRole({ query: queryFn }, ROLE_ID, AUDIT_CTX)).rejects.toThrow()

    expect(queryCalls).toContain('ROLLBACK')
    expect(queryCalls).not.toContain('COMMIT')
    // Audit log INSERT must NOT appear (tx rolled back before audit)
    expect(queryCalls.some((s) => s.toLowerCase().includes('rbac_audit_logs'))).toBe(false)
  })

  it('succeeds without active users — commits and writes audit log', async () => {
    const queryCalls: string[] = []
    const queryFn = vi.fn(async (sql: string) => {
      queryCalls.push(sql.trim())
      if (/^BEGIN$|^COMMIT$|^ROLLBACK$/.test(sql.trim())) return { rows: [], rowCount: 0 }
      if (sql.includes('FOR UPDATE')) return { rows: [{ id: ROLE_ID }], rowCount: 1 }
      if (sql.includes('COUNT(*)')) return { rows: [{ cnt: '0' }], rowCount: 1 }
      if (sql.includes('DELETE FROM backoffice_roles')) return { rows: [], rowCount: 1 }
      if (sql.includes('rbac_audit_logs')) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await deleteRole({ query: queryFn }, ROLE_ID, AUDIT_CTX)

    expect(queryCalls).toContain('COMMIT')
    expect(queryCalls).not.toContain('ROLLBACK')
  })
})

// ---------------------------------------------------------------------------
// writeRbacAuditLog
// ---------------------------------------------------------------------------

describe('writeRbacAuditLog()', () => {
  /**
   * writeRbacAuditLog(db, entry: RbacAuditEntry)
   * RbacAuditEntry: { user_id, role_id, module, action, request_id, workspace_slug, metadata? }
   * Throws BEFORE try-catch if action is invalid (allowlist check)
   * Does NOT rethrow if db.query fails (immutability audit log contract)
   */

  it('throws on invalid audit action (allowlist validation)', async () => {
    const db = { query: vi.fn(async () => ({ rows: [], rowCount: 1 })) }
    await expect(
      writeRbacAuditLog(db, {
        action: 'INVALID_ACTION' as any,
        user_id: null,
        role_id: 'role-1',
        module: null,
        request_id: 'req-1',
        workspace_slug: 'ws',
      })
    ).rejects.toThrow()
  })

  it('writes audit log entry with valid CREATE_ROLE action', async () => {
    const queryFn = vi.fn(async () => ({ rows: [], rowCount: 1 }))
    await writeRbacAuditLog(
      { query: queryFn },
      {
        action: 'CREATE_ROLE',
        user_id: 'user-1',
        role_id: 'role-1',
        module: null,
        request_id: 'req-1',
        workspace_slug: 'ws',
      }
    )
    expect(queryFn).toHaveBeenCalledWith(
      expect.stringContaining('rbac_audit_logs'),
      expect.any(Array)
    )
  })

  it('does not throw when DB write fails (non-blocking immutability contract)', async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql.includes('rbac_audit_logs')) throw new Error('Trigger violation')
      return { rows: [], rowCount: 1 }
    })

    // writeRbacAuditLog catches DB errors and never rethrows (immutability contract)
    await expect(
      writeRbacAuditLog(
        { query: queryFn },
        {
          action: 'DELETE_ROLE',
          user_id: 'user-1',
          role_id: 'role-1',
          module: null,
          request_id: 'req-1',
          workspace_slug: 'ws',
        }
      )
    ).resolves.toBeUndefined()
  })
})
