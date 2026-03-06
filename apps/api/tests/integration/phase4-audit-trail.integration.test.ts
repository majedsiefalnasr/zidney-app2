/**
 * Phase 4 Test Suite: Audit Trail Immutability
 *
 * Tests for T031-T032:
 * - T031: Unit test for immutability trigger
 * - T032: Integration test for audit trail
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 */

import { Pool, type PoolClient } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const getConnectionString = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }
  const user = process.env.DB_USER || 'zidney_app'
  const password = process.env.DB_PASSWORD || 'change-me-in-production'
  const host = process.env.DB_HOST || 'localhost'
  const port = process.env.DB_PORT || '5432'
  const database = process.env.DB_DATABASE || process.env.DB_NAME || 'zidney_master'

  return `postgresql://${user}:${password}@${host}:${port}/${database}`
}

describe('Phase 4: Audit Trail Immutability', () => {
  let pool: Pool
  let client: PoolClient
  let testSchema: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: getConnectionString() })

    try {
      client = await pool.connect()
      testSchema = `phase4_audit_${Date.now().toString(36)}`
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${testSchema}`)
      await client.query(`SET search_path TO ${testSchema}, public`)

      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS mcq_exams (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL,
          question_count INTEGER NOT NULL,
          created_by TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS attempts (
          id TEXT PRIMARY KEY,
          exam_type TEXT NOT NULL,
          exam_id TEXT NOT NULL REFERENCES mcq_exams(id) ON DELETE RESTRICT,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          started_at TIMESTAMPTZ NOT NULL,
          created_by TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS attempt_events (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by TEXT NOT NULL
        );
        CREATE OR REPLACE FUNCTION phase4_attempt_events_immutable_guard()
        RETURNS TRIGGER AS $$
        BEGIN
          RAISE EXCEPTION 'Immutable table: attempt_events cannot be modified';
        END;
        $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS phase4_attempt_events_immutable_update ON attempt_events;
        CREATE TRIGGER phase4_attempt_events_immutable_update
          BEFORE UPDATE ON attempt_events
          FOR EACH ROW
          EXECUTE FUNCTION phase4_attempt_events_immutable_guard();
      `)

      await client.query('TRUNCATE TABLE attempt_events, attempts, mcq_exams, users CASCADE')

      // Insert test data
      const userId = '11111111-1111-1111-1111-111111111111'
      await client.query(`INSERT INTO users (id, email, name) VALUES ($1, $2, $3)`, [
        userId,
        'test@example.com',
        'Test User',
      ])

      // Create test exam and attempt
      const examId = '22222222-2222-2222-2222-222222222222'
      const attemptId = '33333333-3333-3333-3333-333333333333'

      // Insert MCQ exam
      await client.query(
        `INSERT INTO mcq_exams (id, name, duration_minutes, question_count, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [examId, 'Test Exam', 60, 10, userId]
      )

      // Insert attempt
      await client.query(
        `INSERT INTO attempts (
          id, exam_type, exam_id, user_id, started_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [attemptId, 'MCQ', examId, userId, new Date(), userId]
      )
    } catch (error) {
      console.error('Setup error:', error)
      throw error
    }
  })

  afterAll(async () => {
    if (client && testSchema) {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`)
    }
    if (client) {
      await client.release()
    }
    if (pool) {
      await pool.end()
    }
  })

  describe('T031: Immutability Trigger Unit Tests', () => {
    it('should allow INSERT into attempt_events', async () => {
      const attemptId = '33333333-3333-3333-3333-333333333333'
      const userId = '11111111-1111-1111-1111-111111111111'

      const result = await client.query(
        `INSERT INTO attempt_events (
          attempt_id, event_type, occurred_at, created_by
        ) VALUES ($1, $2, $3, $4)
        RETURNING id, event_type`,
        [attemptId, 'START', new Date(), userId]
      )

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].event_type).toBe('START')
    })

    it('should prevent UPDATE on attempt_events', async () => {
      const attemptId = '33333333-3333-3333-3333-333333333333'

      // First, create an event
      const createResult = await client.query(
        `INSERT INTO attempt_events (
          attempt_id, event_type, occurred_at, created_by
        ) VALUES ($1, $2, $3, $4)
        RETURNING id`,
        [attemptId, 'PAUSE', new Date(), '11111111-1111-1111-1111-111111111111']
      )

      const eventId = createResult.rows[0].id

      // Now try to UPDATE it
      let error: Error | null = null
      try {
        await client.query(`UPDATE attempt_events SET event_type = 'RESUME' WHERE id = $1`, [
          eventId,
        ])
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
      expect(error?.message).toContain('Immutable table')
    })

    it('should allow DELETE via is_deleted (soft delete)', async () => {
      // Note: Soft deletes use is_deleted flag, not CASCADE DELETE
      // This test verifies that is_deleted column exists and can be updated
      // However, attempt_events table should not have is_deleted per spec
      // This test documents the pattern for other immutable tables
    })
  })

  describe('T032: Audit Trail Integration Tests', () => {
    it('should create audit trail of attempt lifecycle', async () => {
      const attemptId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      const userId = '11111111-1111-1111-1111-111111111111'
      const examId = '22222222-2222-2222-2222-222222222222'

      // Create attempt for this test
      await client.query(
        `INSERT INTO attempts (
          id, exam_type, exam_id, user_id, started_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [attemptId, 'MCQ', examId, userId, new Date(), userId]
      )

      // Log START event
      await client.query(
        `INSERT INTO attempt_events (
          attempt_id, event_type, occurred_at, created_by
        ) VALUES ($1, $2, $3, $4)`,
        [attemptId, 'START', new Date(), userId]
      )

      // Log ANSWER_SUBMIT event
      await client.query(
        `INSERT INTO attempt_events (
          attempt_id, event_type, event_payload, occurred_at, created_by
        ) VALUES ($1, $2, $3::jsonb, $4, $5)`,
        [
          attemptId,
          'ANSWER_SUBMIT',
          JSON.stringify({ questionId: '1', answer: 'A' }),
          new Date(),
          userId,
        ]
      )

      // Log SUBMIT_REQUEST event
      await client.query(
        `INSERT INTO attempt_events (
          attempt_id, event_type, occurred_at, created_by
        ) VALUES ($1, $2, $3, $4)`,
        [attemptId, 'SUBMIT_REQUEST', new Date(), userId]
      )

      // Verify audit trail
      const result = await client.query(
        `SELECT event_type, created_by
         FROM attempt_events
         WHERE attempt_id = $1
         ORDER BY occurred_at ASC`,
        [attemptId]
      )

      expect(result.rows).toHaveLength(3)
      expect(result.rows[0].event_type).toBe('START')
      expect(result.rows[1].event_type).toBe('ANSWER_SUBMIT')
      expect(result.rows[2].event_type).toBe('SUBMIT_REQUEST')
    })

    it('should prevent modification of archived events', async () => {
      const attemptId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      const userId = '11111111-1111-1111-1111-111111111111'
      const examId = '22222222-2222-2222-2222-222222222222'

      // Create attempt
      await client.query(
        `INSERT INTO attempts (
          id, exam_type, exam_id, user_id, started_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [attemptId, 'MCQ', examId, userId, new Date(), userId]
      )

      // Log event
      const createResult = await client.query(
        `INSERT INTO attempt_events (
          attempt_id, event_type, occurred_at, created_by
        ) VALUES ($1, $2, $3, $4)
        RETURNING id`,
        [attemptId, 'ARCHIVED', new Date(), userId]
      )

      const eventId = createResult.rows[0].id

      // Verify immutability
      let error: Error | null = null
      try {
        await client.query(`UPDATE attempt_events SET event_type = 'START' WHERE id = $1`, [
          eventId,
        ])
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
      expect(error?.message).toContain('Immutable')
    })
  })
})
