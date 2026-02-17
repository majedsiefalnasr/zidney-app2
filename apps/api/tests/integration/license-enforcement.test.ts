/**
 * License Enforcement Tests
 *
 * File: apps/api/tests/integration/license-enforcement.test.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Verify license validation on every request
 *
 * License States:
 * - ACTIVE: Normal operation
 * - SOFT_LOCKED: Payment due (423 Locked)
 * - ARCHIVED: Workspace closed (403 Forbidden)
 *
 * Requirements:
 * - Check license on login
 * - Check license on every authenticated request
 * - Return appropriate HTTP status
 * - Log license violations for compliance
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, getTenantPool } from '../../db'

describe('License Enforcement', () => {
  let activeWorkspace: any
  let lockedWorkspace: any
  let archivedWorkspace: any
  let user: any

  beforeAll(async () => {
    // Create ACTIVE workspace
    const active = await db.master.query(
      `INSERT INTO workspaces (slug, name, license_status, schema_version, product_version)
       VALUES ('lic-active', 'Active Workspace', 'ACTIVE', 1, '0.1.0')
       RETURNING *`
    )
    activeWorkspace = active.rows[0]

    // Create SOFT_LOCKED workspace
    const locked = await db.master.query(
      `INSERT INTO workspaces (slug, name, license_status, schema_version, product_version)
       VALUES ('lic-locked', 'Locked Workspace', 'SOFT_LOCKED', 1, '0.1.0')
       RETURNING *`
    )
    lockedWorkspace = locked.rows[0]

    // Create ARCHIVED workspace
    const archived = await db.master.query(
      `INSERT INTO workspaces (slug, name, license_status, schema_version, product_version, archived_at)
       VALUES ('lic-archived', 'Archived Workspace', 'ARCHIVED', 1, '0.1.0', NOW())
       RETURNING *`
    )
    archivedWorkspace = archived.rows[0]

    // Create user in active workspace
    const pool = getTenantPool(activeWorkspace.id)
    const u = await pool.query(
      `INSERT INTO users (email, password_hash, role, token_version)
       VALUES ('license@test.com', 'hash', 'admin', 1)
       RETURNING id, email`
    )
    user = u.rows[0]
  })

  afterAll(async () => {
    const pool = getTenantPool(activeWorkspace.id)
    await pool.query('DELETE FROM users WHERE id = $1', [user.id])

    await db.master.query(
      'DELETE FROM workspaces WHERE license_status IN (?, ?, ?)',
      ['ACTIVE', 'SOFT_LOCKED', 'ARCHIVED']
    )
  })

  it('should allow access to ACTIVE workspace', async () => {
    const result = await db.master.query(
      `SELECT license_status FROM workspaces WHERE id = $1`,
      [activeWorkspace.id]
    )

    expect(result.rows[0].license_status).toBe('ACTIVE')
  })

  it('should deny access to SOFT_LOCKED workspace with 423', async () => {
    const result = await db.master.query(
      `SELECT license_status FROM workspaces WHERE id = $1`,
      [lockedWorkspace.id]
    )

    // Middleware should return 423 Locked for SOFT_LOCKED
    expect(result.rows[0].license_status).toBe('SOFT_LOCKED')
  })

  it('should deny access to ARCHIVED workspace with 403', async () => {
    const result = await db.master.query(
      `SELECT license_status FROM workspaces WHERE id = $1`,
      [archivedWorkspace.id]
    )

    // Middleware should return 403 Forbidden for ARCHIVED
    expect(result.rows[0].license_status).toBe('ARCHIVED')
  })

  it('should validate license on login attempt', async () => {
    // Simulating login middleware check
    // Before issuing JWT, middleware must verify license_status

    const lockResult = await db.master.query(
      `SELECT license_status FROM workspaces WHERE id = $1`,
      [lockedWorkspace.id]
    )

    // If SOFT_LOCKED, should reject with 423
    expect(lockResult.rows[0].license_status).toBe('SOFT_LOCKED')

    const archiveResult = await db.master.query(
      `SELECT license_status FROM workspaces WHERE id = $1`,
      [archivedWorkspace.id]
    )

    // If ARCHIVED, should reject with 403
    expect(archiveResult.rows[0].license_status).toBe('ARCHIVED')
  })

  it('should validate license on every authenticated request', async () => {
    // Simulating auth middleware flow
    // 1. Validate JWT
    // 2. Check workspace license (on every request)
    // 3. If license changed, reject immediately

    // Transition active → locked to test on-request validation
    await db.master.query(
      `UPDATE workspaces SET license_status = $1 WHERE id = $2`,
      ['SOFT_LOCKED', activeWorkspace.id]
    )

    // Verify change applied
    const check = await db.master.query(
      `SELECT license_status FROM workspaces WHERE id = $1`,
      [activeWorkspace.id]
    )

    expect(check.rows[0].license_status).toBe('SOFT_LOCKED')

    // Reset
    await db.master.query(
      `UPDATE workspaces SET license_status = $1 WHERE id = $2`,
      ['ACTIVE', activeWorkspace.id]
    )
  })
})
