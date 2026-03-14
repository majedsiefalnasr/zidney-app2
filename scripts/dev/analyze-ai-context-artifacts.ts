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

const contextDir = path.join(process.cwd(), 'docs/ai/context')

console.log('🧠 Analyzing AI context artifacts...\n')

const results = AIContextAnalyzer.analyzeArtifactDirectory(contextDir)

if (results.length === 0) {
  console.log('⚠️ No AI context artifacts found')
  process.exit(0)
}

// Sort by size descending
results.sort((a, b) => b.sizeBytes - a.sizeBytes)

// Display results
console.log('📊 Artifact Analysis:\n')
console.log('Artifact Name                        Size (KB)  Compressed   Ratio   Status')
console.log('─'.repeat(85))

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

  console.log(
    `${result.artifactName.padEnd(35)} ${sizeKb.toString().padStart(8)}KB  ${compKb.toString().padStart(7)}KB   ${ratio.padStart(6)}x   ${status}`
  )
}

console.log('─'.repeat(85))
console.log(
  `${'TOTAL'.padEnd(35)} ${Math.round(totalSize / 1024)
    .toString()
    .padStart(8)}KB  ${Math.round(totalCompressed / 1024)
    .toString()
    .padStart(7)}KB   ${(totalSize / totalCompressed).toFixed(1).padStart(6)}x`
)

// Phase 3 Targets
console.log('\n🎯 Phase 3 Optimization Targets:\n')
console.log(`Current total size: ${Math.round(totalSize / 1024)}KB`)
console.log(`Current compressed size: ${Math.round(totalCompressed / 1024)}KB`)
console.log(`Phase 3 target: <10MB total uncompressed`)
console.log(`Phase 3 target: <2s generation time (cold run)`)
console.log(`Phase 3 target: <500ms generation time (warm/cached run)`)

// Compression efficiency
console.log('\n📈 Compression Stats:\n')
const avgRatio = results.reduce((sum, r) => sum + r.compressionRatio, 0) / results.length
console.log(`Average compression ratio: ${avgRatio.toFixed(1)}:1`)
console.log(`Target ratio: >6:1 (85% reduction)`)

const lowRatio = results.filter((r) => r.compressionRatio < 6)
if (lowRatio.length > 0) {
  console.log(`\nArtifacts below target compression:`)
  for (const artifact of lowRatio) {
    console.log(
      `  • ${artifact.artifactName}: ${artifact.compressionRatio.toFixed(1)}:1 (optimize content structure)`
    )
  }
}

// Content hash for change detection
console.log('\n🔐 Content Hashes (for change detection):\n')
for (const result of results) {
  console.log(`${result.artifactName.padEnd(35)} ${result.contentHash}`)
}
