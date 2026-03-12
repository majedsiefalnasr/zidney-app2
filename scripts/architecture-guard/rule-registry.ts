import { circularDependencyRule } from './rules/circular-dependency.rule'
import { dependencyBoundariesRule } from './rules/dependency-boundaries.rule'
import { nonNegotiablesRule } from './rules/non-negotiables.rule'
import { typeSafetySuppressionRule } from './rules/type-safety-suppression.rule'
import type { GuardRule, ValidationMode } from './types'

const REGISTERED_RULES: GuardRule[] = [
  dependencyBoundariesRule,
  circularDependencyRule,
  nonNegotiablesRule,
  typeSafetySuppressionRule,
].sort((a, b) => a.order - b.order)

export function getRulesForMode(mode: ValidationMode): GuardRule[] {
  return REGISTERED_RULES.filter((rule) => rule.enabledIn.includes(mode))
}

export function getRuleOrder(): string[] {
  return REGISTERED_RULES.map((rule) => rule.id)
}
