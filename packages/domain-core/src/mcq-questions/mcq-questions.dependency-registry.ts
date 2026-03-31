/**
 * MCQ Questions — Dependency Registry
 *
 * File: packages/domain-core/src/mcq-questions/mcq-questions.dependency-registry.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 *
 * Extensible registry for dependency-check functions used during question deletion.
 * Other domain modules (e.g. attempt-engine) may register checker functions at
 * runtime to prevent question deletion when references exist.
 *
 * Active-attempt references take priority: if any checker signals isActiveAttempt,
 * deletion is immediately blocked with a 409 QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT.
 */

import type { DbClient } from './mcq-questions.types'

export interface QuestionReferenceCheckResult {
  hasReferences: boolean
  isActiveAttempt: boolean
}

export type QuestionReferenceChecker = (
  db: DbClient,
  questionId: string
) => Promise<QuestionReferenceCheckResult>

/** Registry of dependency-check functions contributed by other domain modules. */
const checkers: QuestionReferenceChecker[] = []

/** Register an external dependency checker (e.g. attempt-engine, exam-configurations). */
export function registerQuestionReferenceChecker(checker: QuestionReferenceChecker): void {
  checkers.push(checker)
}

/**
 * Run all registered dependency checkers for a question.
 *
 * Returns aggregated result:
 * - isActiveAttempt = true  → immediate block (409), hard delete forbidden
 * - hasReferences = true    → soft delete only (no hard delete even for DRAFT)
 * - both false              → safe to hard-delete (DRAFT) or soft-delete (other)
 *
 * Active-attempt check short-circuits: stops processing remaining checkers.
 */
export async function checkQuestionReferences(
  db: DbClient,
  questionId: string
): Promise<QuestionReferenceCheckResult> {
  for (const checker of checkers) {
    const result = await checker(db, questionId)
    if (result.isActiveAttempt) return { hasReferences: true, isActiveAttempt: true }
    if (result.hasReferences) return { hasReferences: true, isActiveAttempt: false }
  }
  return { hasReferences: false, isActiveAttempt: false }
}
