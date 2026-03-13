import { DEFAULT_THRESHOLD_POLICY } from '../score-model'
import type { HealthFinding, HealthSignalResult, SourceRun } from '../types'

export interface TypeSafetyGuardReport {
  violations: Array<{
    file: string
    line: number
    column: number
    pattern: string
    code: string
    message: string
  }>
  total: number
}

export function parseTypeSafetyGuardReport(stdout: string): TypeSafetyGuardReport {
  return JSON.parse(stdout) as TypeSafetyGuardReport
}

export function normalizeValidationGovernance(input: {
  typeSafetyReport: TypeSafetyGuardReport
  brainValidationRun: SourceRun
}): {
  signal: HealthSignalResult
  findings: HealthFinding[]
} {
  const findings: HealthFinding[] = input.typeSafetyReport.violations.map((violation, index) => ({
    finding_id: `type-safety-${index}-${violation.file}-${violation.line}`,
    signal_ids: ['type_safety_governance'],
    classification: 'direct_rule_violation',
    severity: 'medium',
    impacted_surface: violation.file,
    location: {
      file: violation.file,
      line: violation.line,
      column: violation.column,
    },
    message: violation.message,
    remediation: `Remove the unsafe type pattern: ${violation.pattern}`,
    source_tools: ['type-safety-guard'],
  }))

  if (input.brainValidationRun.exit_code !== 0) {
    findings.push({
      finding_id: 'architecture-brain-validation-failed',
      signal_ids: ['intelligence_synchronization', 'type_safety_governance'],
      classification: 'synchronization',
      severity: 'high',
      impacted_surface: 'docs/ai/context/ai-architecture-brain.json',
      message: 'Architecture brain validation failed.',
      remediation: 'Run bun run arch:validate-brain and resolve the reported graph issues.',
      source_tools: ['arch:validate-brain'],
    })
  }

  const weight = DEFAULT_THRESHOLD_POLICY.weights.type_safety_governance
  const count = findings.filter((finding) =>
    finding.signal_ids.includes('type_safety_governance')
  ).length

  return {
    signal: {
      signal_id: 'type_safety_governance',
      weight,
      status: count === 0 ? 'PASS' : 'FAIL',
      score_delta: count === 0 ? 0 : Math.min(weight, count * 5),
      finding_count: count,
      summary: `Type safety violations: ${input.typeSafetyReport.total}`,
      sources: ['type-safety-guard', 'arch:validate-brain'],
    },
    findings,
  }
}
