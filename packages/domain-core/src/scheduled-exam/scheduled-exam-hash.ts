/**
 * Scheduled Exam — Base Exam Hash Computation
 *
 * File: packages/domain-core/src/scheduled-exam/scheduled-exam-hash.ts
 * Stage: STAGE_38_SCHEDULED_EXAM_ENGINE
 *
 * SHA-256 hash of sorted JSON of canonical fields to detect base exam drift.
 */

import { createHash } from 'node:crypto'

export interface McqHashInput {
  title: string
  instructions?: string | null
  totalMarks: number
  passMark: number
  durationMinutes?: number | null
  questionPoolId?: string | null
}

export type TraditionalHashInput = McqHashInput
export function computeBaseExamHash(input: Record<string, unknown>): string {
  // Normalize various input shapes into a canonical representation used for hashing.
  // Tests expect exam_type and updated_at to affect the hash, and different field
  // names (total_marks vs total_questions, duration_minutes vs durationMinutes) to be handled.
  const inAny = input as Record<string, unknown>
  const normalized: Record<string, unknown> = {
    exam_type: inAny.exam_type ?? inAny.examType ?? null,
    name: inAny.name ?? inAny.title ?? null,
    description: inAny.description ?? inAny.instructions ?? null,
    subject_id: inAny.subject_id ?? inAny.subjectId ?? null,
    duration_minutes: inAny.duration_minutes ?? inAny.durationMinutes ?? null,
    pass_percentage: inAny.pass_percentage ?? inAny.passPercentage ?? null,
    // unify total marks/questions into `total_questions`
    total_questions:
      inAny.total_questions ??
      inAny.totalQuestions ??
      inAny.total_marks ??
      inAny.totalMarks ??
      null,
    updated_at: inAny.updated_at ?? inAny.updatedAt ?? null,
  }

  const sorted = Object.fromEntries(
    Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))
  )

  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex')
}
