/**
 * Test Fixtures & Factory Functions
 * Provides deterministic test data creation for isolated test scenarios
 */

import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'

export interface Workspace {
  id: string
  slug: string
  name: string
  created_at: string
  updated_at: string
}

export interface License {
  id: string
  workspace_id: string
  product_id: string
  status: 'ACTIVE' | 'SOFT_LOCKED' | 'ARCHIVED' | 'DELETED'
  max_students: number
  max_staff: number
  schema_version: string
  product_version: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  workspace_id: string
  email: string
  role: 'admin' | 'staff' | 'student'
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  workspace_id: string
  email: string
  first_name: string
  last_name: string
  created_at: string
  updated_at: string
}

export interface Exam {
  id: string
  workspace_id: string
  title: string
  duration_minutes: number
  pass_threshold: number
  passing_grade: string
  question_count: number
  total_points: number
  created_at: string
  updated_at: string
}

export interface Attempt {
  id: string
  workspace_id: string
  student_id: string
  exam_id: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED'
  snapshot: Record<string, any>
  started_at: string
  deadline_at: string
  completed_at: string | null
  result: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface Question {
  id: string
  exam_id: string
  question_id: number
  title: string
  type: 'multiple_choice' | 'short_answer' | 'essay'
  points: number
  options?: string[]
  correct_answer?: string | string[]
  created_at: string
}

/**
 * Create a unique workspace for testing
 * @param db Master database connection
 * @param overrides Optional field overrides
 * @returns Workspace object
 */
export async function seedWorkspace(db: Pool, overrides?: Partial<Workspace>): Promise<Workspace> {
  const id = overrides?.id ?? randomUUID()
  const slug = overrides?.slug ?? `test-ws-${randomUUID().slice(0, 8)}`
  const name = overrides?.name ?? `Test Workspace ${slug}`
  const now = new Date().toISOString()

  const result = await db.query(
    `INSERT INTO workspaces (id, slug, name, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, slug, name, now, now]
  )

  return result.rows[0]
}

/**
 * Create a license for a workspace
 * @param db Master database connection
 * @param overrides Optional field overrides
 * @returns License object
 */
export async function seedLicense(db: Pool, overrides?: Partial<License>): Promise<License> {
  const id = overrides?.id ?? randomUUID()
  const workspace_id = overrides?.workspace_id ?? randomUUID()
  const product_id = overrides?.product_id ?? randomUUID()
  const status = overrides?.status ?? 'ACTIVE'
  const max_students = overrides?.max_students ?? 1000
  const max_staff = overrides?.max_staff ?? 100
  const schema_version = overrides?.schema_version ?? '1.0.0'
  const product_version = overrides?.product_version ?? '1.0.0'
  const now = new Date().toISOString()

  const result = await db.query(
    `INSERT INTO licenses 
     (id, workspace_id, product_id, status, max_students, max_staff, schema_version, product_version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      id,
      workspace_id,
      product_id,
      status,
      max_students,
      max_staff,
      schema_version,
      product_version,
      now,
      now,
    ]
  )

  return result.rows[0]
}

/**
 * Create a user in a tenant database
 * @param db Tenant database connection
 * @param overrides Optional field overrides
 * @returns User object
 */
export async function seedUser(db: Pool, overrides?: Partial<User>): Promise<User> {
  const id = overrides?.id ?? randomUUID()
  const workspace_id = overrides?.workspace_id ?? randomUUID()
  const email = overrides?.email ?? `user-${randomUUID().slice(0, 8)}@test.com`
  const role = overrides?.role ?? 'student'
  const now = new Date().toISOString()

  const result = await db.query(
    `INSERT INTO users (id, workspace_id, email, role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, workspace_id, email, role, now, now]
  )

  return result.rows[0]
}

/**
 * Create student records
 * @param db Tenant database connection
 * @param count Number of students to create
 * @param workspaceId Workspace ID
 * @returns Array of Student objects
 */
export async function seedStudents(
  db: Pool,
  workspaceId: string,
  count: number = 1
): Promise<Student[]> {
  const students: Student[] = []
  const now = new Date().toISOString()

  for (let i = 0; i < count; i++) {
    const id = randomUUID()
    const email = `student-${i}-${randomUUID().slice(0, 6)}@test.com`
    const result = await db.query(
      `INSERT INTO students (id, workspace_id, email, first_name, last_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, workspaceId, email, `First${i}`, `Last${i}`, now, now]
    )
    students.push(result.rows[0])
  }

