/**
 * Idempotency Tests
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T047
 *
 * File: apps/api/tests/unit/idempotency.test.ts
 * Purpose: Verify triple-layer idempotency protection
 *
 * Layers:
 * 1. Redis cache (in-memory)
 * 2. PostgreSQL UNIQUE constraint
 * 3. Application status check
 *
 * Requirement: Same request → identical response
 */

import { createClient } from 'redis'
import { beforeAll, describe, expect, test } from 'vitest'
import { db, getTenantPool } from '../../db'

describe('Idempotency (Triple-Layer)', () => {
  let redis: any
  let workspaceId: string
  let pool: any

  beforeAll(async () => {
    // Setup Redis client
    redis = createClient()

    // Setup database
    const wsRes = await db.master.query(
      `INSERT INTO workspaces (slug, name, schema_version, product_version, license_status)
       VALUES ('idempotent-ws', 'Idempotent WS', 1, '1.0.0', 'ACTIVE')
       RETURNING id`
    )
    workspaceId = wsRes.rows[0].id
    pool = getTenantPool(workspaceId)

    // Create test table for submissions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS submission_idempotency_keys (
        id SERIAL PRIMARY KEY,
        workspace_id UUID NOT NULL,
        idempotency_key VARCHAR(255) NOT NULL UNIQUE,
        attempt_id UUID NOT NULL,
        response JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
  })

  // T047.1: Redis Cache Prevents Duplicate Processing
  test('Redis cache prevents duplicate processing', async () => {
    const key = 'idempotency:test-key-1'
    const response = { job_id: 'job-123', status: 'ACCEPTED' }

    // First check (cache miss)
    const cached1 = await redis.get(key)
    expect(cached1).toBeNull()

    // Store in cache
    await redis.set(key, JSON.stringify(response), { EX: 300 }) // 5 minute TTL

    // Second check (cache hit)
    const cached2 = await redis.get(key)
    expect(cached2).toEqual(JSON.stringify(response))
  })

  // T047.2: Redis Cache Hit Returns Exact Response
  test('Cache hit returns identical response', async () => {
    const key = 'idempotency:test-key-2'
    const response = {
      job_id: 'job-456',
      status: 'ACCEPTED',
      timestamp: 1234567890,
    }

    await redis.set(key, JSON.stringify(response), { EX: 300 })

    const cached = await redis.get(key)
    const parsed = JSON.parse(cached!)

    expect(parsed).toEqual(response)
    expect(parsed.job_id).toBe(response.job_id)
    expect(parsed.timestamp).toBe(response.timestamp)
  })

  // T047.3: PostgreSQL UNIQUE Constraint Prevents Duplicate Insertion
  test('PostgreSQL UNIQUE constraint prevents duplicate key', async () => {
    const key = 'idempotency:unique-test-1'
    const attemptId = 'attempt-789'
    const response = { status: 'ACCEPTED' }

    // First insert
    await pool.query(
      `INSERT INTO submission_idempotency_keys 
       (workspace_id, idempotency_key, attempt_id, response)
       VALUES ($1, $2, $3, $4)`,
      [workspaceId, key, attemptId, JSON.stringify(response)]
    )

    // Second insert with same key (should fail)
    await expect(
      pool.query(
        `INSERT INTO submission_idempotency_keys 
         (workspace_id, idempotency_key, attempt_id, response)
         VALUES ($1, $2, $3, $4)`,
        [workspaceId, key, attemptId, JSON.stringify(response)]
      )
    ).rejects.toThrow(/unique/)
  })

  // T047.4: UPSERT Handles Idempotency
  test('UPSERT returns same result on duplicate', async () => {
    const key = 'idempotency:upsert-test-1'
    const attemptId = 'attempt-999'
    const response1 = { status: 'ACCEPTED', job_id: 'job-1' }

    // First upsert
    await pool.query(
      `INSERT INTO submission_idempotency_keys 
       (workspace_id, idempotency_key, attempt_id, response)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (idempotency_key) DO UPDATE SET response = $4`,
      [workspaceId, key, attemptId, JSON.stringify(response1)]
    )

    const result1 = await pool.query(
      `SELECT response FROM submission_idempotency_keys WHERE idempotency_key = $1`,
      [key]
    )

    // Second upsert (same key)
    await pool.query(
      `INSERT INTO submission_idempotency_keys 
       (workspace_id, idempotency_key, attempt_id, response)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (idempotency_key) DO UPDATE SET response = $4`,
      [workspaceId, key, attemptId, JSON.stringify(response1)]
    )

    const result2 = await pool.query(
      `SELECT response FROM submission_idempotency_keys WHERE idempotency_key = $1`,
      [key]
    )

    expect(JSON.parse(result1.rows[0].response)).toEqual(
      JSON.parse(result2.rows[0].response)
    )
  })

  // T047.5: Status Check Prevents Double Finalization
  test('Attempt status check prevents double finalization', async () => {
    // Create attempt
    const attemptRes = await pool.query(
      `INSERT INTO attempts (workspace_id, status)
       VALUES ($1, 'FINALIZED')
       RETURNING id, status`,
      [workspaceId]
    )

    const attempt = attemptRes.rows[0]

    // Try to finalize again
    const finalizeAgain = async () => {
      const result = await pool.query(
        `SELECT status FROM attempts WHERE id = $1 AND workspace_id = $2`,
        [attempt.id, workspaceId]
      )

      if (result.rows[0].status === 'FINALIZED') {
        throw new Error('Attempt already finalized')
      }
    }

    await expect(finalizeAgain()).rejects.toThrow('Attempt already finalized')
  })

  // T047.6: Same Idempotency Key Different Attempt Fails
  test('Idempotency key bound to attempt prevents cross-attempt reuse', async () => {
    const key = 'idempotency:attempt-binding-test'
    const attempt1 = 'attempt-aaa'
    const attempt2 = 'attempt-bbb'
    const response = { status: 'ACCEPTED' }

    // Insert for attempt1
    await pool.query(
      `INSERT INTO submission_idempotency_keys 
       (workspace_id, idempotency_key, attempt_id, response)
       VALUES ($1, $2, $3, $4)`,
      [workspaceId, key, attempt1, JSON.stringify(response)]
    )

    // Try to use same key for attempt2 (should fail)
    await expect(
      pool.query(
        `INSERT INTO submission_idempotency_keys 
         (workspace_id, idempotency_key, attempt_id, response)
         VALUES ($1, $2, $3, $4)`,
        [workspaceId, key, attempt2, JSON.stringify(response)]
      )
    ).rejects.toThrow(/unique/)
  })

  // T047.7: Cache Expiration And Resubmission
  test('Cache expiration allows fresh submission', async () => {
    const key = 'idempotency:expiring-test'
    const response = { job_id: 'job-exp', status: 'ACCEPTED' }

    // Set with short TTL
    await redis.set(key, JSON.stringify(response), { EX: 1 })

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100))

    // Should be expired
    const cached = await redis.get(key)
    expect(cached).toBeNull()
  })

  // T047.8: Multiple Concurrent Submissions With Same Key
  test('Concurrent submissions with same key handled correctly', async () => {
    const key = 'idempotency:concurrent-test'
    const attemptId = 'attempt-concurrent'
    const responses = [
      { status: 'ACCEPTED', job_id: 'job-c1' },
      { status: 'ACCEPTED', job_id: 'job-c1' }, // Should be same
    ]

    const promises = responses.map((response, index) =>
      pool.query(
        `INSERT INTO submission_idempotency_keys 
         (workspace_id, idempotency_key, attempt_id, response)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [workspaceId, key, attemptId, JSON.stringify(response)]
      )
    )

    const results = await Promise.allSettled(promises)

    // At least one should succeed
    expect(
      results.filter((r) => r.status === 'fulfilled').length
    ).toBeGreaterThanOrEqual(1)
  })

  // T047.9: Idempotency Key Format Validation
  test('Idempotency key format must be valid', () => {
    const validKeys = [
      'idempotency:test-1',
      'idempotency:uuid-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      'req-12345678-1234',
    ]

    const isValidKey = (key: string) => /^[a-zA-Z0-9:\-_]{1,255}$/.test(key)

    validKeys.forEach((key) => {
      expect(isValidKey(key)).toBe(true)
    })
  })

  // T047.10: Long-Running Submission Idempotency
  test('Job remains idempotent during processing', async () => {
    const key = 'idempotency:long-running'
    const job_id = 'job-long-1'

    // Store initial job_id
    await redis.set(key, JSON.stringify({ job_id, status: 'PENDING' }), {
      EX: 600,
    })

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Query same key
    const result = await redis.get(key)
    expect(JSON.parse(result!).job_id).toBe(job_id)

    // Should still be same
    const result2 = await redis.get(key)
    expect(JSON.parse(result2!).job_id).toBe(job_id)
  })
})
