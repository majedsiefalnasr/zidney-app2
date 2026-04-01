/**
 * Traditional Exams — Dependency Registry (Deletion Guard)
 *
 * File: packages/domain-core/src/traditional-exams/traditional-exams.dependency-registry.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

import type { DbClient, ExamReferenceCheckResult } from './traditional-exams.types'

// ── Types ────────────────────────────────────────────────────────

export type TraditionalExamReferenceChecker = (
  db: DbClient,
  examId: string
) => Promise<ExamReferenceCheckResult>

// ── Registry ─────────────────────────────────────────────────────

const checkers: TraditionalExamReferenceChecker[] = []

export function registerTraditionalExamReferenceChecker(
  checker: TraditionalExamReferenceChecker
): void {
  checkers.push(checker)
}

export async function checkTraditionalExamReferences(
  db: DbClient,
  examId: string
): Promise<ExamReferenceCheckResult> {
  for (const checker of checkers) {
    const result = await checker(db, examId)
    if (result.hasReferences) {
      return result // short-circuit on first match
    }
  }
  return { hasReferences: false, isActiveAttempt: false }
}
