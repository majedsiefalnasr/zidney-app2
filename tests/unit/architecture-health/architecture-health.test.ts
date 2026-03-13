import { describe, expect, it } from 'vitest'
import { buildAssessmentFromCollections } from '../../../scripts/architecture-health/architecture-health'
import { DEFAULT_THRESHOLD_POLICY } from '../../../scripts/architecture-health/score-model'
import type {
  ArchitectureIntelligenceSnapshot,
  HealthFinding,
  HealthSignalResult,
  SourceRun,
} from '../../../scripts/architecture-health/types'

const emptySnapshot: ArchitectureIntelligenceSnapshot = {
  snapshot_id: 'snapshot-1',
  artifacts: [],
  validation_status: 'CURRENT',
  validation_notes: 'All current',
}

const baseSourceRun: SourceRun = {
  tool: 'test',
  command: 'test',
  timeout_ms: 1000,
  duration_ms: 10,
  timed_out: false,
  started_at: '2026-03-12T00:00:00.000Z',
  finished_at: '2026-03-12T00:00:00.010Z',
  exit_code: 0,
  output_format: 'text',
}

function healthySignals(): HealthSignalResult[] {
  return [
    'dependency_integrity',
    'layer_integrity',
    'circular_dependency_risk',
    'type_safety_governance',
    'architecture_drift',
    'intelligence_synchronization',
  ].map((signal_id) => ({
    signal_id: signal_id as HealthSignalResult['signal_id'],
    weight:
      DEFAULT_THRESHOLD_POLICY.weights[signal_id as keyof typeof DEFAULT_THRESHOLD_POLICY.weights],
    status: 'PASS',
    score_delta: 0,
    finding_count: 0,
    summary: 'ok',
    sources: ['test'],
  }))
}

describe('architecture-health assessment composition', () => {
  it('returns PASS for a compliant repository state', () => {
    const assessment = buildAssessmentFromCollections({
      repoRoot: process.cwd(),
      signals: healthySignals(),
      findings: [],
      intelligenceSnapshot: emptySnapshot,
      sourceRuns: [baseSourceRun],
      threshold: undefined,
      ci: false,
      failOnSync: false,
    })

    expect(assessment.overall.verdict).toBe('PASS')
    expect(assessment.overall.score).toBe(100)
  })

  it('returns BLOCKED for a regressed repository state', () => {
    const findings: HealthFinding[] = [
      {
        finding_id: 'drift-1',
        signal_ids: ['architecture_drift'],
        classification: 'drift',
        severity: 'high',
        impacted_surface: 'packages/logger',
        message: 'Architecture drift detected',
        remediation: 'Refresh context',
        source_tools: ['architecture-guard'],
      },
    ]

    const signals = healthySignals().map((signal) =>
      signal.signal_id === 'architecture_drift'
        ? { ...signal, status: 'FAIL' as const, score_delta: 30, finding_count: 1 }
        : signal
    )

    const assessment = buildAssessmentFromCollections({
      repoRoot: process.cwd(),
      signals,
      findings,
      intelligenceSnapshot: emptySnapshot,
      sourceRuns: [baseSourceRun],
      threshold: undefined,
      ci: true,
      failOnSync: false,
    })

    expect(assessment.overall.verdict).toBe('BLOCKED')
    expect(assessment.findings).toHaveLength(1)
  })
})
