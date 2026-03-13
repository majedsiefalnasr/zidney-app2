import type { HealthSignalResult, HealthState, HealthThresholdPolicy, HealthVerdict } from './types'
import { SIGNAL_ORDER } from './types'

export const DEFAULT_THRESHOLD_POLICY: HealthThresholdPolicy = {
  policy_id: 'default-health-threshold-v1',
  minimum_passing_score: 80,
  weights: {
    dependency_integrity: 30,
    layer_integrity: 20,
    circular_dependency_risk: 15,
    type_safety_governance: 15,
    architecture_drift: 10,
    intelligence_synchronization: 10,
  },
  hard_fail_conditions: ['invalid_architecture_intelligence'],
  status_mapping: {
    excellent_minimum: 90,
    healthy_minimum: 75,
    warning_minimum: 50,
  },
}

export interface HealthScoreEvaluation {
  score: number
  health_state: HealthState
  verdict: HealthVerdict
}

export function validateThresholdPolicy(policy: HealthThresholdPolicy): boolean {
  const total = SIGNAL_ORDER.reduce((sum, signalId) => sum + policy.weights[signalId], 0)
  return total === 100
}

export function deriveHealthState(score: number, policy = DEFAULT_THRESHOLD_POLICY): HealthState {
  if (score >= policy.status_mapping.excellent_minimum) return 'EXCELLENT'
  if (score >= policy.status_mapping.healthy_minimum) return 'HEALTHY'
  if (score >= policy.status_mapping.warning_minimum) return 'WARNING'
  return 'CRITICAL'
}

export function evaluateHealthSignals(
  signals: HealthSignalResult[],
  policy = DEFAULT_THRESHOLD_POLICY,
  hardFailTriggered = false
): HealthScoreEvaluation {
  if (!validateThresholdPolicy(policy)) {
    throw new Error(`Invalid threshold policy: ${policy.policy_id}`)
  }

  const totalPenalty = signals.reduce((sum, signal) => sum + signal.score_delta, 0)
  const score = Math.max(0, Math.min(100, 100 - totalPenalty))
  const health_state = deriveHealthState(score, policy)
  const verdict: HealthVerdict =
    hardFailTriggered || score < policy.minimum_passing_score ? 'BLOCKED' : 'PASS'

  return {
    score,
    health_state,
    verdict,
  }
}

export function createDefaultSignals(): HealthSignalResult[] {
  return SIGNAL_ORDER.map((signal_id) => ({
    signal_id,
    weight: DEFAULT_THRESHOLD_POLICY.weights[signal_id],
    status: 'WARN',
    score_delta: 0,
    finding_count: 0,
    summary: 'Signal collector initialization pending',
    sources: [],
  }))
}
