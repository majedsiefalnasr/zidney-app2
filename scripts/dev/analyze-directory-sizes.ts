#!/usr/bin/env bun

/**
 * analyze-directory-sizes.ts
 *
 * Measures directory sizes using system `du` command.
 * Identifies largest directories contributing to repository bloat.
 *
 * Usage: bun scripts/dev/analyze-directory-sizes.ts
 */

import { DirectorySizeAnalyzer } from '../../tests/audit-helpers'

const rootDir = process.cwd()

console.log('📂 Analyzing directory sizes...\n')

// Analyze key directories
const results = DirectorySizeAnalyzer.analyzeKeyDirectories(rootDir)

if (results.length === 0) {
  console.log('❌ No directories found')
  process.exit(1)
}

// Sort by size descending
results.sort((a, b) => b.sizeBytes - a.sizeBytes)

// Display results
console.log('📊 Directory Sizes:\n')
console.log('Directory                          Size        Files')
console.log('─'.repeat(70))

let totalSize = 0
for (const result of results) {
  totalSize += result.sizeBytes
  console.log(
    `${result.dirPath.padEnd(34)} ${result.scaledSize.padStart(8)}    ${result.fileCount.toLocaleString().padStart(6)} files`
  )
}

console.log('─'.repeat(70))
console.log(
  `${'TOTAL'.padEnd(34)} ${Math.round((totalSize / (1024 * 1024 * 1024)) * 10) / 10}GB`.padEnd(42)
)

// Percentage distribution
console.log('\n📈 Size Distribution:\n')
for (const result of results.slice(0, 5)) {
  const percentage = ((result.sizeBytes / totalSize) * 100).toFixed(1)
  const bar = '█'.repeat(Math.round(parseFloat(percentage) / 5))
  console.log(`${result.dirPath.padEnd(34)} ${bar} ${percentage}%`)
}

// Targets and recommendations
console.log('\n🎯 Target Analysis:\n')

const nodeModules = results.find((r) => r.dirPath.includes('node_modules'))
const artifacts = results.find((r) => r.dirPath.includes('docs/ai/context'))
const scripts = results.find((r) => r.dirPath.includes('scripts'))

console.log('Current vs Target:')
if (nodeModules) {
  console.log(`  node_modules: ${nodeModules.scaledSize} (not counted in compressed size)`)
}
if (artifacts) {
  console.log(`  AI Context: ${artifacts.scaledSize} (target: <10MB)`)
}
if (scripts) {
  console.log(`  Scripts: ${scripts.scaledSize} (target: reduced by 30% after P2)`)
}

console.log(
  `\n  Total (excl. node_modules): ~${Math.round((totalSize - (nodeModules?.sizeBytes || 0)) / 1024 / 1024)}MB`
)
console.log(
  `  Compressed estimate: ~${Math.round((totalSize - (nodeModules?.sizeBytes || 0)) / 1024 / 1024 / 2)}MB (50% est.)`
)
