/**
 * ARCH-001 — Architecture Dependency Boundary Rule
 *
 * Detects module import boundary violations by delegating to the architecture-guard adapter.
 * Self-registers on import via side-effect call to registerRule().
 *
 * @module scripts/policy-engine/rules/architecture/ARCH-001.rule
 
 * @library-module
*/

import { runArchitectureGuard } from '../../adapters/architecture-guard.adapter'
import { registerRule } from '../../registry'
import type { PolicyContext, PolicyResult } from '../../types'

registerRule({
  id: 'ARCH-001',
  domain: 'ARCH',
  description:
    'Detects module import boundary violations by delegating to the architecture-guard adapter',
  severity: 'error',
  sequential: false,
  evaluate(context: PolicyContext): Promise<PolicyResult[]> {
    return runArchitectureGuard(context)
  },
})
