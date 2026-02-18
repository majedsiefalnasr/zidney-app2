/**
 * Job Consumer (Main Worker Loop)
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T037
 *
 * Continuously polls grading_jobs queue and processes attempts.
 * Implements ADR-0001 (tenant isolation) and ADR-0002 (snapshot immutability).
 *
 * Key Properties:
 * - Stateless: Can be scaled horizontally
 * - Idempotent: Safe to retry same job
 * - Snapshot-only: Never loads live exam configuration
 * - Graceful shutdown: Completes current job before exit
 *
 * Behavior:
 * 1. Poll for pending jobs (FIFO, non-exclusive)
 * 2. Mark job as PROCESSING
 * 3. Load attempt (workspace-scoped)
 * 4. Check idempotency (if already FINALIZED, skip)
 * 5. Execute grading (T038)
 * 6. Persist result (T039, atomic)
 * 7. Mark job as COMPLETED
 * 8. Handle failures with retry strategy (T040)
 */

import { Attempt, AttemptStatus } from '@types/attempt'
import { Pool } from 'pg'
import { logger } from '../services/logger'
import { gradeAttempt } from './grader'
import { finalizeAttempt } from './result-persister'
import { handleJobFailure } from './retry-strategy'

/**
 * Interface: Grading Job from Queue
 */
interface GradingJob {
  id: string
  attempt_id: string
  workspace_id: string
  correlation_id: string
  retry_count?: number
  dequeue_time?: Date
}

/**
 * Job Consumer State
 */
interface ConsumerState {
  isRunning: boolean
  currentJobId: string | null
  jobsProcessed: number
  jobsFailed: number
}

const consumerState: ConsumerState = {
  isRunning: false,
  currentJobId: null,
  jobsProcessed: 0,
  jobsFailed: 0,
}

/**
 * Main Job Consumer Loop
 *
 * Polls grading_jobs table for PENDING jobs and processes them.
 * Implements pessimistic locking via UPDATE ... FOR UPDATE SKIP LOCKED.
 *
 * @param tenantPoolMap - Map of workspace_id → tenant database pools
 * @param masterDb - Master database pool for job state management
 * @returns Promise that resolves when consumer stops
 */
