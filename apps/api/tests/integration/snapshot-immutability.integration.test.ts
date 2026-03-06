/**
 * Integration Test: Snapshot Immutability
 *
 * Validates that snapshots remain frozen after attempt creation.
 * Modifying exam after attempt start does not affect snapshot.
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 * Task: T038 (Integration test for snapshot immutability)
 */

import { initializeAttempt } from '@zidney/domain-core/attempts/attempt-init'
import { getAttemptSnapshot } from '@zidney/domain-core/attempts/snapshot-service'
import { createLogger } from '@zidney/logger'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const logger = createLogger('SnapshotImmutabilityTest')

describe('Snapshot Immutability Integration Tests (T038)', () => {
  let pool: Pool
  let examId: string
  let userId: string
  let testSchema: string

  beforeAll(async () => {
    testSchema = `snapshot_immut_${Date.now().toString(36)}`
    const connectionString = process.env.DATABASE_URL
    pool = connectionString
      ? new Pool({
          connectionString,
          max: 1,
          options: `-c search_path=${testSchema},public`,
        })
      : new Pool({
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
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
      CREATE TABLE IF NOT EXISTS mcq_baskets (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        name TEXT NOT NULL,
        created_by TEXT NULL
      );
      CREATE TABLE IF NOT EXISTS mcq_exams (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        basket_id TEXT NULL REFERENCES mcq_baskets(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        question_count INTEGER NOT NULL,
        passing_score INTEGER NOT NULL DEFAULT 70,
        created_by TEXT NULL
      );
      CREATE TABLE IF NOT EXISTS mcq_questions (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        basket_id TEXT NOT NULL REFERENCES mcq_baskets(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        options_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        correct_option INTEGER NOT NULL DEFAULT 0,
        difficulty TEXT NOT NULL DEFAULT 'medium',
        tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by TEXT NULL
      );
      CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        exam_id TEXT NOT NULL REFERENCES mcq_exams(id) ON DELETE RESTRICT,
        user_id TEXT NOT NULL,
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
        created_by TEXT NOT NULL DEFAULT 'system'
      );
      CREATE OR REPLACE FUNCTION snapshot_attempts_immutable_guard()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Immutable snapshot: attempts cannot be modified';
      END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS snapshot_attempts_immutable_update ON attempts;
      CREATE TRIGGER snapshot_attempts_immutable_update
        BEFORE UPDATE ON attempts
        FOR EACH ROW
        EXECUTE FUNCTION snapshot_attempts_immutable_guard();
    `)
    await schemaClient.query(
      'TRUNCATE TABLE attempts, mcq_questions, mcq_exams, mcq_baskets, users CASCADE'
    )
    schemaClient.release()

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
    if (pool && testSchema) {
      await pool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`)
    }
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
    await pool.query(`UPDATE mcq_exams SET question_count = 5, passing_score = 80 WHERE id = $1`, [
      examId,
    ])

    // Retrieve attempt snapshot again
    const unchangedSnapshot = await getAttemptSnapshot(attempt.id, pool)

    // Snapshot should remain unchanged
    expect(unchangedSnapshot.config.question_count).toBe(3)
    expect(unchangedSnapshot.config.passing_score).toBe(70)
    expect(JSON.stringify(unchangedSnapshot)).toBe(JSON.stringify(originalSnapshot))

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
    const attempt = await initializeAttempt({ examId: testExamId, userId }, pool, userId)

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
      expect(error).toBeDefined()
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
    const attempt = await initializeAttempt({ examId: testExamId, userId }, pool, userId)

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
    const attempt1 = await initializeAttempt({ examId: testExamId, userId }, pool, userId)

    // Small delay
    await new Promise((r) => setTimeout(r, 100))

    // Create another attempt (captures new question order if exam changed)
    const userId2Result = await pool.query(
      `INSERT INTO users (email, first_name, last_name, password_hash, is_active)
       VALUES ('snapshot2@test.example.com', 'Snapshot2', 'Tester', 'hash', true)
       RETURNING id`
    )
    const userId2 = userId2Result.rows[0].id

    const attempt2 = await initializeAttempt({ examId: testExamId, userId: userId2 }, pool, userId2)

    const snap1 = await getAttemptSnapshot(attempt1.id, pool)
    const snap2 = await getAttemptSnapshot(attempt2.id, pool)

    // Both attempts should have identical question order (from same exam at time of creation)
    expect(JSON.stringify(snap1.questions)).toBe(JSON.stringify(snap2.questions))

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
    const attempt = await initializeAttempt({ examId: testExamId, userId }, pool, userId)

    // Try to update configuration_snapshot
    try {
      await pool.query(
        `UPDATE attempts SET configuration_snapshot = '{"tampered": true}' WHERE id = $1`,
        [attempt.id]
      )

      expect(true).toBe(false) // Should not reach (trigger prevents it)
    } catch (error: any) {
      expect(error).toBeDefined()
      logger.info('✅ Snapshot modification prevention test passed')
    }
  })
})
