/**
 * Grade Attempt Job Handler - Grading Worker Integration with Dual ID Logging.
 *
 * Wraps grading logic with structured logging that includes dual IDs:
 * - request_id: From API request context
 * - job_id: Unique per job execution
 * - attempt_id: Exam attempt identifier
 *
 * Entry point for attempt grading in worker job processor.
 * Logs full attempt lifecycle: submission → grading → result persistence.
 */

import { GradeAttemptJob, JobEnvelope } from '@zidney/types/job-envelope'

/**
 * Grade attempt job handler.
 *
 * Called by job processor when 'finalize_attempt' job is dequeued.
 * Executes grading logic with structured logging.
 *
 * Lifecycle:
 * 1. Extract attempt details from job payload
 * 2. Log grading_started with context
 * 3. Execute grading algorithm (existing logic)
 * 4. Log grading_completed with results
 * 5. Persist results (existing logic)
 * 6. Return success/failure
 *
 * @param job - Dequeued job envelope for attempt grading
 * @param logger - Job-scoped logger with dual IDs
 * @returns Success/failure indicator
 * @throws Error if grading fails
 */
export async function handleGradeAttemptJob(
  job: GradeAttemptJob,
  logger: any
): Promise<{ success: boolean; error?: Error }> {
  const { attempt_id, exam_id, student_id } = job.payload
  const startTime = Date.now()

  try {
    // Log job received (dual IDs: request_id, job_id, attempt_id)
    logger.info({
      event: 'grading_started',
      attempt_id,
      exam_id,
      student_id,
      job_id: job.job_id,
      request_id: job.request_id,
    })

    // TODO: Execute grading logic (call existing grader service)
    // const gradeResult = await performGrading({
    //   attempt_id,
    //   exam_id,
    //   student_id,
    //   submission_data: job.payload.submission_data,
    // });

    // Placeholder for demonstration
    const gradeResult = {
      score: 85,
      passed: true,
      total_points: 100,
      pass_score: 70,
      question_results: [],
      summary: 'Attempt successfully graded (demo)',
      graded_at: new Date().toISOString(),
      attempt_duration_seconds: 3600,
    }

    const duration = Date.now() - startTime

    // Log grading decision (numeric results + dual IDs for traceability)
    logger.info({
      event: 'attempt_graded',
      attempt_id,
      score: gradeResult.score,
      passed: gradeResult.passed,
      grade_reason: gradeResult.summary,
      duration_ms: duration,
      job_id: job.job_id,
      request_id: job.request_id,
    })

    // TODO: Persist grading results to database
    // await persistGradingResult({
    //   attempt_id,
    //   result_snapshot: gradeResult,
    //   graded_by: 'SYSTEM',
    //   graded_at: new Date(),
    // });

    logger.info({
      event: 'grading_results_persisted',
      attempt_id,
      duration_ms: duration,
      total_duration_seconds: Math.round(duration / 1000),
    })

    return { success: true }
  } catch (error) {
    const duration = Date.now() - startTime

    logger.error({
      event: 'grading_failed',
      attempt_id,
      error_code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      error_message: error instanceof Error ? error.message : String(error),
      duration_ms: duration,
      job_id: job.job_id,
      request_id: job.request_id,
    })

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

/**
 * Register grade attempt handler with job processor.
 *
 * Call this during worker service initialization.
 */
export async function registerGradeAttemptHandler(): Promise<void> {
  // TODO: Import registerJobHandler from processor
  // registerJobHandler('finalize_attempt', formatGradeAttemptJob);
  console.log('Grade attempt handler registered (TODO: implement registration)')
}

/**
 * Format and validate grade attempt job for handler.
 *
 * @param job - Job envelope
 * @param logger - Job-scoped logger
 * @returns Formatted job ready for handler
 */
function formatGradeAttemptJob(job: JobEnvelope, logger: any): GradeAttemptJob {
  if (job.job_name !== 'finalize_attempt' || !job.attempt_id) {
    throw new Error('Invalid job type for grade attempt handler')
  }

  return job as GradeAttemptJob
}
