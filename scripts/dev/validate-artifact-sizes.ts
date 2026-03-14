#!/usr/bin/env bun

/**
 * Validate AI Context Artifact Sizes (T051-T059)
 *
 * Purpose: Verify all artifacts meet Phase 3 size targets
 * Targets:
 *   - ai-context-mini.json: <50KB
 *   - ai-module-map.json: <200KB
 *   - ai-dependency-graph.json: <200KB
 *   - ai-runtime-dependents.json: <200KB
 *   - ai-architecture-brain.json: <400KB
 *   - ai-architecture-diff.json: <100KB
 *   - ai-layer-model.json: <100KB
 *   - ai-runtime-map.json: <50KB
 *
 * Success: All artifacts within targets + gzip compression >6x
 */

import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createLogger } from '../core/logger-factory'

const logger = createLogger('artifact-size-validator')

interface ArtifactTarget {
  path: string
  maxSizeKb: number
  minCompressionRatio: number
}

const ARTIFACTS: ArtifactTarget[] = [
  { path: 'docs/ai/context/ai-context-mini.json', maxSizeKb: 50, minCompressionRatio: 6 },
  { path: 'docs/ai/context/ai-module-map.json', maxSizeKb: 200, minCompressionRatio: 6 },
  {
    path: 'docs/ai/context/ai-dependency-graph.json',
    maxSizeKb: 200,
    minCompressionRatio: 6,
  },
  {
    path: 'docs/ai/context/ai-runtime-dependents.json',
    maxSizeKb: 200,
    minCompressionRatio: 6,
  },
  { path: 'docs/ai/context/ai-architecture-brain.json', maxSizeKb: 400, minCompressionRatio: 6 },
  {
    path: 'docs/ai/context/ai-architecture-diff.json',
    maxSizeKb: 100,
    minCompressionRatio: 6,
  },
  { path: 'docs/ai/context/ai-layer-model.json', maxSizeKb: 100, minCompressionRatio: 6 },
  { path: 'docs/ai/context/ai-runtime-map.json', maxSizeKb: 50, minCompressionRatio: 6 },
]

interface ValidationResult {
  artifact: string
  exists: boolean
  sizeKb: number
  targetKb: number
  status: 'PASS' | 'FAIL' | 'MISSING'
  compressionRatio: number
  checksum: string
  message: string
}

async function validateArtifactSize(target: ArtifactTarget): Promise<ValidationResult> {
  const name = basename(target.path)

  try {
    // Check if file exists
    const stats = statSync(target.path)
    const content = readFileSync(target.path, 'utf-8')
    const sizeBytes = stats.size
    const sizeKb = sizeBytes / 1024

    // Calculate compression ratio
    const compressed = gzipSync(content)
    const compressionRatio = sizeBytes / compressed.length

    // Calculate checksum
    const checksum = createHash('sha256').update(content).digest('hex').slice(0, 12)

    // Validate size
    const sizeStatus = sizeKb <= target.maxSizeKb
    // Only enforce compression ratio for files >10KB (small JSON files naturally have poor ratios)
    const compressionStatus = sizeBytes < 10240 || compressionRatio >= target.minCompressionRatio

    if (sizeStatus && compressionStatus) {
      return {
        artifact: name,
        exists: true,
        sizeKb: parseFloat(sizeKb.toFixed(2)),
        targetKb: target.maxSizeKb,
        status: 'PASS',
        compressionRatio: parseFloat(compressionRatio.toFixed(2)),
        checksum,
        message: `✓ Within size target (${sizeKb.toFixed(1)}KB / ${target.maxSizeKb}KB), compression ${compressionRatio.toFixed(1)}x`,
      }
    }

    const issues: string[] = []
    if (!sizeStatus) {
      issues.push(`Size ${sizeKb.toFixed(1)}KB exceeds ${target.maxSizeKb}KB`)
    }
    if (!compressionStatus && sizeBytes >= 10240) {
      issues.push(
        `Compression ${compressionRatio.toFixed(1)}x below ${target.minCompressionRatio}x`
      )
    }

    return {
      artifact: name,
      exists: true,
      sizeKb: parseFloat(sizeKb.toFixed(2)),
      targetKb: target.maxSizeKb,
      status: 'FAIL',
      compressionRatio: parseFloat(compressionRatio.toFixed(2)),
      checksum,
      message: `✗ ${issues.join(', ')}`,
    }
  } catch (_error) {
    return {
      artifact: name,
      exists: false,
      sizeKb: 0,
      targetKb: target.maxSizeKb,
      status: 'MISSING',
      compressionRatio: 0,
      checksum: '',
      message: `✗ File not found or unreadable`,
    }
  }
}

async function main() {
  logger.info('Starting artifact size validation...')

  const results: ValidationResult[] = []
  for (const target of ARTIFACTS) {
    const result = await validateArtifactSize(target)
    results.push(result)
  }

  // Generate report
  console.log('\n📊 ARTIFACT SIZE VALIDATION REPORT\n')
  console.log('| Artifact | Status | Size (KB) | Target (KB) | Compression | Checksum |')
  console.log('|----------|--------|-----------|-------------|-------------|----------|')

  let passCount = 0
  let failCount = 0
  let missingCount = 0

  for (const result of results) {
    const statusIcon = result.status === 'PASS' ? '✓' : result.status === 'MISSING' ? '?' : '✗'
    console.log(
      `| ${result.artifact} | ${statusIcon} ${result.status} | ${result.sizeKb} | ${result.targetKb} | ${result.compressionRatio}x | ${result.checksum} |`
    )

    if (result.status === 'PASS') passCount++
    else if (result.status === 'FAIL') failCount++
    else if (result.status === 'MISSING') missingCount++
  }

  console.log('\n📈 SUMMARY\n')
  console.log(`Total Artifacts: ${results.length}`)
  console.log(`✓ Passing: ${passCount}`)
  console.log(`✗ Failing: ${failCount}`)
  console.log(`? Missing: ${missingCount}`)

  // Overall status
  const allPass = passCount === results.length
  console.log(`\n${allPass ? '✓ ALL ARTIFACTS WITHIN TARGETS' : '✗ SOME ARTIFACTS OUT OF TARGET'}`)

  // Return exit code
  process.exit(allPass ? 0 : 1)
}

main().catch((error) => {
  logger.error('Validation failed', { error: String(error) })
  process.exit(1)
})
