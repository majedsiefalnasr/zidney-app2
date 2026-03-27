/**
 * TYPES-001 — TypeScript Type Safety Rule
 *
 * Detects TypeScript type-safety violations by delegating to the type-safety adapter.
 * Sequential: true — tsc is stateful; running multiple tsc invocations in parallel
 * can cause port conflicts with the language server.
 *
 * Self-registers on import via side-effect call to registerRule().
 *
 * @module scripts/policy-engine/rules/types/TYPES-001.rule
 
 * @library-module
*/

import { runTypeSafety } from '../../adapters/type-safety.adapter'
import { registerRule } from '../../registry'
import type { PolicyContext, PolicyResult } from '../../types'

registerRule({
  id: 'TYPES-001',
  domain: 'TYPES',
  description: 'Detects TypeScript type-safety violations by delegating to the type-safety adapter',
  severity: 'error',
  sequential: true, // tsc is stateful — must not run in parallel
  evaluate(context: PolicyContext): Promise<PolicyResult[]> {
    return runTypeSafety(context)
  },
})
