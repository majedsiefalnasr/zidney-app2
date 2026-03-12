import { describe, expect, it } from 'vitest'
import { runContextGenerationHook } from '../../../scripts/architecture-guard/hooks/generate-context'
import { runBrainValidationHook } from '../../../scripts/architecture-guard/hooks/validate-brain'

describe('US3 architecture brain validation hook', () => {
  it('validates ai-architecture-brain.json without throwing', () => {
    runContextGenerationHook()
    expect(() => runBrainValidationHook()).not.toThrow()
  })
})
