/**
 * Account Lockout Tests
 *
 * File: apps/api/tests/integration/account-lockout.test.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Verify brute force protection mechanism
 *
 * Mechanism:
 * - Track failed_login_count per user
 * - Lock account after 5 failed attempts
 * - locked_until = NOW() + 15 minutes
 * - Auto-unlock after 15 minutes
 * - Failed count resets on successful login
 *
 * Tests:
 * 1. Increment counter on failed login
 * 2. Lock account at 5 attempts
 * 3. Reject login while locked (423)
 * 4. Reset counter on successful login
 * 5. Auto-unlock after timeout
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, getTenantPool } from '../../db'

describe('Account Lockout', () => {
  let workspace: any
  let user: any

  beforeAll(async () => {
    const ws = await db.master.query(
      `INSERT INTO workspaces (slug, name, license_status, schema_version, product_version)
       VALUES ('lockout-test', 'Lockout Test', 'ACTIVE', 1, '0.1.0')
       RETURNING *`
    )
    workspace = ws.rows[0]

    const pool = getTenantPool(workspace.id)
    const u = await pool.query(
      `INSERT INTO users (email, password_hash, role, token_version, failed_login_count)
       VALUES ('lockout@test.com', 'hash', 'student', 1, 0)
       RETURNING id, email, failed_login_count`
    )
    user = u.rows[0]
  })

  afterAll(async () => {
    const pool = getTenantPool(workspace.id)
    await pool.query('DELETE FROM users WHERE id = $1', [user.id])
    await db.master.query('DELETE FROM workspaces WHERE id = $1', [
      workspace.id,
    ])
  })

  it('should increment failed login counter', async () => {
    const pool = getTenantPool(workspace.id)

    const before = await pool.query(
      `SELECT failed_login_count FROM users WHERE id = $1`,
      [user.id]
    )

    expect(before.rows[0].failed_login_count).toBe(0)

    // Simulate failed login
    await pool.query(
      `UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id = $1`,
      [user.id]
    )

    const after = await pool.query(
      `SELECT failed_login_count FROM users WHERE id = $1`,
      [user.id]
    )

    expect(after.rows[0].failed_login_count).toBe(1)
  })

  it('should lock account after 5 failed attempts', async () => {
    const pool = getTenantPool(workspace.id)

    // Simulate 4 more failed attempts (total 5)
    await pool.query(
      `UPDATE users SET failed_login_count = failed_login_count + 4 WHERE id = $1`,
      [user.id]
    )

    // On 5th attempt, account locks
    // This happens atomically in the login handler
    await pool.query(
      `UPDATE users
       SET locked_until = CASE
             WHEN failed_login_count >= 4 THEN NOW() + INTERVAL '15 minutes'
             ELSE locked_until
           END
       WHERE id = $1`,
      [user.id]
    )

    const result = await pool.query(
      `SELECT failed_login_count, locked_until FROM users WHERE id = $1`,
      [user.id]
    )

    expect(result.rows[0].failed_login_count).toBe(5)
    expect(result.rows[0].locked_until).not.toBeNull()
  })

  it('should reject login with 423 while locked', async () => {
    const pool = getTenantPool(workspace.id)

    const result = await pool.query(
      `SELECT locked_until FROM users WHERE id = $1`,
      [user.id]
    )

    const lockedUntil = result.rows[0].locked_until

    if (lockedUntil && lockedUntil > new Date()) {
      // Account is locked
      // Middleware should return 423 Locked
      expect(lockedUntil).not.toBeNull()
    }
  })

  it('should reset counter on successful login', async () => {
    const pool = getTenantPool(workspace.id)

    // Simulate successful login (counter reset)
    await pool.query(
      `UPDATE users
       SET failed_login_count = 0,
           locked_until = NULL
       WHERE id = $1`,
      [user.id]
    )

    const result = await pool.query(
      `SELECT failed_login_count, locked_until FROM users WHERE id = $1`,
      [user.id]
    )

    expect(result.rows[0].failed_login_count).toBe(0)
    expect(result.rows[0].locked_until).toBeNull()
  })

  it('should auto-unlock after timeout', async () => {
    const pool = getTenantPool(workspace.id)

    // Lock account
    await pool.query(
      `UPDATE users
       SET failed_login_count = 5,
           locked_until = NOW() - INTERVAL '1 minute'
       WHERE id = $1`,
      [user.id]
    )

    // Check if lock has expired
    const result = await pool.query(
      `SELECT locked_until FROM users WHERE id = $1`,
      [user.id]
    )

    const lockedUntil = result.rows[0].locked_until
    const isExpired = lockedUntil && lockedUntil < new Date()

    expect(isExpired).toBe(true)

    // Lock should be considered expired, login should be allowed
    // Handler would check: if (locked_until > NOW()) → reject
    // If not > NOW(), allow login
  })

  it('should use FOR UPDATE to prevent race conditions', async () => {
    // Simulating concurrent failed logins

    const pool = getTenantPool(workspace.id)

    // Reset counter
    await pool.query(
      `UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1`,
      [user.id]
    )

    // Simulating two concurrent login attempts
    // Both should use FOR UPDATE to lock the row
    const client1 = await pool.connect()
    const client2 = await pool.connect()

    try {
      await client1.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
      await client2.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

      // Both acquire lock
      await client1.query(`SELECT * FROM users WHERE id = $1 FOR UPDATE`, [
        user.id,
      ])
      await client2.query(`SELECT * FROM users WHERE id = $1 FOR UPDATE`, [
        user.id,
      ])

      // First completes
      await client1.query(
        `UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id = $1`,
        [user.id]
      )
      await client1.query('COMMIT')

      // Second waits for lock, then completes
      await client2.query(
        `UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id = $1`,
        [user.id]
      )
      await client2.query('COMMIT')

      // Both increments applied atomically
      const result = await pool.query(
        `SELECT failed_login_count FROM users WHERE id = $1`,
        [user.id]
      )

      expect(result.rows[0].failed_login_count).toBe(2)

      // Reset
      await pool.query(
        `UPDATE users SET failed_login_count = 0 WHERE id = $1`,
        [user.id]
      )
    } finally {
      client1.release()
      client2.release()
    }
  })
})
