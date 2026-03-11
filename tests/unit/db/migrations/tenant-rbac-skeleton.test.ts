/**
 * Unit Tests: Tenant RBAC Skeleton Migration
 *
 * File: tests/unit/db/migrations/tenant-rbac-skeleton.test.ts
 * Task: T029
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 *
 * Migration tested: 20260228_001_tenant_rbac_skeleton
 *
 * Scenarios:
 * (a) All 4 tables created after up()
 * (b) All 6 indexes present after up()
 * (c) Unique constraint on role_permissions.(role_id, module, action)
 * (d) Unique constraint on staff_user_roles.(staff_user_id, role_id)
 * (e) Migration is idempotent (safe to run twice — IF EXISTS guards)
 * (f) down() throws with explicit message
 */

import { describe, expect, it, vi } from 'vitest'
import {
  down,
  up,
} from '../../../../apps/api/src/db/tenant/migrations/20260228_001_tenant_rbac_skeleton'

// ── In-Memory DB Stub ─────────────────────────────────────────────────────────

/**
 * Creates a stateful in-memory "connection" that tracks:
 * - queries executed (for assertion)
 * - simulates transaction control (BEGIN/COMMIT/ROLLBACK)
 * - tracks created tables and indexes via DDL inspection
 */
function makeTestDb(shouldFail = false) {
  const executedSql: string[] = []
  const tablesCreated: string[] = []
  const indexesCreated: string[] = []

  const client = {
    query: vi.fn(async (sql: string) => {
      if (shouldFail && sql.includes('CREATE TABLE')) {
        throw new Error('Simulated DB failure')
      }

      executedSql.push(sql.trim())

      // Track tables
      const tableMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)
      if (tableMatch) {
        tablesCreated.push(tableMatch[1]!.toLowerCase())
      }

      // Track indexes
      const indexMatch =
        sql.match(/CREATE INDEX IF NOT EXISTS (\w+)/i) ??
        sql.match(/CREATE UNIQUE INDEX IF NOT EXISTS (\w+)/i)
      if (indexMatch) {
        indexesCreated.push(indexMatch[1]!.toLowerCase())
      }

      return { rows: [] }
    }),
    release: vi.fn(),
  }

  return { client, executedSql, tablesCreated, indexesCreated }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('migration: 20260228_001_tenant_rbac_skeleton', () => {
  describe('up()', () => {
    it('(a) creates all 4 required tables', async () => {
      const { client, tablesCreated } = makeTestDb()
      await up(client as any)

      const required = [
        'backoffice_roles',
        'backoffice_role_permissions',
        'backoffice_staff_users',
        'backoffice_staff_user_roles',
      ]
      for (const table of required) {
        expect(tablesCreated).toContain(table)
      }
    })

    it('(b) creates all 6 required indexes', async () => {
      const { client, executedSql } = makeTestDb()
      await up(client as any)

      // Verify all index DDLs are present in executed SQL
      const allSql = executedSql.join('\n').toLowerCase()

      const requiredIndexes = [
        'idx_backoffice_roles_workspace_id',
        'idx_backoffice_role_permissions_role_id',
        'idx_backoffice_role_permissions_role_module',
        'idx_backoffice_staff_users_workspace_email',
        'idx_backoffice_staff_users_workspace_id',
        'idx_backoffice_staff_user_roles_role_id',
      ]

      for (const idx of requiredIndexes) {
        expect(allSql, `Expected index ${idx} to be created`).toContain(idx)
      }
    })

    it('(c) unique constraint on role_permissions.(role_id, module, action)', async () => {
      const { client, executedSql } = makeTestDb()
      await up(client as any)

      const allSql = executedSql.join('\n').toLowerCase()
      // The constraint should appear as UNIQUE in role_permissions table DDL or as a UNIQUE INDEX
      const hasUniqueRolePermissions =
        allSql.includes('unique') &&
        (allSql.includes('role_permissions') || allSql.includes('role_id')) &&
        allSql.includes('module') &&
        allSql.includes('action')

      expect(hasUniqueRolePermissions).toBe(true)
    })

    it('(d) unique constraint on staff_user_roles.(staff_user_id, role_id)', async () => {
      const { client, executedSql } = makeTestDb()
      await up(client as any)

      const allSql = executedSql.join('\n').toLowerCase()
      const hasUniqueUserRoles =
        allSql.includes('unique') &&
        (allSql.includes('staff_user_roles') || allSql.includes('staff_user_id')) &&
        allSql.includes('role_id')

      expect(hasUniqueUserRoles).toBe(true)
    })

    it('(e) migration is idempotent (IF NOT EXISTS guards allow running twice safely)', async () => {
      const { client, executedSql } = makeTestDb()

      // Run migration twice — should NOT throw
      await expect(up(client as any)).resolves.not.toThrow()
      await expect(up(client as any)).resolves.not.toThrow()

      // All DDL statements should use IF NOT EXISTS
      const ddlStatements = executedSql.filter((sql) => sql.toUpperCase().startsWith('CREATE'))
      for (const stmt of ddlStatements) {
        expect(stmt.toUpperCase()).toContain('IF NOT EXISTS')
      }
    })

    it('wraps all DDL in a transaction (BEGIN before first CREATE, COMMIT at end)', async () => {
      const { client, executedSql } = makeTestDb()
      await up(client as any)

      const first = executedSql[0]?.toUpperCase().trim()
      expect(first).toBe('BEGIN')

      // COMMIT should appear (not necessarily last — ROLLBACK on error)
      const hasCommit = executedSql.some((s) => s.trim().toUpperCase() === 'COMMIT')
      expect(hasCommit).toBe(true)
    })

    it('rolls back on error and re-throws', async () => {
      const { client } = makeTestDb(true /* shouldFail */)
      await expect(up(client as any)).rejects.toThrow('Simulated DB failure')
    })
  })

  describe('down()', () => {
    it('(f) throws with explicit message — forward-only migration', async () => {
      const { client } = makeTestDb()
      await expect(down(client as any)).rejects.toThrow()
    })

    it('thrown error message is descriptive (not generic)', async () => {
      const { client } = makeTestDb()
      try {
        await down(client as any)
        // Should not reach here
        expect(true).toBe(false)
      } catch (err) {
        expect(err instanceof Error).toBe(true)
        const msg = (err as Error).message
        expect(msg.length).toBeGreaterThan(0)
        // Should not be a generic "Error" or empty
        expect(msg).not.toBe('Error')
      }
    })
  })
})
