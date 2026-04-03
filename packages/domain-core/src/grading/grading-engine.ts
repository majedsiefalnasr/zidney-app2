/**
 * Grading Engine
 *
 * File: packages/domain-core/src/grading/grading-engine.ts
 * Stage: STAGE_40_GRADING_CORE
 *
 * Orchestrator for the 13-step grading transaction flow.
 * - Atomicity: All operations in single SELECT FOR UPDATE transaction
 * - Immutability: Snapshots taken at step 1, never re-read
 * - Determinism: All grading computations independent of runtime state
 * - Observability: Each step tracked with correlation_id
 */

import type { PoolClient } from 'pg'

import type {
  GradeAttemptInput,
  GradeAttemptResult,
  GradingConfigSnapshot,
  QuestionGradingResult,
} from './grading.types'
import { aggregateScores } from './score-aggregator'

/**
 * Grading engine configuration
 */
export interface GradingEngineConfig {
  correlationId: string
  gradingVersion: string
  timeout: number // milliseconds
}

/**
 * 13-step grading workflow
 */
export class GradingEngine {
  private config: GradingEngineConfig

  constructor(config: GradingEngineConfig) {
    this.config = config
  }

  /**
   * Grade an attempt using the 13-step atomic workflow
   *
   * @param client - Database connection (will acquire exclusive lock)
   * @param input - Grade attempt input (attemptId, workspaceId)
   * @returns Grading result
   *
   * @throws GradingError on validation, isolation, or execution failures
   *
   * Workflow steps:
   * 1. Acquire lock (SELECT FOR UPDATE)
   * 2. Load attempt record
   * 3. Validate attempt status (must be SUBMITTED or IN_PROGRESS)
   * 4. Snapshot grading config
   * 5. Snapshot all question records
   * 6. Snapshot all user responses
   * 7. Begin grading transaction
   * 8. Grade each question (pure function)
   * 9. Aggregate question scores
   * 10. Update attempt status to GRADED + grading_status to GRADED
   * 11. Insert grading_result row
   * 12. Insert grading_question_result rows (one per question)
   * 13. Commit transaction
   */
  async gradeAttempt(client: PoolClient, input: GradeAttemptInput): Promise<GradeAttemptResult> {
    const startTime = Date.now()
    let txStarted = false

    try {
      // Step 1: Acquire lock
      await this.acquireLock(client, input.workspaceId, input.attemptId)

      // Step 2: Load attempt record
      const attempt = await this.loadAttempt(client, input.workspaceId, input.attemptId)

      // Step 3: Validate attempt status
      this.validateAttemptStatus(attempt)

      // Step 4-6: Snapshot config, questions, responses
      const configSnapshot = await this.snapshotGradingConfig(
        client,
        input.workspaceId,
        input.attemptId
      )
      const questionSnapshots = await this.snapshotQuestions(
        client,
        input.workspaceId,
        input.attemptId
      )
      const userResponses = await this.snapshotUserResponses(
        client,
        input.workspaceId,
        input.attemptId
      )

      // Step 7: Begin transaction
      await client.query('BEGIN')
      txStarted = true

      // Step 8: Grade each question (pure function calls)
      const questionResults: QuestionGradingResult[] = []
      for (const qSnap of questionSnapshots) {
        const userResp = userResponses[qSnap.id]
        const graded = this.gradeQuestion(qSnap, userResp, configSnapshot)
        questionResults.push(graded)
      }

      // Step 9: Aggregate scores
      const aggregate = aggregateScores(questionResults, configSnapshot)

      // Step 10: Update attempt status
      await this.updateAttemptStatus(client, input.workspaceId, input.attemptId, 'GRADED', 'GRADED')

      // Step 11-12: Insert grading result and question results
      const gradingResultId = await this.insertGradingResult(client, input.workspaceId, {
        attemptId: input.attemptId,
        totalScore: aggregate.totalScore,
        totalPossibleScore: aggregate.totalPossibleScore,
        percentage: aggregate.percentage,
        passed: aggregate.passed,
      })

      await this.insertQuestionResults(
        client,
        input.workspaceId,
        gradingResultId,
        input.attemptId,
        questionResults
      )

      // Step 13: Commit
      await client.query('COMMIT')
      txStarted = false

      const _duration = Date.now() - startTime

      return {
        gradingResultId,
        totalScore: aggregate.totalScore,
        totalPossibleScore: aggregate.totalPossibleScore,
        percentage: aggregate.percentage,
        passed: aggregate.passed,
        questionResults,
        gradingVersion: this.config.gradingVersion,
        gradedAt: new Date(),
      }
    } catch (error) {
      if (txStarted) {
        try {
          await client.query('ROLLBACK')
        } catch (_e) {
          // Rollback failed, log but continue throwing original error
        }
      }
      throw error
    }
  }