export async function startGradeJobsConsumer(
  tenantPoolMap: Map<string, Pool>,
  masterDb: Pool
): Promise<void> {
  consumerState.isRunning = true

  logger.info(
    {
      service: 'job-consumer',
      action: 'consumer_started',
    },
    'Grade jobs consumer started'
  )

  try {
    while (consumerState.isRunning) {
      try {
        // 1. Get next job from queue (non-blocking, pessimistic lock)
        const job = await dequeueJob(masterDb)

        if (!job) {
          // No jobs available; backpressure
          await sleep(100)
          continue
        }

        consumerState.currentJobId = job.id
        const correlationId = job.correlation_id

        logger.info(
          {
            service: 'job-consumer',
            action: 'job_dequeued',
            job_id: job.id,
            attempt_id: job.attempt_id,
            workspace_id: job.workspace_id,
            correlation_id: correlationId,
            retry_count: job.retry_count || 0,
          },
          'Job dequeued from queue'
        )

        // 2. Update job status → PROCESSING
        await updateJobStatus(masterDb, job.id, 'PROCESSING', {
          started_at: new Date(),
        })

        // 3. Load attempt (workspace-scoped)
        const tenantDb = tenantPoolMap.get(job.workspace_id)
        if (!tenantDb) {
          throw new Error(
            `Tenant database not found for workspace ${job.workspace_id}`
          )
        }

        const attempt = await loadAttempt(
          tenantDb,
          job.workspace_id,
          job.attempt_id
        )

        if (!attempt) {
          throw new Error(`Attempt not found: ${job.attempt_id}`)
        }

        logger.debug(
          {
            service: 'job-consumer',
            action: 'attempt_loaded',
            attempt_id: attempt.id,
            attempt_status: attempt.status,
            correlation_id: correlationId,
            workspace_id: job.workspace_id,
          },
          'Attempt loaded from database'
        )

        // 4. Check idempotency: if already FINALIZED, skip
        if (attempt.status === AttemptStatus.FINALIZED) {
          logger.info(
            {
              service: 'job-consumer',
              action: 'attempt_already_finalized',
              attempt_id: attempt.id,
              correlation_id: correlationId,
              workspace_id: job.workspace_id,
            },
            'Attempt already finalized; skipping grading'
          )

          await updateJobStatus(masterDb, job.id, 'COMPLETED', {
            finished_at: new Date(),
            skipped: true,
          })

          consumerState.jobsProcessed++
          consumerState.currentJobId = null
          continue
        }

        // 5. Verify attempt is in SUBMITTED state
        if (attempt.status !== AttemptStatus.SUBMITTED) {
          throw new Error(
            `Attempt must be SUBMITTED for grading, got: ${attempt.status}`
          )
        }

        // 6. Execute grading (T038)
        logger.debug(
          {
            service: 'job-consumer',
            action: 'grading_started',
            attempt_id: attempt.id,
            correlation_id: correlationId,
            workspace_id: job.workspace_id,
          },
          'Starting grading computation'
        )

        const gradeResult = await gradeAttempt(attempt, job.workspace_id)

        logger.debug(
          {
            service: 'job-consumer',
            action: 'grading_completed',
            attempt_id: attempt.id,
            score: gradeResult.score,
            passed: gradeResult.passed,
            correlation_id: correlationId,
            workspace_id: job.workspace_id,
          },
          'Grading computation completed'
        )

        // 7. Persist result (T039, atomic)
        const finalized = await finalizeAttempt(
          tenantDb,
          attempt,
          gradeResult,
          job.workspace_id
        )

        logger.info(
          {
            service: 'job-consumer',
            action: 'attempt_finalized',
            attempt_id: attempt.id,
            score: finalized.score,
            passed: finalized.passed,
            correlation_id: correlationId,
            workspace_id: job.workspace_id,
          },
          'Attempt finalized with result'
        )

        // 8. Update job status → COMPLETED
        await updateJobStatus(masterDb, job.id, 'COMPLETED', {
          finished_at: new Date(),
          result_data: {
            score: gradeResult.score,
            passed: gradeResult.passed,
            total_points: gradeResult.total_points,
          },
        })

        logger.info(
          {
            service: 'job-consumer',
            action: 'job_completed',
            job_id: job.id,
            attempt_id: attempt.id,
            score: gradeResult.score,
            correlation_id: correlationId,
            workspace_id: job.workspace_id,
          },
          'Grading job completed successfully'
        )

        consumerState.jobsProcessed++
        consumerState.currentJobId = null
      } catch (err) {
        // Catch job-level errors and apply retry strategy
        const currentJobId = consumerState.currentJobId

        if (currentJobId) {
          logger.error(
            {
              service: 'job-consumer',
              action: 'job_processing_error',
              job_id: currentJobId,
              error: err instanceof Error ? err.message : String(err),
              error_stack: err instanceof Error ? err.stack : undefined,
            },
            'Error processing job'
          )

          consumerState.jobsFailed++
          consumerState.currentJobId = null

          // Get job from database and apply retry strategy
          const jobResult = await getJobById(masterDb, currentJobId)
          if (jobResult) {
            await handleJobFailure(masterDb, jobResult, err)
          }
        } else {
          logger.error(
            {
              service: 'job-consumer',
              action: 'consumer_error',
              error: err instanceof Error ? err.message : String(err),
              error_stack: err instanceof Error ? err.stack : undefined,
            },
            'Consumer loop error'
          )
        }

        // Backpressure after error
        await sleep(100)
      }
    }
  } finally {
    logger.info(
      {
        service: 'job-consumer',
        action: 'consumer_stopped',
        jobs_processed: consumerState.jobsProcessed,
        jobs_failed: consumerState.jobsFailed,
      },
      'Grade jobs consumer stopped'
    )
  }
}

/**
 * Stop job consumer gracefully
 *
 * Sets flag to stop accepting new jobs after current one finishes.
 */
export async function stopGradeJobsConsumer(): Promise<void> {
  logger.info(
    {
      service: 'job-consumer',
      action: 'consumer_stop_requested',
      current_job_id: consumerState.currentJobId,
    },
    'Stop signal received for job consumer'
  )

  consumerState.isRunning = false

  // Wait for current job to finish (max 10 seconds)
  const startTime = Date.now()
  while (
    consumerState.currentJobId !== null &&
    Date.now() - startTime < 10000 &&
    consumerState.isRunning === false
  ) {
    await sleep(100)
  }

  if (consumerState.currentJobId !== null) {
    logger.warn(
      {
        service: 'job-consumer',
        action: 'consumer_stop_timeout',
        current_job_id: consumerState.currentJobId,
      },
      'Consumer stop timeout reached'
    )
  }
}

/**
 * Database: Dequeue next pending job (pessimistic locking)
 *
 * Uses UPDATE ... FOR UPDATE SKIP LOCKED to atomically claim a job.
 * Only returns jobs with status = PENDING.
 *
 * @param masterDb - Master database pool
 * @returns Job or null if no jobs pending
 */
