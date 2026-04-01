/**
 * Traditional Exams — Domain Validators
 *
 * File: packages/domain-core/src/traditional-exams/traditional-exams.validators.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

// ── Validation Result ────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  reason?: string
}

// ── Pass Percentage Validator ────────────────────────────────────

export function validatePassPercentage(value: number): ValidationResult {
  if (value <= 0 || value > 100) {
    return {
      valid: false,
      reason: 'pass_percentage must be between 0 (exclusive) and 100 (inclusive)',
    }
  }
  return { valid: true }
}

// ── Structural Validation (Pre-ENABLED) ──────────────────────────

export interface StructuralValidationInput {
  exam_section_count: number
  template_section_count: number
  subsection_counts: Array<{
    section_id: string
    exam_count: number
    template_count: number
  }>
  subsections_with_questions: Array<{
    subsection_id: string
    question_count: number
  }>
  pass_percentage: number
  total_score: number
  duration_minutes: number | null
  has_chrono_mode: boolean
}

export interface StructuralValidationFailure {
  rule: string
  message: string
}

export function validateStructuralReadiness(
  input: StructuralValidationInput
): StructuralValidationFailure[] {
  const failures: StructuralValidationFailure[] = []

  // 1. Section count must match template
  if (input.exam_section_count !== input.template_section_count) {
    failures.push({
      rule: 'section_count_mismatch',
      message: `Exam has ${input.exam_section_count} sections but template requires ${input.template_section_count}`,
    })
  }

  // 2. Subsection count per section must match template
  for (const sub of input.subsection_counts) {
    if (sub.exam_count !== sub.template_count) {
      failures.push({
        rule: 'subsection_count_mismatch',
        message: `Section ${sub.section_id} has ${sub.exam_count} subsections but template requires ${sub.template_count}`,
      })
    }
  }

  // 3. Every subsection must have at least one question
  for (const sub of input.subsections_with_questions) {
    if (sub.question_count === 0) {
      failures.push({
        rule: 'empty_subsection',
        message: `Subsection ${sub.subsection_id} has no questions assigned`,
      })
    }
  }

  // 4. pass_percentage must be valid
  if (input.pass_percentage <= 0) {
    failures.push({
      rule: 'invalid_pass_percentage',
      message: 'pass_percentage must be greater than 0',
    })
  }

  // 5. Total score must be > 0
  if (input.total_score <= 0) {
    failures.push({
      rule: 'zero_total_score',
      message: 'Total score of all questions must be greater than 0',
    })
  }

  // 6. Chrono mode requires duration
  if (input.has_chrono_mode && (!input.duration_minutes || input.duration_minutes <= 0)) {
    failures.push({
      rule: 'chrono_no_duration',
      message: 'Auto-submit on timeout is enabled but duration_minutes is not set or is 0',
    })
  }

  return failures
}

// ── Transition Validation ────────────────────────────────────────

export type TransitionAction = 'review' | 'approve' | 'enable' | 'disable' | 'return'

interface TransitionRule {
  from: string
  to: string
  action: TransitionAction
  requiresReason: boolean
}

const TRANSITION_TABLE: TransitionRule[] = [
  { from: 'DRAFT', to: 'UNDER_REVIEW', action: 'review', requiresReason: false },
  { from: 'UNDER_REVIEW', to: 'APPROVED', action: 'approve', requiresReason: false },
  { from: 'APPROVED', to: 'ENABLED', action: 'enable', requiresReason: false },
  { from: 'ENABLED', to: 'DISABLED', action: 'disable', requiresReason: false },
  { from: 'UNDER_REVIEW', to: 'DRAFT', action: 'return', requiresReason: true },
  { from: 'APPROVED', to: 'UNDER_REVIEW', action: 'return', requiresReason: true },
]

export function findTransitionRule(
  currentStatus: string,
  targetStatus: string
): TransitionRule | null {
  return (
    TRANSITION_TABLE.find((rule) => rule.from === currentStatus && rule.to === targetStatus) ?? null
  )
}

export function getValidTransitions(currentStatus: string): string[] {
  return TRANSITION_TABLE.filter((rule) => rule.from === currentStatus).map((rule) => rule.to)
}
