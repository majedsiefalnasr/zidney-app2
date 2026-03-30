#!/usr/bin/env bun

/**
 * @script dev:analyze:directory-sizes
 * @domain dev
 * @category dev
 * @description Measure key repository directory sizes and highlight the largest
 *   contributors to repository bloat.
 * @usage bun run dev:analyze:directory-sizes
 */

import { DirectorySizeAnalyzer } from '../../tests/audit-helpers'
import { exit, log } from '../utils/logger'

const rootDir = process.cwd()
log.setScript('dev:analyze:directory-sizes')

log.header('ANALYZE DIRECTORY SIZES', 'Measures directory sizes and identifies repository bloat')

// Analyze key directories
const results = DirectorySizeAnalyzer.analyzeKeyDirectories(rootDir)

if (results.length === 0) {
  log.error('No directories found')
  log.result({ total: 0, passed: 0, failed: 1 })
  exit(1)
}

// Sort by size descending
results.sort((a, b) => b.sizeBytes - a.sizeBytes)

// Display results
log.step('Directory Sizes:')
log.info('Directory                          Size        Files')

let totalSize = 0
for (const result of results) {
  totalSize += result.sizeBytes
  log.info(
    `${result.dirPath.padEnd(34)} ${result.scaledSize.padStart(8)}    ${result.fileCount.toLocaleString().padStart(6)} files`
  )
}

log.info(
  `${'TOTAL'.padEnd(34)} ${Math.round((totalSize / (1024 * 1024 * 1024)) * 10) / 10}GB`.padEnd(42)
)

// Percentage distribution
log.step('Size Distribution:')
for (const result of results.slice(0, 5)) {
  const percentage = ((result.sizeBytes / totalSize) * 100).toFixed(1)
  const bar = '█'.repeat(Math.round(parseFloat(percentage) / 5))
  log.info(`${result.dirPath.padEnd(34)} ${bar} ${percentage}%`)
}

// Targets and recommendations
log.step('Target Analysis:')

const nodeModules = results.find((r) => r.dirPath.includes('node_modules'))
const artifacts = results.find((r) => r.dirPath.includes('docs/ai/context'))
const scripts = results.find((r) => r.dirPath.includes('scripts'))

log.info('Current vs Target:')
if (nodeModules) {
  log.info(`  node_modules: ${nodeModules.scaledSize} (not counted in compressed size)`)
}
if (artifacts) {
  log.info(`  AI Context: ${artifacts.scaledSize} (target: <10MB)`)
}
if (scripts) {
  log.info(`  Scripts: ${scripts.scaledSize} (target: reduced by 30% after P2)`)
}

log.info(
  `  Total (excl. node_modules): ~${Math.round((totalSize - (nodeModules?.sizeBytes || 0)) / 1024 / 1024)}MB`
)
log.info(
  `  Compressed estimate: ~${Math.round((totalSize - (nodeModules?.sizeBytes || 0)) / 1024 / 1024 / 2)}MB (50% est.)`
)
log.result({ total: results.length, passed: results.length, failed: 0 })
exit(0)