  private async acquireLock(
    _client: PoolClient,
    _workspaceId: string,
    _attemptId: string
  ): Promise<void> {
    // Stub: Would execute SELECT FOR UPDATE on attempts table
  }

  private async loadAttempt(
    _client: PoolClient,
    _workspaceId: string,
    attemptId: string
  ): Promise<Record<string, unknown>> {
    // Stub: Would load attempt record from DB
    return {
      id: attemptId,
      status: 'SUBMITTED',
      grading_status: 'PENDING',
    }
  }

  private validateAttemptStatus(attempt: Record<string, unknown>): void {
    const validStatuses = ['SUBMITTED', 'IN_PROGRESS', 'FINALIZED']
    if (!validStatuses.includes(String(attempt.status))) {
      throw new Error(`Invalid attempt status: ${attempt.status}`)
    }
  }

  private async snapshotGradingConfig(
    _client: PoolClient,
    _workspaceId: string,
    _attemptId: string
  ): Promise<GradingConfigSnapshot> {
    // Stub: Would load grading_config from exam
    return {
      questions: [],
      pass_type: 'PERCENTAGE',
      pass_value: 50,
      total_possible_score: 100,
    }
  }

  private async snapshotQuestions(
    _client: PoolClient,
    _workspaceId: string,
    _attemptId: string
  ): Promise<Record<string, unknown>[]> {
    // Stub: Would load question records
    return []
  }

  private async snapshotUserResponses(
    _client: PoolClient,
    _workspaceId: string,
    _attemptId: string
  ): Promise<Record<string, unknown>> {
    // Stub: Would load user responses from attempt_responses
    return {}
  }

  private gradeQuestion(
    questionSnapshot: QuestionSnapshot,
    userResponse: unknown,
    configSnapshot: GradingConfigSnapshot
  ): QuestionGradingResult {
    const qType = questionSnapshot.type
    let result: { awardedScore: number; isCorrect: boolean }

    if (['MCQ_SINGLE', 'MCQ_MULTIPLE', 'MCQ_TRUE_FALSE', 'MCQ_ARRANGEMENT'].includes(qType)) {
      result = gradeMultipleChoiceQuestion(qType, questionSnapshot, userResponse)
    } else if (
      ['TRADITIONAL_TRUE_FALSE', 'TRADITIONAL_FILL_BLANK', 'TRADITIONAL_SHORT_ANSWER'].includes(
        qType
      )
    ) {
      result = gradeTraditionalQuestion(qType, questionSnapshot, userResponse, configSnapshot)
    } else {
      result = { awardedScore: 0, isCorrect: false }
    }

    return {
      questionId: questionSnapshot.id,
      questionType: qType,
      questionScore: questionSnapshot.score,
      awardedScore: result.awardedScore,
      isCorrect: result.isCorrect,
      userResponse,
      correctAnswerSnapshot: questionSnapshot.correct_answer,
      gradingMetadata: {
        correlationId: this.config.correlationId,
        gradingVersion: this.config.gradingVersion,
      },
    }
  }

  private async updateAttemptStatus(
    _client: PoolClient,
    _workspaceId: string,
    _attemptId: string,
    _status: string,
    _gradingStatus: string
  ): Promise<void> {
    // Stub: Would UPDATE attempts SET status, grading_status
  }

  private async insertGradingResult(
    _client: PoolClient,
    _workspaceId: string,
    _data: {
      attemptId: string
      totalScore: number
      totalPossibleScore: number
      percentage: number
      passed: boolean
    }
  ): Promise<string> {
    // Stub: Would INSERT into grading_results
    return 'grading-result-id-placeholder'
  }

  private async insertQuestionResults(
    _client: PoolClient,
    _workspaceId: string,
    _gradingResultId: string,
    _attemptId: string,
    _questionResults: QuestionGradingResult[]
  ): Promise<void> {
    // Stub: Would INSERT into grading_question_results
  }
}

/**
 * Factory function to create a GradingEngine
 *
 * @param config - Engine configuration
 * @returns Engine instance
 */
export function createGradingEngine(config: GradingEngineConfig): GradingEngine {
  return new GradingEngine(config)
}
