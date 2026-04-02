/**
 * MCQ Auto-Criteria Validation Service
 *
 * File: packages/domain-core/src/mcq-exams/mcq-auto-criteria-validation.service.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T025
 *
 * Validates overlap-risk and pool-size adequacy for AUTOMATIC exam criteria
 * before criteria are persisted and before publish transitions.
 *
 * Does NOT open DB transactions. All DB access is injected via FetchEligiblePoolFn
 * to keep this module framework-free.
 */

import type { FetchEligiblePoolFn, CriteriaBlockFilters } from '../attempts/auto-selection.service'
import type { CriteriaEntry } from './mcq-exams.types'
import { validateCriteriaMode, validateCriteriaTotalMatch } from './mcq-exams.validators'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CriteriaValidationError {
  code:
    | 'INVALID_CRITERIA_MODE'
    | 'CRITERIA_COUNT_MISMATCH'
    | 'CRITERIA_OVERLAP_RISK'
    | 'UNDERSIZED_POOL'
  message: string
  /** Block index (1-based) where the violation was detected, if applicable. */
  blockIndex?: number
}

export interface CriteriaValidationResult {
  valid: boolean
  errors: CriteriaValidationError[]
}

export interface ValidateCriteriaInput {
  workspaceId: string
  examId: string
  totalQuestions: number
  criteria: CriteriaEntry[]
  fetchEligiblePool: FetchEligiblePoolFn
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Validate automatic selection criteria for an exam.
 *
 * Checks in order:
 * 1. Count-mode integrity (exactly one of percentage or fixed_count per block)
 * 2. Total match (percentages sum to 100 OR fixed counts sum to totalQuestions)
 * 3. Overlap-risk heuristic (no two blocks share all filter dimensions)
 * 4. Pool adequacy (each block's candidate pool is >= the resolved question count)
 *
 * Returns a CriteriaValidationResult. If valid is false, errors lists all failures.
 */
export async function validateAutoCriteria(
  input: ValidateCriteriaInput
): Promise<CriteriaValidationResult> {
  const { workspaceId, examId, totalQuestions, criteria, fetchEligiblePool } = input
  const errors: CriteriaValidationError[] = []

  // 1. Mode integrity
  const modeResult = validateCriteriaMode(criteria)
  if (!modeResult.valid) {
    errors.push({ code: 'INVALID_CRITERIA_MODE', message: modeResult.reason ?? 'Invalid criteria mode' })
    // Cannot proceed with further checks if modes are invalid
    return { valid: false, errors }
  }

  // 2. Total match
  const totalResult = validateCriteriaTotalMatch(criteria, totalQuestions)
  if (!totalResult.valid) {
    errors.push({ code: 'CRITERIA_COUNT_MISMATCH', message: totalResult.reason ?? 'Criteria total mismatch' })
  }

  // 3. Overlap-risk: two blocks are considered overlapping if their non-null filter sets are identical
  for (let i = 0; i < criteria.length; i++) {
    for (let j = i + 1; j < criteria.length; j++) {
      if (_criteriaFilterEquals(criteria[i]!, criteria[j]!)) {
        errors.push({
          code: 'CRITERIA_OVERLAP_RISK',
          message: `Blocks ${i + 1} and ${j + 1} share identical filter dimensions — they may draw from the same candidate pool`,
          blockIndex: i + 1,
        })
      }
    }
  }

  // 4. Pool adequacy: run concurrently for all blocks
  const poolChecks = criteria.map(async (block, idx) => {
    const blockId = `validate-block-${idx}`
    const filters: CriteriaBlockFilters = {
      lessonIds: block.lesson_ids ?? undefined,
      categoryValueIds: block.category_value_ids ?? undefined,
      tagIds: block.tag_ids ?? undefined,
      basketIds: block.basket_ids ?? undefined,
      categoryIds: block.category_ids ?? undefined,
      semesterId: block.semester_id ?? undefined,
    }
    const requiredCount = _resolveBlockCount(block, totalQuestions)
    try {
      const pool = await fetchEligiblePool(workspaceId, examId, blockId, filters, [])
      if (pool.length < requiredCount) {
        return {
          code: 'UNDERSIZED_POOL' as const,
          message: `Block ${idx + 1}: pool size (${pool.length}) is less than required count (${requiredCount})`,
          blockIndex: idx + 1,
        }
      }
    } catch {
      // If pool query fails during validation, treat as undersized
      return {
        code: 'UNDERSIZED_POOL' as const,
        message: `Block ${idx + 1}: failed to resolve candidate pool for adequacy check`,
        blockIndex: idx + 1,
      }
    }
    return null
  })

  const poolResults = await Promise.all(poolChecks)
  for (const result of poolResults) {
    if (result !== null) {
      errors.push(result)
    }
  }

  return { valid: errors.length === 0, errors }
}

// ── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Resolve the number of questions a criteria block should contribute.
 * Mirrors the logic in auto-selection.selector.ts → resolveBlockCount.
 */
function _resolveBlockCount(block: CriteriaEntry, totalQuestions: number): number {
  if (block.fixed_count != null) return block.fixed_count
  const pct = block.percentage ?? 0
  return Math.max(1, Math.floor((pct / 100) * totalQuestions))
}

/**
 * Return true if two criteria blocks have identical non-null filter sets.
 * Compares sorted arrays for order-independence.
 */
function _criteriaFilterEquals(a: CriteriaEntry, b: CriteriaEntry): boolean {
  return (
    _arraysEqual(a.lesson_ids, b.lesson_ids) &&
    _arraysEqual(a.category_value_ids, b.category_value_ids) &&
    _arraysEqual(a.tag_ids, b.tag_ids) &&
    _arraysEqual(a.basket_ids, b.basket_ids) &&
    _arraysEqual(a.category_ids, b.category_ids) &&
    (a.semester_id ?? null) === (b.semester_id ?? null)
  )
}

function _arraysEqual(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const normA = (a ?? []).slice().sort()
  const normB = (b ?? []).slice().sort()
  if (normA.length !== normB.length) return false
  return normA.every((v, i) => v === normB[i])
}
