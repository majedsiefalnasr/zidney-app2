/**
 * Phase 6 Test Suite: Referential Integrity
 *
 * Tests for T047-T050:
 * - T047: FK cascade delete tests
 * - T048: FK restrict policy tests
 * - T049: Referential integrity during operations
 * - T050: FK concurrency tests
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 */

import { Pool, PoolClient } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const getConnectionString = () => {
  const user = process.env.DB_USER || 'postgres'
  const password = process.env.DB_PASSWORD || 'postgres'
  const host = process.env.DB_HOST || 'localhost'
  const port = process.env.DB_PORT || '5432'
  const database = process.env.DB_DATABASE || 'zidney_test_tenant'

  return `postgresql://${user}:${password}@${host}:${port}/${database}`
}

describe('Phase 6: Referential Integrity Tests', () => {
  let pool: Pool
  let client: PoolClient

  beforeAll(async () => {
    pool = new Pool({ connectionString: getConnectionString() })
    client = await pool.connect()
  })

  afterAll(async () => {
    if (client) {
      await client.release()
    }
    if (pool) {
      await pool.end()
    }
  })

  describe('T047: FK Cascade Delete Tests', () => {
    it('should cascade delete subscription events when subscription deleted', async () => {
      const userId = '11111111-1111-1111-1111-111111111111'
      const subscriptionId = '99999999-9999-9999-9999-999999999999'

      // Ensure user exists
      await client.query(
        `INSERT INTO users (id, email, name) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
        [userId, 'test@example.com', 'Test User']
      )

      // Create subscription
      await client.query(
        `INSERT INTO subscriptions (
          id, user_id, plan_type, created_by
        ) VALUES ($1, $2, $3, $4)`,
        [subscriptionId, userId, 'PREMIUM', userId]
      )

      // Create subscription event
      await client.query(
        `INSERT INTO subscription_events (
          id, subscription_id, event_type, occurred_at, created_by
        ) VALUES (gen_random_uuid(), $1, $2, NOW(), $3)`,
        [subscriptionId, 'ACTIVATED', userId]
      )

      // Verify event exists
      let result = await client.query(
        `SELECT COUNT(*) as count FROM subscription_events WHERE subscription_id = $1`,
        [subscriptionId]
      )
      expect(parseInt(result.rows[0].count, 10)).toBe(1)

      // Delete subscription
      await client.query(`DELETE FROM subscriptions WHERE id = $1`, [
        subscriptionId,
      ])

      // Verify event was cascaded deleted
      result = await client.query(
        `SELECT COUNT(*) as count FROM subscription_events WHERE subscription_id = $1`,
        [subscriptionId]
      )
      expect(parseInt(result.rows[0].count, 10)).toBe(0)
    })

    it('should cascade delete attempt_events when attempt deleted', async () => {
      const userId = '11111111-1111-1111-1111-111111111111'
      const examId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      const attemptId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

      // Setup exam and attempt
      await client.query(
        `INSERT INTO mcq_exams (id, name, duration_minutes, question_count, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [examId, 'Test', 60, 10, userId]
      )

      await client.query(
        `INSERT INTO attempts (
          id, exam_type, exam_id, user_id, started_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING`,
        [attemptId, 'MCQ', examId, userId, new Date(), userId]
      )

      // Create attempt event
      await client.query(
        `INSERT INTO attempt_events (
          id, attempt_id, event_type, occurred_at, created_by
        ) VALUES (gen_random_uuid(), $1, $2, NOW(), $3)`,
        [attemptId, 'START', userId]
      )

      // Verify event exists
      let result = await client.query(
        `SELECT COUNT(*) as count FROM attempt_events WHERE attempt_id = $1`,
        [attemptId]
      )
      expect(parseInt(result.rows[0].count, 10)).toBe(1)

      // Delete attempt
      await client.query(`DELETE FROM attempts WHERE id = $1`, [attemptId])

      // Verify events cascaded
      result = await client.query(
        `SELECT COUNT(*) as count FROM attempt_events WHERE attempt_id = $1`,
        [attemptId]
      )
      expect(parseInt(result.rows[0].count, 10)).toBe(0)
    })
  })

  describe('T048: FK Restrict Policy Tests', () => {
    it('should prevent deletion of exam with active attempts', async () => {
      const userId = '11111111-1111-1111-1111-111111111111'
      const examId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      const attemptId = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

      // Setup exam and attempt
      await client.query(
        `INSERT INTO mcq_exams (id, name, duration_minutes, question_count, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [examId, 'Protected Exam', 60, 10, userId]
      )

      await client.query(
        `INSERT INTO attempts (
          id, exam_type, exam_id, user_id, started_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [attemptId, 'MCQ', examId, userId, new Date(), userId]
      )

      // Try to delete exam
      let error: Error | null = null
      try {
        await client.query(`DELETE FROM mcq_exams WHERE id = $1`, [examId])
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
      expect(error?.message).toContain('foreign key')
    })

    it('should prevent deletion of division with departments', async () => {
      const userId = '11111111-1111-1111-1111-111111111111'
      const divisionId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
      const departmentId = 'ffffffff-ffff-ffff-ffff-ffffffffffff'

      // Create division
      await client.query(
        `INSERT INTO divisions (id, name, code, created_by)
         VALUES ($1, $2, $3, $4)`,
        [divisionId, 'Engineering', 'ENG', userId]
      )

      // Create department
      await client.query(
        `INSERT INTO departments (id, division_id, name, code, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [departmentId, divisionId, 'Computer Science', 'CS', userId]
      )

      // Try to delete division
      let error: Error | null = null
      try {
        await client.query(`DELETE FROM divisions WHERE id = $1`, [divisionId])
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
      expect(error?.message).toContain('foreign key')
    })
  })

  describe('T049: Referential Integrity During Operations', () => {
    it('should maintain integrity for exam+question+attempt flow', async () => {
      const userId = '11111111-1111-1111-1111-111111111111'
      const basketId = '11111111-1111-1111-1111-111111111111'
      const examId = '22222222-2222-2222-2222-222222222222'
      const attemptId = '33333333-3333-3333-3333-333333333333'

      // Create basket
      await client.query(
        `INSERT INTO mcq_baskets (id, name, created_by)
         VALUES ($1, $2, $3)`,
        [basketId, 'Test Questions', userId]
      )

      // Create question
      await client.query(
        `INSERT INTO mcq_questions (
          id, basket_id, question_text, correct_option, created_by
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
        [basketId, 'Test Q1', 0, userId]
      )

      // Create exam
      await client.query(
        `INSERT INTO mcq_exams (id, name, duration_minutes, question_count, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [examId, 'Test Exam', 60, 1, userId]
      )

      // Create attempt
      await client.query(
        `INSERT INTO attempts (
          id, exam_type, exam_id, user_id, started_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [attemptId, 'MCQ', examId, userId, new Date(), userId]
      )

      // Verify all relationships exist
      const result = await client.query(
        `SELECT
          (SELECT COUNT(*) FROM mcq_baskets WHERE id = $1) as baskets,
          (SELECT COUNT(*) FROM mcq_questions WHERE basket_id = $1) as questions,
          (SELECT COUNT(*) FROM mcq_exams WHERE id = $2) as exams,
          (SELECT COUNT(*) FROM attempts WHERE exam_id = $2) as attempts`,
        [basketId, examId]
      )

      expect(result.rows[0].baskets).toBe('1')
      expect(result.rows[0].questions).toBe('1')
      expect(result.rows[0].exams).toBe('1')
      expect(result.rows[0].attempts).toBe('1')
    })
  })

  describe('T050: FK Concurrency Tests', () => {
    it('should handle concurrent attempt submissions without constraint violations', async () => {
      const userId = '11111111-1111-1111-1111-111111111111'
      const examId = '44444444-4444-4444-4444-444444444444'

      // Create exam
      await client.query(
        `INSERT INTO mcq_exams (id, name, duration_minutes, question_count, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [examId, 'Concurrent Test', 60, 10, userId]
      )

      // Simulate concurrent submissions
      const promises = []
      for (let i = 0; i < 10; i++) {
        const attemptId = `44444444-4444-4444-4444-${'4'.padEnd(12, `${i}`)}`

        const promise = client.query(
          `INSERT INTO attempts (
            id, exam_type, exam_id, user_id, started_at, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [attemptId, 'MCQ', examId, userId, new Date(), userId]
        )

        promises.push(promise)
      }

      // All should succeed without FK violations
      const results = await Promise.allSettled(promises)
      const failures = results.filter((r) => r.status === 'rejected')

      expect(failures).toHaveLength(0)
    })
  })
})
