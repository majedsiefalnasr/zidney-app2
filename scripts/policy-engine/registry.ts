/**
 * Policy Engine — Rule Registry
 *
 * Central catalog of all registered PolicyRule instances.
 * Populated at module initialization time via compile-time registration
 * (side-effect imports in cli.ts trigger registerRule() calls in each rule file).
 *
 * No dynamic loading — registry is populated only by static imports.
 *
 * @module scripts/policy-engine/registry
 
 * @library-module
*/

import type { PolicyDomain, PolicyRule, RegistryStats } from './types'

const _registry: PolicyRule[] = []

/**
 * Register a rule in the policy engine registry.
 * Throws synchronously on duplicate rule.id — caught during initialization,
 * surfaces as process error before engine runs.
 */
export function registerRule(rule: PolicyRule): void {
  const existing = _registry.find((r) => r.id === rule.id)
  if (existing) {
    throw new Error(
      `PolicyRegistry: duplicate rule ID "${rule.id}". Each rule ID must be globally unique.`
    )
  }
  _registry.push(rule)
}

/**
 * Returns a frozen copy of all registered rules.
 * The returned array cannot be mutated.
 */
export function getRules(): readonly PolicyRule[] {
  return Object.freeze([..._registry])
}

/**
 * Returns registry statistics for Gate 3 coverage test.
 * Reports domain counts to verify all required domains are covered.
 */
export function getRegistryStats(): RegistryStats {
  const domainCounts: Partial<Record<PolicyDomain, number>> = {}

  for (const rule of _registry) {
    domainCounts[rule.domain] = (domainCounts[rule.domain] ?? 0) + 1
  }

  return {
    totalRules: _registry.length,
    domainCounts,
  }
}

/**
 * Reset the registry. FOR TESTING ONLY — not exported in production.
 * @internal
 */
export function _resetRegistryForTesting(): void {
  _registry.length = 0
}
