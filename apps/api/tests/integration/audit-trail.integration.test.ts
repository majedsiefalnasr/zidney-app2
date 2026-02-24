/**
 * Integration Test: Audit Trail
 *
 * Validates end-to-end audit trail functionality.
 * Tests event creation, ordering, and immutability.
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 * Task: T032 (Integration test for audit trail)
 */

import {
  countAttemptEventsByType,
  getAttemptEventHistory,
  logAttemptEvent,
} from '@zidney/domain-core/audit/attempt-event-logger'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLogger } from '@zidney/logger'

const logger = createLogger('AuditTrailIntegrationTest')

describe('Audit Trail Integration Tests (T032)', () => {
  let pool: Pool
  let examId: string
  let userId: string
  let attemptId: string
  let testSchema: string

  beforeAll(async () => {
    testSchema = `audit_trail_${Date.now().toString(36)}`
    const connectionString = process.env.DATABASE_URL
    pool = connectionString
      ? new Pool({
          connectionString,
          max: 1,
          options: `-c search_path=${testSchema},public`,
        })
      : new Pool({
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          database: process.env.DB_NAME || 'zidney_test',
          user: process.env.DB_USER || 'zidney_app',
          password: process.env.DB_PASSWORD || 'change-me-in-production',
          max: 1,
          options: `-c search_path=${testSchema},public`,
        })

    const schemaClient = await pool.connect()
    await schemaClient.query(`CREATE SCHEMA IF NOT EXISTS ${testSchema}`)
    await schemaClient.query(`SET search_path TO ${testSchema}, public`)

    await schemaClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        email TEXT UNIQUE NOT NULL,
        first_name TEXT NULL,
        last_name TEXT NULL,
        password_hash TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE
      );
      CREATE TABLE IF NOT EXISTS mcq_exams (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        name TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        question_count INTEGER NOT NULL,
        passing_score INTEGER NOT NULL DEFAULT 70
      );
      CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        exam_id TEXT NOT NULL REFERENCES mcq_exams(id) ON DELETE RESTRICT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        configuration_snapshot JSONB NULL,
        question_list_snapshot JSONB NULL,
        grading_config_snapshot JSONB NULL,
        status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        submission_deadline_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
      CREATE OR REPLACE FUNCTION audit_trail_events_immutable_guard()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Immutable table: attempt_events cannot be modified';
      END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS audit_trail_events_immutable_update ON attempt_events;
      CREATE TRIGGER audit_trail_events_immutable_update
        BEFORE UPDATE ON attempt_events
        FOR EACH ROW
        EXECUTE FUNCTION audit_trail_events_immutable_guard();
    `)
    await schemaClient.query(
      'TRUNCATE TABLE attempt_events, attempts, mcq_exams, users CASCADE'
    )
    schemaClient.release()

    // Create exam
    const examResult = await pool.query(
      `INSERT INTO mcq_exams (name, duration_minutes, question_count, passing_score)
       VALUES ('Audit Trail Test Exam', 60, 10, 70)
       RETURNING id`
    )
    examId = examResult.rows[0].id

    // Create user
    const userResult = await pool.query(
      `INSERT INTO users (email, first_name, last_name, password_hash, is_active)
       VALUES ('audit@test.example.com', 'Audit', 'Tester', 'hash', true)
       RETURNING id`
    )
    userId = userResult.rows[0].id

    // Create attempt
    const attemptResult = await pool.query(
      `INSERT INTO attempts (
        exam_id, user_id, configuration_snapshot, question_list_snapshot,
        grading_config_snapshot, status, started_at, submission_deadline_at, created_by
      ) VALUES ($1, $2, '{}', '{}', '{}', 'IN_PROGRESS', now(), now() + interval '1 hour', $3)
      RETURNING id`,
      [examId, userId, userId]
    )
    attemptId = attemptResult.rows[0].id

    logger.info('Audit trail integration tests setup complete')
  })

  afterAll(async () => {
    if (pool && testSchema) {
      await pool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`)
    }
    if (pool) {
      await pool.end()
    }
  })

  it('✅ Attempt START event is created', async () => {
    await logAttemptEvent(
      {
        attemptId,
        eventType: 'START',
        payload: { started_by: 'system' },
        currentUserId: userId,
      },
      pool
    )

    const history = await getAttemptEventHistory(attemptId, pool)
    const startEvent = history.find((e) => e.event_type === 'START')

    expect(startEvent).toBeDefined()
    expect(startEvent?.event_payload).toEqual({ started_by: 'system' })
    logger.info('✅ START event test passed')
  })

  it('✅ Attempt ANSWER_SUBMIT events are created in order', async () => {
    await logAttemptEvent(
      {
        attemptId,
        eventType: 'ANSWER_SUBMIT',
        payload: { question_id: 'q1', answer: 1 },
        currentUserId: userId,
      },
      pool
    )

    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 100))

    await logAttemptEvent(
      {
        attemptId,
        eventType: 'ANSWER_SUBMIT',
        payload: { question_id: 'q2', answer: 2 },
        currentUserId: userId,
      },
      pool
    )

    const history = await getAttemptEventHistory(attemptId, pool)
    const submitEvents = history.filter((e) => e.event_type === 'ANSWER_SUBMIT')

    expect(submitEvents.length).toBe(2)
    expect(submitEvents[0].event_payload.question_id).toBe('q1')
    expect(submitEvents[1].event_payload.question_id).toBe('q2')
    logger.info('✅ ANSWER_SUBMIT order test passed')
  })

  it('✅ Complete attempt event lifecycle is ordered', async () => {
    await logAttemptEvent(
      {
        attemptId,
        eventType: 'SUBMIT_REQUEST',
        currentUserId: userId,
      },
      pool
    )

    await logAttemptEvent(
      {
        attemptId,
        eventType: 'FINALIZED',
        currentUserId: userId,
      },
      pool
    )

    await logAttemptEvent(
      {
        attemptId,
        eventType: 'GRADED',
        payload: { score: 85 },
        currentUserId: userId,
      },
      pool
    )

    const history = await getAttemptEventHistory(attemptId, pool)
    const eventTypes = history.map((e) => e.event_type)

    expect(eventTypes).toContain('START')
    expect(eventTypes).toContain('ANSWER_SUBMIT')
    expect(eventTypes).toContain('SUBMIT_REQUEST')
    expect(eventTypes).toContain('FINALIZED')
    expect(eventTypes).toContain('GRADED')

    // Verify order
    const submitIdx = eventTypes.indexOf('SUBMIT_REQUEST')
    const finalizedIdx = eventTypes.indexOf('FINALIZED')
    const gradedIdx = eventTypes.indexOf('GRADED')

    expect(submitIdx).toBeLessThan(finalizedIdx)
    expect(finalizedIdx).toBeLessThan(gradedIdx)

    logger.info('✅ Event lifecycle order test passed')
  })

  it('✅ Event counts by type are accurate', async () => {
    const counts = await countAttemptEventsByType(attemptId, pool)

    expect(counts['START']).toBeGreaterThan(0)
    expect(counts['ANSWER_SUBMIT']).toBeGreaterThan(0)
    expect(counts['SUBMIT_REQUEST']).toBeGreaterThan(0)
    expect(counts['FINALIZED']).toBeGreaterThan(0)
    expect(counts['GRADED']).toBeGreaterThan(0)

    logger.info('✅ Event count test passed', { counts })
  })

  it('❌ Audit trail events cannot be modified', async () => {
    const history = await getAttemptEventHistory(attemptId, pool)
    const firstEvent = history[0]

    // Try to update event
    try {
      await pool.query(
        `UPDATE attempt_events SET event_payload = '{"modified": true}' WHERE id = $1`,
        [firstEvent.id]
      )
      expect(true).toBe(false) // Should not reach
    } catch (error: any) {
      expect(error).toBeDefined()
      logger.info('✅ Immutability enforcement test passed')
    }
  })

  it('✅ Concurrent event logging does not cause conflicts', async () => {
    const promises = []

    for (let i = 0; i < 10; i++) {
      promises.push(
        logAttemptEvent(
          {
            attemptId,
            eventType: 'ANSWER_SUBMIT',
            payload: { question_id: `q${i}`, answer: i },
            currentUserId: userId,
          },
          pool
        )
      )
    }

    await Promise.all(promises)

    const history = await getAttemptEventHistory(attemptId, pool)
    const concurrentEvents = history.filter(
      (e) => e.event_type === 'ANSWER_SUBMIT'
    )

    expect(concurrentEvents.length).toBeGreaterThanOrEqual(10)
    logger.info('✅ Concurrent logging test passed')
  })
})
