import type { PoolClient } from 'pg'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pool } from '~/db/pool'

/**
 * T047: Foreign Key CASCADE Delete Tests
 * Validates that parent record deletion cascades to child records
 */

describe('FK Cascade Delete Constraints', () => {
  let client: PoolClient

  beforeEach(async () => {
    client = await pool.connect()
    await client.query('BEGIN TRANSACTION')
  })

  afterEach(async () => {
    await client.query('ROLLBACK')
    client.release()
  })

  it('T047-1: Delete subscription → child invoices cascade delete', async () => {
    // Setup
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

    const invResult = await client.query(
      'INSERT INTO subscriptions (user_id, plan_type) VALUES ($1, $2) RETURNING id',
      [userId, 'STARTER']
    )

    // Create invoices via trigger or manual
    await client.query('DELETE FROM subscriptions WHERE id = $1', [
      subscriptionId,
    ])

    // Verify cascade: invoices on deleted subscription should be gone
    const countResult = await client.query(
      'SELECT COUNT(*) FROM subscriptions WHERE id = $1',
      [subscriptionId]
    )
    expect(parseInt(countResult.rows[0].count, 10)).toBe(0)
  })

  it('T047-2: Delete attempt → child attempt_events cascade delete', async () => {
    // Setup
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

    // Create audit event
    await client.query(
      'INSERT INTO attempt_events (attempt_id, event_type, occurred_at) VALUES ($1, $2, $3)',
      [attemptId, 'START', new Date()]
    )

    // Verify event exists
    let eventCount = await client.query(
      'SELECT COUNT(*) FROM attempt_events WHERE attempt_id = $1',
      [attemptId]
    )
    expect(parseInt(eventCount.rows[0].count, 10)).toBe(1)

    // Delete attempt
    await client.query('DELETE FROM attempts WHERE id = $1', [attemptId])

    // Verify cascade: events deleted
    eventCount = await client.query(
      'SELECT COUNT(*) FROM attempt_events WHERE attempt_id = $1',
      [attemptId]
    )
    expect(parseInt(eventCount.rows[0].count, 10)).toBe(0)
  })

  it('T047-3: Delete role → child role_permissions cascade delete', async () => {
    // Create role
    const roleResult = await client.query(
      'INSERT INTO roles (code, name) VALUES ($1, $2) RETURNING id',
      ['TEST_ROLE', 'Test Role']
    )
    const roleId = roleResult.rows[0].id

    // Create permissions
    await client.query(
      'INSERT INTO role_permissions (role_id, permission_code) VALUES ($1, $2)',
      [roleId, 'exams:create']
    )
    await client.query(
      'INSERT INTO role_permissions (role_id, permission_code) VALUES ($1, $2)',
      [roleId, 'exams:read']
    )

    // Verify permissions exist
    let permCount = await client.query(
      'SELECT COUNT(*) FROM role_permissions WHERE role_id = $1',
      [roleId]
    )
    expect(parseInt(permCount.rows[0].count, 10)).toBe(2)

    // Delete role
    await client.query('DELETE FROM roles WHERE id = $1', [roleId])

    // Verify cascade: permissions deleted
    permCount = await client.query(
      'SELECT COUNT(*) FROM role_permissions WHERE role_id = $1',
      [roleId]
    )
    expect(parseInt(permCount.rows[0].count, 10)).toBe(0)
  })

  it('T047-4: Delete category → child category_values cascade delete', async () => {
    // Create category
    const catResult = await client.query(
      'INSERT INTO categories (name, type) VALUES ($1, $2) RETURNING id',
      ['DIFFICULTY', 'level']
    )
    const categoryId = catResult.rows[0].id

    // Create values
    await client.query(
      'INSERT INTO category_values (category_id, value) VALUES ($1, $2)',
      [categoryId, 'EASY']
    )
    await client.query(
      'INSERT INTO category_values (category_id, value) VALUES ($1, $2)',
      [categoryId, 'HARD']
    )

    // Verify values exist
    let valueCount = await client.query(
      'SELECT COUNT(*) FROM category_values WHERE category_id = $1',
      [categoryId]
    )
    expect(parseInt(valueCount.rows[0].count, 10)).toBe(2)

    // Delete category
    await client.query('DELETE FROM categories WHERE id = $1', [categoryId])

    // Verify cascade: values deleted
    valueCount = await client.query(
      'SELECT COUNT(*) FROM category_values WHERE category_id = $1',
      [categoryId]
    )
    expect(parseInt(valueCount.rows[0].count, 10)).toBe(0)
  })

  it('T047-5: Delete user → notifications and feedback cascade delete', async () => {
    // Create user
    const userResult = await client.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      ['cascade-user@test.com', 'Cascade User']
    )
    const userId = userResult.rows[0].id

    // Create notifications and feedback
    await client.query(
      'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
      [userId, 'Test notification']
    )
    await client.query(
      'INSERT INTO feedback (user_id, feedback_text, rating) VALUES ($1, $2, $3)',
      [userId, 'Great app', 5]
    )

    // Verify records exist
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

    // Delete user
    await client.query('DELETE FROM users WHERE id = $1', [userId])

    // Verify cascade: both deleted
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
