import { describe, expect, it } from 'vitest'
import {
  buildAssessmentFromCollections,
  parseCliArgs,
} from '../../../scripts/architecture-health/architecture-health'
import { DEFAULT_THRESHOLD_POLICY } from '../../../scripts/architecture-health/score-model'
import type {
  ArchitectureIntelligenceSnapshot,
  HealthSignalResult,
  SourceRun,
} from '../../../scripts/architecture-health/types'

const snapshot: ArchitectureIntelligenceSnapshot = {
  snapshot_id: 'snapshot',
  artifacts: [],
  validation_status: 'CURRENT',
  validation_notes: 'ok',
}

const sourceRun: SourceRun = {
  tool: 'test',
  command: 'test',
  timeout_ms: 1000,
  duration_ms: 1,
  timed_out: false,
  started_at: '2026-03-12T00:00:00.000Z',
  finished_at: '2026-03-12T00:00:00.001Z',
  exit_code: 0,
  output_format: 'text',
}

function passSignals(): HealthSignalResult[] {
  return Object.entries(DEFAULT_THRESHOLD_POLICY.weights).map(([signal_id, weight]) => ({
    signal_id: signal_id as HealthSignalResult['signal_id'],
    weight,
    status: 'PASS',
    score_delta: 0,
    finding_count: 0,
    summary: 'ok',
    sources: ['test'],
  }))
}

describe('architecture-health CLI contract', () => {
  it('parses CLI options including refresh and fail-on-sync flags', () => {
    const options = parseCliArgs([
      '--ci',
      '--threshold',
      '65',
      '--refresh-context',
      '--fail-on-sync',
    ])
    expect(options.ci).toBe(true)
    expect(options.threshold).toBe(65)
    expect(options.refreshContext).toBe(true)
    expect(options.failOnSync).toBe(true)
  })

  it('keeps the immutable CI threshold even when a lower threshold is supplied', () => {
    const assessment = buildAssessmentFromCollections({
      repoRoot: process.cwd(),
      signals: passSignals(),
      findings: [],
      intelligenceSnapshot: snapshot,
      sourceRuns: [sourceRun],
      threshold: 10,
      ci: true,
      failOnSync: false,
    })

    expect(assessment.threshold_policy.minimum_passing_score).toBe(80)
    expect(assessment.overall.threshold.minimum_passing_score).toBe(80)
  })
})
