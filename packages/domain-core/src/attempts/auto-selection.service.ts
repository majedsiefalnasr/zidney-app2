/**
 * Auto-Selection Orchestration Service
 *
 * Coordinates per-criteria-block pool resolution, deterministic shuffle,
 * deduplication, and hybrid merge (manual + auto) for automatic MCQ exam
 * attempt starts.
 *
 * Pure orchestration: DB access is injected via fetchEligiblePool callback.
 * No HTTP / no Hono / no framework dependencies.
 *
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Tasks: T016 (core), T032 (hybrid + zero-auto edge case extension)
 */

import {
  computePoolFingerprint,
  resolveBlockCount,
  selectFromPool,
} from './auto-selection.selector'

// ── Input / output types ─────────────────────────────────────────────────────

export interface CriteriaBlockFilters {
  lessonIds?: string[] | null
  categoryValueIds?: string[] | null
  tagIds?: string[] | null
  basketIds?: string[] | null
  categoryIds?: string[] | null
  semesterId?: string | null
}

export interface CriteriaBlock {
  id: string
  percentage: number | null
  fixed_count: number | null
  filters: CriteriaBlockFilters
}

/** Function signature for DB-backed eligible pool retrieval. */
export type FetchEligiblePoolFn = (
  workspaceId: string,
  examId: string,
  blockId: string,
  filters: CriteriaBlockFilters,
  excludeIds: string[]
) => Promise<string[]>

export interface AutoSelectionInput {
  workspaceId: string
  examId: string
  /** Exam-configured total question count */
  totalQuestions: number
  criteriaBlocks: CriteriaBlock[]
  /**
   * IDs of manually-assigned questions. These are pre-included and must be
   * excluded from the auto candidate pool to prevent duplicates.
   */
  manualQuestionIds: string[]
  /** Deterministic seed (UUID or hex from API layer) */
  selectionSeed: string
  /** Injected DB access: returns ordered, deduplicated candidate IDs */
  fetchEligiblePool: FetchEligiblePoolFn
}

/** Per-block question assignment with ordering data for persistence. */
export interface BlockAssignment {
  questionId: string
  criteriaBlockId: string
  /** 0-indexed order within the final merged set */
  order: number
}

export interface AutoSelectionResult {
  /** Final ordered list of selected question IDs (auto only, no manual IDs) */
  selectedIds: string[]
  /** Fingerprint of the merged candidate pool for drift detection */
  candidatePoolFingerprint: string
  diagnostics: {
    criteria_block_count: number
    /** Eligible pool size per block (before deduplication) */
    pool_sizes: number[]
    /** Total auto-selected questions */
    selected_count: number
    /** Number of duplicate candidates removed across blocks */
    duplicate_count: number
  }
  /** Per-question assignment metadata for attempt_questions persistence */
  blockAssignments: BlockAssignment[]
}

/** Structured failure raised when pools or criteria are invalid. */
export class AutoSelectionError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'AutoSelectionError'
  }
}

// ── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Execute full auto-selection for an automatic or hybrid MCQ exam attempt.
 *
 * Steps:
 * 1. For each criteria block: resolve required count, fetch eligible pool,
 *    shuffle with seed, slice.
 * 2. Accumulate selected IDs in insertion order; detect cross-block duplicates.
 * 3. Merge manual + auto IDs and derive blockAssignments for persistence.
 *
 * Throws AutoSelectionError on pool insufficiency or criteria misconfiguration.
 */
export async function runAutoSelection(
  input: AutoSelectionInput
): Promise<AutoSelectionResult> {
  const {
    workspaceId,
    examId,
    totalQuestions,
    criteriaBlocks,
    manualQuestionIds,
    selectionSeed,
    fetchEligiblePool,
  } = input

  if (criteriaBlocks.length === 0) {
    throw new AutoSelectionError(
      'AUTO_SELECTION_INVALID_CRITERIA',
      'No criteria blocks configured for automatic exam'
    )
  }

  const seen = new Set<string>(manualQuestionIds)
  const autoSelectedIds: string[] = []
  const blockAssignments: BlockAssignment[] = []
  const poolSizes: number[] = []
  const allCandidateIds: string[] = []
  let duplicateCount = 0

  for (const block of criteriaBlocks) {
    const requiredCount = resolveBlockCount(
      totalQuestions,
      block.percentage,
      block.fixed_count
    )

    if (requiredCount === 0) {
      // Zero-auto edge case (US3): skip block entirely
      poolSizes.push(0)
      continue
    }

    // Compose exclusion list: manual IDs + any already selected
    const excludeIds = Array.from(seen)

    // Fetch eligible pool (caller provides stable, deduplicated, ordered IDs)
    const pool = await fetchEligiblePool(
      workspaceId,
      examId,
      block.id,
      block.filters,
      excludeIds
    )

    poolSizes.push(pool.length)
    allCandidateIds.push(...pool)

    if (pool.length < requiredCount) {
      throw new AutoSelectionError(
        'AUTO_SELECTION_INSUFFICIENT_POOL',
        `Criteria block ${block.id}: need ${requiredCount} questions but pool has ${pool.length}`
      )
    }

    // Deterministic shuffle + slice using per-block composite seed
    const blockSeed = `${selectionSeed}:${block.id}`
    const selected = selectFromPool(pool, requiredCount, blockSeed)

    for (const questionId of selected) {
      if (seen.has(questionId)) {
        duplicateCount++
        continue
      }
      seen.add(questionId)
      autoSelectedIds.push(questionId)
      blockAssignments.push({
        questionId,
        criteriaBlockId: block.id,
        order: manualQuestionIds.length + autoSelectedIds.length - 1,
      })
    }
  }

  const candidatePoolFingerprint = computePoolFingerprint(allCandidateIds)

  return {
    selectedIds: autoSelectedIds,
    candidatePoolFingerprint,
    diagnostics: {
      criteria_block_count: criteriaBlocks.length,
      pool_sizes: poolSizes,
      selected_count: autoSelectedIds.length,
      duplicate_count: duplicateCount,
    },
    blockAssignments,
  }
}
