/**
 * Integration Tests - AI Context Generation
 * Task: T031
 * Path: tests/integration/ai-context-integration.test.ts
 */

import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateAllArtifacts } from '../../scripts/ai-context/artifact-generator'

const TEST_OUTPUT_DIR = './tests/ai-context/test-ai-context-output'

describe('AI Context Integration', () => {
  beforeAll(async () => {
    // Clean up any previous test output
    try {
      await rm(TEST_OUTPUT_DIR, { recursive: true, force: true })
    } catch {}
  })

  it('should generate all artifacts successfully', async () => {
    const result = await generateAllArtifacts({
      repoRoot: process.cwd(),
      outputDir: TEST_OUTPUT_DIR,
      validate: true,
      verbose: false,
    })

    expect(result.success).toBeTruthy()
    expect(result.artifacts_generated.length).toBe(7)
    expect(result.errors.length).toBe(0)
  })

  it('should generate valid JSON artifacts', async () => {
    const jsonArtifacts = [
      'ai-module-map.json',
      'ai-layer-model.json',
      'ai-dependency-graph.json',
      'ai-runtime-map.json',
      'ai-architecture-brain.json',
      'ai-context-mini.json',
    ]

    for (const artifact of jsonArtifacts) {
      const filePath = join(TEST_OUTPUT_DIR, artifact)
      const content = await readFile(filePath, 'utf-8')

      // Should be valid JSON
      const parsed = JSON.parse(content)
      expect(parsed).toBeDefined()

      // Should have required fields
      expect(parsed.schema_version).toBeDefined()
      expect(parsed.generated_at).toBeDefined()
    }
  })

  it('should generate markdown architecture summary', async () => {
    const summaryPath = join(TEST_OUTPUT_DIR, 'ai-architecture-summary.md')
    const content = await readFile(summaryPath, 'utf-8')

    expect(content).toContain('# Zidney Architecture Summary')
    expect(content).toContain('## System Layers')
    expect(content).toContain('## Applications')
    expect(content).toContain('## Packages')
  })

  it('should include source metadata in artifacts', async () => {
    const modulePath = join(TEST_OUTPUT_DIR, 'ai-module-map.json')
    const content = await readFile(modulePath, 'utf-8')
    const parsed = JSON.parse(content)

    expect(parsed.source_metadata).toBeDefined()
    expect(parsed.source_metadata.module_boundaries_hash).toBeTruthy()
    expect(parsed.source_metadata.audit_timestamp).toBeTruthy()
  })

  it('should generate consistent results on repeated runs', async () => {
    const result1 = await generateAllArtifacts({
      repoRoot: process.cwd(),
      outputDir: TEST_OUTPUT_DIR,
      validate: false,
      verbose: false,
    })

    const result2 = await generateAllArtifacts({
      repoRoot: process.cwd(),
      outputDir: TEST_OUTPUT_DIR,
      validate: false,
      verbose: false,
    })

    expect(result1.metrics.total_modules).toBe(result2.metrics.total_modules)
    expect(result1.metrics.total_violations).toBe(result2.metrics.total_violations)
  })
})
