import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { runContextGenerationHook } from '../../../scripts/architecture-guard/hooks/generate-context'

const REQUIRED_ARTIFACTS = [
  'docs/ai/context/ai-architecture-summary.md',
  'docs/ai/context/ai-module-map.json',
  'docs/ai/context/ai-layer-model.json',
  'docs/ai/context/ai-dependency-graph.json',
  'docs/ai/context/ai-runtime-map.json',
  'docs/ai/context/ai-runtime-dependents.json',
  'docs/ai/context/ai-architecture-brain.json',
  'docs/ai/context/ai-architecture-diff.json',
  'docs/ai/context/ai-context-mini.json',
]

describe('US3 architecture context generation', () => {
  it('generates required architecture context artifacts', () => {
    runContextGenerationHook()

    for (const artifact of REQUIRED_ARTIFACTS) {
      expect(existsSync(artifact), `Missing artifact: ${artifact}`).toBe(true)
    }
  })
})
