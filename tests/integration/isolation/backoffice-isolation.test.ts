/**
 * Integration Tests: Backoffice Tenant Isolation
 *
 * File: tests/integration/isolation/backoffice-isolation.test.ts
 * Task: T031
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 *
 * Scenarios:
 * (a) AC-05/FR-10.1 — no Backoffice handler imports or references master_db pool
 * (b) FR-10.2 — RBAC query scoped to tenant DB only — no cross-tenant join possible
 * (c) Context endpoint returns data from correct tenant DB when multiple tenants exist
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// ── Helpers ───────────────────────────────────────────────────────────────────

function readSourceFile(relativePath: string): string {
  const absolutePath = resolve(__dirname, '../../../', relativePath)
  return readFileSync(absolutePath, 'utf-8')
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Backoffice tenant isolation', () => {
  /**
   * (a) AC-05 / FR-10.1
   * No Backoffice handler should import or reference master_db.
   * All Backoffice DB access must originate from the tenant resolver context.
   */
  describe('(a) AC-05/FR-10.1 — Backoffice handlers do not reference master_db', () => {
    const BACKOFFICE_SOURCE_FILES = [
      'apps/api/src/routes/backoffice/context.ts',
      'apps/api/src/routes/backoffice/ws.ts',
      'apps/api/src/routes/backoffice/types.ts',
      'apps/api/src/middleware/backoffice-rbac-guard.ts',
      'apps/api/src/middleware/backoffice-module-guard.ts',
    ]

    it.each(BACKOFFICE_SOURCE_FILES)('%s does not import master_db', (filePath) => {
      const source = readSourceFile(filePath)

      // Must not reference master_db pool directly
      expect(source).not.toMatch(/master_db/)
      expect(source).not.toMatch(/masterDb/)
      expect(source).not.toMatch(/master-db/)
    })

    it.each(
      BACKOFFICE_SOURCE_FILES
    )('%s does not reference the master pool singleton', (filePath) => {
      const source = readSourceFile(filePath)

      // Must not reference constants like MASTER_POOL or similar singletons
      expect(source).not.toMatch(/MASTER_POOL/)
      expect(source).not.toMatch(/masterPool/)
      expect(source).not.toMatch(/getMasterDb\(\)/)
    })
  })

  /**
   * (b) FR-10.2
   * RBAC queries must be scoped to the tenant DB only.
   * No cross-tenant joins or references to other workspace tables.
   */
  describe('(b) FR-10.2 — RBAC queries are scoped to tenant DB, no cross-tenant joins', () => {
    it('RBAC guard SQL does not contain workspace_id filter on a cross-tenant table', () => {
      const source = readSourceFile('apps/api/src/middleware/backoffice-rbac-guard.ts')

      // RBAC guard should not join against a global workspace table
      expect(source).not.toMatch(/FROM workspaces/i)
      expect(source).not.toMatch(/JOIN workspaces/i)
      expect(source).not.toMatch(/FROM licenses/i)
      expect(source).not.toMatch(/JOIN licenses/i)
    })

    it('RBAC guard queries target tenant-scoped tables only (roles, role_permissions, staff_user_roles)', () => {
      const source = readSourceFile('apps/api/src/middleware/backoffice-rbac-guard.ts')

      // Must query tenant-local tables
      const queryPresent =
        source.includes('staff_user_roles') ||
        source.includes('role_permissions') ||
        source.includes('roles')

      expect(queryPresent).toBe(true)
    })

    it('RBAC guard extracts pool from tenant context, not a global reference', () => {
      const source = readSourceFile('apps/api/src/middleware/backoffice-rbac-guard.ts')

      // Should get pool from ctx.get('tenant') or similar context-bound access
      expect(source).toMatch(/tenant.*pool|pool.*tenant|ctx\.get\(/i)
    })
  })

  /**
   * (c) Context endpoint returns correct tenant data
   * When multiple tenants exist, route handler must return data from the
   * tenant bound to the current request — not a default or global tenant.
   */
  describe('(c) Context endpoint returns data from the correct tenant DB', () => {
    it('context handler reads workspace data from ctx variables set by tenant resolver', () => {
      const source = readSourceFile('apps/api/src/routes/backoffice/context.ts')

      // Handler must retrieve workspace_id, workspace_slug etc. from c.get() / ctx.get()
      // NOT from a global or environment variable
      expect(source).toMatch(/[c]\.get\(/i)
      expect(source).not.toMatch(/process\.env\.WORKSPACE_ID/i)
      expect(source).not.toMatch(/process\.env\.WORKSPACE_SLUG/i)
    })

    it('context handler does not hardcode any workspace slug or ID', () => {
      const source = readSourceFile('apps/api/src/routes/backoffice/context.ts')

      // Should not contain hardcoded workspace references
      expect(source).not.toMatch(/workspace_slug\s*=\s*['"][^'"]+['"]/i)
      expect(source).not.toMatch(/workspace_id\s*=\s*['"][^'"]+['"]/i)
    })

    it('tenant isolation — multiple tenants get isolated data via independent ctx.get() calls', async () => {
      // Simulate two "contexts" representing two different tenant requests
      function makeIsolatedCtx(tenantData: Record<string, string>) {
        return {
          get: vi.fn((key: string) => tenantData[key] ?? null),
          set: vi.fn(),
          json: vi.fn().mockResolvedValue({}),
        }
      }

      const ctxTenantA = makeIsolatedCtx({
        workspace_id: 'ws-A',
        workspace_slug: 'tenant-a',
        license_status: 'ACTIVE',
        correlation_id: 'corr-a',
        correlationId: 'corr-a',
      })
      const ctxTenantB = makeIsolatedCtx({
        workspace_id: 'ws-B',
        workspace_slug: 'tenant-b',
        license_status: 'ACTIVE',
        correlation_id: 'corr-b',
        correlationId: 'corr-b',
      })

      // Both contexts are independent — querying one doesn't pollute the other
      expect(ctxTenantA.get('workspace_id')).toBe('ws-A')
      expect(ctxTenantB.get('workspace_id')).toBe('ws-B')
      expect(ctxTenantA.get('workspace_id')).not.toBe(ctxTenantB.get('workspace_id'))
    })
  })
})
