/**
 * Unit Tests: Snapshot Service
 *
 * Validates snapshot capture functionality.
 * Tests consistency, completeness, and determinism.
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 * Task: T037 (unit test for snapshot capture)
 */

import {
  captureExamSnapshot,
  compareSnapshots,
} from '@zidney/domain-core/attempts/snapshot-service'
import { Pool, PoolClient } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createLogger } from '@zidney/logger'

const logger = createLogger('SnapshotServiceTest')

const getConnectionString = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const user = process.env.DB_USER || 'zidney_app'
  const password = process.env.DB_PASSWORD || 'change-me-in-production'
  const host = process.env.DB_HOST || 'localhost'
  const port = process.env.DB_PORT || '5432'
  const database = process.env.DB_NAME || process.env.DB_DATABASE || 'zidney_master'

  return `postgresql://${user}:${password}@${host}:${port}/${database}`
}

describe('Snapshot Service Unit Tests (T037)', () => {
  let pool: Pool
  let client: PoolClient
  let schemaName: string
  let examId: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: getConnectionString() })
    client = await pool.connect()
    schemaName = `snapshot_test_${Date.now().toString(36)}`

    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`)
    await client.query(`SET search_path TO ${schemaName}, public`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS mcq_exams (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        basket_id TEXT NOT NULL,
        name TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        question_count INTEGER NOT NULL,
        passing_score NUMERIC(5, 2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS mcq_questions (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        basket_id TEXT NOT NULL,
        question_text TEXT NOT NULL,
        options_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        difficulty TEXT NOT NULL DEFAULT 'medium',
        tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    logger.info('Snapshot service unit tests starting')
  })

  afterAll(async () => {
    if (client) {
      await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`)
      client.release()
    }
    if (pool) {
      await pool.end()
    }
  })

  beforeEach(async () => {
    await client.query('TRUNCATE TABLE mcq_questions, mcq_exams')

    const basketId = `basket-${Date.now().toString(36)}`
    const examResult = await client.query(
      `INSERT INTO mcq_exams (basket_id, name, duration_minutes, question_count, passing_score)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [basketId, `Snapshot Test Exam ${Date.now().toString(36)}`, 60, 10, 70]
    )
    examId = examResult.rows[0].id

    await client.query(
      `INSERT INTO mcq_questions (
         basket_id, question_text, options_json, difficulty, tags_json
       ) VALUES ($1, $2, $3::jsonb, $4, $5::jsonb)`,
      [
        basketId,
        'What is 2 + 2?',
        JSON.stringify({ A: '3', B: '4', C: '5' }),
        'easy',
        JSON.stringify(['math']),
      ]
    )
  })

  it('Capture snapshot returns config + questions + grading', async () => {
    const snapshot = await captureExamSnapshot(
      examId,
      client as unknown as Pool
    )

    expect(snapshot.config).toBeDefined()
    expect(snapshot.questions).toBeDefined()
    expect(snapshot.grading).toBeDefined()

    expect(snapshot.config.exam_id).toBe(examId)
    expect(snapshot.config.duration_minutes).toBe(60)
    expect(Number(snapshot.grading.passing_score)).toBe(70)
  })

  it('Snapshot is consistent across multiple calls', async () => {
    const snap1 = await captureExamSnapshot(examId, client as unknown as Pool)
    await new Promise((r) => setTimeout(r, 50))
    const snap2 = await captureExamSnapshot(examId, client as unknown as Pool)

    expect(snap1.config.exam_name).toBe(snap2.config.exam_name)
    expect(snap1.config.duration_minutes).toBe(snap2.config.duration_minutes)
    expect(snap1.config.passing_score).toBe(snap2.config.passing_score)
    expect(snap1.questions.length).toBe(snap2.questions.length)
  })

  it('Snapshot includes all required config fields', async () => {
    const snapshot = await captureExamSnapshot(
      examId,
      client as unknown as Pool
    )

    expect(snapshot.config.exam_id).toBeDefined()
    expect(snapshot.config.exam_name).toBeDefined()
    expect(snapshot.config.duration_minutes).toBeDefined()
    expect(snapshot.config.question_count).toBeDefined()
    expect(snapshot.config.passing_score).toBeDefined()
    expect(snapshot.config.exam_type).toBe('mcq')
    expect(snapshot.config.captured_at).toBeDefined()
  })

  it('Snapshot includes all required grading fields', async () => {
    const snapshot = await captureExamSnapshot(
      examId,
      client as unknown as Pool
    )

    expect(snapshot.grading.passing_score).toBeDefined()
    expect(snapshot.grading.total_questions).toBeDefined()
    expect(snapshot.grading.grading_mode).toBe('auto')
    expect(snapshot.grading.partial_credit_enabled).toBe(false)
    expect(snapshot.grading.captured_at).toBeDefined()
  })

  it('Snapshot questions have correct structure', async () => {
    const snapshot = await captureExamSnapshot(
      examId,
      client as unknown as Pool
    )

    expect(snapshot.questions.length).toBeGreaterThan(0)

    for (const q of snapshot.questions) {
      expect(q.question_id).toBeDefined()
      expect(q.question_text).toBeDefined()
      expect(q.question_type).toBe('mcq')
      expect(q.order).toBeDefined()
      expect(q.difficulty).toBeDefined()
    }
  })

  it('compareSnapshots detects identical snapshots', async () => {
    const snap1 = await captureExamSnapshot(examId, client as unknown as Pool)
    const snap2 = await captureExamSnapshot(examId, client as unknown as Pool)

    snap2.config.captured_at = snap1.config.captured_at
    snap2.grading.captured_at = snap1.grading.captured_at

    expect(compareSnapshots(snap1, snap2)).toBe(true)
  })

  it('compareSnapshots detects different snapshots', async () => {
    const snap1 = await captureExamSnapshot(examId, client as unknown as Pool)
    const snap2 = await captureExamSnapshot(examId, client as unknown as Pool)

    snap2.config.passing_score = 99
    expect(compareSnapshots(snap1, snap2)).toBe(false)
  })

  it('Capture snapshot fails for non-existent exam', async () => {
    await expect(
      captureExamSnapshot(
        '00000000-0000-0000-0000-000000000000',
        client as unknown as Pool
      )
    ).rejects.toThrow('Exam not found')
  })
})
