/**
 * Integration Tests: Tenant Isolation
 *
 * File: apps/api/tests/integration/auto-selection-tenant-isolation.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T049
 *
 * Verifies that auto-selection treats each workspaceId as isolated — no
 * cross-tenant data leakage: separate pool fetches, independent results.
 */

import type { FetchEligiblePoolFn } from '@zidney/domain-core/attempts/auto-selection.service'
import { runAutoSelection } from '@zidney/domain-core/attempts/auto-selection.service'
import { describe, expect, it } from 'vitest'

const WORKSPACE_A = '10000000-0000-0000-0000-000000000001'
const WORKSPACE_B = '10000000-0000-0000-0000-000000000002'
const EXAM_A = '30000000-0000-0000-0000-000000000001'
const EXAM_B = '30000000-0000-0000-0000-000000000002'

// Generate N unique question IDs for a given tenant prefix
function tenantPool(prefix: string, count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `${prefix}0000-0000-0000-${String(i + 1).padStart(12, '0')}`
  )
}

const poolA = tenantPool('aaaaaaaaa', 20)
const poolB = tenantPool('bbbbbbbbb', 20)

function makeFetch(pool: string[]): {
  fn: FetchEligiblePoolFn
  calls: Parameters<FetchEligiblePoolFn>[]
} {
  const calls: Parameters<FetchEligiblePoolFn>[] = []
  const fn: FetchEligiblePoolFn = async (workspaceId, examId, filters, excludeIds) => {
    calls.push([workspaceId, examId, filters, excludeIds])
    return pool.filter((id) => !excludeIds.includes(id))
  }
  return { fn, calls }
}

describe('T049 — tenant isolation: workspace ID forwarded to pool fetch', () => {
  it('passes workspaceId A to fetchEligiblePool for tenant A', async () => {
    const fetchA = makeFetch(poolA)
    await runAutoSelection({
      workspaceId: WORKSPACE_A,
      examId: EXAM_A,
      totalQuestions: 5,
      criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
      manualQuestionIds: [],
      selectionSeed: 'seed-a',
      fetchEligiblePool: fetchA.fn,
    })
    expect(fetchA.calls.length).toBeGreaterThan(0)
    expect(fetchA.calls[0][0]).toBe(WORKSPACE_A)
  })

  it('passes workspaceId B to fetchEligiblePool for tenant B', async () => {
    const fetchB = makeFetch(poolB)
    await runAutoSelection({
      workspaceId: WORKSPACE_B,
      examId: EXAM_B,
      totalQuestions: 5,
      criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
      manualQuestionIds: [],
      selectionSeed: 'seed-b',
      fetchEligiblePool: fetchB.fn,
    })
    expect(fetchB.calls.length).toBeGreaterThan(0)
    expect(fetchB.calls[0][0]).toBe(WORKSPACE_B)
  })
})

describe('T049 — tenant isolation: no cross-tenant data leakage', () => {
  it('different workspaceIds produce independent selectedIds', async () => {
    const fetchA = makeFetch(poolA)
    const fetchB = makeFetch(poolB)

    const [resultA, resultB] = await Promise.all([
      runAutoSelection({
        workspaceId: WORKSPACE_A,
        examId: EXAM_A,
        totalQuestions: 5,
        criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
        manualQuestionIds: [],
        selectionSeed: 'same-seed',
        fetchEligiblePool: fetchA.fn,
      }),
      runAutoSelection({
        workspaceId: WORKSPACE_B,
        examId: EXAM_B,
        totalQuestions: 5,
        criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
        manualQuestionIds: [],
        selectionSeed: 'same-seed',
        fetchEligiblePool: fetchB.fn,
      }),
    ])

    // Pool contents are tenant-specific — no overlap
    const overlap = resultA.selectedIds.filter((id) => resultB.selectedIds.includes(id))
    expect(overlap).toHaveLength(0)
  })

  it('tenant A pool fetch is never called with tenant B workspace ID', async () => {
    const fetchA = makeFetch(poolA)
    const fetchB = makeFetch(poolB)

    await Promise.all([
      runAutoSelection({
        workspaceId: WORKSPACE_A,
        examId: EXAM_A,
        totalQuestions: 5,
        criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
        manualQuestionIds: [],
        selectionSeed: 'isolate-seed',
        fetchEligiblePool: fetchA.fn,
      }),
      runAutoSelection({
        workspaceId: WORKSPACE_B,
        examId: EXAM_B,
        totalQuestions: 5,
        criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
        manualQuestionIds: [],
        selectionSeed: 'isolate-seed',
        fetchEligiblePool: fetchB.fn,
      }),
    ])

    for (const call of fetchA.calls) {
      expect(call[0]).toBe(WORKSPACE_A)
    }
    for (const call of fetchB.calls) {
      expect(call[0]).toBe(WORKSPACE_B)
    }
  })

  it('examId is isolated per tenant call', async () => {
    const fetchA = makeFetch(poolA)
    await runAutoSelection({
      workspaceId: WORKSPACE_A,
      examId: EXAM_A,
      totalQuestions: 3,
      criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
      manualQuestionIds: [],
      selectionSeed: 'exam-id-check',
      fetchEligiblePool: fetchA.fn,
    })
    for (const call of fetchA.calls) {
      expect(call[1]).toBe(EXAM_A)
    }
  })
})
