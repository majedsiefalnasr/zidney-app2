/**
 * MCQ Exams — Domain Validators
 *
 * File: packages/domain-core/src/mcq-exams/mcq-exams.validators.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG (original)
 *        STAGE_39_AUTO_SELECTION_ENGINE (added Stage 39 criteria validators)
 *
 * Application-layer validation rules for MCQ exam business logic.
 * These complement database constraints and are used by the service layer.
 */

import type { CriteriaEntry, McqExamPassType, SetCriteriaInput } from './mcq-exams.types'

export interface ValidationResult {
  valid: boolean
  reason?: string
}

/**
 * Validate pass_value is within acceptable range for the given pass_type.
 * - PERCENTAGE: 0 < value <= 100
 * - SCORE: value > 0
 */
export function validatePassValue(passType: McqExamPassType, passValue: number): ValidationResult {
  if (passType === 'PERCENTAGE') {
    if (passValue <= 0 || passValue > 100) {
      return {
        valid: false,
        reason: `PERCENTAGE pass_value must be > 0 and <= 100, got ${passValue}`,
      }
    }
  } else if (passType === 'SCORE') {
    if (passValue <= 0) {
      return { valid: false, reason: `SCORE pass_value must be > 0, got ${passValue}` }
    }
  }
  return { valid: true }
}

/**
 * Validate that auto criteria percentages sum to exactly 100.
 */
export function validateCriteriaSum(input: SetCriteriaInput): ValidationResult {
  if (input.criteria.length === 0) {
    return { valid: false, reason: 'At least one criteria entry is required' }
  }

  const sum = input.criteria.reduce((acc, c) => acc + (c.percentage ?? 0), 0)
  if (sum !== 100) {
    return { valid: false, reason: `Criteria percentages must sum to 100, got ${sum}` }
  }

  return { valid: true }
}

/**
 * Validate total_questions is a positive integer.
 */
export function validateTotalQuestions(totalQuestions: number): ValidationResult {
  if (totalQuestions <= 0 || !Number.isInteger(totalQuestions)) {
    return {
      valid: false,
      reason: `total_questions must be a positive integer, got ${totalQuestions}`,
    }
  }
  return { valid: true }
}

// ── Stage 39: Strict Criteria Count-Mode Validation ─────────────────────────

/**
 * Validate that a criteria block has exactly one of percentage or fixed_count
 * set (mutually exclusive), and that the set value is valid.
 *
 * @returns ValidationResult with reason identifying the offending block (1-based index)
 */
export function validateCriteriaMode(blocks: CriteriaEntry[]): ValidationResult {
  if (blocks.length === 0) {
    return { valid: false, reason: 'At least one criteria block is required' }
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const hasPercentage = block.percentage != null
    const hasFixed = block.fixed_count != null

    if (hasPercentage && hasFixed) {
      return {
        valid: false,
        reason: `Block ${i + 1}: only one of percentage or fixed_count is allowed, not both`,
      }
    }
    if (!hasPercentage && !hasFixed) {
      return {
        valid: false,
        reason: `Block ${i + 1}: exactly one of percentage or fixed_count is required`,
      }
    }
    if (hasPercentage) {
      const pct = block.percentage as number
      if (!Number.isInteger(pct) || pct <= 0 || pct > 100) {
        return {
          valid: false,
          reason: `Block ${i + 1}: percentage must be an integer in range 1-100, got ${pct}`,
        }
      }
    }
    if (hasFixed) {
      const fc = block.fixed_count as number
      if (!Number.isInteger(fc) || fc <= 0) {
        return {
          valid: false,
          reason: `Block ${i + 1}: fixed_count must be a positive integer, got ${fc}`,
        }
      }
    }
  }

  return { valid: true }
}

/**
 * Validate that the criteria blocks' totals match the expected totalQuestions.
 *
 * - If ALL blocks use percentage mode: percentages must sum to exactly 100.
 *   The resolved question counts (floor(pct * total / 100)) are then used;
 *   any rounding slack is consumed, but the plan guarantees whole-number
 *   totals when the exam is configured with round-precision totals.
 * - If ALL blocks use fixed_count mode: fixed counts must sum to exactly totalQuestions.
 * - Mixed mode (some percentage, some fixed_count) is not allowed.
 */
export function validateCriteriaTotalMatch(
  blocks: CriteriaEntry[],
  totalQuestions: number
): ValidationResult {
  if (blocks.length === 0) {
    return { valid: false, reason: 'At least one criteria block is required' }
  }

  const percentageBlocks = blocks.filter((b) => b.percentage != null)
  const fixedBlocks = blocks.filter((b) => b.fixed_count != null)

  if (percentageBlocks.length > 0 && fixedBlocks.length > 0) {
    return {
      valid: false,
      reason: 'Mixed percentage and fixed_count blocks are not allowed in the same criteria set',
    }
  }

  if (percentageBlocks.length === blocks.length) {
    const sum = percentageBlocks.reduce((acc, b) => acc + (b.percentage as number), 0)
    if (sum !== 100) {
      return {
        valid: false,
        reason: `Percentage criteria must sum to 100, got ${sum}`,
      }
    }
  } else {
    // All fixed_count
    const sum = fixedBlocks.reduce((acc, b) => acc + (b.fixed_count as number), 0)
    if (sum !== totalQuestions) {
      return {
        valid: false,
        reason: `Fixed-count criteria sum (${sum}) must equal total_questions (${totalQuestions})`,
      }
    }
  }

  return { valid: true }
}
