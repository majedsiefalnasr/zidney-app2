#!/usr/bin/env bun

/**
 * analyze-file-sizes.ts
 *
 * Analyzes repository files for size and line count.
 * Identifies oversized files (>2000 lines, >1MB) for optimization.
 *
 * Usage: bun scripts/dev/analyze-file-sizes.ts
 */

import * as path from 'node:path'
import { FileSizeAnalyzer } from '../../tests/audit-helpers'

const rootDir = process.cwd()

console.log('🔍 Analyzing file sizes across repository...\n')

// Find oversized files
const results = FileSizeAnalyzer.findOversizedFiles(rootDir, 2000, 1_000_000)

if (results.length === 0) {
  console.log('✅ No oversized files found!')
  process.exit(0)
}

// Sort by size descending
results.sort((a, b) => b.sizeBytes - a.sizeBytes)

// Display results
console.log(`📊 Found ${results.length} oversized files:\n`)

// Group by category
const byStatus = new Map<string, typeof results>()
for (const result of results) {
  const current = byStatus.get(result.status) || []
  current.push(result)
  byStatus.set(result.status, current)
}

// Display by status
for (const [status, items] of byStatus) {
  const label = status === 'oversized' ? '🚨 OVERSIZED (>2000 lines)' : '⚠️ LARGE (>1MB)'
  console.log(`\n${label}:`)
  console.log('─'.repeat(100))

  for (const item of items) {
    const relPath = path.relative(rootDir, item.filePath)
    const sizeKb = Math.round(item.sizeBytes / 1024)
    console.log(`${relPath}`)
    console.log(`  └─ ${item.lineCount.toLocaleString()} lines, ${sizeKb}KB`)
  }

  console.log()
}

// Summary statistics
const totalSize = results.reduce((sum, r) => sum + r.sizeBytes, 0)
const oversized = results.filter((r) => r.status === 'oversized')
const large = results.filter((r) => r.status === 'large')

console.log('\n📈 Summary Statistics:')
console.log('─'.repeat(100))
console.log(`Total oversized files: ${oversized.length}`)
console.log(`Total large files: ${large.length}`)
console.log(`Total combined size: ${Math.round(totalSize / 1024 / 1024)}MB`)
console.log(`Average file size: ${Math.round(totalSize / results.length / 1024)}KB`)
console.log(
  `Largest file: ${results[0]?.filePath} (${Math.round(results[0]?.sizeBytes / 1024 / 1024)}MB)`
)

// Target vs current
console.log('\n🎯 Targets:')
console.log(`  Files >2000 lines: ${oversized.length} (target: 0)`)
console.log(`  Files >1MB: ${large.length} (target: 0)`)
console.log(`  Combined size: ${Math.round(totalSize / 1024 / 1024)}MB (target: reduce by 30-40%)`)
