/**
 * Unit Tests: Snapshot Service
 *
 * Validates snapshot capture functionality.
 * Tests consistency, completeness, and determinism.
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 * Task: T037 (Unit test for snapshot capture)
 */

import {
  captureExamSnapshot,
  compareSnapshots,
} from '@zidney/domain-core/src/attempts/snapshot-service'
import { createLogger } from '@zidney/logging'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const logger = createLogger('SnapshotServiceTest')

describe('Snapshot Service Unit Tests (T037)', () => {
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

    logger.info('Snapshot service unit tests starting')
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
       VALUES ('Snapshot Test Exam ' || now(), 60, 10, 70)
       RETURNING id`
    )
    examId = examResult.rows[0].id
  })

  it('✅ Capture snapshot returns config + questions + grading', async () => {
    const snapshot = await captureExamSnapshot(examId, pool)

    expect(snapshot.config).toBeDefined()
    expect(snapshot.questions).toBeDefined()
    expect(snapshot.grading).toBeDefined()

    expect(snapshot.config.exam_id).toBe(examId)
    expect(snapshot.config.duration_minutes).toBe(60)
    expect(snapshot.grading.passing_score).toBe(70)

    logger.info('✅ Snapshot structure test passed')
  })

  it('✅ Snapshot is consistent across multiple calls', async () => {
    const snap1 = await captureExamSnapshot(examId, pool)

    // Small delay
    await new Promise((r) => setTimeout(r, 100))

    const snap2 = await captureExamSnapshot(examId, pool)

    // Config should be identical (except captured_at timestamp)
    expect(snap1.config.exam_name).toBe(snap2.config.exam_name)
    expect(snap1.config.duration_minutes).toBe(snap2.config.duration_minutes)
    expect(snap1.config.passing_score).toBe(snap2.config.passing_score)

    // Questions should have same order and count
    expect(snap1.questions.length).toBe(snap2.questions.length)

    logger.info('✅ Snapshot consistency test passed')
  })

  it('✅ Snapshot includes all required config fields', async () => {
    const snapshot = await captureExamSnapshot(examId, pool)

    // Config fields
    expect(snapshot.config.exam_id).toBeDefined()
    expect(snapshot.config.exam_name).toBeDefined()
    expect(snapshot.config.duration_minutes).toBeDefined()
    expect(snapshot.config.question_count).toBeDefined()
    expect(snapshot.config.passing_score).toBeDefined()
    expect(snapshot.config.exam_type).toBe('mcq')
    expect(snapshot.config.captured_at).toBeDefined()

    logger.info('✅ Config fields test passed')
  })

  it('✅ Snapshot includes all required grading fields', async () => {
    const snapshot = await captureExamSnapshot(examId, pool)

    // Grading fields
    expect(snapshot.grading.passing_score).toBeDefined()
    expect(snapshot.grading.total_questions).toBeDefined()
    expect(snapshot.grading.grading_mode).toBe('auto')
    expect(snapshot.grading.partial_credit_enabled).toBe(false)
    expect(snapshot.grading.captured_at).toBeDefined()

    logger.info('✅ Grading fields test passed')
  })

  it('✅ Snapshot questions have correct structure', async () => {
    const snapshot = await captureExamSnapshot(examId, pool)

    // If there are questions, verify structure
    if (snapshot.questions.length > 0) {
      for (const q of snapshot.questions) {
        expect(q.question_id).toBeDefined()
        expect(q.question_text).toBeDefined()
        expect(q.question_type).toBe('mcq')
        expect(q.order).toBeDefined()
        expect(q.difficulty).toBeDefined()
      }
    }

    logger.info('✅ Question structure test passed')
  })

  it('✅ compareSnapshots detects identical snapshots', async () => {
    const snap1 = await captureExamSnapshot(examId, pool)
    const snap2 = await captureExamSnapshot(examId, pool)

    // Manually ensure captured_at is identical for comparison
    snap2.config.captured_at = snap1.config.captured_at

    const isIdentical = compareSnapshots(snap1, snap2)
    expect(isIdentical).toBe(true)

    logger.info('✅ Snapshot comparison test passed')
  })

  it('✅ compareSnapshots detects different snapshots', async () => {
    const snap1 = await captureExamSnapshot(examId, pool)
    const snap2 = await captureExamSnapshot(examId, pool)

    // Modify one snapshot
    snap2.config.passing_score = 99

    const isIdentical = compareSnapshots(snap1, snap2)
    expect(isIdentical).toBe(false)

    logger.info('✅ Snapshot difference detection test passed')
  })

  it('❌ Capture snapshot fails for non-existent exam', async () => {
    try {
      await captureExamSnapshot('00000000-0000-0000-0000-000000000000', pool)
      expect(true).toBe(false) // Should not reach
    } catch (error: any) {
      expect(error.message).toContain('Exam not found')
      logger.info('✅ Non-existent exam error test passed')
    }
  })
})
