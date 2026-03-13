import { describe, expect, it } from 'vitest'
import {
  createDefaultSignals,
  DEFAULT_THRESHOLD_POLICY,
  deriveHealthState,
  evaluateHealthSignals,
} from '../../../scripts/architecture-health/score-model'

describe('architecture-health score model', () => {
  it('maps score ranges to expected health states', () => {
    expect(deriveHealthState(95)).toBe('EXCELLENT')
    expect(deriveHealthState(80)).toBe('HEALTHY')
    expect(deriveHealthState(55)).toBe('WARNING')
    expect(deriveHealthState(25)).toBe('CRITICAL')
  })

  it('blocks when score falls below the threshold', () => {
    const signals = createDefaultSignals().map((signal) => ({
      ...signal,
      status: 'FAIL' as const,
      score_delta: signal.signal_id === 'dependency_integrity' ? 30 : 0,
    }))

    const evaluation = evaluateHealthSignals(signals, DEFAULT_THRESHOLD_POLICY)
    expect(evaluation.score).toBe(70)
    expect(evaluation.verdict).toBe('BLOCKED')
  })

  it('blocks when a hard-fail condition is triggered even with a passing score', () => {
    const evaluation = evaluateHealthSignals(createDefaultSignals(), DEFAULT_THRESHOLD_POLICY, true)
    expect(evaluation.verdict).toBe('BLOCKED')
  })
})
