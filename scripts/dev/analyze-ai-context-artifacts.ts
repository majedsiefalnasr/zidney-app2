#!/usr/bin/env bun

/**
 * analyze-ai-context-artifacts.ts
 *
 * Analyzes AI context artifacts for size, compression, and redundancy.
 * Identifies optimization opportunities in Phase 3.
 *
 * Usage: bun scripts/dev/analyze-ai-context-artifacts.ts
 */

import * as path from 'node:path'
import { AIContextAnalyzer } from '../../tests/audit-helpers'
import { flushAi, log } from '../utils/logger'

const contextDir = path.join(process.cwd(), 'docs/ai/context')

log.header(
  'ANALYZE AI CONTEXT ARTIFACTS',
  'Analyzes AI context artifacts for size, compression, and redundancy'
)

const results = AIContextAnalyzer.analyzeArtifactDirectory(contextDir)

if (results.length === 0) {
  log.warn('No AI context artifacts found')
  log.result({ total: 0, passed: 0, failed: 0 })
  flushAi()
  process.exit(0)
}

// Sort by size descending
results.sort((a, b) => b.sizeBytes - a.sizeBytes)

// Display results
log.step('Artifact Analysis:')
log.info('Artifact Name                        Size (KB)  Compressed   Ratio   Status')
log.info('─'.repeat(85))

let totalSize = 0
let totalCompressed = 0

const targets: Record<string, number> = {
  'ai-context-mini.json': 50,
  'ai-module-map.json': 200,
  'ai-dependency-graph.json': 500,
  'ai-architecture-brain.json': 400,
  'ai-runtime-map.json': 50,
  'ai-runtime-dependents.json': 200,
  'ai-layer-model.json': 100,
  'ai-architecture-diff.json': 100,
}

for (const result of results) {
  totalSize += result.sizeBytes
  totalCompressed += result.compressedSizeBytes

  const sizeKb = Math.round(result.sizeBytes / 1024)
  const compKb = Math.round(result.compressedSizeBytes / 1024)
  const ratio = result.compressionRatio.toFixed(1)
  const target = targets[result.artifactName]

  let status = '✓'
  if (target && sizeKb > target) {
    status = '⚠️ OVER'
  }

  log.info(
    `${result.artifactName.padEnd(35)} ${sizeKb.toString().padStart(8)}KB  ${compKb.toString().padStart(7)}KB   ${ratio.padStart(6)}x   ${status}`
  )
}

log.info('─'.repeat(85))
log.info(
  `${'TOTAL'.padEnd(35)} ${Math.round(totalSize / 1024)
    .toString()
    .padStart(8)}KB  ${Math.round(totalCompressed / 1024)
    .toString()
    .padStart(7)}KB   ${(totalSize / totalCompressed).toFixed(1).padStart(6)}x`
)

log.step('Phase 3 Optimization Targets:')
log.info(`Current total size: ${Math.round(totalSize / 1024)}KB`)
log.info(`Current compressed size: ${Math.round(totalCompressed / 1024)}KB`)
log.info('Phase 3 target: <10MB total uncompressed')
log.info('Phase 3 target: <2s generation time (cold run)')
log.info('Phase 3 target: <500ms generation time (warm/cached run)')

log.step('Compression Stats:')
const avgRatio = results.reduce((sum, r) => sum + r.compressionRatio, 0) / results.length
log.info(`Average compression ratio: ${avgRatio.toFixed(1)}:1`)
log.info('Target ratio: >6:1 (85% reduction)')

const lowRatio = results.filter((r) => r.compressionRatio < 6)
if (lowRatio.length > 0) {
  log.warn('Artifacts below target compression:')
  for (const artifact of lowRatio) {
    log.warn(
      `  • ${artifact.artifactName}: ${artifact.compressionRatio.toFixed(1)}:1 (optimize content structure)`
    )
  }
}

log.step('Content Hashes (for change detection):')
for (const result of results) {
  log.info(`${result.artifactName.padEnd(35)} ${result.contentHash}`)
}

log.result({ total: results.length, passed: results.length, failed: 0 })
flushAi()
