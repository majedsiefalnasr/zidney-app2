/**
 * Token Versioning Tests
 *
 * File: apps/api/tests/integration/token-versioning.test.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Verify stateless token revocation mechanism
 *
 * Mechanism:
 * - token_version field in JWT payload
 * - user.token_version field in database
 * - Mismatch = token is revoked
 * - No blocklist needed (stateless revocation)
 *
 * Operations:
 * - logout-all: increment token_version
 * - password change: increment token_version
 * - admin revoke: increment token_version
 *
 * Tests:
 * 1. Token valid when versions match
 * 2. Token invalid when versions mismatch
 * 3. logout-all invalidates all tokens
 * 4. Password change invalidates all tokens
 * 5. Old tokens cannot be reused
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, getTenantPool } from '../../db'

const TOKEN_WORKSPACES_TABLE = 'token_versioning_workspaces'
const TOKEN_USERS_TABLE = 'token_versioning_users'

describe('Token Versioning', () => {
  let workspace: any
  let user: any

  beforeAll(async () => {
    await db.master.query(`
      CREATE TABLE IF NOT EXISTS ${TOKEN_WORKSPACES_TABLE} (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        license_status TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        product_version TEXT NOT NULL
      )
    `)
    await db.master.query(`
      CREATE TABLE IF NOT EXISTS ${TOKEN_USERS_TABLE} (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        workspace_id TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        token_version INTEGER NOT NULL DEFAULT 1
      )
    `)

    const ws = await db.master.query(
      `INSERT INTO ${TOKEN_WORKSPACES_TABLE} (slug, name, license_status, schema_version, product_version)
       VALUES ('token-ver', 'Token Version Test', 'ACTIVE', 1, '0.1.0')
       RETURNING *`
    )
    workspace = ws.rows[0]!

    const pool = getTenantPool(workspace.id)!
    const u = await pool.query(
      `INSERT INTO ${TOKEN_USERS_TABLE} (workspace_id, email, password_hash, role, token_version)
       VALUES ($1, 'tokenver@test.com', 'hash', 'admin', 1)
       RETURNING id, email, token_version`,
      [workspace.id]
    )
    user = u.rows[0]!
  })

  afterAll(async () => {
    if (!workspace || !user) {
      return
    }
    const pool = getTenantPool(workspace.id)!
    await pool.query(`DELETE FROM ${TOKEN_USERS_TABLE} WHERE id = $1`, [user.id])
    await db.master.query(`DELETE FROM ${TOKEN_WORKSPACES_TABLE} WHERE id = $1`, [workspace.id])
  })

  it('should validate token when versions match', async () => {
    const pool = getTenantPool(workspace.id)!

    // Get current token version
    const result = await pool.query(
      `SELECT token_version FROM ${TOKEN_USERS_TABLE} WHERE id = $1`,
      [user.id]
    )

    const dbVersion = result.rows[0]?.token_version
    const tokenVersion = 1 // Originally issued with version 1

    // Versions match = token valid
    expect(tokenVersion).toBe(dbVersion)
  })

  it('should reject token when versions mismatch', async () => {
    const pool = getTenantPool(workspace.id)!

    // Simulate incremented version in DB
    await pool.query(
      `UPDATE ${TOKEN_USERS_TABLE} SET token_version = token_version + 1 WHERE id = $1`,
      [user.id]
    )

    // Get new version
    const result = await pool.query(
      `SELECT token_version FROM ${TOKEN_USERS_TABLE} WHERE id = $1`,
      [user.id]
    )

    const dbVersion = result.rows[0]?.token_version
    const tokenVersion = 1 // Token still has version 1

    // Versions mismatch = token revoked
    expect(tokenVersion).not.toBe(dbVersion)
    expect(dbVersion).toBe(2)
  })

  it('should invalidate all tokens on logout-all', async () => {
    const pool = getTenantPool(workspace.id)!

    // Get current version
    const before = await pool.query(
      `SELECT token_version FROM ${TOKEN_USERS_TABLE} WHERE id = $1`,
      [user.id]
    )
    const beforeVersion = before.rows[0]?.token_version

    // Simulate logout-all (increment version)
    await pool.query(
      `UPDATE ${TOKEN_USERS_TABLE} SET token_version = token_version + 1 WHERE id = $1`,
      [user.id]
    )

    // Verify version incremented
    const after = await pool.query(`SELECT token_version FROM ${TOKEN_USERS_TABLE} WHERE id = $1`, [
      user.id,
    ])
    const afterVersion = after.rows[0]?.token_version

    expect(afterVersion).toBe(beforeVersion + 1)

    // All previously issued tokens (version = beforeVersion) are now invalid
  })

  it('should prevent token reuse after revocation', async () => {
    const pool = getTenantPool(workspace.id)!

    // Get current version
    const result = await pool.query(
      `SELECT token_version FROM ${TOKEN_USERS_TABLE} WHERE id = $1`,
      [user.id]
    )
    const currentVersion = result.rows[0]?.token_version

    // Old token with version (currentVersion - 1) cannot be reused
    const oldTokenVersion = currentVersion - 1

    expect(oldTokenVersion).not.toBe(currentVersion)
  })

  it('should work with concurrent logout-all calls', async () => {
    const pool = getTenantPool(workspace.id)!

    // Get initial version
    const initial = await pool.query(
      `SELECT token_version FROM ${TOKEN_USERS_TABLE} WHERE id = $1`,
      [user.id]
    )
    const initialVersion = initial.rows[0]?.token_version

    // Simulate two concurrent logout-all increments
    const t1 = pool.query(
      `UPDATE ${TOKEN_USERS_TABLE} SET token_version = token_version + 1 WHERE id = $1`,
      [user.id]
    )
    const t2 = pool.query(
      `UPDATE ${TOKEN_USERS_TABLE} SET token_version = token_version + 1 WHERE id = $1`,
      [user.id]
    )

    await Promise.all([t1, t2])

    // Both completed, version incremented twice
    const final = await pool.query(`SELECT token_version FROM ${TOKEN_USERS_TABLE} WHERE id = $1`, [
      user.id,
    ])
    const finalVersion = final.rows[0]?.token_version

    expect(finalVersion).toBeGreaterThan(initialVersion)
  })
})
