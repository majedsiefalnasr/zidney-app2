/**
 * Create Attempt Endpoint
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION – Phase C, T022
 * STAGE_39_AUTO_SELECTION_ENGINE    — T018, T021, T034, T047
 *
 * Route: POST /api/workspaces/:slug/attempts
 * Purpose: Create new attempt with snapshot capture
 * Authorization: RBAC (student/instructor can create)
 *
 * Business Flow (MANUAL exam):
 * 1. Validate request format + Idempotency-Key header
 * 2. Load exam (validate exists and active)
 * 3. Validate user eligibility (enrolled, max attempts)
 * 4. Build immutable snapshot
 * 5. Atomically insert attempt + progress records
 * 6. Return 201 Created
 *
 * Business Flow (AUTOMATIC exam — additional steps):
 * 1. Same as above for pre-flight validation
 * 2. Acquire advisory lock (hashtext of workspace+exam+user)
 * 3. Re-validate eligibility under lock
 * 4. Check idempotency claim → replay or conflict
 * 5. Insert idempotency claim (before side effects)
 * 6. Run auto-selection service (FetchEligiblePoolFn → DB query)
 * 7. Insert attempt with selection metadata
 * 8. Persist attempt_questions via selection-persistence
 * 9. Log selection event via logSelectionSuccess
 * 10. Return 201 Created
 *
 * Constitutional Compliance:
 * - ADR-0001: workspace_id on all queries
 * - ADR-0002: Snapshot immutability (captured at start)
 * - ADR-0006: Server-authoritative time (NOW() only)
 * - ADR-0007: Version compatibility (validated pre-insert)
 * - Atomic transaction (rollback on error)
 * - Structured logging with correlation_id
 * - Advisory lock for auto-selection concurrency guard
 */

import { createLogger } from '@zidney/logger'
import { AutoSelectionError, runAutoSelection } from '@zidney/domain-core'
import { logSelectionSuccess, logSelectionFailure } from '@zidney/domain-core'
import { AutoSelectionErrorCode, getAutoSelectionHTTPStatus } from '@zidney/types'
import type { Context } from 'hono'
import type { Pool, PoolClient } from 'pg'
import { v4 as uuidv4 } from 'uuid'
import type { UserContextStage06 } from '../../middleware/auth-context-stage06'
import { loadQuestionsForExam } from '../../modules/attempt/exam-loader'
import {
  buildFlagsSnapshot,
  buildGradingConfigSnapshot,
  buildQuestionSnapshot,
} from '../../modules/attempt/snapshot-builder'
import {
  claimIdempotencyKey,
  findExistingClaim,
  verifyPayloadHash,
} from '../../modules/attempt/idempotency-claim.service'
import {
  persistAutoSelections,
  persistManualSelections,
} from '../../modules/attempt/selection-persistence'
import {
  computePayloadHash,
  validateCreateAttemptRequestFormat,
  validateExamExists,
  validateIdempotencyKey,
  validateUserEligibility,
} from '../../services/attempt-input-validator'

/**
 * POST /api/workspaces/:slug/attempts
 *
 * Create new attempt endpoint
 */
