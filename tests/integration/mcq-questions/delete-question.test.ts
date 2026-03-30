/**
 * Integration Tests: DELETE /api/v1/backoffice/workspace/mcq-questions/:questionId
 *
 * File: tests/integration/mcq-questions/delete-question.test.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL — T040
 *
 * Tests hard delete (DRAFT, no refs) and soft delete (non-DRAFT) paths.
 * Uses dependency-registry module mock for active-attempt blocker test.
 */

import { mcqQuestionsRouter } from '@zidney/app/api/routes/backoffice/mcq-questions/index'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

// Mock the dependency registry so we control reference check behaviour per test
// vi.hoisted ensures the function is available when vi.mock factory runs (hoisting safe)
const mockCheckQuestionReferences = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    hasReferences: false,
    isActiveAttempt: false,
  })
)

vi.mock('@zidney/domain-core/mcq-questions/mcq-questions.dependency-registry', () => ({
  checkQuestionReferences: mockCheckQuestionReferences,
  registerQuestionReferenceChecker: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const USER_ID = '00000000-0000-0000-0000-000000000010'
const SUBJECT_ID = '00000000-0000-0000-0000-000000000020'
const QUESTION_ID = '00000000-0000-0000-0000-000000000030'
const NOW = new Date('2026-01-01T00:00:00.000Z')

// ---------------------------------------------------------------------------
// Mock Pool
// ---------------------------------------------------------------------------

function buildMockPool(
  options: { questionRow?: Record<string, unknown> | null; status?: string } = {}
) {
  const { questionRow, status = 'DRAFT' } = options

  const defaultQuestionRow = {
    id: QUESTION_ID,
    subject_id: SUBJECT_ID,
    division_id: null,
    lesson_id: null,
    question_type: 'SINGLE',
    language: 'ar',
    content: '<p>Test question</p>',
    explanation: null,
    is_revision_only: false,
    is_exam_only: false,
    status,
    deleted_at: null,
    created_at: NOW,
    updated_at: NOW,
    created_by: USER_ID,
    updated_by: USER_ID,
    status_updated_at: null,
    status_updated_by: null,
  }

  const resolvedRow = questionRow !== undefined ? questionRow : defaultQuestionRow

  return {
    query: vi.fn().mockImplementation(async (sql: string) => {
      const s = sql.trim()

      if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') {
        return { rows: [], rowCount: 0 }
      }

      // findQuestionById
      if (s.includes('mcq_questions') && s.includes('SELECT') && s.includes('deleted_at IS NULL')) {
        if (!resolvedRow) return { rows: [], rowCount: 0 }
        return { rows: [resolvedRow], rowCount: 1 }
      }

      // Hard delete (DELETE FROM mcq_questions WHERE id = $1)
      if (s.includes('mcq_questions') && s.includes('DELETE')) {
        return { rows: [], rowCount: 1 }
      }

      // Soft delete (UPDATE mcq_questions SET deleted_at = NOW())
      if (s.includes('mcq_questions') && s.includes('UPDATE') && s.includes('deleted_at')) {
        return { rows: [], rowCount: 1 }
      }

      return { rows: [], rowCount: 0 }
    }),
  }
}

// ---------------------------------------------------------------------------
// App Factory
// ---------------------------------------------------------------------------

function createTestApp(pool: ReturnType<typeof buildMockPool>) {
  const app = new Hono()

  app.use('*', async (c, next) => {
    ;(c as any).set('tenant', { id: TENANT_ID, slug: 'test-ws', pool })
    ;(c as any).set('user', { id: USER_ID })
    ;(c as any).set('rbacContext', { permissions: ['question_manage'] })
    ;(c as any).set('correlation_id', 'corr-001')
    ;(c as any).set('workspace_slug', 'test-ws')
    ;(c as any).set('workspace_id', TENANT_ID)
    await next()
  })

  app.route('/api/v1/backoffice/workspace', mcqQuestionsRouter)

  return app
}

const DELETE_URL = `/api/v1/backoffice/workspace/mcq-questions/${QUESTION_ID}`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DELETE /mcq-questions/:questionId', () => {
  describe('hard delete — DRAFT question with no references', () => {
    it('returns 200 with deleteType=hard when question is DRAFT and no references', async () => {
      mockCheckQuestionReferences.mockResolvedValueOnce({
        hasReferences: false,
        isActiveAttempt: false,
      })
      const pool = buildMockPool({ status: 'DRAFT' })
      const app = createTestApp(pool)

      const res = await app.request(DELETE_URL, { method: 'DELETE' })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.deleted).toBe(true)
      expect(body.data.deleteType).toBe('hard')
    })

    it('calls DELETE SQL (not UPDATE with deleted_at) for hard delete', async () => {
      mockCheckQuestionReferences.mockResolvedValueOnce({
        hasReferences: false,
        isActiveAttempt: false,
      })
      const pool = buildMockPool({ status: 'DRAFT' })
      const app = createTestApp(pool)

      await app.request(DELETE_URL, { method: 'DELETE' })

      const hardDeleteCalled = pool.query.mock.calls.some(
        (c: unknown[]) =>
          typeof c[0] === 'string' &&
          c[0].includes('mcq_questions') &&
          c[0].trim().startsWith('DELETE')
      )
      expect(hardDeleteCalled).toBe(true)
    })
  })

  describe('soft delete — non-DRAFT question', () => {
    it('returns 200 with deleteType=soft when question is APPROVED', async () => {
      mockCheckQuestionReferences.mockResolvedValueOnce({
        hasReferences: false,
        isActiveAttempt: false,
      })
      const pool = buildMockPool({ status: 'APPROVED' })
      const app = createTestApp(pool)

      const res = await app.request(DELETE_URL, { method: 'DELETE' })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.deleteType).toBe('soft')
    })

    it('uses UPDATE SET deleted_at SQL for soft delete', async () => {
      mockCheckQuestionReferences.mockResolvedValueOnce({
        hasReferences: false,
        isActiveAttempt: false,
      })
      const pool = buildMockPool({ status: 'APPROVED' })
      const app = createTestApp(pool)

      await app.request(DELETE_URL, { method: 'DELETE' })

      const softDeleteCalled = pool.query.mock.calls.some(
        (c: unknown[]) =>
          typeof c[0] === 'string' &&
          c[0].includes('mcq_questions') &&
          c[0].includes('UPDATE') &&
          c[0].includes('deleted_at')
      )
      expect(softDeleteCalled).toBe(true)
    })
  })

  describe('deletion guard — active attempt reference', () => {
    it('returns 409 QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT when isActiveAttempt=true', async () => {
      mockCheckQuestionReferences.mockResolvedValueOnce({
        hasReferences: true,
        isActiveAttempt: true,
      })
      const pool = buildMockPool({ status: 'ENABLED' })
      const app = createTestApp(pool)

      const res = await app.request(DELETE_URL, { method: 'DELETE' })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error.code).toBe('QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT')
    })
  })

  describe('soft delete — DRAFT with references (hasReferences=true)', () => {
    it('returns 200 with deleteType=soft when DRAFT but has non-active references', async () => {
      mockCheckQuestionReferences.mockResolvedValueOnce({
        hasReferences: true,
        isActiveAttempt: false,
      })
      const pool = buildMockPool({ status: 'DRAFT' })
      const app = createTestApp(pool)

      const res = await app.request(DELETE_URL, { method: 'DELETE' })

      expect(res.status).toBe(200)
      const body = await res.json()
      // DRAFT but has references → soft delete (not hard)
      expect(body.data.deleteType).toBe('soft')
    })
  })

  describe('not found', () => {
    it('returns 404 QUESTION_NOT_FOUND when question does not exist', async () => {
      const pool = buildMockPool({ questionRow: null })
      const app = createTestApp(pool)

      const res = await app.request(DELETE_URL, { method: 'DELETE' })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error.code).toBe('QUESTION_NOT_FOUND')
    })
  })

  describe('transaction integrity', () => {
    it('wraps delete in BEGIN/COMMIT', async () => {
      mockCheckQuestionReferences.mockResolvedValueOnce({
        hasReferences: false,
        isActiveAttempt: false,
      })
      const pool = buildMockPool({ status: 'DRAFT' })
      const app = createTestApp(pool)

      await app.request(DELETE_URL, { method: 'DELETE' })

      const calls = pool.query.mock.calls.map((c: unknown[]) => (c[0] as string).trim())
      expect(calls).toContain('BEGIN')
      expect(calls).toContain('COMMIT')
    })
  })
})
