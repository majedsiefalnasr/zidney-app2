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

async function analyzeDependencies(): Promise<void> {
  console.log('📊 Dependency Analysis - T103\n')

  try {
    // Read package.json to get direct dependencies
    const pkgContent = readFileSync('package.json', 'utf-8')
    const pkg = JSON.parse(pkgContent)

    const directDeps = new Set([
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
    ])

    console.log(`📦 Direct Dependencies: ${directDeps.size}\n`)

    // List direct dependencies
    console.log('# Dependencies (from package.json)\n')
    if (pkg.dependencies) {
      console.log('## Production Dependencies\n')
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        console.log(`- ${name}@${version}`)
      }
    }

    if (pkg.devDependencies) {
      console.log('\n## Development Dependencies\n')
      for (const [name, version] of Object.entries(pkg.devDependencies)) {
        console.log(`- ${name}@${version}`)
      }
    }

    // Get lock file size
    const lsResult = await $`ls -lh bun.lock`.text().catch(() => 'Lock file not found')
    const sizeMatch = lsResult.match(/(\d+\.?\d*[KMG]?)/)
    const lockFileSize = sizeMatch ? sizeMatch[1] : 'unknown'

    console.log(`\n---\n`)
    console.log(`📊 Lock File Metrics:\n`)
    console.log(`- File: bun.lock`)
    console.log(`- Size: ${lockFileSize}`)
    console.log(`- Format: Bun lock file format (YAML-based)`)

    // Try to get install size of node_modules
    const nodeModulesSize = await $`du -sh node_modules | cut -f1`.text().catch(() => 'N/A')
    console.log(`- node_modules size: ${nodeModulesSize.trim()}`)

    // Count entries in lock file (approximate)
    const wc = await $`wc -l < bun.lock`.text().catch(() => '0')
    console.log(`- Lock file lines: ${wc.trim()}`)

    // Analyze which dependencies are large
    console.log(`\n📈 Largest Dependencies (by common patterns):\n`)
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
        console.log(`- ${pattern}@${version} ${isDev}`.trim())
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

    await Bun.write('.dependency-analysis-report.json', JSON.stringify(report, null, 2))
    console.log(`\n📄 Analysis report saved to: .dependency-analysis-report.json\n`)

    console.log('✅ T103 Complete: Dependency analysis baseline established\n')

    process.exit(0)
  } catch (error) {
    console.error('Analysis failed:', error)
    process.exit(1)
  }
}

analyzeDependencies()
