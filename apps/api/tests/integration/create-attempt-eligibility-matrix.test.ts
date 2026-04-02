/**
 * Integration Tests: Eligibility Constraints Matrix
 *
 * File: apps/api/tests/integration/create-attempt-eligibility-matrix.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T039
 *
 * Validates that each filter dimension (lesson, category, tag, basket, semester)
 * is forwarded to fetchEligiblePool with the correct CriteriaBlockFilters.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  runAutoSelection,
  type AutoSelectionInput,
  type CriteriaBlock,
  type FetchEligiblePoolFn,
  type CriteriaBlockFilters,
} from '@zidney/domain-core/attempts/auto-selection.service'
import {
  FIXTURE_WORKSPACE_ID,
  FIXTURE_EXAM_ID,
  FIXTURE_QUESTION_IDS,
  FIXTURE_LESSON_ID,
  FIXTURE_CATEGORY_ID,
  FIXTURE_TAG_ID,
  FIXTURE_BASKET_ID,
  FIXTURE_SEMESTER_ID,
} from '../fixtures/auto-selection.fixture'

const POOL = FIXTURE_QUESTION_IDS

function makeInput(blocks: CriteriaBlock[], fetch: FetchEligiblePoolFn, total = 5): AutoSelectionInput {
  return {
    workspaceId: FIXTURE_WORKSPACE_ID,
    examId: FIXTURE_EXAM_ID,
    totalQuestions: total,
    criteriaBlocks: blocks,
    manualQuestionIds: [],
    selectionSeed: 'eligibility-matrix-seed',
    fetchEligiblePool: fetch,
  }
}

function block(id: string, filters: CriteriaBlockFilters): CriteriaBlock {
  return { id, percentage: null, fixed_count: 5, filters }
}

function extractFetchCallFilters(fetch: ReturnType<typeof vi.fn>, callIndex = 0): CriteriaBlockFilters {
  return fetch.mock.calls[callIndex]![3] as CriteriaBlockFilters
}

// ── Filter dimension forwarding ───────────────────────────────────────────────

describe('T039 — lesson filter forwarded', () => {
  it('passes lessonIds to fetchEligiblePool', async () => {
    const fetch = vi.fn().mockResolvedValue([...POOL])
    await runAutoSelection(makeInput([block('B1', { lessonIds: [FIXTURE_LESSON_ID] })], fetch))
    expect(extractFetchCallFilters(fetch).lessonIds).toContain(FIXTURE_LESSON_ID)
  })
})

describe('T039 — category filter forwarded', () => {
  it('passes categoryIds to fetchEligiblePool', async () => {
    const fetch = vi.fn().mockResolvedValue([...POOL])
    await runAutoSelection(makeInput([block('B1', { categoryIds: [FIXTURE_CATEGORY_ID] })], fetch))
    expect(extractFetchCallFilters(fetch).categoryIds).toContain(FIXTURE_CATEGORY_ID)
  })
})

describe('T039 — tag filter forwarded', () => {
  it('passes tagIds to fetchEligiblePool', async () => {
    const fetch = vi.fn().mockResolvedValue([...POOL])
    await runAutoSelection(makeInput([block('B1', { tagIds: [FIXTURE_TAG_ID] })], fetch))
    expect(extractFetchCallFilters(fetch).tagIds).toContain(FIXTURE_TAG_ID)
  })
})

describe('T039 — basket filter forwarded', () => {
  it('passes basketIds to fetchEligiblePool', async () => {
    const fetch = vi.fn().mockResolvedValue([...POOL])
    await runAutoSelection(makeInput([block('B1', { basketIds: [FIXTURE_BASKET_ID] })], fetch))
    expect(extractFetchCallFilters(fetch).basketIds).toContain(FIXTURE_BASKET_ID)
  })
})

describe('T039 — semester filter forwarded', () => {
  it('passes semesterId to fetchEligiblePool', async () => {
    const fetch = vi.fn().mockResolvedValue([...POOL])
    await runAutoSelection(makeInput([block('B1', { semesterId: FIXTURE_SEMESTER_ID })], fetch))
    expect(extractFetchCallFilters(fetch).semesterId).toBe(FIXTURE_SEMESTER_ID)
  })
})

describe('T039 — combined filters', () => {
  it('all filter dimensions forwarded when combined', async () => {
    const fetch = vi.fn().mockResolvedValue([...POOL])
    await runAutoSelection(
      makeInput(
        [
          block('B1', {
            lessonIds: [FIXTURE_LESSON_ID],
            categoryIds: [FIXTURE_CATEGORY_ID],
            tagIds: [FIXTURE_TAG_ID],
            semesterId: FIXTURE_SEMESTER_ID,
          }),
        ],
        fetch
      )
    )
    const filters = extractFetchCallFilters(fetch)
    expect(filters.lessonIds).toContain(FIXTURE_LESSON_ID)
    expect(filters.categoryIds).toContain(FIXTURE_CATEGORY_ID)
    expect(filters.tagIds).toContain(FIXTURE_TAG_ID)
    expect(filters.semesterId).toBe(FIXTURE_SEMESTER_ID)
  })

  it('fetchEligiblePool called once per criteria block', async () => {
    const fetch = vi.fn().mockResolvedValue([...POOL])
    await runAutoSelection(
      makeInput(
        [
          block('B1', { lessonIds: ['L1'] }),
          block('B2', { categoryIds: ['C1'] }),
        ],
        fetch,
        10
      )
    )
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
