#!/usr/bin/env bun

/**
 * @script dev:analyze:file-sizes
 * @domain dev
 * @category dev
 * @description Analyze repository files by size and line count to identify
 *   oversized files that need optimization.
 * @usage bun run dev:analyze:file-sizes
 */

import * as path from 'node:path'
import { FileSizeAnalyzer } from '../../tests/audit-helpers'
import { exit, log } from '../utils/logger'

const rootDir = process.cwd()
log.setScript('dev:analyze:file-sizes')

log.header('ANALYZE FILE SIZES', 'Identifies oversized files in the repository')

const results = FileSizeAnalyzer.findOversizedFiles(rootDir, 2000, 1_000_000)

if (results.length === 0) {
  log.success('No oversized files found!')
  log.result({ total: 0, passed: 0, failed: 0 })
  exit(0)
}

// Sort by size descending
results.sort((a, b) => b.sizeBytes - a.sizeBytes)

// Display results
log.step(`Found ${results.length} oversized files:`)

// Group by category
const byStatus = new Map<string, typeof results>()
for (const result of results) {
  const current = byStatus.get(result.status) || []
  current.push(result)
  byStatus.set(result.status, current)
}

// Display by status
for (const [status, items] of byStatus) {
  const label = status === 'oversized' ? 'OVERSIZED (>2000 lines)' : 'LARGE (>1MB)'
  log.step(`\n${label}:`)
  log.info('─'.repeat(100))

  for (const item of items) {
    const relPath = path.relative(rootDir, item.filePath)
    const sizeKb = Math.round(item.sizeBytes / 1024)
    log.info(`${relPath}`)
    log.info(`  └─ ${item.lineCount.toLocaleString()} lines, ${sizeKb}KB`)
  }
}

// Summary statistics
const totalSize = results.reduce((sum, r) => sum + r.sizeBytes, 0)
const oversized = results.filter((r) => r.status === 'oversized')
const large = results.filter((r) => r.status === 'large')

log.step('Summary Statistics:')
log.info('─'.repeat(100))
log.info(`Total oversized files: ${oversized.length}`)
log.info(`Total large files: ${large.length}`)
log.info(`Total combined size: ${Math.round(totalSize / 1024 / 1024)}MB`)
log.info(`Average file size: ${Math.round(totalSize / results.length / 1024)}KB`)
log.info(
  `Largest file: ${results[0]?.filePath} (${Math.round((results[0]?.sizeBytes ?? 0) / 1024 / 1024)}MB)`
)

log.step('Targets:')
log.info(`  Files >2000 lines: ${oversized.length} (target: 0)`)
log.info(`  Files >1MB: ${large.length} (target: 0)`)
log.info(`  Combined size: ${Math.round(totalSize / 1024 / 1024)}MB (target: reduce by 30-40%)`)

log.result({ total: results.length, passed: 0, failed: results.length })
exit(results.length > 0 ? 1 : 0)
