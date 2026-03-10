/**
 * Performance Tests - AI Context Generation
 * Task: T032
 * Path: tests/performance/ai-context-performance.test.ts
 */

import { describe, expect, it } from 'vitest'
import { generateAllArtifacts } from '../../scripts/ai-context/artifact-generator'

describe('AI Context Performance', () => {
  it('should generate artifacts in under 5 seconds', async () => {
    const startTime = performance.now()

    const result = await generateAllArtifacts({
      repoRoot: process.cwd(),
      outputDir: './test-perf-output',
      validate: false,
      verbose: false,
    })

    const duration = performance.now() - startTime

    expect(result.success).toBeTruthy()
    expect(duration).toBeLessThan(5000) // 5 seconds
  })

  it('should report generation metrics', async () => {
    const result = await generateAllArtifacts({
      repoRoot: process.cwd(),
      outputDir: './test-perf-output-2',
      validate: false,
      verbose: false,
    })

    expect(result.metrics.generation_time_ms).toBeDefined()
    expect(result.metrics.total_modules).toBeGreaterThan(0)
    expect(result.metrics.generator_version).toBeDefined()
  })
})
