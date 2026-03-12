import type {
  FallbackReason,
  GuardRunReport,
  ScopeMetrics,
  ValidationMode,
  ViolationRecord,
} from '../types'
import { normalizeViolations } from './violation-normalizer'

interface BuildJsonReportInput {
  mode: ValidationMode
  scope: ScopeMetrics
  fallbackReason: FallbackReason
  contractError: boolean
  violations: ViolationRecord[]
  durationMs: number
}

export function buildJsonReport(input: BuildJsonReportInput): GuardRunReport {
  const normalizedViolations = normalizeViolations(input.violations)
  const hasErrors = normalizedViolations.some((violation) => violation.severity === 'error')

  return {
    run_id: `${Date.now()}`,
    timestamp: new Date().toISOString(),
    validation_mode: input.mode,
    scope: input.scope,
    fallback_reason: input.fallbackReason,
    contract_error: input.contractError,
    verdict: input.contractError || hasErrors ? 'BLOCKED' : 'PASS',
    violations: normalizedViolations,
    duration_ms: input.durationMs,
  }
}

export function reportToJson(report: GuardRunReport): string {
  return JSON.stringify(report, null, 2)
}
