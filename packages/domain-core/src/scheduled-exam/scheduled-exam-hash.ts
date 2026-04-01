/**
 * Scheduled Exam — Base Exam Hash Computation
 *
 * File: packages/domain-core/src/scheduled-exam/scheduled-exam-hash.ts
 * Stage: STAGE_38_SCHEDULED_EXAM_ENGINE
 *
 * SHA-256 hash of sorted JSON of canonical fields to detect base exam drift.
 */

import { createHash } from 'node:crypto'

export const MCQ_HASH_FIELDS = [
  'title',
  'instructions',
  'totalMarks',
  'passMark',
  'durationMinutes',
  'questionPoolId',
] as const

export const TRADITIONAL_HASH_FIELDS = [
  'title',
  'instructions',
  'totalMarks',
  'passMark',
  'durationMinutes',
  'questionPoolId',
] as const

export interface McqHashInput {
  title: string
  instructions?: string | null
  totalMarks: number
  passMark: number
  durationMinutes?: number | null
  questionPoolId?: string | null
}

export type TraditionalHashInput = McqHashInput

export function computeBaseExamHash(input: McqHashInput | TraditionalHashInput): string {
  const normalized = {
    title: input.title,
    instructions: input.instructions ?? null,
    totalMarks: input.totalMarks,
    passMark: input.passMark,
    durationMinutes: input.durationMinutes ?? null,
    questionPoolId: input.questionPoolId ?? null,
  }
  const sorted = Object.fromEntries(
    Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))
  )
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex')
}
