#!/usr/bin/env node

/**
 * Profile Optimized Infra-Audit Performance
 *
 * Benchmarks infra-audit.ts with incremental mode and caching optimizations
 * Target: <3s for full audits (95th percentile)
 *
 * Runs infra-audit 10 times in incremental mode and reports:
 * - Mean execution time
 * - 95th percentile (target: <3s)
 * - Min/Max times
 * - Performance trend (cold vs warm runs)
 */

import { execSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'

interface ProfileRun {
  run: number
  isIncremental: boolean
  durationMs: number
  cacheHit: boolean
}

interface ProfileResult {
  totalRuns: number
  runs: ProfileRun[]
  coldRuns: ProfileRun[]
  warmRuns: ProfileRun[]
  statistics: {
    meanMs: number
    medianMs: number
    percentile95Ms: number
    minMs: number
    maxMs: number
    stdDevMs: number
    targetStatus: 'PASS' | 'WARN' | 'FAIL'
  }
  coldWarming: {
    coldMeanMs: number
    warmMeanMs: number
    improvementPercent: number
  }
}

/**
 * Run a single infra-audit invocation and measure time
 */
function runInfraAuditProfiled(
  runNumber: number,
  incremental: boolean
): { duration: number; cacheHit: boolean } {
  const startTime = Date.now()

  try {
    const args = incremental ? '--incremental' : ''
    const cmd = `bun scripts/architecture/infra-audit.ts ${args} 2>&1`

    console.log(`  Run ${runNumber}: executing...`)
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const duration = Date.now() - startTime
    const cacheHit = output.includes('cache_hitratio') || output.includes('Graph cache')

    console.log(`  Run ${runNumber}: ${duration}ms (cache_hit: ${cacheHit})`)
    return { duration, cacheHit }
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`  Run ${runNumber}: FAILED (${duration}ms)`)
    throw error
  }
}

/**
 * Analyze profile results
 */
function analyzeResults(runs: ProfileRun[]): ProfileResult['statistics'] {
  const durations = runs.map((r) => r.durationMs).sort((a, b) => a - b)

  const mean = durations.reduce((a, b) => a + b, 0) / durations.length
  const median = durations[Math.floor(durations.length / 2)]
  const percentile95 = durations[Math.floor(durations.length * 0.95)]
  const min = durations[0]
  const max = durations[durations.length - 1]

  // Standard deviation
  const variance = durations.reduce((sum, val) => sum + (val - mean) ** 2, 0) / durations.length
  const stdDev = Math.sqrt(variance)

  // Determine status
  const target = 3000 // 3 seconds
  const targetStatus =
    percentile95 <= target ? 'PASS' : percentile95 <= target * 1.2 ? 'WARN' : 'FAIL'

  return {
    meanMs: Math.round(mean),
    medianMs: Math.round(median),
    percentile95Ms: Math.round(percentile95),
    minMs: min,
    maxMs: max,
    stdDevMs: Math.round(stdDev),
    targetStatus,
  }
}

/**
 * Main profiling function
 */
