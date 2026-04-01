/**
 * MCQ Exams — Dependency Registry
 *
 * File: packages/domain-core/src/mcq-exams/mcq-exams.dependency-registry.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 *
 * Extensible registry for dependency-check functions used during exam deletion.
 * Other domain modules (e.g. attempt-engine, scheduled-exams) may register
 * checker functions at runtime to prevent exam deletion when references exist.
 */

import type { DbClient } from './mcq-exams.types'

export interface ExamReferenceCheckResult {
  hasReferences: boolean
  isActiveAttempt: boolean
}

export type ExamReferenceChecker = (
  db: DbClient,
  examId: string
) => Promise<ExamReferenceCheckResult>

/** Registry of dependency-check functions contributed by other domain modules. */
const checkers: ExamReferenceChecker[] = []

/** Register an external dependency checker (e.g. attempt-engine, scheduled-exams). */
export function registerExamReferenceChecker(checker: ExamReferenceChecker): void {
  checkers.push(checker)
}

/**
 * Run all registered dependency checkers for an exam.
 *
 * Returns aggregated result:
 * - isActiveAttempt = true  → immediate block (409), deletion forbidden
 * - hasReferences = true    → deletion blocked
 * - both false              → safe to soft-delete
 *
 * Active-attempt check short-circuits: stops processing remaining checkers.
 */
export async function checkExamReferences(
  db: DbClient,
  examId: string
): Promise<ExamReferenceCheckResult> {
  for (const checker of checkers) {
    const result = await checker(db, examId)
    if (result.isActiveAttempt) return { hasReferences: true, isActiveAttempt: true }
    if (result.hasReferences) return { hasReferences: true, isActiveAttempt: false }
  }
  return { hasReferences: false, isActiveAttempt: false }
}
