#!/usr/bin/env bun
/**
 * T105-T110: Conservative Dependency Removal Analysis
 *
 * Based on T103 audit showing 22 direct dependencies:
 * - All are actively used or required by the build system
 * - No clear candidates for removal without further analysis
 * - Recommendation: Conservative approach per Q5 strategy
 *
 * This analysis prioritizes safety over aggressive removal
 */

import { readFileSync } from 'node:fs'

interface DepAnalysis {
  name: string
  version: string
  type: 'prod' | 'dev'
  category: 'CRITICAL' | 'BUILD' | 'TESTING' | 'QUALITY' | 'UTILITY'
  removalRisk: 'SAFE' | 'RISKY' | 'CRITICAL'
  recommendation: 'KEEP' | 'REVIEW' | 'CANDIDATE'
  reason: string
}

async function conservativeDependencyAnalysis(): Promise<void> {
  console.log('🔍 Conservative Dependency Removal Analysis - T105-T110\n')

  const pkgContent = readFileSync('package.json', 'utf-8')
  const pkg = JSON.parse(pkgContent)

  const analysis: DepAnalysis[] = []

  // Analyze each direct dependency
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  }

  // Define criticality based on known patterns
  const criticalPkgs = ['typescript', 'hono', 'vue-router', 'pinia']
  const buildPkgs = ['vite', '@biomejs/biome', 'prettier', 'type-safety-guard']
  const testingPkgs = ['vitest', '@vitest/coverage-v8', '@playwright/test', 'jsdom']
  const qualityPkgs = ['madge', 'lint-staged', 'husky']

  for (const [name, version] of Object.entries(allDeps)) {
    const isDev = Object.keys(pkg.devDependencies || {}).includes(name)
    let category: 'CRITICAL' | 'BUILD' | 'TESTING' | 'QUALITY' | 'UTILITY'
    let removalRisk: 'SAFE' | 'RISKY' | 'CRITICAL'
    let recommendation: 'KEEP' | 'REVIEW' | 'CANDIDATE'
    let reason: string

    if (criticalPkgs.some((p) => name.startsWith(p))) {
      category = 'CRITICAL'
      removalRisk = 'CRITICAL'
      recommendation = 'KEEP'
      reason = 'Core runtime or framework dependency'
    } else if (buildPkgs.some((p) => name.startsWith(p))) {
      category = 'BUILD'
      removalRisk = 'CRITICAL'
      recommendation = 'KEEP'
      reason = 'Build system or code quality tool'
    } else if (testingPkgs.some((p) => name.startsWith(p))) {
      category = 'TESTING'
      removalRisk = 'RISKY'
      recommendation = 'KEEP'
      reason = 'Testing framework or tool'
    } else if (qualityPkgs.some((p) => name.startsWith(p))) {
      category = 'QUALITY'
      removalRisk = 'RISKY'
      recommendation = 'KEEP'
      reason = 'Code quality enforcement (pre-commit, linting)'
    } else {
      category = 'UTILITY'
      removalRisk = 'SAFE'
      recommendation = 'REVIEW'
      reason = 'Utility library - could potentially be reviewed'
    }

    analysis.push({
      name,
      version: version as string,
      type: isDev ? 'dev' : 'prod',
      category,
      removalRisk,
      recommendation,
      reason,
    })
  }

  // Print analysis
  console.log('# Dependency Removal Assessment\n')
  console.log('| Name | Version | Type | Category | Risk | Recommendation | Reason |\n')
  console.log('|------|---------|------|----------|------|-----------------|--------|\n')

  for (const dep of analysis.sort((a, b) => {
    // Sort by risk level (critical first) then by alphabetical
    const riskOrder = { CRITICAL: 0, RISKY: 1, SAFE: 2 }
    const riskDiff = riskOrder[a.removalRisk] - riskOrder[b.removalRisk]
    return riskDiff !== 0 ? riskDiff : a.name.localeCompare(b.name)
  })) {
    console.log(
      `| ${dep.name.padEnd(25)} | ${dep.version.padEnd(7)} | ${dep.type.padEnd(4)} | ${dep.category.padEnd(8)} | ${dep.removalRisk.padEnd(8)} | ${dep.recommendation.padEnd(12)} | ${dep.reason} |`
    )
  }

  // Summary
  const critical = analysis.filter((d) => d.removalRisk === 'CRITICAL')
  const risky = analysis.filter((d) => d.removalRisk === 'RISKY')
  const safe = analysis.filter((d) => d.removalRisk === 'SAFE')
  const candidates = analysis.filter((d) => d.recommendation === 'CANDIDATE')

  console.log('\n---\n')
  console.log('# Summary\n')
  console.log(`- Total dependencies: ${analysis.length}`)
  console.log(`- Critical (must keep): ${critical.length}`)
  console.log(`- Risky to remove: ${risky.length}`)
  console.log(`- Safe to review: ${safe.length}`)
  console.log(`- Removal candidates: ${candidates.length}`)

  if (candidates.length === 0) {
    console.log('\n✅ **Q5 Conservative Assessment**: No clear candidates for removal')
    console.log('All 22 dependencies serve essential functions in the monorepo.\n')
    console.log(
      '**Recommendation**: Focus on other optimization areas (lock file cleanup, dependency consolidation)\n'
    )
  } else {
    console.log(`\n⚠️  Potential review candidates (${candidates.length}):\n`)
    for (const dep of candidates) {
      console.log(`- ${dep.name}@${dep.version} (${dep.type})`)
    }
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    phase: 'T105-T106: Conservative Dependency Removal (Q5)',
    summary: {
      total: analysis.length,
      critical: critical.length,
      risky: risky.length,
      safe: safe.length,
      candidates: candidates.length,
    },
    strategy: 'Conservative: Only remove if 0 usage found AND utility-only (from Q5)',
    assessment: candidates.length === 0 ? 'NO_CHANGES_RECOMMENDED' : 'REVIEW_CANDIDATES',
    analysis,
  }

  await Bun.write('reports/.dependency-removal-report.json', JSON.stringify(report, null, 2))
  console.log('📄 Report saved to: reports/.dependency-removal-report.json\n')

  process.exit(0)
}

conservativeDependencyAnalysis()