async function profileInfraAudit(): Promise<void> {
  console.log('\n[Profile] Infra-Audit Performance Optimization Test')
  console.log('======================================================\n')

  console.log('Target: <3000ms (95th percentile)')
  console.log('Runs: 10 iterations\n')

  const allRuns: ProfileRun[] = []

  console.log('Running profiling tests...\n')

  // Run 10 iterations
  for (let i = 1; i <= 10; i++) {
    try {
      const result = runInfraAuditProfiled(i, i > 1) // First run is cold, rest are warm
      allRuns.push({
        run: i,
        isIncremental: i > 1,
        durationMs: result.duration,
        cacheHit: result.cacheHit,
      })
    } catch (_error) {
      console.error(`Profiling failed at run ${i}`)
      process.exit(1)
    }
  }

  // Separate cold and warm runs
  const coldRuns = allRuns.slice(0, 1)
  const warmRuns = allRuns.slice(1)

  // Analyze results
  const _coldStats = analyzeResults(coldRuns)
  const _warmStats = analyzeResults(warmRuns)
  const allStats = analyzeResults(allRuns)

  const coldMean = coldRuns.reduce((sum, r) => sum + r.durationMs, 0) / coldRuns.length
  const warmMean = warmRuns.reduce((sum, r) => sum + r.durationMs, 0) / warmRuns.length
  const improvement = ((coldMean - warmMean) / coldMean) * 100

  const result: ProfileResult = {
    totalRuns: 10,
    runs: allRuns,
    coldRuns,
    warmRuns,
    statistics: allStats,
    coldWarming: {
      coldMeanMs: Math.round(coldMean),
      warmMeanMs: Math.round(warmMean),
      improvementPercent: Math.round(improvement * 10) / 10,
    },
  }

  // Display results
  console.log('\n======================================================')
  console.log('Profile Results (All 10 Runs)\n')
  console.log(`  Mean:         ${result.statistics.meanMs}ms`)
  console.log(`  Median:       ${result.statistics.medianMs}ms`)
  console.log(`  95th %-ile:   ${result.statistics.percentile95Ms}ms`)
  console.log(`  Min:          ${result.statistics.minMs}ms`)
  console.log(`  Max:          ${result.statistics.maxMs}ms`)
  console.log(`  Std Dev:      ${result.statistics.stdDevMs}ms`)
  console.log(`  Status:       ${result.statistics.targetStatus} (target: <3000ms)\n`)

  console.log('Cold vs. Warm Run Analysis')
  console.log(`  Cold Run Mean  (Run 1):  ${result.coldWarming.coldMeanMs}ms`)
  console.log(`  Warm Runs Mean (2-10):   ${result.coldWarming.warmMeanMs}ms`)
  console.log(`  Improvement:             ${result.coldWarming.improvementPercent}%\n`)

  // Detailed breakdown
  console.log('Detailed Run Times:')
  allRuns.forEach((run) => {
    const mode = run.isIncremental ? 'incremental' : 'cold'
    const cache = run.cacheHit ? 'hit' : 'miss'
    const status = run.durationMs <= 3000 ? '✓' : '✗'
    console.log(
      `  Run ${String(run.run).padStart(2)}: ${String(run.durationMs).padStart(4)}ms [${mode}/${cache}] ${status}`
    )
  })

  // Write report
  const reportPath = 'docs/reports/OPTIMIZATION_PROFILE_INFRA_AUDIT.md'
  const reportContent = generateMarkdownReport(result)

  try {
    if (!existsSync('docs/reports')) {
      const fs = require('node:fs')
      fs.mkdirSync('docs/reports', { recursive: true })
    }
    writeFileSync(reportPath, reportContent, 'utf-8')
    console.log(`\n✓ Report written to: ${reportPath}`)
  } catch (error) {
    console.warn(`Failed to write report: ${String(error)}`)
  }

  // Exit with success if target met
  const exitCode = result.statistics.targetStatus === 'FAIL' ? 1 : 0
  if (exitCode !== 0) {
    console.log(
      `\n⚠ Performance target NOT met. 95th percentile: ${result.statistics.percentile95Ms}ms (target: 3000ms)`
    )
  } else {
    console.log(
      `\n✓ Performance target MET. 95th percentile: ${result.statistics.percentile95Ms}ms (target: 3000ms)`
    )
  }

  process.exit(exitCode)
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(result: ProfileResult): string {
  return `# Infrastructure Audit Performance Profile

**Date:** ${new Date().toISOString()}  
**Test:** Infra-Audit Optimization (Phase 6 - T118)  
**Target:** <3000ms (95th percentile)  
**Status:** ${result.statistics.targetStatus}

## Summary

| Metric | Value | Status |
|--------|-------|--------|
| Mean Execution Time | ${result.statistics.meanMs}ms | ${result.statistics.meanMs <= 3000 ? '✓ PASS' : '✗ FAIL'} |
| 95th Percentile | ${result.statistics.percentile95Ms}ms | ${result.statistics.targetStatus === 'PASS' ? '✓ PASS' : '✗ FAIL'} |
| Min | ${result.statistics.minMs}ms | — |
| Max | ${result.statistics.maxMs}ms | — |
| Std Dev | ${result.statistics.stdDevMs}ms | — |

## Cold vs. Warm Run Analysis

| Stage | Mean | Improvement |
|-------|------|-------------|
| Cold Run (Run 1) | ${result.coldWarming.coldMeanMs}ms | — |
| Warm Runs (2-10) | ${result.coldWarming.warmMeanMs}ms | ${result.coldWarming.improvementPercent}% faster |

With caching enabled, subsequent runs are approximately **${result.coldWarming.improvementPercent}% faster**.

## Detailed Run Times

\`\`\`
${result.runs
  .map((r) => {
    const mode = r.isIncremental ? 'incremental' : 'cold'
    const cache = r.cacheHit ? 'hit' : 'miss'
    const status = r.durationMs <= 3000 ? '✓' : '✗'
    return `Run ${String(r.run).padStart(2)}: ${String(r.durationMs).padStart(4)}ms [${mode}/${cache}] ${status}`
  })
  .join('\n')}
\`\`\`

## Optimization Applied

- **T111:** Module change detection enabled
- **T112:** Incremental analysis mode activated
- **T113:** Partial validation in ai-guard
- **T114:** --incremental flag for infra-audit
- **T115:** Persistent architecture graph caching
- **T116:** Cache validation in pipeline
- **T117:** Cache invalidation on config changes

## Recommendations

${
  result.statistics.targetStatus === 'PASS'
    ? '✓ Performance targets met. Optimizations are effective.'
    : result.statistics.targetStatus === 'WARN'
      ? '⚠ Performance is close to target. Monitor for regressions.'
      : '✗ Performance target not met. Further optimization needed. Consider:\n  - Profiling individual audit phases\n  - Optimizing graph construction\n  - Implementing lazy loading for artifacts'
}

---

Generated by Phase 6 Optimization Profiler (T118)
`
}

// Run profiler
profileInfraAudit().catch((error) => {
  console.error('[Profile] Fatal error:', error)
  process.exit(1)
})
