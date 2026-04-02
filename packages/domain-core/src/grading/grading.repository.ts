/**
 * Grading Repository
 *
 * File: packages/domain-core/src/grading/grading.repository.ts
 * Stage: STAGE_40_GRADING_CORE
 *
 * Data access layer for grading operations.
 * - Workspace-scoped all queries (workspace_id filtering mandatory)
 * - Uses Drizzle ORM with prepared statements
 * - No business logic, pure DB access
 * - All operations accept DrizzleTransaction for atomicity
 */

import type { PoolClient } from 'pg'
import type { Transaction } from 'drizzle-orm'

import type {
  DrizzleTransaction,
  GradeAttemptResult,
  QuestionGradingResult,
} from './grading.types'

/**
 * Repository interface for grading persistence
 */
export interface IGradingRepository {
  saveGradingResult(
    tx: DrizzleTransaction,
    workspaceId: string,
    result: {
      gradingResultId: string
      attemptId: string
      totalScore: number
      totalPossibleScore: number
      percentage: number
      passed: boolean
      gradedBy: 'ENGINE' | 'SELF' | 'ADMIN'
    }
  ): Promise<void>

  saveQuestionResult(
    tx: DrizzleTransaction,
    workspaceId: string,
    questionResult: {
      gradingResultId: string
      attemptId: string
      questionId: string
      questionType: string
      questionScore: number
      awardedScore: number
      isCorrect: boolean
      userResponse: unknown
      correctAnswerSnapshot: unknown
      gradingMetadata?: Record<string, unknown>
    }
  ): Promise<void>

  getGradingResult(
    client: PoolClient,
    workspaceId: string,
    attemptId: string
  ): Promise<GradeAttemptResult | null>

  checkAttemptAlreadyGraded(
    client: PoolClient,
    workspaceId: string,
    attemptId: string
  ): Promise<boolean>

  recordGradingOverride(
    tx: DrizzleTransaction,
    workspaceId: string,
    override: {
      gradingResultId: string
      attemptId: string
      previousScore: number
      newScore: number
      previousPassed: boolean
      newPassed: boolean
      overrideReason: string
      overrideUserId: string
    }
  ): Promise<void>
}

/**
 * Factory function to create a GradingRepository
 *
 * @param db - Drizzle database client
 * @returns Repository instance
 */
export function createGradingRepository(db: unknown): IGradingRepository {
  return {
    async saveGradingResult(tx, workspaceId, result) {
      // Stub: Actual implementation uses db.insert().values()
      // For now, demonstrates the contract
      if (!workspaceId || !result.attemptId) {
        throw new Error('workspace_id and attempt_id required')
      }
    },

    async saveQuestionResult(tx, workspaceId, questionResult) {
      if (!workspaceId || !questionResult.attemptId) {
        throw new Error('workspace_id and attempt_id required')
      }
    },

    async getGradingResult(client, workspaceId, attemptId) {
      if (!workspaceId || !attemptId) {
        throw new Error('workspace_id and attempt_id required')
      }
      return null
    },

    async checkAttemptAlreadyGraded(client, workspaceId, attemptId) {
      if (!workspaceId || !attemptId) {
        throw new Error('workspace_id and attempt_id required')
      }
      return false
    },

    async recordGradingOverride(tx, workspaceId, override) {
      if (!workspaceId || !override.attemptId) {
        throw new Error('workspace_id and attempt_id required')
      }
    },
  }
}
