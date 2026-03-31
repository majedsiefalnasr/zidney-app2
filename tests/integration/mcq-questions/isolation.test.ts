/**
 * Integration Tests: Tenant isolation for MCQ questions
 *
 * File: tests/integration/mcq-questions/isolation.test.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL — T044
 *
 * Verifies that requests for tenant A never hit tenant B's pool and vice versa.
 * Two separate Hono app instances are wired to different mock pools.
 */

import { mcqQuestionsRouter } from '@zidney/app/api/routes/backoffice/mcq-questions/index'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_A_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const TENANT_B_ID = 'bbbbbbbb-0000-0000-0000-000000000002'
const USER_ID = '00000000-0000-0000-0000-000000000010'
const SUBJECT_ID = '00000000-0000-0000-0000-000000000020'
const QA_ID = 'aaqqqqqq-0000-0000-0000-000000000030'
const QB_ID = 'bbqqqqqq-0000-0000-0000-000000000031'
const NOW = new Date('2026-01-01T00:00:00.000Z')

function makeQuestionRow(id: string, createdBy: string) {
  return {
    id,
    subject_id: SUBJECT_ID,
    division_id: null,
    lesson_id: null,
    question_type: 'SINGLE',
    language: 'ar',
    content: '<p>Q</p>',
    explanation: null,
    is_revision_only: false,
    is_exam_only: false,
    status: 'DRAFT',
    deleted_at: null,
    created_at: NOW,
    updated_at: NOW,
    created_by: createdBy,
    updated_by: createdBy,
    status_updated_at: null,
    status_updated_by: null,
  }
}

// ---------------------------------------------------------------------------
// Pool factories
// ---------------------------------------------------------------------------

function buildTenantPool(rows: ReturnType<typeof makeQuestionRow>[], total: number) {
  return {
    query: vi.fn().mockImplementation(async (sql: string) => {
      const s = sql.trim()
      if (s.includes('COUNT(*)')) {
        return { rows: [{ count: String(total) }], rowCount: 1 }
      }
      if (s.includes('FROM mcq_questions') && s.includes('LIMIT')) {
        return { rows, rowCount: rows.length }
      }
      return { rows: [], rowCount: 0 }
    }),
  }
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

function createTenantApp(tenantId: string, pool: ReturnType<typeof buildTenantPool>) {
  const app = new Hono()

  app.use('*', async (c, next) => {
    ;(c as any).set('tenant', { id: tenantId, slug: `ws-${tenantId.slice(0, 4)}`, pool })
    ;(c as any).set('user', { id: USER_ID })
    ;(c as any).set('rbacContext', { permissions: ['question_manage'] })
    ;(c as any).set('correlation_id', `corr-${tenantId.slice(0, 4)}`)
    ;(c as any).set('workspace_slug', `ws-${tenantId.slice(0, 4)}`)
    ;(c as any).set('workspace_id', tenantId)
    await next()
  })

  app.route('/api/v1/backoffice/workspace', mcqQuestionsRouter)

  return app
}

const BASE_URL = '/api/v1/backoffice/workspace/mcq-questions'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCQ questions tenant isolation', () => {
  it('tenant A queries only hit tenant A pool', async () => {
    const poolA = buildTenantPool([makeQuestionRow(QA_ID, TENANT_A_ID)], 1)
    const poolB = buildTenantPool([makeQuestionRow(QB_ID, TENANT_B_ID)], 1)

    const appA = createTenantApp(TENANT_A_ID, poolA)
    createTenantApp(TENANT_B_ID, poolB) // mount but don't call

    const res = await appA.request(BASE_URL)
    expect(res.status).toBe(200)

    // Pool A was hit
    expect(poolA.query).toHaveBeenCalled()
    // Pool B was never touched
    expect(poolB.query).not.toHaveBeenCalled()
  })

  it('tenant B queries only hit tenant B pool', async () => {
    const poolA = buildTenantPool([makeQuestionRow(QA_ID, TENANT_A_ID)], 1)
    const poolB = buildTenantPool([makeQuestionRow(QB_ID, TENANT_B_ID)], 1)

    createTenantApp(TENANT_A_ID, poolA) // mount but don't call
    const appB = createTenantApp(TENANT_B_ID, poolB)

    const res = await appB.request(BASE_URL)
    expect(res.status).toBe(200)

    // Pool B was hit
    expect(poolB.query).toHaveBeenCalled()
    // Pool A was never touched
    expect(poolA.query).not.toHaveBeenCalled()
  })

  it('tenant A and tenant B requests return their own data', async () => {
    const poolA = buildTenantPool([makeQuestionRow(QA_ID, TENANT_A_ID)], 1)
    const poolB = buildTenantPool([makeQuestionRow(QB_ID, TENANT_B_ID)], 5)

    const appA = createTenantApp(TENANT_A_ID, poolA)
    const appB = createTenantApp(TENANT_B_ID, poolB)

    const [resA, resB] = await Promise.all([appA.request(BASE_URL), appB.request(BASE_URL)])

    const bodyA = await resA.json()
    const bodyB = await resB.json()

    // Each tenant gets its own total
    expect(bodyA.data.total).toBe(1)
    expect(bodyB.data.total).toBe(5)

    // Each tenant gets its own question IDs
    expect(bodyA.data.data[0].id).toBe(QA_ID)
    expect(bodyB.data.data[0].id).toBe(QB_ID)
  })
})
