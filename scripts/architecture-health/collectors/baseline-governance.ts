import type { GuardRunReport, ViolationRecord } from '../architecture-guard-types'
import { DEFAULT_THRESHOLD_POLICY } from '../score-model'
import type { HealthFinding, HealthSignalResult } from '../types'

type GuardSignalGroup =
  | 'dependency_integrity'
  | 'layer_integrity'
  | 'circular_dependency_risk'
  | 'architecture_drift'

export interface InfraAuditQuickSummary {
  dependencyViolations: number
  circularDependencies: number
  layerViolations: number
  architectureMapViolations: number
  architectureDrift: number
  architectureScore?: number
}

const SUMMARY_PATTERNS: Array<[keyof InfraAuditQuickSummary, RegExp]> = [
  ['dependencyViolations', /^Dependency violations:\s+(\d+)$/m],
  ['circularDependencies', /^Circular dependencies:\s+(\d+)$/m],
  ['layerViolations', /^Layer violations:\s+(\d+)$/m],
  ['architectureMapViolations', /^Architecture map violations:\s+(\d+)$/m],
  ['architectureDrift', /^Architecture drift:\s+(\d+)$/m],
  ['architectureScore', /^Architecture score:\s+(\d+)\s+\/\s+100$/m],
]

function violationToSignal(rule: string): GuardSignalGroup {
  if (rule === 'dependency-boundaries') return 'dependency_integrity'
  if (rule === 'circular-dependency') return 'circular_dependency_risk'
  if (rule.includes('arch-drift')) return 'architecture_drift'
  return 'layer_integrity'
}

function violationToClassification(rule: string): HealthFinding['classification'] {
  return rule.includes('arch-drift') ? 'drift' : 'direct_rule_violation'
}

function violationToSeverity(violation: ViolationRecord): HealthFinding['severity'] {
  return violation.severity === 'error' ? 'high' : 'medium'
}

function buildSignal(
  signal_id: GuardSignalGroup,
  count: number,
  summary: string,
  sources: string[]
): HealthSignalResult {
  const weight = DEFAULT_THRESHOLD_POLICY.weights[signal_id]
  const status = count === 0 ? 'PASS' : 'FAIL'
  return {
    signal_id,
    weight,
    status,
    score_delta: count === 0 ? 0 : Math.min(weight, count * 5),
    finding_count: count,
    summary,
    sources,
  }
}

export function parseInfraAuditQuickSummary(stdout: string): InfraAuditQuickSummary {
  const summary: InfraAuditQuickSummary = {
    dependencyViolations: 0,
    circularDependencies: 0,
    layerViolations: 0,
    architectureMapViolations: 0,
    architectureDrift: 0,
  }

  for (const [key, pattern] of SUMMARY_PATTERNS) {
    const match = stdout.match(pattern)
    if (match) {
      summary[key] = Number(match[1]) as never
    }
  }

  return summary
}

export function parseGuardRunReport(stdout: string): GuardRunReport {
  return JSON.parse(stdout) as GuardRunReport
}

export function normalizeBaselineGovernance(input: {
  guardReport: GuardRunReport
  infraSummary: InfraAuditQuickSummary
}): {
  signals: HealthSignalResult[]
  findings: HealthFinding[]
} {
  const findings: HealthFinding[] = input.guardReport.violations.map((violation, index) => ({
    finding_id: `${violation.rule}-${index}-${violation.location.file}`,
    signal_ids: [violationToSignal(violation.rule)],
    classification: violationToClassification(violation.rule),
    severity: violationToSeverity(violation),
    impacted_surface: violation.source_module || violation.location.file,
    location: {
      file: violation.location.file,
      line: violation.location.line,
      column: violation.location.column,
    },
    message: violation.message,
    remediation: violation.remediation,
    source_tools: ['architecture-guard'],
  }))

  const dependencyCount = Math.max(
    input.infraSummary.dependencyViolations,
    findings.filter((finding) => finding.signal_ids.includes('dependency_integrity')).length
  )
  const circularCount = Math.max(
    input.infraSummary.circularDependencies,
    findings.filter((finding) => finding.signal_ids.includes('circular_dependency_risk')).length
  )
  const driftCount =
    input.infraSummary.architectureMapViolations +
    input.infraSummary.architectureDrift +
    findings.filter((finding) => finding.signal_ids.includes('architecture_drift')).length
  const layerCount = Math.max(
    input.infraSummary.layerViolations,
    findings.filter((finding) => finding.signal_ids.includes('layer_integrity')).length
  )

  return {
    signals: [
      buildSignal(
        'dependency_integrity',
        dependencyCount,
        `Dependency violations: ${dependencyCount}`,
        ['architecture-guard', 'infra-audit --quick']
      ),
      buildSignal('layer_integrity', layerCount, `Layer violations: ${layerCount}`, [
        'architecture-guard',
        'infra-audit --quick',
      ]),
      buildSignal(
        'circular_dependency_risk',
        circularCount,
        `Circular dependencies: ${circularCount}`,
        ['architecture-guard', 'infra-audit --quick']
      ),
      buildSignal(
        'architecture_drift',
        driftCount,
        `Architecture drift and map violations: ${driftCount}`,
        ['architecture-guard', 'infra-audit --quick']
      ),
    ],
    findings,
  }
}