  return students
}

/**
 * Create an exam with questions
 * @param db Tenant database connection
 * @param overrides Optional field overrides
 * @returns Exam object
 */
export async function seedExam(db: Pool, overrides?: Partial<Exam>): Promise<Exam> {
  const id = overrides?.id ?? randomUUID()
  const workspace_id = overrides?.workspace_id ?? randomUUID()
  const title = overrides?.title ?? `Test Exam ${randomUUID().slice(0, 6)}`
  const duration_minutes = overrides?.duration_minutes ?? 60
  const pass_threshold = overrides?.pass_threshold ?? 60
  const passing_grade = overrides?.passing_grade ?? 'D'
  const question_count = overrides?.question_count ?? 5
  const total_points = overrides?.total_points ?? 100
  const now = new Date().toISOString()

  const result = await db.query(
    `INSERT INTO exams (id, workspace_id, title, duration_minutes, pass_threshold, passing_grade, question_count, total_points, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      id,
      workspace_id,
      title,
      duration_minutes,
      pass_threshold,
      passing_grade,
      question_count,
      total_points,
      now,
      now,
    ]
  )

  return result.rows[0]
}

/**
 * Create an attempt with snapshot
 * @param db Tenant database connection
 * @param overrides Optional field overrides
 * @returns Attempt object
 */
export async function seedAttempt(db: Pool, overrides?: Partial<Attempt>): Promise<Attempt> {
  const id = overrides?.id ?? randomUUID()
  const workspace_id = overrides?.workspace_id ?? randomUUID()
  const student_id = overrides?.student_id ?? randomUUID()
  const exam_id = overrides?.exam_id ?? randomUUID()
  const status = overrides?.status ?? 'PENDING'
  const snapshot = overrides?.snapshot ?? {
    exam_config: { pass_threshold: 60, passing_grade: 'D', questions: 5 },
  }
  const started_at = overrides?.started_at ?? new Date().toISOString()
  const deadline_at = overrides?.deadline_at ?? new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const result = await db.query(
    `INSERT INTO attempts (id, workspace_id, student_id, exam_id, status, snapshot, started_at, deadline_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      id,
      workspace_id,
      student_id,
      exam_id,
      status,
      JSON.stringify(snapshot),
      started_at,
      deadline_at,
      now,
      now,
    ]
  )

  return result.rows[0]
}

/**
 * Create a submission record
 * @param db Tenant database connection
 * @param overrides Optional field overrides
 * @returns Submission record
 */
export async function seedSubmission(db: Pool, overrides?: any): Promise<any> {
  const job_id = overrides?.job_id ?? randomUUID()
  const attempt_id = overrides?.attempt_id ?? randomUUID()
  const now = new Date().toISOString()

  const result = await db.query(
    `INSERT INTO attempt_submissions (job_id, attempt_id, submitted_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [job_id, attempt_id, now]
  )

  return result.rows[0]
}

/**
 * Cleanup all test fixtures
 * @param db Database connection
 */
export async function cleanupAllFixtures(db: Pool): Promise<void> {
  const tables = [
    'attempt_submissions',
    'attempts',
    'questions',
    'exams',
    'students',
    'users',
    'licenses',
    'workspaces',
  ]

  for (const table of tables) {
    try {
      await db.query(`TRUNCATE TABLE ${table} CASCADE`)
    } catch (_error) {
      // Table may not exist, which is fine
    }
  }
}
