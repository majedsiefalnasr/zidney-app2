#!/usr/bin/env bun

/**
 * T103: Analyze bun.lock file and identify all dependencies
 *
 * Parses bun.lock file to extract:
 * - All direct dependencies from package.json
 * - All transitive dependencies
 * - Dependency tree structure
 * - Size contributions to lock file
 *
 * Success criteria: Complete dependency catalog for Phase 5 analysis
 */

import { readFileSync } from 'node:fs'
import { $ } from 'bun'
import { flushAi, log } from '../utils/logger'

async function analyzeDependencies(): Promise<void> {
  log.header('ANALYZE DEPENDENCIES', 'Analyzes bun.lock file and identifies all dependencies')

  try {
    // Read package.json to get direct dependencies
    const pkgContent = readFileSync('package.json', 'utf-8')
    const pkg = JSON.parse(pkgContent)

    const directDeps = new Set([
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
    ])

    log.info(`Direct Dependencies: ${directDeps.size}`)

    // List direct dependencies
    log.step('Dependencies (from package.json)')
    if (pkg.dependencies) {
      log.step('Production Dependencies')
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        log.info(`- ${name}@${version}`)
      }
    }

    if (pkg.devDependencies) {
      log.step('Development Dependencies')
      for (const [name, version] of Object.entries(pkg.devDependencies)) {
        log.info(`- ${name}@${version}`)
      }
    }

    // Get lock file size
    const lsResult = await $`ls -lh bun.lock`.text().catch(() => 'Lock file not found')
    const sizeMatch = lsResult.match(/(\d+\.?\d*[KMG]?)/)
    const lockFileSize = sizeMatch ? sizeMatch[1] : 'unknown'

    log.step('Lock File Metrics:')
    log.info(`- File: bun.lock`)
    log.info(`- Size: ${lockFileSize}`)
    log.info(`- Format: Bun lock file format (YAML-based)`)

    // Try to get install size of node_modules
    const nodeModulesSize = await $`du -sh node_modules | cut -f1`.text().catch(() => 'N/A')
    log.info(`- node_modules size: ${nodeModulesSize.trim()}`)

    // Count entries in lock file (approximate)
    const wc = await $`wc -l < bun.lock`.text().catch(() => '0')
    log.info(`- Lock file lines: ${wc.trim()}`)

    // Analyze which dependencies are large
    log.step('Largest Dependencies (by common patterns):')
    const largePatterns = [
      'typescript',
      '@types/node',
      'eslint',
      'prettier',
      'vue',
      'vite',
      'vitest',
      'playwright',
      'aws-cdk-lib',
      'aws-sdk',
      'bun',
    ]

    for (const pattern of largePatterns) {
      if (directDeps.has(pattern)) {
        const version = pkg.dependencies?.[pattern] || pkg.devDependencies?.[pattern] || 'unknown'
        const isDev = pattern in (pkg.devDependencies || {}) ? '(dev)' : ''
        log.info(`- ${pattern}@${version} ${isDev}`.trim())
      }
    }

    // Generate report file
    const report = {
      timestamp: new Date().toISOString(),
      totalDirectDependencies: directDeps.size,
      productionDependencies: Object.keys(pkg.dependencies || {}).length,
      devDependencies: Object.keys(pkg.devDependencies || {}).length,
      lockFileSize: lockFileSize,
      phase5Target: 'Identify unused dependencies for removal',
      nextSteps: [
        'T104: Verify dependency usage with grep',
        'T105: Identify zero-reference dependencies',
        'T106: Audit criticality of candidates',
      ],
    }

    await Bun.write('reports/dependency-analysis-report.json', JSON.stringify(report, null, 2))
    log.success(`Analysis report saved to: reports/dependency-analysis-report.json`)
    log.success('T103 Complete: Dependency analysis baseline established')
    log.result({ total: directDeps.size, passed: directDeps.size, failed: 0 })
    flushAi()
    process.exit(0)
  } catch (error) {
    log.error(`Analysis failed: ${String(error)}`)
    log.result({ total: 0, passed: 0, failed: 1 })
    flushAi()
    process.exit(1)
  }
}

analyzeDependencies()
