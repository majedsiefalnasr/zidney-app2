/**
 * SECURITY-001 — Trivy CVE Findings Rule
 *
 * Surfaces HIGH and CRITICAL Trivy CVE findings by delegating to the Trivy adapter.
 *
 * Self-registers on import via side-effect call to registerRule().
 *
 * @module scripts/policy-engine/rules/security/SECURITY-001.rule
 */

import { runTrivy } from '../../adapters/trivy.adapter'
import { registerRule } from '../../registry'
import type { PolicyContext, PolicyResult } from '../../types'

registerRule({
  id: 'SECURITY-001',
  domain: 'SECURITY',
  description: 'Surfaces HIGH and CRITICAL Trivy CVE findings by delegating to the Trivy adapter',
  severity: 'error',
  sequential: false,
  evaluate(context: PolicyContext): Promise<PolicyResult[]> {
    return runTrivy(context)
  },
})
