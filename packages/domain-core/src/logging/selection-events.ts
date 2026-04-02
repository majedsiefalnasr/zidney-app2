/**
 * Structured Selection Diagnostics Logger
 *
 * Framework-agnostic helper for emitting selection lifecycle events with
 * all 10 mandatory observability fields. Called by the auto-selection
 * service and persistence layer to populate selection_diagnostics on
 * the attempts row and to emit structured log lines.
 *
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T011
 */

import { createLogger } from '@zidney/logger'

const logger = createLogger('auto-selection')

// ── Diagnostics shape ────────────────────────────────────────────────────────

/**
 * Selection diagnostics persisted as JSONB into attempts.selection_diagnostics.
 * All 10 fields are mandatory for observability contract compliance.
 */
export interface SelectionDiagnostics {
  /** Inbound/API correlation ID (UUID) */
  request_id: string
  /** End-to-end trace correlation ID */
  correlation_id: string
  /** Tenant workspace slug */
  workspace_slug: string
  /** Exam UUID */
  exam_id: string
  /** Newly created attempt UUID */
  attempt_id: string
  /** Deterministic seed used for shuffle (hex string) */
  selection_seed: string
  /** Number of criteria blocks processed */
  criteria_block_count: number
  /** Per-block eligible pool sizes before deduplication */
  pool_sizes: number[]
  /** Total questions selected across all criteria blocks */
  selected_count: number
  /** Number of duplicate candidates discarded across blocks */
  duplicate_count: number
}

// ── Event emitters ───────────────────────────────────────────────────────────

/**
 * Log a successful auto-selection event.
 * Also returns the diagnostics object for persistence.
 */
export function logSelectionSuccess(
  diagnostics: SelectionDiagnostics
): SelectionDiagnostics {
  logger.info('auto_selection_success', {
    request_id: diagnostics.request_id,
    correlation_id: diagnostics.correlation_id,
    workspace_slug: diagnostics.workspace_slug,
    exam_id: diagnostics.exam_id,
    attempt_id: diagnostics.attempt_id,
    selection_seed: diagnostics.selection_seed,
    criteria_block_count: diagnostics.criteria_block_count,
    pool_sizes: diagnostics.pool_sizes,
    selected_count: diagnostics.selected_count,
    duplicate_count: diagnostics.duplicate_count,
  })
  return diagnostics
}

/**
 * Log a selection failure event (pool insufficiency, invalid criteria, etc.).
 */
export function logSelectionFailure(
  params: Omit<SelectionDiagnostics, 'attempt_id'> & {
    attempt_id: string | null
    error_code: string
    error_message: string
  }
): void {
  logger.warn('auto_selection_failure', {
    request_id: params.request_id,
    correlation_id: params.correlation_id,
    workspace_slug: params.workspace_slug,
    exam_id: params.exam_id,
    attempt_id: params.attempt_id ?? 'none',
    selection_seed: params.selection_seed,
    criteria_block_count: params.criteria_block_count,
    pool_sizes: params.pool_sizes,
    selected_count: params.selected_count,
    duplicate_count: params.duplicate_count,
    error_code: params.error_code,
    error_message: params.error_message,
  })
}

/**
 * Log an idempotency replay event (same-key second request returning cached response).
 */
export function logIdempotencyReplay(params: {
  request_id: string
  correlation_id: string
  workspace_slug: string
  exam_id: string
  attempt_id: string
  idempotency_key: string
}): void {
  logger.info('auto_selection_idempotency_replay', {
    request_id: params.request_id,
    correlation_id: params.correlation_id,
    workspace_slug: params.workspace_slug,
    exam_id: params.exam_id,
    attempt_id: params.attempt_id,
    idempotency_key: params.idempotency_key,
  })
}

/**
 * Log an idempotency conflict event (same key but different payload hash).
 */
export function logIdempotencyConflict(params: {
  request_id: string
  correlation_id: string
  workspace_slug: string
  exam_id: string
  idempotency_key: string
}): void {
  logger.warn('auto_selection_idempotency_conflict', {
    request_id: params.request_id,
    correlation_id: params.correlation_id,
    workspace_slug: params.workspace_slug,
    exam_id: params.exam_id,
    idempotency_key: params.idempotency_key,
  })
}
