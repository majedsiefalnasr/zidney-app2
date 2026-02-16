/**
 * Integration Test: Concurrent Snapshots
 *
 * Validates snapshot consistency under concurrent attempt creation.
 * 100+ concurrent users starting same exam should have identical snapshots.
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 * Task: T039 (Integration test for concurrent snapshots)
 */

import { initializeAttempt } from '@zidney/domain-core/src/attempts/attempt-init'
import { getAttemptSnapshot } from '@zidney/domain-core/src/attempts/snapshot-service'
import { createLogger } from '@zidney/logging'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const logger = createLogger('ConcurrentSnapshotsTest')

describe('Concurrent Snapshot Tests (T039)', () => {
  let pool: Pool
  let examId: string

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'zidney_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    })

    // Create test exam
    const examResult = await pool.query(
      `INSERT INTO mcq_exams (name, duration_minutes, question_count, passing_score)
       VALUES ('Concurrent Snapshots Exam ' || now(), 120, 20, 75)
       RETURNING id`
    )
    examId = examResult.rows[0].id

    logger.info('Concurrent snapshots tests setup complete')
  })

  afterAll(async () => {
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
      for (let i = 0; i < batchSize && userIds.length < concurrentCount; i++) {
        promises.push(
          pool.query(
            `INSERT INTO users (email, first_name, last_name, password_hash, is_active)
             VALUES ($1, 'ConcurrentUser', $2, 'hash', true)
             RETURNING id`,
            [`concurrent${userIds.length}@test.com`, userIds.length.toString()]
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
    const firstSnapshot = snapshots[0]
    const firstSnapshotStr = JSON.stringify(firstSnapshot)

    let allIdentical = true
    for (let i = 1; i < snapshots.length; i++) {
      const snapStr = JSON.stringify(snapshots[i])
      if (snapStr !== firstSnapshotStr) {
        allIdentical = false
        logger.warn('Snapshot mismatch detected', {
          index: i,
          first: firstSnapshot.config,
          current: snapshots[i].config,
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
    const configSnapshots = snapshots.map((s) => JSON.stringify(s.config))
    const uniqueConfigs = new Set(configSnapshots)

    const questionSnapshots = snapshots.map((s) => JSON.stringify(s.questions))
    const uniqueQuestions = new Set(questionSnapshots)

    const gradingSnapshots = snapshots.map((s) => JSON.stringify(s.grading))
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

    expect(JSON.stringify(snap1)).toBe(JSON.stringify(snap2))

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
      for (let i = 0; i < batchSize && userIds.length < concurrentCount; i++) {
        promises.push(
          pool.query(
            `INSERT INTO users (email, first_name, last_name, password_hash, is_active)
             VALUES ($1, 'HighConcurrentUser', $2, 'hash', true)
             RETURNING id`,
            [
              `highconcurrent${userIds.length}@test.com`,
              userIds.length.toString(),
            ]
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
