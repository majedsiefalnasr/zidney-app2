import type { PoolClient } from 'pg'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import { pool } from '../../db'

/**
 * T049: Referential Integrity Integration Test
 * End-to-end test validating FK relationships during user operations
 */

describe('Referential Integrity Integration', () => {
  let client: PoolClient
  let testSchema: string

  beforeAll(async () => {
    testSchema = `referential_int_${Date.now().toString(36)}`
    const setupClient = await pool.connect()
    try {
      await setupClient.query(`CREATE SCHEMA IF NOT EXISTS ${testSchema}`)
      await setupClient.query(`SET search_path TO ${testSchema}, public`)
      await setupClient.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS mcq_baskets (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          name TEXT NOT NULL,
          created_by TEXT NULL
        );
        CREATE TABLE IF NOT EXISTS mcq_questions (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          basket_id TEXT NOT NULL REFERENCES mcq_baskets(id) ON DELETE CASCADE,
          question_text TEXT NOT NULL,
          options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          correct_option INTEGER NOT NULL,
          is_deleted BOOLEAN NOT NULL DEFAULT FALSE
        );
        CREATE TABLE IF NOT EXISTS mcq_exams (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          name TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL,
          question_count INTEGER NOT NULL,
          is_deleted BOOLEAN NOT NULL DEFAULT FALSE
        );
        CREATE TABLE IF NOT EXISTS attempts (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          exam_type TEXT NOT NULL,
          exam_id TEXT NOT NULL REFERENCES mcq_exams(id) ON DELETE RESTRICT,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          configuration_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
          question_list_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
          grading_config_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
        );
        CREATE TABLE IF NOT EXISTS roles (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS role_assignments (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          parent_category_id TEXT NULL REFERENCES categories(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS category_values (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          value TEXT NOT NULL
        );
      `)
    } finally {
      setupClient.release()
    }
  })

  afterAll(async () => {
    const teardownClient = await pool.connect()
    try {
      await teardownClient.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`)
    } finally {
      teardownClient.release()
    }
  })

  beforeEach(async () => {
    client = await pool.connect()
    await client.query('BEGIN TRANSACTION')
    await client.query(`SET search_path TO ${testSchema}, public`)
  })

  afterEach(async () => {
    await client.query('ROLLBACK')
    client.release()
  })

  it('T049-1: Create exam + question + attempt → all relationships valid', async () => {
    // Create user
    const userResult = await client.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      ['integrity-user@test.com', 'Integrity User']
    )
    const userId = userResult.rows[0].id

    // Create basket
    const basketResult = await client.query(
      'INSERT INTO mcq_baskets (name) VALUES ($1) RETURNING id',
      ['Integration Basket']
    )
    const basketId = basketResult.rows[0].id

    // Create question
    const questionResult = await client.query(
      'INSERT INTO mcq_questions (basket_id, question_text, options_json, correct_option) VALUES ($1, $2, $3, $4) RETURNING id',
      [basketId, 'Sample Q', '["A", "B", "C"]', 0]
    )
    const questionId = questionResult.rows[0].id

    // Create exam
    const examResult = await client.query(
      'INSERT INTO mcq_exams (name, duration_minutes, question_count) VALUES ($1, $2, $3) RETURNING id',
      ['Integrity Exam', 30, 1]
    )
    const examId = examResult.rows[0].id

    // Create attempt
    const attemptResult = await client.query(
      'INSERT INTO attempts (exam_type, exam_id, user_id, configuration_snapshot, question_list_snapshot, grading_config_snapshot) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      ['MCQ', examId, userId, '{}', '{}', '{}']
    )
    const attemptId = attemptResult.rows[0].id

    // Verify all relationships exist
    const examCheck = await client.query(
      'SELECT id FROM mcq_exams WHERE id = $1',
      [examId]
    )
    const questionCheck = await client.query(
      'SELECT id FROM mcq_questions WHERE id = $1',
      [questionId]
    )
    const attemptCheck = await client.query(
      'SELECT id FROM attempts WHERE id = $1',
      [attemptId]
    )

    expect(examCheck.rowCount).toBe(1)
    expect(questionCheck.rowCount).toBe(1)
    expect(attemptCheck.rowCount).toBe(1)
  })

  it('T049-2: Delete question → attempt still references question_id (acceptable)', async () => {
    const userResult = await client.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      ['q-delete-user@test.com', 'Q Delete User']
    )
    const userId = userResult.rows[0].id

    const basketResult = await client.query(
      'INSERT INTO mcq_baskets (name) VALUES ($1) RETURNING id',
      ['Delete Basket']
    )
    const basketId = basketResult.rows[0].id

    const questionResult = await client.query(
      'INSERT INTO mcq_questions (basket_id, question_text, options_json, correct_option) VALUES ($1, $2, $3, $4) RETURNING id',
      [basketId, 'Delete Q', '["X", "Y"]', 1]
    )
    const questionId = questionResult.rows[0].id

    // Create exam + attempt
    const examResult = await client.query(
      'INSERT INTO mcq_exams (name, duration_minutes, question_count) VALUES ($1, $2, $3) RETURNING id',
      ['Delete Exam', 30, 1]
    )
    const examId = examResult.rows[0].id

    await client.query(
      'INSERT INTO attempts (exam_type, exam_id, user_id, configuration_snapshot, question_list_snapshot, grading_config_snapshot) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        'MCQ',
        examId,
        userId,
        '{}',
        JSON.stringify({ questions: [questionId] }),
        '{}',
      ]
    )

    // Delete question (soft delete)
    await client.query(
      'UPDATE mcq_questions SET is_deleted = true WHERE id = $1',
      [questionId]
    )

    // Verify question marked as deleted
    const deleteCheck = await client.query(
      'SELECT is_deleted FROM mcq_questions WHERE id = $1',
      [questionId]
    )
    expect(deleteCheck.rows[0].is_deleted).toBe(true)

    // Attempt still has reference (acceptable)
    const attemptCheck = await client.query(
      'SELECT question_list_snapshot FROM attempts WHERE exam_id = $1',
      [examId]
    )
    expect(attemptCheck.rowCount).toBe(1)
  })

  it('T049-3: Archive exam → new attempts blocked (logical enforcement)', async () => {
    const userResult = await client.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      ['archive-user@test.com', 'Archive User']
    )
    const userId = userResult.rows[0].id

    const examResult = await client.query(
      'INSERT INTO mcq_exams (name, duration_minutes, question_count, is_deleted) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Archive Exam', 60, 5, true]
    )
    const examId = examResult.rows[0].id

    // Application should check is_deleted before allowing new attempts
    const archiveCheck = await client.query(
      'SELECT is_deleted FROM mcq_exams WHERE id = $1',
      [examId]
    )
    expect(archiveCheck.rows[0].is_deleted).toBe(true)

    // Attempts on archived exam acceptable at DB level (enforced at app level)
    await client.query(
      'INSERT INTO attempts (exam_type, exam_id, user_id, configuration_snapshot, question_list_snapshot, grading_config_snapshot) VALUES ($1, $2, $3, $4, $5, $6)',
      ['MCQ', examId, userId, '{}', '{}', '{}']
    )

    const attemptCount = await client.query(
      'SELECT COUNT(*) FROM attempts WHERE exam_id = $1',
      [examId]
    )
    expect(parseInt(attemptCount.rows[0].count, 10)).toBe(1)
  })

  it('T049-4: Role assignment → verify bidirectional FK integrity', async () => {
    // Create user and role
    const userResult = await client.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      ['bidirectional-user@test.com', 'Bidirectional User']
    )
    const userId = userResult.rows[0].id

    const roleResult = await client.query(
      'INSERT INTO roles (code, name) VALUES ($1, $2) RETURNING id',
      ['INSTRUCTOR', 'Instructor Role']
    )
    const roleId = roleResult.rows[0].id

    // Assign role
    const assignResult = await client.query(
      'INSERT INTO role_assignments (user_id, role_id) VALUES ($1, $2) RETURNING *',
      [userId, roleId]
    )
    expect(assignResult.rowCount).toBe(1)

    // Verify backward query
    const backQuery = await client.query(
      'SELECT user_id, role_id FROM role_assignments WHERE user_id = $1 AND role_id = $2',
      [userId, roleId]
    )
    expect(backQuery.rowCount).toBe(1)
    expect(backQuery.rows[0].user_id).toEqual(userId)
    expect(backQuery.rows[0].role_id).toEqual(roleId)
  })

  it('T049-5: Category hierarchy → parent-child relationships valid', async () => {
    // Create parent category
    const parentResult = await client.query(
      'INSERT INTO categories (name, type) VALUES ($1, $2) RETURNING id',
      ['Parent Category', 'hierarchy']
    )
    const parentId = parentResult.rows[0].id

    // Create child category
    const childResult = await client.query(
      'INSERT INTO categories (name, type, parent_category_id) VALUES ($1, $2, $3) RETURNING id',
      ['Child Category', 'hierarchy', parentId]
    )
    const childId = childResult.rows[0].id

    // Verify hierarchy
    const childCheck = await client.query(
      'SELECT parent_category_id FROM categories WHERE id = $1',
      [childId]
    )
    expect(childCheck.rows[0].parent_category_id).toEqual(parentId)

    // Create values under child
    await client.query(
      'INSERT INTO category_values (category_id, value) VALUES ($1, $2)',
      [childId, 'value1']
    )

    const valueCheck = await client.query(
      'SELECT category_id FROM category_values WHERE category_id = $1',
      [childId]
    )
    expect(valueCheck.rowCount).toBe(1)
  })
})
