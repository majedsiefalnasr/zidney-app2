/** @library-module */
import type { ArchitectureHealthAssessment } from './types'
import { SIGNAL_ORDER } from './types'

export interface ReportSchemaValidationResult {
  valid: boolean
  errors: string[]
}

export function validateArchitectureHealthReport(
  assessment: ArchitectureHealthAssessment
): ReportSchemaValidationResult {
  const errors: string[] = []

  if (!assessment.schema_version) errors.push('schema_version is required')
  if (!assessment.assessment_id) errors.push('assessment_id is required')
  if (!assessment.generated_at) errors.push('generated_at is required')
  if (assessment.signals.length !== SIGNAL_ORDER.length) {
    errors.push(`signals must contain exactly ${SIGNAL_ORDER.length} entries`)
  }

  const signalOrder = assessment.signals.map((signal) => signal.signal_id)
  if (JSON.stringify(signalOrder) !== JSON.stringify(SIGNAL_ORDER)) {
    errors.push('signals must appear in the canonical order')
  }

  if (assessment.threshold_policy.minimum_passing_score < 0) {
    errors.push('minimum_passing_score must be >= 0')
  }

  for (const sourceRun of assessment.source_runs) {
    if (sourceRun.timeout_ms <= 0) errors.push(`invalid timeout for ${sourceRun.tool}`)
    if (sourceRun.duration_ms < 0) errors.push(`invalid duration for ${sourceRun.tool}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