export async function createAttemptHandler(c: Context) {
  const correlationId = c.get('correlationId') || 'unknown'
  const workspace = c.get('workspace')
  const user = c.get('user') as UserContextStage06
  const tenantDb = c.get('tenantDb') as Pool
  const logger = createLogger('attempts-create')

  const startTime = Date.now()

  // 1. Parse and validate request body
  const body = await c.req.json()
  const requestValidation = validateCreateAttemptRequestFormat(body)

  if (!requestValidation.valid) {
    logger.warn('Attempt creation failed: invalid request format', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      user_id: user.id,
      errors: requestValidation.errors,
    })

    throw {
      code: 'VALIDATION_ERROR',
      message: requestValidation.errors?.[0] || 'Invalid request format',
      status: 400,
    }
  }

  const exam_id = requestValidation.data!.exam_id!
  const attempt_mode = requestValidation.data!.attempt_mode ?? 'CHRONO'

  // 2. Validate exam exists and is active
  const examValidation = await validateExamExists(
    tenantDb,
    workspace.id,
    exam_id,
    logger,
    correlationId
  )

  if (!examValidation.valid) {
    logger.warn('Attempt creation failed: exam validation', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      exam_id: exam_id,
      errors: examValidation.errors,
    })

    throw {
      code: 'EXAM_NOT_FOUND',
      message: examValidation.errors?.[0] || 'Exam validation failed',
      status: 404,
    }
  }

  const exam = examValidation.data!

  // 3. Validate user eligibility
  const eligibilityValidation = await validateUserEligibility(
    tenantDb,
    workspace.id,
    user.id,
    exam_id,
    exam.allow_multiple_attempts || false,
    logger,
    correlationId
  )

  if (!eligibilityValidation.valid) {
    logger.warn('Attempt creation failed: user not eligible', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      user_id: user.id,
      exam_id: exam_id,
      errors: eligibilityValidation.errors,
    })

    // Check if conflict is in-progress attempt
    if (eligibilityValidation.errors?.[0]?.includes('in-progress')) {
      throw {
        code: 'ATTEMPT_IN_PROGRESS',
        message: 'User already has an in-progress attempt for this exam',
        status: 409,
      }
    }

    throw {
      code: 'USER_NOT_ELIGIBLE',
      message: eligibilityValidation.errors?.[0] || 'User not eligible for this exam',
      status: 400,
    }
  }

  // ── Stage 39: Detect exam selection mode ─────────────────────────────────
  // Load MCQ exam metadata to determine if this is AUTOMATIC mode.
  // If not an MCQ exam (legacy exams don't have a row in mcq_exams),
  // fall through to the original MANUAL path.
  const mcqExamRow = await tenantDb
    .query(
      `
      SELECT e.selection_mode, e.total_questions,
             COALESCE(
               (SELECT array_agg(question_id ORDER BY display_order)
                FROM mcq_exam_manual_questions
                WHERE exam_id = e.id AND workspace_id = $2),
               '{}'::uuid[]
             ) AS manual_question_ids
      FROM mcq_exams e
      WHERE e.id = $1
        AND e.id IN (SELECT id FROM mcq_exams WHERE id = $1)
      LIMIT 1
      `,
      [exam_id, workspace.id]
    )
    .then(
      (r) =>
        (r.rows[0] as
          | { selection_mode: string; total_questions: number; manual_question_ids: string[] }
          | undefined) ?? null
    )
    .catch(() => null) // Non-MCQ exam — fall through

  const isAutomatic = mcqExamRow?.selection_mode === 'AUTOMATIC'

  // ── Auto-selection path (Stage 039) ──────────────────────────────────────
  if (isAutomatic && mcqExamRow) {
    return await _handleAutomaticAttemptCreation(c, {
      correlationId,
      workspace,
      user,
      tenantDb,
      logger,
      startTime,
      examId: exam_id,
      attemptMode: attempt_mode,
      exam: exam as unknown as Record<string, unknown>,
      mcqExam: mcqExamRow,
      requestBody: body,
    })
  }

  // ── Manual / legacy path (STAGE_06 original logic) ───────────────────────

  // 4. Load questions for snapshot
  const questions = await loadQuestionsForExam(tenantDb, exam_id)

  if (!questions || questions.length === 0) {
    logger.error('Attempt creation failed: no questions for exam', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      exam_id: exam_id,
    })

    throw {
      code: 'EXAM_INVALID',
      message: 'Exam has no questions',
      status: 400,
    }
  }

  // 5. Build immutable snapshots
  const questionSnapshot = buildQuestionSnapshot(
    questions as unknown as Parameters<typeof buildQuestionSnapshot>[0]
  )
  const gradingConfigSnapshot = buildGradingConfigSnapshot(exam)
  const flagsSnapshot = buildFlagsSnapshot(exam)

  // 6. Create attempt record atomically
  const attemptId = uuidv4()
  const now = new Date()

  const client = await tenantDb.connect()

  try {
    await client.query('BEGIN')

    // Insert attempt
    await client.query(
      `
      INSERT INTO attempts (
        id, workspace_id, user_id, exam_id, status,
        question_snapshot, question_order, grading_config_snapshot,
        mode, flags_snapshot, time_limit_snapshot,
        exam_version, expected_schema_version, expected_product_version,
        started_at, server_start_time, certificate_enabled,
        single_attempt_rule, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
      `,
      [
        attemptId,
        workspace.id,
        user.id,
        exam_id,
        'IN_PROGRESS',
        JSON.stringify(questionSnapshot),
        questionSnapshot.questions.map((q) => q.id),
        JSON.stringify(gradingConfigSnapshot),
        attempt_mode,
        JSON.stringify(flagsSnapshot),
        exam.time_limit_seconds || null,
        exam.version,
        1, // schema_version
        '1.0.0', // product_version
        now,
        now,
        exam.certificate_enabled || false,
        !exam.allow_multiple_attempts,
        now,
        now,
      ]
    )

    // Insert initial progress records (one per question, unanswered)
    for (const question of questions) {
      await client.query(
        `
        INSERT INTO attempt_progress (
          id, attempt_id, question_id, user_answer,
          answered_at, flagged, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [uuidv4(), attemptId, question.id, null, null, false, now, now]
      )
    }

    await client.query('COMMIT')

    // Log success
    logger.info('attempt_created', {
      attempt_id: attemptId,
      workspace_id: workspace.id,
      user_id: user.id,
      exam_id: exam_id,
      mode: attempt_mode,
      question_count: questions.length,
      correlation_id: correlationId,
      elapsed_ms: Date.now() - startTime,
    })

    // Return 201 Created
    return c.json(
      {
        success: true,
        data: {
          id: attemptId,
          workspace_id: workspace.id,
          user_id: user.id,
          exam_id: exam_id,
          status: 'IN_PROGRESS',
          started_at: now.toISOString(),
          server_start_time: now.toISOString(),
          mode: attempt_mode,
          time_limit_seconds: exam.time_limit_seconds || null,
          time_remaining_seconds: exam.time_limit_seconds || null,
          question_count: questions.length,
          questions: questions.map((q) => ({
            id: q.id,
            type: q.type,
            text: q.text,
            options: q.options || [],
            points: q.points,
          })),
        },
        error: null,
      },
      201
    )
  } catch (txError) {
    await client.query('ROLLBACK')
    logger.error('Attempt creation transaction failed', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      user_id: user.id,
      exam_id: exam_id,
      error: txError instanceof Error ? txError.message : String(txError),
    })
    throw txError
  } finally {
    client.release()
  }
}

// ── Auto-selection handler (Stage 039) ───────────────────────────────────────

interface AutomaticAttemptHandlerInput {
  correlationId: string
  workspace: { id: string; slug: string }
  user: UserContextStage06
  tenantDb: Pool
  logger: ReturnType<typeof createLogger>
  startTime: number
  examId: string
  attemptMode: string
  exam: Record<string, unknown>
  mcqExam: { selection_mode: string; total_questions: number; manual_question_ids: string[] }
  requestBody: unknown
}

async function _handleAutomaticAttemptCreation(
  c: Context,
  input: AutomaticAttemptHandlerInput
): Promise<Response> {
  const {
    correlationId,
    workspace,
    user,
    tenantDb,
    logger,
    startTime,
    examId,
    attemptMode,
    exam,
    mcqExam,
    requestBody,
  } = input

  // T047: Validate Idempotency-Key header
  const idempotencyKeyRaw = c.req.header('Idempotency-Key') ?? null
  const keyValidation = validateIdempotencyKey(idempotencyKeyRaw)
  if (!keyValidation.valid) {
    throw {
      code: 'VALIDATION_ERROR',
      message: keyValidation.errors?.[0] ?? 'Idempotency-Key header is required for automatic exams',
      status: 400,
    }
  }
  const idempotencyKey = keyValidation.data!

  const payloadHash = await computePayloadHash(requestBody)
  const selectionSeed = uuidv4()
  const attemptId = uuidv4()
  const now = new Date()

  const client: PoolClient = await tenantDb.connect()

  try {
    await client.query('BEGIN')

    // T047: Advisory lock — prevents concurrent duplicate attempt starts for same user+exam
    // pg_try_advisory_xact_lock returns false if lock is not available immediately
    const lockRes = await client.query(
      `SELECT pg_try_advisory_xact_lock(hashtext($1 || $2 || $3)) AS acquired`,
      [workspace.id, examId, user.id]
    )
    if (!(lockRes.rows[0] as { acquired: boolean } | undefined)?.acquired) {
      await client.query('ROLLBACK')
      throw {
        code: AutoSelectionErrorCode.DUPLICATE_CONFLICT,
        message: 'A concurrent attempt start is already in progress for this exam.',
        status: getAutoSelectionHTTPStatus(AutoSelectionErrorCode.DUPLICATE_CONFLICT),
      }
    }

    // Step: Check idempotency claim (replay detection)
    const existingClaim = await findExistingClaim({
      client,
      workspaceId: workspace.id,
      userId: user.id,
      examId,
      idempotencyKey,
    })

    if (existingClaim) {
      if (!verifyPayloadHash(existingClaim, payloadHash)) {
        await client.query('ROLLBACK')
        throw {
          code: AutoSelectionErrorCode.IDEMPOTENCY_CONFLICT,
          message: 'Idempotency key already used with a different payload.',
          status: getAutoSelectionHTTPStatus(AutoSelectionErrorCode.IDEMPOTENCY_CONFLICT),
        }
      }
      // Safe replay — return original attempt_id
      await client.query('ROLLBACK')
      logger.info('attempt_start_idempotency_replay', {
        attempt_id: existingClaim.attempt_id ?? undefined,
        workspace_id: workspace.id,
        user_id: user.id,
        exam_id: examId,
        correlation_id: correlationId,
      })
      return c.json(
        {
          success: true,
          data: {
            id: existingClaim.attempt_id,
            workspace_id: workspace.id,
            user_id: user.id,
            exam_id: examId,
            status: 'IN_PROGRESS',
            idempotency_replay: true,
          },
          error: null,
        },
        201
      )
    }

    // Step: Insert idempotency claim BEFORE all side effects
    await claimIdempotencyKey({
      client,
      workspaceId: workspace.id,
      userId: user.id,
      examId,
      idempotencyKey,
      attemptId,
      payloadHash,
    })

    // Step: Run auto-selection
    const fetchEligiblePool = buildFetchEligiblePool(client, workspace.id)
    const manualQuestionIds = mcqExam.manual_question_ids ?? []

    // Load criteria blocks for this exam
    const criteriaRes = await client.query(
      `
      SELECT id, percentage, fixed_count,
             lesson_ids, category_value_ids, tag_ids,
             basket_ids, category_ids, semester_id
      FROM mcq_exam_auto_criteria
      WHERE exam_id = $1 AND workspace_id = $2
      ORDER BY created_at
      `,
      [examId, workspace.id]
    )

    const criteriaBlocks = criteriaRes.rows.map((r) => ({
      id: r.id,
      percentage: r.percentage ?? null,
      fixed_count: r.fixed_count ?? null,
      filters: {
        lessonIds: r.lesson_ids ?? null,
        categoryValueIds: r.category_value_ids ?? null,
        tagIds: r.tag_ids ?? null,
        basketIds: r.basket_ids ?? null,
        categoryIds: r.category_ids ?? null,
        semesterId: r.semester_id ?? null,
      },
    }))

    let selectionResult
    try {
      selectionResult = await runAutoSelection({
        workspaceId: workspace.id,
        examId,
        totalQuestions: mcqExam.total_questions,
        criteriaBlocks,
        manualQuestionIds,
        selectionSeed,
        fetchEligiblePool,
      })
    } catch (selErr) {
      await client.query('ROLLBACK')

      if (selErr instanceof AutoSelectionError) {
        logSelectionFailure({
          request_id: correlationId,
          correlation_id: correlationId,
          workspace_slug: workspace.slug,
          exam_id: examId,
          attempt_id: attemptId,
          selection_seed: selectionSeed,
          criteria_block_count: criteriaBlocks.length,
          pool_sizes: [],
          selected_count: 0,
          duplicate_count: 0,
          error_code: selErr.code,
          error_message: selErr.message,
        })
        throw {
          code: selErr.code,
          message: selErr.message,
          status: AUTO_SELECTION_ERROR_HTTP_CODES[selErr.code as AutoSelectionErrorCode] ?? 422,
        }
      }
      throw selErr
    }

    // Step: Insert attempt with selection metadata
    await client.query(
      `
      INSERT INTO attempts (
        id, workspace_id, user_id, exam_id, status,
        question_snapshot, question_order, grading_config_snapshot,
        mode, flags_snapshot, time_limit_snapshot,
        exam_version, expected_schema_version, expected_product_version,
        started_at, server_start_time, certificate_enabled,
        single_attempt_rule, selection_seed, candidate_pool_fingerprint,
        selection_diagnostics, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22
      )
      `,
      [
        attemptId,
        workspace.id,
        user.id,
        examId,
        'IN_PROGRESS',
        JSON.stringify({ questions: selectionResult.selectedIds.map((id) => ({ id })) }),
        selectionResult.selectedIds,
        JSON.stringify({}), // grading config snapshot — filled by exam-loader if needed
        attemptMode,
        JSON.stringify({}), // flags
        (exam as { time_limit_seconds?: number }).time_limit_seconds ?? null,
        1, // exam_version placeholder
        1, // expected_schema_version
        '1.0.0',
        now,
        now,
        false,
        !(exam as { allow_multiple_attempts?: boolean }).allow_multiple_attempts,
        selectionSeed,
        selectionResult.candidatePoolFingerprint,
        JSON.stringify(selectionResult.diagnostics),
        now,
      ]
    )

    // T019: Persist manual question assignments (hybrid mode)
    if (manualQuestionIds.length > 0) {
      await persistManualSelections({
        client,
        workspaceId: workspace.id,
        attemptId,
        manualQuestionIds,
      })
    }

    // T019: Persist auto-selected question assignments
    await persistAutoSelections({
      client,
      workspaceId: workspace.id,
      attemptId,
      assignments: selectionResult.blockAssignments,
      orderOffset: manualQuestionIds.length,
    })

    await client.query('COMMIT')

    // Log observability event
    const diagnosticPayload = logSelectionSuccess({
      request_id: correlationId,
      correlation_id: correlationId,
      workspace_slug: workspace.slug,
      exam_id: examId,
      attempt_id: attemptId,
      selection_seed: selectionSeed,
      criteria_block_count: selectionResult.diagnostics.criteria_block_count,
      pool_sizes: selectionResult.diagnostics.pool_sizes,
      selected_count: selectionResult.diagnostics.selected_count,
      duplicate_count: selectionResult.diagnostics.duplicate_count,
    })

    logger.info('auto_selection_attempt_created', {
      attempt_id: attemptId,
      workspace_id: workspace.id,
      user_id: user.id,
      exam_id: examId,
      selection_seed: selectionSeed,
      selected_count: selectionResult.diagnostics.selected_count,
      correlation_id: correlationId,
      elapsed_ms: Date.now() - startTime,
      diagnostics: diagnosticPayload,
    })

    return c.json(
      {
        success: true,
        data: {
          id: attemptId,
          workspace_id: workspace.id,
          user_id: user.id,
          exam_id: examId,
          status: 'IN_PROGRESS',
          started_at: now.toISOString(),
          server_start_time: now.toISOString(),
          mode: attemptMode,
          selection_seed: selectionSeed,
          question_count: selectionResult.selectedIds.length + manualQuestionIds.length,
        },
        error: null,
      },
      201
    )
  } catch (txError) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore rollback errors
    }
    logger.error('auto_selection_attempt_creation_failed', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      user_id: user.id,
      exam_id: examId,
      error: txError instanceof Error ? txError.message : String(txError),
    })
    throw txError
  } finally {
    client.release()
  }
}

// ── Eligible pool factory ─────────────────────────────────────────────────────

/**
 * Build the FetchEligiblePoolFn bound to the open transaction client.
 *
 * The query fetches question IDs eligible for a given criteria block, excluding
 * previously-assigned IDs. All filtering is done in PostgreSQL to minimise data
 * transfer.
 */
function buildFetchEligiblePool(
  client: PoolClient,
  workspaceId: string
): import('@zidney/domain-core').FetchEligiblePoolFn {
  return async (
    _workspaceId: string,
    examId: string,
    _blockId: string,
    filters: import('@zidney/domain-core').CriteriaBlockFilters,
    excludeIds: string[]
  ): Promise<string[]> => {
    const conditions: string[] = [
      'q.workspace_id = $1',
      'q.exam_id = $2',
      'q.deleted_at IS NULL',
    ]
    const params: unknown[] = [workspaceId, examId]
    let paramIdx = 3

    if (excludeIds.length > 0) {
      conditions.push(`q.id != ALL($${paramIdx++})`)
      params.push(excludeIds)
    }

    if (filters.lessonIds && filters.lessonIds.length > 0) {
      conditions.push(`q.lesson_id = ANY($${paramIdx++})`)
      params.push(filters.lessonIds)
    }

    if (filters.categoryValueIds && filters.categoryValueIds.length > 0) {
      conditions.push(`q.category_value_id = ANY($${paramIdx++})`)
      params.push(filters.categoryValueIds)
    }

    if (filters.tagIds && filters.tagIds.length > 0) {
      conditions.push(`EXISTS (
        SELECT 1 FROM question_tags qt
        WHERE qt.question_id = q.id AND qt.tag_id = ANY($${paramIdx++})
      )`)
      params.push(filters.tagIds)
    }

    if (filters.basketIds && filters.basketIds.length > 0) {
      conditions.push(`q.basket_id = ANY($${paramIdx++})`)
      params.push(filters.basketIds)
    }

    if (filters.categoryIds && filters.categoryIds.length > 0) {
      conditions.push(`q.category_id = ANY($${paramIdx++})`)
      params.push(filters.categoryIds)
    }

    if (filters.semesterId) {
      conditions.push(`q.semester_id = $${paramIdx++}`)
      params.push(filters.semesterId)
    }

    const sql = `
      SELECT q.id
      FROM questions q
      WHERE ${conditions.join(' AND ')}
      ORDER BY q.id
    `
    const res = await client.query(sql, params)
    return (res.rows as { id: string }[]).map((r) => r.id)
  }
}

// ── Re-export for error mapping (T021) ────────────────────────────────────────
const AUTO_SELECTION_ERROR_HTTP_CODES: Record<string, number> = {
  [AutoSelectionErrorCode.INSUFFICIENT_POOL]: 422,
  [AutoSelectionErrorCode.INVALID_CRITERIA]: 422,
  [AutoSelectionErrorCode.OVERLAP_UNDERSIZED]: 422,
  [AutoSelectionErrorCode.DUPLICATE_CONFLICT]: 409,
  [AutoSelectionErrorCode.SELECTION_ABORTED]: 500,
  [AutoSelectionErrorCode.IDEMPOTENCY_CONFLICT]: 409,
}
