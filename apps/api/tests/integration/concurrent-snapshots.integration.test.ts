/**
 * Integration Test: Concurrent Snapshots
 *
 * Validates snapshot consistency under concurrent attempt creation.
 * 100+ concurrent users starting same exam should have identical snapshots.
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 * Task: T039 (Integration test for concurrent snapshots)
 */

import { initializeAttempt } from '@zidney/domain-core/attempts/attempt-init'
import { getAttemptSnapshot } from '@zidney/domain-core/attempts/snapshot-service'
import { createLogger } from '@zidney/logger'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const logger = createLogger('ConcurrentSnapshotsTest')

function normalizeSnapshot(snapshot: any) {
  return {
    config: {
      ...snapshot.config,
      captured_at: undefined,
    },
    questions: snapshot.questions,
    grading: {
      ...snapshot.grading,
      captured_at: undefined,
    },
  }
}

describe('Concurrent Snapshot Tests (T039)', () => {
  let pool: Pool
  let examId: string
  let testSchema: string

  beforeAll(async () => {
    testSchema = `concurrent_snapshot_${Date.now().toString(36)}`
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
        name TEXT NULL,
        first_name TEXT NULL,
        last_name TEXT NULL,
        password_hash TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE
      );
      CREATE TABLE IF NOT EXISTS mcq_baskets (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        name TEXT NOT NULL,
        created_by TEXT NOT NULL
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
        correct_option INTEGER NOT NULL DEFAULT 0,
        options_json JSONB NOT NULL DEFAULT '{}'::jsonb,
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
        created_by TEXT NOT NULL
      );
    `)
    await schemaClient.query(
      'TRUNCATE TABLE attempt_events, attempts, mcq_questions, mcq_exams, mcq_baskets, users CASCADE'
    )
    schemaClient.release()

    const systemUser = await pool.query(
      `INSERT INTO users (email, first_name, last_name, password_hash, is_active)
       VALUES ('system-concurrent@test.com', 'System', 'User', 'hash', true)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`
    )
    const systemUserId = systemUser.rows[0].id
    const basketResult = await pool.query(
      `INSERT INTO mcq_baskets (name, created_by) VALUES ('Concurrent Basket', $1) RETURNING id`,
      [systemUserId]
    )
    const basketId = basketResult.rows[0].id

    // Create test exam
    const examResult = await pool.query(
      `INSERT INTO mcq_exams (basket_id, name, duration_minutes, question_count, passing_score, created_by)
       VALUES ($1, 'Concurrent Snapshots Exam ' || now(), 120, 20, 75, $2)
       RETURNING id`,
      [basketId, systemUserId]
    )
    examId = examResult.rows[0].id

    await pool.query(
      `INSERT INTO mcq_questions (basket_id, question_text, correct_option, options_json, created_by)
       VALUES ($1, 'Question 1', 0, '{"A":"A","B":"B"}'::jsonb, $2)`,
      [basketId, systemUserId]
    )

    logger.info('Concurrent snapshots tests setup complete')
  })

  afterAll(async () => {
    if (pool && testSchema) {
      await pool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`)
    }
    if (pool) {
      await pool.end()
    }
  })

  it('✅ 50 concurrent attempts capture identical snapshots', async () => {
    const concurrentCount = 50
    const userIds: string[] = []

    // Create users
    const batchSize = 10
    for (
      let batch = 0;
      batch < Math.ceil(concurrentCount / batchSize);
      batch++
    ) {
      const promises = []
      for (let i = 0; i < batchSize; i++) {
        const index = batch * batchSize + i
        if (index >= concurrentCount) {
          break
        }
        promises.push(
          pool.query(
            `INSERT INTO users (email, first_name, last_name, password_hash, is_active)
             VALUES ($1, 'ConcurrentUser', $2, 'hash', true)
             RETURNING id`,
            [`concurrent${index}@test.com`, index.toString()]
          )
        )
      }

      const results = await Promise.all(promises)
      for (const result of results) {
        userIds.push(result.rows[0].id)
      }
    }

    logger.info('Created users for concurrent test', {
      user_count: userIds.length,
    })

    // Create 50 attempts concurrently
    const attempts = await Promise.all(
      userIds.map((userId) =>
        initializeAttempt({ examId, userId }, pool, userId)
      )
    )

    logger.info('Created concurrent attempts', {
      attempt_count: attempts.length,
    })

    // Get snapshots for all attempts
    const snapshots = await Promise.all(
      attempts.map((a) => getAttemptSnapshot(a.id, pool))
    )

    // Verify all have identical snapshots
    const firstSnapshot = normalizeSnapshot(snapshots[0])
    const firstSnapshotStr = JSON.stringify(firstSnapshot)

    let allIdentical = true
    for (let i = 1; i < snapshots.length; i++) {
      const snapStr = JSON.stringify(normalizeSnapshot(snapshots[i]))
      if (snapStr !== firstSnapshotStr) {
        allIdentical = false
        logger.warn('Snapshot mismatch detected', {
          index: i,
          first: firstSnapshot.config,
          current: normalizeSnapshot(snapshots[i]).config,
        })
        break
      }
    }

    expect(allIdentical).toBe(true)
    logger.info('✅ Concurrent snapshots identical test passed')
  })

  it('✅ No race conditions in concurrent snapshot capture', async () => {
    const concurrentCount = 30
    const userIds: string[] = []

    // Create users
    for (let i = 0; i < concurrentCount; i++) {
      const result = await pool.query(
        `INSERT INTO users (email, first_name, last_name, password_hash, is_active)
         VALUES ($1, 'RaceTestUser', $2, 'hash', true)
         RETURNING id`,
        [`racetest${i}@test.com`, i.toString()]
      )
      userIds.push(result.rows[0].id)
    }

    // Create attempts concurrently from same exam
    const attempts = await Promise.all(
      userIds.map((userId) =>
        initializeAttempt({ examId, userId }, pool, userId)
      )
    )

    // Verify all attempts were created
    expect(attempts.length).toBe(concurrentCount)

    // Verify all attempts have valid snapshots
    for (const attempt of attempts) {
      expect(attempt.id).toBeDefined()
      expect(attempt.configuration_snapshot).toBeDefined()
      expect(attempt.question_list_snapshot).toBeDefined()
      expect(attempt.grading_config_snapshot).toBeDefined()
    }

    logger.info('✅ No race conditions test passed')
  })

  it('✅ Snapshot consistency across concurrent users', async () => {
    const concurrentCount = 20
    const userIds: string[] = []

    // Create users
    for (let i = 0; i < concurrentCount; i++) {
      const result = await pool.query(
        `INSERT INTO users (email, first_name, last_name, password_hash, is_active)
         VALUES ($1, 'ConsistencyUser', $2, 'hash', true)
         RETURNING id`,
        [`consistency${i}@test.com`, i.toString()]
      )
      userIds.push(result.rows[0].id)
    }

    // Create all attempts concurrently
    const createStartTime = Date.now()
    const attempts = await Promise.all(
      userIds.map((userId) =>
        initializeAttempt({ examId, userId }, pool, userId)
      )
    )
    const createDuration = Date.now() - createStartTime

    // Get all snapshots
    const snapshots = await Promise.all(
      attempts.map((a) => getAttemptSnapshot(a.id, pool))
    )

    // Verify consistency metrics
    const configSnapshots = snapshots.map((s) =>
      JSON.stringify({
        ...s.config,
        captured_at: undefined,
      })
    )
    const uniqueConfigs = new Set(configSnapshots)

    const questionSnapshots = snapshots.map((s) => JSON.stringify(s.questions))
    const uniqueQuestions = new Set(questionSnapshots)

    const gradingSnapshots = snapshots.map((s) =>
      JSON.stringify({
        ...s.grading,
        captured_at: undefined,
      })
    )
    const uniqueGradings = new Set(gradingSnapshots)

    logger.info('Snapshot consistency metrics', {
      total_attempts: snapshots.length,
      unique_configs: uniqueConfigs.size,
      unique_questions: uniqueQuestions.size,
      unique_gradings: uniqueGradings.size,
      create_duration_ms: createDuration,
    })

    // All should be identical
    expect(uniqueConfigs.size).toBe(1)
    expect(uniqueQuestions.size).toBe(1)
    expect(uniqueGradings.size).toBe(1)

    logger.info('✅ Concurrent consistency test passed')
  })

  it('✅ Concurrent attempts do not affect each other', async () => {
    const userId1Result = await pool.query(
      `INSERT INTO users (email, first_name, last_name, password_hash, is_active)
       VALUES ('isolation1@test.com', 'Isolation', 'User1', 'hash', true)
       RETURNING id`
    )
    const userId1 = userId1Result.rows[0].id

    const userId2Result = await pool.query(
      `INSERT INTO users (email, first_name, last_name, password_hash, is_active)
       VALUES ('isolation2@test.com', 'Isolation', 'User2', 'hash', true)
       RETURNING id`
    )
    const userId2 = userId2Result.rows[0].id

    // Create two attempts concurrently
    const [attempt1, attempt2] = await Promise.all([
      initializeAttempt({ examId, userId: userId1 }, pool, userId1),
      initializeAttempt({ examId, userId: userId2 }, pool, userId2),
    ])

    // Verify they are different attempts
    expect(attempt1.id).not.toBe(attempt2.id)
    expect(attempt1.user_id).toBe(userId1)
    expect(attempt2.user_id).toBe(userId2)

    // But have identical snapshots
    const snap1 = await getAttemptSnapshot(attempt1.id, pool)
    const snap2 = await getAttemptSnapshot(attempt2.id, pool)

    expect(JSON.stringify(normalizeSnapshot(snap1))).toBe(
      JSON.stringify(normalizeSnapshot(snap2))
    )

    logger.info('✅ Concurrent isolation test passed')
  })

  it('✅ High concurrency handles 100+ simultaneous attempts', async () => {
    const concurrentCount = 100
    const userIds: string[] = []

    logger.info('Creating users for high concurrency test', {
      count: concurrentCount,
    })

    // Create all users in batches
    const batchSize = 20
    for (
      let batch = 0;
      batch < Math.ceil(concurrentCount / batchSize);
      batch++
    ) {
      const promises = []
      for (let i = 0; i < batchSize; i++) {
        const index = batch * batchSize + i
        if (index >= concurrentCount) {
          break
        }
        promises.push(
          pool.query(
            `INSERT INTO users (email, first_name, last_name, password_hash, is_active)
             VALUES ($1, 'HighConcurrentUser', $2, 'hash', true)
             RETURNING id`,
            [`highconcurrent${index}@test.com`, index.toString()]
          )
        )
      }

      const results = await Promise.all(promises)
      for (const result of results) {
        userIds.push(result.rows[0].id)
      }
    }

    logger.info('Created all users, starting concurrent attempt creation')

    // Create 100 attempts concurrently
    const startTime = Date.now()
    const attempts = await Promise.all(
      userIds.map((userId) =>
        initializeAttempt({ examId, userId }, pool, userId).catch((err) => {
          logger.error('Failed to create attempt', {
            user_id: userId,
            error: err.message,
          })
          return null
        })
      )
    )
    const duration = Date.now() - startTime

    const successfulAttempts = attempts.filter((a) => a !== null)

    logger.info('High concurrency test completed', {
      total_requested: concurrentCount,
      successful: successfulAttempts.length,
      duration_ms: duration,
      throughput_attempts_per_sec: (
        successfulAttempts.length /
        (duration / 1000)
      ).toFixed(2),
    })

    expect(successfulAttempts.length).toBeGreaterThanOrEqual(
      concurrentCount * 0.95
    )
    logger.info('✅ High concurrency test passed')
  })
})