async function dequeueJob(masterDb: Pool): Promise<GradingJob | null> {
  // Pessimistic lock: find and lock job atomically
  const result = await masterDb.query(
    `
    UPDATE grading_jobs
    SET 
      status = 'PROCESSING',
      started_at = NOW(),
      updated_at = NOW()
    WHERE id = (
      SELECT id FROM grading_jobs
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING 
      id,
      attempt_id,
      workspace_id,
      correlation_id,
      retry_count
    `
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    id: row.id,
    attempt_id: row.attempt_id,
    workspace_id: row.workspace_id,
    correlation_id: row.correlation_id,
    retry_count: row.retry_count || 0,
  }
}

/**
 * Database: Get job by ID
 *
 * @param masterDb - Master database pool
 * @param jobId - Job UUID
 * @returns Job or null
 */
async function getJobById(
  masterDb: Pool,
  jobId: string
): Promise<GradingJob | null> {
  const result = await masterDb.query(
    `
    SELECT 
      id,
      attempt_id,
      workspace_id,
      correlation_id,
      retry_count,
      status
    FROM grading_jobs
    WHERE id = $1
    `,
    [jobId]
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    id: row.id,
    attempt_id: row.attempt_id,
    workspace_id: row.workspace_id,
    correlation_id: row.correlation_id,
    retry_count: row.retry_count || 0,
  }
}

/**
 * Database: Update job status
 *
 * @param masterDb - Master database pool
 * @param jobId - Job UUID
 * @param status - New status (PENDING, PROCESSING, COMPLETED, FAILED)
 * @param metadata - Additional fields to update (started_at, finished_at, etc.)
 */
async function updateJobStatus(
  masterDb: Pool,
  jobId: string,
  status: string,
  metadata?: Record<string, any>
): Promise<void> {
  const fields: string[] = ['status = $1', 'updated_at = NOW()']
  const values: any[] = [status]
  let paramIndex = 2

  if (metadata?.started_at) {
    fields.push(`started_at = $${paramIndex++}`)
    values.push(metadata.started_at)
  }

  if (metadata?.finished_at) {
    fields.push(`finished_at = $${paramIndex++}`)
    values.push(metadata.finished_at)
  }

  if (metadata?.result_data) {
    fields.push(`result_data = $${paramIndex++}`)
    values.push(JSON.stringify(metadata.result_data))
  }

  if (metadata?.skipped) {
    fields.push(`skipped = $${paramIndex++}`)
    values.push(true)
  }

  values.push(jobId)

  const query = `
    UPDATE grading_jobs
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
  `

  await masterDb.query(query, values)
}

/**
 * Database: Load attempt by ID (tenant-scoped)
 *
 * @param tenantDb - Tenant database pool
 * @param workspaceId - Workspace UUID
 * @param attemptId - Attempt UUID
 * @returns Attempt or null
 */
async function loadAttempt(
  tenantDb: Pool,
  workspaceId: string,
  attemptId: string
): Promise<Attempt | null> {
  const result = await tenantDb.query(
    `
    SELECT 
      id,
      workspace_id,
      user_id,
      attempt_type,
      exam_id,
      question_snapshot,
      question_order,
      grading_config_snapshot,
      mode,
      flags_snapshot,
      time_limit_snapshot,
      exam_version,
      expected_schema_version,
      expected_product_version,
      started_at,
      server_start_time,
      submitted_at,
      finalized_at,
      certificate_enabled,
      single_attempt_rule,
      status,
      score,
      passed,
      result_snapshot,
      created_at,
      updated_at
    FROM attempts
    WHERE id = $1 AND workspace_id = $2
    `,
    [attemptId, workspaceId]
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    user_id: row.user_id,
    attempt_type: row.attempt_type,
    exam_id: row.exam_id,
    question_snapshot: row.question_snapshot,
    question_order: row.question_order,
    grading_config_snapshot: row.grading_config_snapshot,
    mode: row.mode,
    flags_snapshot: row.flags_snapshot,
    time_limit_snapshot: row.time_limit_snapshot,
    exam_version: row.exam_version,
    expected_schema_version: row.expected_schema_version,
    expected_product_version: row.expected_product_version,
    started_at: row.started_at,
    server_start_time: row.server_start_time,
    submitted_at: row.submitted_at,
    finalized_at: row.finalized_at,
    certificate_enabled: row.certificate_enabled,
    single_attempt_rule: row.single_attempt_rule,
    status: row.status,
    score: row.score,
    passed: row.passed,
    result_snapshot: row.result_snapshot,
    created_at: row.created_at,
    updated_at: row.updated_at,
  } as Attempt
}

/**
 * Utility: Sleep for milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Get consumer state (for monitoring)
 */
export function getConsumerState() {
  return { ...consumerState }
}
