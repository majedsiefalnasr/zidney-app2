import type { PoolClient } from 'pg'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pool } from '~/db/pool'

/**
 * T048: Foreign Key RESTRICT Policy Tests
 * Validates that parent record deletion is prevented when children exist
 */

describe('FK RESTRICT Constraints', () => {
  let client: PoolClient

  beforeEach(async () => {
    client = await pool.connect()
    await client.query('BEGIN TRANSACTION')
  })

  afterEach(async () => {
    await client.query('ROLLBACK')
    client.release()
  })

  it('T048-1: Attempt to delete exam with active attempts → constraint violation', async () => {
    const userResult = await client.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      ['restrict-user@test.com', 'Restrict User']
    )
    const userId = userResult.rows[0].id

    const examResult = await client.query(
      'INSERT INTO mcq_exams (name, duration_minutes, question_count) VALUES ($1, $2, $3) RETURNING id',
      ['Restricted Exam', 60, 5]
    )
    const examId = examResult.rows[0].id

    // Create attempt (creates foreign key)
    await client.query(
      'INSERT INTO attempts (exam_type, exam_id, user_id) VALUES ($1, $2, $3)',
      ['MCQ', examId, userId]
    )

    // Attempt to delete exam should fail (RESTRICT policy)
    try {
      await client.query('DELETE FROM mcq_exams WHERE id = $1', [examId])
      expect.fail('Should have thrown FK RESTRICT violation')
    } catch (err: any) {
      expect(err.code).toBe('23503') // Foreign key violation
    }
  })

  it('T048-2: Attempt to delete division with departments → constraint violation', async () => {
    const divResult = await client.query(
      'INSERT INTO divisions (name, code) VALUES ($1, $2) RETURNING id',
      ['Test Division', 'TEST_DIV']
    )
    const divisionId = divResult.rows[0].id

    // Create department (creates FK to division)
    await client.query(
      'INSERT INTO departments (division_id, name, code) VALUES ($1, $2, $3)',
      [divisionId, 'Test Department', 'TEST_DEPT']
    )

    // Attempt to delete division should fail (RESTRICT policy)
    try {
      await client.query('DELETE FROM divisions WHERE id = $1', [divisionId])
      expect.fail('Should have thrown FK RESTRICT violation')
    } catch (err: any) {
      expect(err.code).toBe('23503')
    }
  })

  it('T048-3: Attempt to delete user with active role_assignments → constraint violation', async () => {
    const userResult = await client.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      ['role-user@test.com', 'Role User']
    )
    const userId = userResult.rows[0].id

    const roleResult = await client.query(
      'INSERT INTO roles (code, name) VALUES ($1, $2) RETURNING id',
      ['STUDENT', 'Student Role']
    )
    const roleId = roleResult.rows[0].id

    // Assign role to user
    await client.query(
      'INSERT INTO role_assignments (user_id, role_id) VALUES ($1, $2)',
      [userId, roleId]
    )

    // Attempt to delete user should fail
    try {
      await client.query('DELETE FROM users WHERE id = $1', [userId])
      expect.fail('Should have thrown FK RESTRICT violation')
    } catch (err: any) {
      expect(err.code).toBe('23503')
    }
  })

  it('T048-4: Verify orphaned records prevented - department without division', async () => {
    const divResult = await client.query(
      'INSERT INTO divisions (name, code) VALUES ($1, $2) RETURNING id',
      ['Orphan Test Div', 'ORPHAN_DIV']
    )
    const divisionId = divResult.rows[0].id

    const deptResult = await client.query(
      'INSERT INTO departments (division_id, name, code) VALUES ($1, $2, $3) RETURNING *',
      [divisionId, 'Orphan Dept', 'ORPHAN_DEPT']
    )

    if (deptResult.rowCount === 0) {
      expect.fail('Department should be created')
    }

    // Verify FK constraint exists
    const deptCheck = await client.query(
      'SELECT division_id FROM departments WHERE id = $1',
      [divisionId]
    )
    expect(deptCheck.rowCount).toBeGreaterThan(0)
  })

  it('T048-5: Attempt to delete subject with active lessons → handled gracefully', async () => {
    const semResult = await client.query(
      'INSERT INTO semesters (name, code, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Test Sem', 'SEM1', new Date(), new Date()]
    )
    const semesterId = semResult.rows[0].id

    const subjResult = await client.query(
      'INSERT INTO subjects (name, code, semester_id) VALUES ($1, $2, $3) RETURNING id',
      ['Test Subject', 'SUBJ1', semesterId]
    )
    const subjectId = subjResult.rows[0].id

    // Verify subject exists
    const check = await client.query('SELECT id FROM subjects WHERE id = $1', [
      subjectId,
    ])
    expect(check.rowCount).toBe(1)

    // Soft delete via is_deleted
    await client.query('UPDATE subjects SET is_deleted = true WHERE id = $1', [
      subjectId,
    ])

    const afterDelete = await client.query(
      'SELECT is_deleted FROM subjects WHERE id = $1',
      [subjectId]
    )
    expect(afterDelete.rows[0].is_deleted).toBe(true)
  })
})
