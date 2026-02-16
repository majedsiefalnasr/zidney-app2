/**
 * Integration Test: Snapshot Immutability
 *
 * Validates that snapshots remain frozen after attempt creation.
 * Modifying exam after attempt start does not affect snapshot.
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 * Task: T038 (Integration test for snapshot immutability)
 */

import { initializeAttempt } from '@zidney/domain-core/src/attempts/attempt-init'
import { getAttemptSnapshot } from '@zidney/domain-core/src/attempts/snapshot-service'
import { createLogger } from '@zidney/logging'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const logger = createLogger('SnapshotImmutabilityTest')

describe('Snapshot Immutability Integration Tests (T038)', () => {
  let pool: Pool
  let examId: string
  let userId: string

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'zidney_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    })

    // Create user
    const userResult = await pool.query(
      `INSERT INTO users (email, first_name, last_name, password_hash, is_active)
       VALUES ('snapshot@test.example.com', 'Snapshot', 'Tester', 'hash', true)
       RETURNING id`
    )
    userId = userResult.rows[0].id

    logger.info('Snapshot immutability tests setup complete')
  })

  afterAll(async () => {
    if (pool) {
      await pool.end()
    }
  })

  it('✅ Modifying exam after attempt start does not affect snapshot', async () => {
    // Create exam
    const examResult = await pool.query(
      `INSERT INTO mcq_exams (name, duration_minutes, question_count, passing_score)
       VALUES ('Immutability Test Exam ' || now(), 60, 3, 70)
       RETURNING id`
    )
    examId = examResult.rows[0].id

    // Create attempt
    const attempt = await initializeAttempt({ examId, userId }, pool, userId)

    const originalSnapshot = await getAttemptSnapshot(attempt.id, pool)
    expect(originalSnapshot.config.question_count).toBe(3)

    // Modify exam (change question count, passing score)
    await pool.query(
      `UPDATE mcq_exams SET question_count = 5, passing_score = 80 WHERE id = $1`,
      [examId]
    )

    // Retrieve attempt snapshot again
    const unchangedSnapshot = await getAttemptSnapshot(attempt.id, pool)

    // Snapshot should remain unchanged
    expect(unchangedSnapshot.config.question_count).toBe(3)
    expect(unchangedSnapshot.config.passing_score).toBe(70)
    expect(JSON.stringify(unchangedSnapshot)).toBe(
      JSON.stringify(originalSnapshot)
    )

    logger.info('✅ Exam modification test passed - snapshot unchanged')
  })

  it('✅ Grading configuration snapshot is immutable', async () => {
    // Create exam
    const examResult = await pool.query(
      `INSERT INTO mcq_exams (name, duration_minutes, question_count, passing_score)
       VALUES ('Grading Immutability Exam ' || now(), 90, 15, 75)
       RETURNING id`
    )
    const testExamId = examResult.rows[0].id

    // Create attempt
    const attempt = await initializeAttempt(
      { examId: testExamId, userId },
      pool,
      userId
    )

    const originalSnapshot = await getAttemptSnapshot(attempt.id, pool)
    const originalGrading = JSON.stringify(originalSnapshot.grading)

    // Try to update grading config (should fail or be ignored)
    try {
      await pool.query(
        `UPDATE attempts SET grading_config_snapshot = '{"modified": true}' WHERE id = $1`,
        [attempt.id]
      )

      // If no error, verify snapshot wasn't actually changed
      const modifiedSnapshot = await getAttemptSnapshot(attempt.id, pool)
      expect(JSON.stringify(modifiedSnapshot.grading)).toBe(originalGrading)
    } catch (error: any) {
      // Expected: trigger prevents update
      expect(error.code).toBe('23514')
    }

    logger.info('✅ Grading immutability test passed')
  })

  it('✅ Configuration snapshot field values are persistent', async () => {
    // Create exam with specific values
    const examResult = await pool.query(
      `INSERT INTO mcq_exams (name, duration_minutes, question_count, passing_score)
       VALUES ('Config Persistence Exam', 45, 8, 65)
       RETURNING id`
    )
    const testExamId = examResult.rows[0].id

    // Create attempt
    const attempt = await initializeAttempt(
      { examId: testExamId, userId },
      pool,
      userId
    )

    // Retrieve at different times
    const snap1 = await getAttemptSnapshot(attempt.id, pool)
    await new Promise((r) => setTimeout(r, 1000))
    const snap2 = await getAttemptSnapshot(attempt.id, pool)

    // Snapshots should be identical
    expect(snap1.config.duration_minutes).toBe(45)
    expect(snap1.config.question_count).toBe(8)
    expect(snap1.config.passing_score).toBe(65)

    expect(JSON.stringify(snap1)).toBe(JSON.stringify(snap2))

    logger.info('✅ Configuration persistence test passed')
  })

  it('✅ Question order in snapshot is frozen at attempt start', async () => {
    // Create exam
    const examResult = await pool.query(
      `INSERT INTO mcq_exams (name, duration_minutes, question_count, passing_score)
       VALUES ('Question Order Exam ' || now(), 60, 5, 70)
       RETURNING id`
    )
    const testExamId = examResult.rows[0].id

    // Create attempt (captures question order)
    const attempt1 = await initializeAttempt(
      { examId: testExamId, userId },
      pool,
      userId
    )

    // Small delay
    await new Promise((r) => setTimeout(r, 100))

    // Create another attempt (captures new question order if exam changed)
    const userId2Result = await pool.query(
      `INSERT INTO users (email, first_name, last_name, password_hash, is_active)
       VALUES ('snapshot2@test.example.com', 'Snapshot2', 'Tester', 'hash', true)
       RETURNING id`
    )
    const userId2 = userId2Result.rows[0].id

    const attempt2 = await initializeAttempt(
      { examId: testExamId, userId: userId2 },
      pool,
      userId2
    )

    const snap1 = await getAttemptSnapshot(attempt1.id, pool)
    const snap2 = await getAttemptSnapshot(attempt2.id, pool)

    // Both attempts should have identical question order (from same exam at time of creation)
    expect(JSON.stringify(snap1.questions)).toBe(
      JSON.stringify(snap2.questions)
    )

    logger.info('✅ Question order freezing test passed')
  })

  it('❌ Direct snapshot modification is prevented', async () => {
    // Create exam
    const examResult = await pool.query(
      `INSERT INTO mcq_exams (name, duration_minutes, question_count, passing_score)
       VALUES ('Modification Prevention Exam ' || now(), 60, 10, 70)
       RETURNING id`
    )
    const testExamId = examResult.rows[0].id

    // Create attempt
    const attempt = await initializeAttempt(
      { examId: testExamId, userId },
      pool,
      userId
    )

    // Try to update configuration_snapshot
    try {
      await pool.query(
        `UPDATE attempts SET configuration_snapshot = '{"tampered": true}' WHERE id = $1`,
        [attempt.id]
      )

      expect(true).toBe(false) // Should not reach (trigger prevents it)
    } catch (error: any) {
      expect(error.code).toBe('23514')
      logger.info('✅ Snapshot modification prevention test passed')
    }
  })
})
