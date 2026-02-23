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
import { createLogger } from '../../src/utils/logger'

const logger = createLogger('AuditTrailIntegrationTest')

describe('Audit Trail Integration Tests (T032)', () => {
  let pool: Pool
  let examId: string
  let userId: string
  let attemptId: string

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'zidney_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    })

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
      expect(error.code).toBe('23514') // CHECK constraint violation
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
