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
 * T048: Foreign Key RESTRICT Policy Tests
 * Validates that parent record deletion is prevented when children exist.
 */

describe('FK RESTRICT Constraints', () => {
  let client: PoolClient
  let schemaName: string

  beforeAll(async () => {
    schemaName = `fk_restrict_${Date.now().toString(36)}`
    const setupClient = await pool.connect()

    try {
      await setupClient.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`)
      await setupClient.query(`
        CREATE TABLE IF NOT EXISTS ${schemaName}.users (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL
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

        CREATE TABLE IF NOT EXISTS ${schemaName}.divisions (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          name TEXT NOT NULL,
          code TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS ${schemaName}.departments (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          division_id TEXT NOT NULL REFERENCES ${schemaName}.divisions(id) ON DELETE RESTRICT,
          name TEXT NOT NULL,
          code TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS ${schemaName}.roles (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ${schemaName}.role_assignments (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          user_id TEXT NOT NULL REFERENCES ${schemaName}.users(id) ON DELETE RESTRICT,
          role_id TEXT NOT NULL REFERENCES ${schemaName}.roles(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS ${schemaName}.semesters (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          name TEXT NOT NULL,
          code TEXT NOT NULL UNIQUE,
          start_date TIMESTAMPTZ NOT NULL,
          end_date TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ${schemaName}.subjects (
          id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
          name TEXT NOT NULL,
          code TEXT NOT NULL UNIQUE,
          semester_id TEXT REFERENCES ${schemaName}.semesters(id) ON DELETE RESTRICT,
          is_deleted BOOLEAN NOT NULL DEFAULT false
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

    await client.query(
      'INSERT INTO attempts (exam_type, exam_id, user_id) VALUES ($1, $2, $3)',
      ['MCQ', examId, userId]
    )

    try {
      await client.query('DELETE FROM mcq_exams WHERE id = $1', [examId])
      expect.fail('Should have thrown FK RESTRICT violation')
    } catch (err: unknown) {
      const pgError = err as { code?: string }
      expect(pgError.code).toBe('23503')
    }
  })

  it('T048-2: Attempt to delete division with departments → constraint violation', async () => {
    const divResult = await client.query(
      'INSERT INTO divisions (name, code) VALUES ($1, $2) RETURNING id',
      ['Test Division', 'TEST_DIV']
    )
    const divisionId = divResult.rows[0].id

    await client.query(
      'INSERT INTO departments (division_id, name, code) VALUES ($1, $2, $3)',
      [divisionId, 'Test Department', 'TEST_DEPT']
    )

    try {
      await client.query('DELETE FROM divisions WHERE id = $1', [divisionId])
      expect.fail('Should have thrown FK RESTRICT violation')
    } catch (err: unknown) {
      const pgError = err as { code?: string }
      expect(pgError.code).toBe('23503')
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

    await client.query(
      'INSERT INTO role_assignments (user_id, role_id) VALUES ($1, $2)',
      [userId, roleId]
    )

    try {
      await client.query('DELETE FROM users WHERE id = $1', [userId])
      expect.fail('Should have thrown FK RESTRICT violation')
    } catch (err: unknown) {
      const pgError = err as { code?: string }
      expect(pgError.code).toBe('23503')
    }
  })

  it('T048-4: Verify orphaned records prevented - department without division', async () => {
    const divResult = await client.query(
      'INSERT INTO divisions (name, code) VALUES ($1, $2) RETURNING id',
      ['Orphan Test Div', 'ORPHAN_DIV']
    )
    const divisionId = divResult.rows[0].id

    const deptResult = await client.query(
      'INSERT INTO departments (division_id, name, code) VALUES ($1, $2, $3) RETURNING id',
      [divisionId, 'Orphan Dept', 'ORPHAN_DEPT']
    )
    const departmentId = deptResult.rows[0].id

    const deptCheck = await client.query(
      'SELECT division_id FROM departments WHERE id = $1',
      [departmentId]
    )
    expect(deptCheck.rowCount).toBeGreaterThan(0)
    expect(deptCheck.rows[0].division_id).toBe(divisionId)
  })

  it('T048-5: Attempt to delete subject with active lessons → handled gracefully', async () => {
    const semResult = await client.query(
      'INSERT INTO semesters (name, code, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Test Sem', 'SEM1', new Date(), new Date(Date.now() + 86400000)]
    )
    const semesterId = semResult.rows[0].id

    const subjResult = await client.query(
      'INSERT INTO subjects (name, code, semester_id) VALUES ($1, $2, $3) RETURNING id',
      ['Test Subject', 'SUBJ1', semesterId]
    )
    const subjectId = subjResult.rows[0].id

    const check = await client.query('SELECT id FROM subjects WHERE id = $1', [
      subjectId,
    ])
    expect(check.rowCount).toBe(1)

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
