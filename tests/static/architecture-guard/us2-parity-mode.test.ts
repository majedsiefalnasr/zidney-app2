import { describe, expect, it } from 'vitest'
import { getRulesForMode } from '../../../scripts/architecture-guard/rule-registry'

describe('US2 strict vs changed rule parity', () => {
  it('runs identical rule set for strict and changed modes', () => {
    const strictRules = getRulesForMode('strict').map((rule) => rule.id)
    const changedRules = getRulesForMode('changed').map((rule) => rule.id)

    expect(changedRules).toEqual(strictRules)
  })
})
