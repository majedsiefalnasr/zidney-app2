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
import { db } from '../../../src/db'

const pool = db.master

/**
 * T047: Foreign Key CASCADE Delete Tests
 * Validates that parent record deletion cascades to child records.
 */

describe('FK Cascade Delete Constraints', () => {
  let client: PoolClient
  let schemaName: string

  beforeAll(async () => {
    schemaName = `fk_cascade_${Date.now().toString(36)}`
    const setupClient = await pool.connect()

    try {
      await setupClient.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`)
      await setupClient.query(`
        CREATE TABLE IF NOT EXISTS ${schemaName}.users (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ${schemaName}.subscriptions (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          user_id TEXT NOT NULL REFERENCES ${schemaName}.users(id) ON DELETE CASCADE,
          plan_type TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ${schemaName}.mcq_exams (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          name TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL,
          question_count INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ${schemaName}.attempts (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          exam_type TEXT NOT NULL,
          exam_id TEXT NOT NULL REFERENCES ${schemaName}.mcq_exams(id) ON DELETE RESTRICT,
          user_id TEXT NOT NULL REFERENCES ${schemaName}.users(id) ON DELETE RESTRICT
        );

        CREATE TABLE IF NOT EXISTS ${schemaName}.attempt_events (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          attempt_id TEXT NOT NULL REFERENCES ${schemaName}.attempts(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          occurred_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ${schemaName}.roles (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ${schemaName}.role_permissions (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          role_id TEXT NOT NULL REFERENCES ${schemaName}.roles(id) ON DELETE CASCADE,
          permission_code TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ${schemaName}.categories (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          name TEXT NOT NULL,
          type TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ${schemaName}.category_values (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          category_id TEXT NOT NULL REFERENCES ${schemaName}.categories(id) ON DELETE CASCADE,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ${schemaName}.notifications (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          user_id TEXT NOT NULL REFERENCES ${schemaName}.users(id) ON DELETE CASCADE,
          message TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ${schemaName}.feedback (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          user_id TEXT NOT NULL REFERENCES ${schemaName}.users(id) ON DELETE CASCADE,
          feedback_text TEXT NOT NULL,
          rating INTEGER NOT NULL
        );
      `)
    } finally {
      setupClient.release()
    }
  })

  afterAll(async () => {
    const teardownClient = await pool.connect()
    try {
      await teardownClient.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`)
    } finally {
      teardownClient.release()
    }
  })

  beforeEach(async () => {
    client = await pool.connect()
    await client.query(`SET search_path TO ${schemaName}, public`)
    await client.query('BEGIN')
  })

  afterEach(async () => {
    await client.query('ROLLBACK')
    client.release()
  })

  it('T047-1: Delete subscription → child invoices cascade delete', async () => {
    const userResult = await client.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      ['sub-user@test.com', 'Sub User']
    )
    const userId = userResult.rows[0].id

    const subResult = await client.query(
      'INSERT INTO subscriptions (user_id, plan_type) VALUES ($1, $2) RETURNING id',
      [userId, 'PREMIUM']
    )
    const subscriptionId = subResult.rows[0].id

    await client.query('DELETE FROM subscriptions WHERE id = $1', [
      subscriptionId,
    ])

    const countResult = await client.query(
      'SELECT COUNT(*) FROM subscriptions WHERE id = $1',
      [subscriptionId]
    )
    expect(parseInt(countResult.rows[0].count, 10)).toBe(0)
  })

  it('T047-2: Delete attempt → child attempt_events cascade delete', async () => {
    const userResult = await client.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      ['attempt-user@test.com', 'Attempt User']
    )
    const userId = userResult.rows[0].id

    const examResult = await client.query(
      'INSERT INTO mcq_exams (name, duration_minutes, question_count) VALUES ($1, $2, $3) RETURNING id',
      ['Test Exam', 60, 10]
    )
    const examId = examResult.rows[0].id

    const attemptResult = await client.query(
      'INSERT INTO attempts (exam_type, exam_id, user_id) VALUES ($1, $2, $3) RETURNING id',
      ['MCQ', examId, userId]
    )
    const attemptId = attemptResult.rows[0].id

    await client.query(
      'INSERT INTO attempt_events (attempt_id, event_type, occurred_at) VALUES ($1, $2, $3)',
      [attemptId, 'START', new Date()]
    )

    let eventCount = await client.query(
      'SELECT COUNT(*) FROM attempt_events WHERE attempt_id = $1',
      [attemptId]
    )
    expect(parseInt(eventCount.rows[0].count, 10)).toBe(1)

    await client.query('DELETE FROM attempts WHERE id = $1', [attemptId])

    eventCount = await client.query(
      'SELECT COUNT(*) FROM attempt_events WHERE attempt_id = $1',
      [attemptId]
    )
    expect(parseInt(eventCount.rows[0].count, 10)).toBe(0)
  })

  it('T047-3: Delete role → child role_permissions cascade delete', async () => {
    const roleResult = await client.query(
      'INSERT INTO roles (code, name) VALUES ($1, $2) RETURNING id',
      ['TEST_ROLE', 'Test Role']
    )
    const roleId = roleResult.rows[0].id

    await client.query(
      'INSERT INTO role_permissions (role_id, permission_code) VALUES ($1, $2)',
      [roleId, 'exams:create']
    )
    await client.query(
      'INSERT INTO role_permissions (role_id, permission_code) VALUES ($1, $2)',
      [roleId, 'exams:read']
    )

    let permCount = await client.query(
      'SELECT COUNT(*) FROM role_permissions WHERE role_id = $1',
      [roleId]
    )
    expect(parseInt(permCount.rows[0].count, 10)).toBe(2)

    await client.query('DELETE FROM roles WHERE id = $1', [roleId])

    permCount = await client.query(
      'SELECT COUNT(*) FROM role_permissions WHERE role_id = $1',
      [roleId]
    )
    expect(parseInt(permCount.rows[0].count, 10)).toBe(0)
  })

  it('T047-4: Delete category → child category_values cascade delete', async () => {
    const catResult = await client.query(
      'INSERT INTO categories (name, type) VALUES ($1, $2) RETURNING id',
      ['DIFFICULTY', 'level']
    )
    const categoryId = catResult.rows[0].id

    await client.query(
      'INSERT INTO category_values (category_id, value) VALUES ($1, $2)',
      [categoryId, 'EASY']
    )
    await client.query(
      'INSERT INTO category_values (category_id, value) VALUES ($1, $2)',
      [categoryId, 'HARD']
    )

    let valueCount = await client.query(
      'SELECT COUNT(*) FROM category_values WHERE category_id = $1',
      [categoryId]
    )
    expect(parseInt(valueCount.rows[0].count, 10)).toBe(2)

    await client.query('DELETE FROM categories WHERE id = $1', [categoryId])

    valueCount = await client.query(
      'SELECT COUNT(*) FROM category_values WHERE category_id = $1',
      [categoryId]
    )
    expect(parseInt(valueCount.rows[0].count, 10)).toBe(0)
  })

  it('T047-5: Delete user → notifications and feedback cascade delete', async () => {
    const userResult = await client.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      ['cascade-user@test.com', 'Cascade User']
    )
    const userId = userResult.rows[0].id

    await client.query(
      'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
      [userId, 'Test notification']
    )
    await client.query(
      'INSERT INTO feedback (user_id, feedback_text, rating) VALUES ($1, $2, $3)',
      [userId, 'Great app', 5]
    )

    let notifCount = await client.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1',
      [userId]
    )
    let feedCount = await client.query(
      'SELECT COUNT(*) FROM feedback WHERE user_id = $1',
      [userId]
    )
    expect(parseInt(notifCount.rows[0].count, 10)).toBe(1)
    expect(parseInt(feedCount.rows[0].count, 10)).toBe(1)

    await client.query('DELETE FROM users WHERE id = $1', [userId])

    notifCount = await client.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1',
      [userId]
    )
    feedCount = await client.query(
      'SELECT COUNT(*) FROM feedback WHERE user_id = $1',
      [userId]
    )
    expect(parseInt(notifCount.rows[0].count, 10)).toBe(0)
    expect(parseInt(feedCount.rows[0].count, 10)).toBe(0)
  })
})
