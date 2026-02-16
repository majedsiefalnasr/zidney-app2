/**
 * Unit Tests: Immutability Trigger
 *
 * Validates that attempt_events table enforces immutability.
 * INSERT allowed, UPDATE blocked, DELETE allowed.
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 * Task: T031 (Unit test for immutability trigger)
 */

import { createLogger } from '@zidney/logging'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const logger = createLogger('ImmutabilityTriggerTest')

describe('Immutability Trigger Tests (T031)', () => {
  let pool: Pool
  let attemptId: string

  beforeAll(async () => {
    // Setup test database
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'zidney_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    })

    logger.info('Immutability trigger tests starting')
  })

  afterAll(async () => {
    if (pool) {
      await pool.end()
    }
  })

  beforeEach(async () => {
    // Create test exam
    const examResult = await pool.query(
      `INSERT INTO mcq_exams (name, duration_minutes, question_count, passing_score)
       VALUES ('Immutability Test Exam', 60, 10, 70)
       RETURNING id`
    )

    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (email, first_name, last_name, password_hash, is_active)
       VALUES ('test@immutable.test', 'Test', 'User', 'hash', true)
       RETURNING id`
    )

    // Create test attempt
    const result = await pool.query(
      `INSERT INTO attempts (
        exam_id, user_id, configuration_snapshot, question_list_snapshot, 
        grading_config_snapshot, status, started_at, submission_deadline_at, created_by
      ) VALUES ($1, $2, '{}', '{}', '{}', 'IN_PROGRESS', now(), now() + interval '1 hour', $3)
      RETURNING id`,
      [examResult.rows[0].id, userResult.rows[0].id, userResult.rows[0].id]
    )

    attemptId = result.rows[0].id
  })

  it('✅ INSERT into attempt_events succeeds', async () => {
    const result = await pool.query(
      `INSERT INTO attempt_events (
        attempt_id, event_type, event_payload, occurred_at, created_at, created_by
      ) VALUES ($1, 'START', '{}', now(), now(), gen_random_uuid())
      RETURNING id`,
      [attemptId]
    )

    expect(result.rows.length).toBe(1)
    expect(result.rows[0].id).toBeDefined()
    logger.info('✅ INSERT test passed')
  })

  it('❌ UPDATE on attempt_events raises immutability violation', async () => {
    // Insert event first
    const insertResult = await pool.query(
      `INSERT INTO attempt_events (
        attempt_id, event_type, event_payload, occurred_at, created_at, created_by
      ) VALUES ($1, 'ANSWER_SUBMIT', '{"answer": 1}', now(), now(), gen_random_uuid())
      RETURNING id`,
      [attemptId]
    )

    const eventId = insertResult.rows[0].id

    // Try to update → should fail
    try {
      await pool.query(
        `UPDATE attempt_events SET event_payload = '{"answer": 2}' WHERE id = $1`,
        [eventId]
      )

      expect(true).toBe(false) // Should not reach here
    } catch (error: any) {
      expect(error.code).toBe('23514') // CHECK constraint violation
      logger.info('✅ UPDATE test passed - constraint enforced')
    }
  })

  it('✅ DELETE on attempt_events is allowed (soft delete)', async () => {
    // Insert event first
    const result = await pool.query(
      `INSERT INTO attempt_events (
        attempt_id, event_type, event_payload, occurred_at, created_at, created_by
      ) VALUES ($1, 'PAUSE', '{}', now(), now(), gen_random_uuid())
      RETURNING id`,
      [attemptId]
    )

    const eventId = result.rows[0].id

    // Should allow delete
    const deleteResult = await pool.query(
      `DELETE FROM attempt_events WHERE id = $1`,
      [eventId]
    )

    expect(deleteResult.rowCount).toBe(1)
    logger.info('✅ DELETE test passed')
  })

  it('✅ Multiple events can be inserted without interference', async () => {
    const insertCount = 5

    for (let i = 0; i < insertCount; i++) {
      await pool.query(
        `INSERT INTO attempt_events (
          attempt_id, event_type, event_payload, occurred_at, created_at, created_by
        ) VALUES ($1, 'ANSWER_SUBMIT', $2, now(), now(), gen_random_uuid())`,
        [attemptId, JSON.stringify({ answer: i })]
      )
    }

    // Verify all events exist
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM attempt_events WHERE attempt_id = $1`,
      [attemptId]
    )

    expect(parseInt(result.rows[0].count)).toBe(insertCount)
    logger.info('✅ Multiple INSERT test passed')
  })
})
