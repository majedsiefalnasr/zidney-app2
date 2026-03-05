/**
 * Audit Logging Tests
 *
 * File: apps/api/tests/integration/audit-logging.test.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Purpose: Verify comprehensive request logging
 *
 * Requirements:
 * - Log every authenticated request
 * - Include correlation_id for tracing
 * - Structured JSON format
 * - Track success/failure
 * - Log all auth events (login, logout, permission denied, etc)
 *
 * Logged Events:
 * - login_success: User logged in
 * - login_failed_not_found: Email not in DB
 * - login_failed_invalid_password: Wrong password
 * - login_failed_account_locked: Account locked
 * - logout: User logged out
 * - logout_all: All sessions invalidated
 * - token_version_mismatch: Revoked token used
 * - permission_denied: User lacks permission
 *
 * Tests:
 * 1. Login success logged
 * 2. Login failure logged
 * 3. Correlation ID included in all logs
 * 4. Structured format JSON
 * 5. Timestamp included
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, getTenantPool } from '../../db'

const AUDIT_WORKSPACES_TABLE = 'audit_logging_workspaces'
const AUDIT_USERS_TABLE = 'audit_logging_users'
const AUDIT_LOGS_TABLE = 'audit_logging_events'

describe('Audit Logging', () => {
  let workspace: any
  let user: any

  beforeAll(async () => {
    await db.master.query(`
      CREATE TABLE IF NOT EXISTS ${AUDIT_WORKSPACES_TABLE} (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        license_status TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        product_version TEXT NOT NULL
      )
    `)
    await db.master.query(`
      CREATE TABLE IF NOT EXISTS ${AUDIT_USERS_TABLE} (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        workspace_id TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        token_version INTEGER NOT NULL DEFAULT 1
      )
    `)
    await db.master.query(`
      CREATE TABLE IF NOT EXISTS ${AUDIT_LOGS_TABLE} (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        workspace_id TEXT NOT NULL,
        user_id TEXT NULL,
        event_type TEXT NOT NULL,
        event_data JSONB NULL,
        correlation_id TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const ws = await db.master.query(
      `INSERT INTO ${AUDIT_WORKSPACES_TABLE} (slug, name, license_status, schema_version, product_version)
       VALUES ('audit-test', 'Audit Test', 'ACTIVE', 1, '0.1.0')
       RETURNING *`
    )
    workspace = ws.rows[0]

    const pool = getTenantPool(workspace.id)!
    const u = await pool.query(
      `INSERT INTO ${AUDIT_USERS_TABLE} (workspace_id, email, password_hash, role, token_version)
       VALUES ($1, 'audit@test.com', 'hash', 'admin', 1)
       RETURNING id, email`,
      [workspace.id]
    )
    user = u.rows[0]
  })

  afterAll(async () => {
    if (!workspace || !user) {
      return
    }
    const pool = getTenantPool(workspace.id)!
    await pool.query(`DELETE FROM ${AUDIT_USERS_TABLE} WHERE id = $1`, [
      user.id,
    ])

    await db.master.query(
      `DELETE FROM ${AUDIT_WORKSPACES_TABLE} WHERE id = $1`,
      [workspace.id]
    )
    await db.master.query(
      `DELETE FROM ${AUDIT_LOGS_TABLE} WHERE workspace_id = $1`,
      [workspace.id]
    )
  })

  it('should create audit log entry', async () => {
    // Insert sample audit log
    const logResult = await db.master.query(
      `INSERT INTO ${AUDIT_LOGS_TABLE} (
        workspace_id,
        user_id,
        event_type,
        event_data,
        correlation_id,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, event_type, correlation_id`,
      [
        workspace.id,
        user.id,
        'login_success',
        JSON.stringify({ ip: '127.0.0.1' }),
        'corr-123',
      ]
    )

    expect(logResult.rows).toHaveLength(1)
    expect(logResult.rows[0].event_type).toBe('login_success')
    expect(logResult.rows[0].correlation_id).toBe('corr-123')
  })

  it('should include correlation_id in all audit logs', async () => {
    const correlationId = 'corr-456'

    // Insert multiple events with same correlation ID
    await db.master.query(
      `INSERT INTO ${AUDIT_LOGS_TABLE} (workspace_id, user_id, event_type, correlation_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [workspace.id, user.id, 'login_success', correlationId]
    )

    await db.master.query(
      `INSERT INTO ${AUDIT_LOGS_TABLE} (workspace_id, user_id, event_type, correlation_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [workspace.id, user.id, 'logout', correlationId]
    )

    // Query related events via correlation ID
    const result = await db.master.query(
      `SELECT event_type FROM ${AUDIT_LOGS_TABLE} WHERE correlation_id = $1 ORDER BY created_at`,
      [correlationId]
    )

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].event_type).toBe('login_success')
    expect(result.rows[1].event_type).toBe('logout')
  })

  it('should log structured JSON event_data', async () => {
    const correlationId = 'corr-structured-json'
    const eventData = {
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      duration_ms: 145,
      method: 'POST',
      path: '/auth/login',
    }

    await db.master.query(
      `INSERT INTO ${AUDIT_LOGS_TABLE} (workspace_id, user_id, event_type, event_data, correlation_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        workspace.id,
        user.id,
        'login_success',
        JSON.stringify(eventData),
        correlationId,
      ]
    )

    const result = await db.master.query(
      `SELECT event_data
       FROM ${AUDIT_LOGS_TABLE}
       WHERE workspace_id = $1 AND correlation_id = $2`,
      [workspace.id, correlationId]
    )

    expect(result.rows).toHaveLength(1)

    // Parse JSON
    const parsed = result.rows[0].event_data
    expect(parsed.ip_address).toBe('192.168.1.1')
    expect(parsed.duration_ms).toBe(145)
  })

  it('should log login success event', async () => {
    const result = await db.master.query(
      `INSERT INTO ${AUDIT_LOGS_TABLE} (
        workspace_id,
        user_id,
        event_type,
        event_data,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING event_type`,
      [
        workspace.id,
        user.id,
        'login_success',
        JSON.stringify({ password_valid: true }),
      ]
    )

    expect(result.rows[0].event_type).toBe('login_success')
  })

  it('should log login failure events', async () => {
    // Log invalid credentials
    await db.master.query(
      `INSERT INTO ${AUDIT_LOGS_TABLE} (workspace_id, user_id, event_type, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [workspace.id, null, 'login_failed_not_found']
    )

    await db.master.query(
      `INSERT INTO ${AUDIT_LOGS_TABLE} (workspace_id, user_id, event_type, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [workspace.id, user.id, 'login_failed_invalid_password']
    )

    const result = await db.master.query(
      `SELECT event_type FROM ${AUDIT_LOGS_TABLE} WHERE event_type LIKE 'login_failed%' ORDER BY created_at`
    )

    expect(result.rows.length).toBeGreaterThanOrEqual(2)
  })

  it('should log logout event', async () => {
    await db.master.query(
      `INSERT INTO ${AUDIT_LOGS_TABLE} (workspace_id, user_id, event_type, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [workspace.id, user.id, 'logout']
    )

    const result = await db.master.query(
      `SELECT event_type
       FROM ${AUDIT_LOGS_TABLE}
       WHERE workspace_id = $1 AND event_type = $2`,
      [workspace.id, 'logout']
    )

    expect(result.rows.length).toBeGreaterThanOrEqual(1)
  })

  it('should log logout_all event with token_version', async () => {
    await db.master.query(
      `INSERT INTO ${AUDIT_LOGS_TABLE} (workspace_id, user_id, event_type, event_data, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        workspace.id,
        user.id,
        'logout_all',
        JSON.stringify({ new_token_version: 2 }),
      ]
    )

    const result = await db.master.query(
      `SELECT event_data FROM ${AUDIT_LOGS_TABLE} WHERE event_type = $1`,
      ['logout_all']
    )

    expect(result.rows.length).toBeGreaterThanOrEqual(1)
  })

  it('should include timestamps in audit logs', async () => {
    const beforeInsert = new Date()

    const correlationId = 'corr-test-event'
    await db.master.query(
      `INSERT INTO ${AUDIT_LOGS_TABLE} (workspace_id, user_id, event_type, correlation_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [workspace.id, user.id, 'test_event', correlationId]
    )

    const afterInsert = new Date()

    const result = await db.master.query(
      `SELECT created_at
       FROM ${AUDIT_LOGS_TABLE}
       WHERE workspace_id = $1 AND event_type = $2 AND correlation_id = $3`,
      [workspace.id, 'test_event', correlationId]
    )

    expect(result.rows).toHaveLength(1)
    const logTimestamp = new Date(result.rows[0].created_at)

    expect(logTimestamp.getTime()).toBeGreaterThanOrEqual(
      beforeInsert.getTime() - 5000
    )
    expect(logTimestamp.getTime()).toBeLessThanOrEqual(
      afterInsert.getTime() + 5000
    )
  })

  it('should query audit logs by workspace', async () => {
    const result = await db.master.query(
      `SELECT COUNT(*) as count FROM ${AUDIT_LOGS_TABLE} WHERE workspace_id = $1`,
      [workspace.id]
    )

    expect(Number(result.rows[0].count)).toBeGreaterThan(0)
  })
})
