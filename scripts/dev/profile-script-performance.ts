#!/usr/bin/env bun

/**
 * profile-script-performance.ts
 *
 * Profiles governance script execution times across multiple runs.
 * Establishes baseline performance metrics for Phase 2 optimization.
 *
 * Usage: bun scripts/dev/profile-script-performance.ts [runs=10]
 */

import { ScriptPerformanceProfiler } from '../../tests/audit-helpers'
import { flushAi, log } from '../utils/logger'

const scriptsToProfile = [
  'scripts/ai-guard.ts',
  'scripts/infra-audit.ts',
  'scripts/type-safety-guard.ts',
  'scripts/architecture-diff.ts',
  'scripts/governance/validate-architecture-brain.ts',
]

const runs = parseInt(process.argv[2] || '10', 10)

log.header(
  'PROFILE SCRIPT PERFORMANCE',
  'Profiles governance script execution times across multiple runs'
)
log.info(`Profiling ${scriptsToProfile.length} scripts (${runs} runs each)...`)

const results = ScriptPerformanceProfiler.profileMultipleScripts(scriptsToProfile, runs)

// Sort by average time descending
results.sort((a, b) => b.avgTimeMs - a.avgTimeMs)

// Define targets
const targets: Record<string, number> = {
  'ai-guard.ts': 1000,
  'infra-audit.ts': 3000,
  'type-safety-guard.ts': 1000,
  'architecture-diff.ts': 2000,
  'validate-architecture-brain.ts': 1000,
}

// Display results
log.step('Performance Profile Results:')
log.info(
  'Script Name                      Min (ms)  Max (ms)  Avg (ms)  P95 (ms)  Target (ms)  Status'
)

for (const result of results) {
  const target = targets[result.scriptName] || 2000
  const minStr = result.minTimeMs.toFixed(0).padStart(7)
  const maxStr = result.maxTimeMs.toFixed(0).padStart(7)
  const avgStr = result.avgTimeMs.toFixed(0).padStart(7)
  const p95Str = result.p95TimeMs.toFixed(0).padStart(7)
  const targetStr = target.toString().padStart(10)

  let status = '✓ PASS'
  if (result.p95TimeMs > target * 1.1) {
    status = '🔴 FAIL'
  } else if (result.p95TimeMs > target) {
    status = '⚠️ WARN'
  }

  log.info(
    `${result.scriptName.padEnd(32)} ${minStr}    ${maxStr}    ${avgStr}    ${p95Str}    ${targetStr}    ${status}`
  )
}

// Summary by status
log.step('Summary:')

const passing = results.filter((r) => {
  const target = targets[r.scriptName] || 2000
  return r.p95TimeMs <= target
})

const warning = results.filter((r) => {
  const target = targets[r.scriptName] || 2000
  return r.p95TimeMs > target && r.p95TimeMs <= target * 1.1
})

const failing = results.filter((r) => {
  const target = targets[r.scriptName] || 2000
  return r.p95TimeMs > target * 1.1
})

log.info(`✓ Passing targets: ${passing.length}/${results.length}`)
log.info(`⚠️  Warning (within 10%): ${warning.length}`)
log.info(`🔴 Failing (>10% over): ${failing.length}`)

if (failing.length > 0) {
  log.warn(`Scripts needing optimization:`)
  for (const result of failing) {
    const target = targets[result.scriptName] || 2000
    const excess = result.p95TimeMs - target
    log.warn(`  \u2022 ${result.scriptName}: ${excess.toFixed(0)}ms over target`)
  }
}

// Variability analysis
log.step('Variability Analysis (Consistency):')
for (const result of results) {
  const variance = result.maxTimeMs - result.minTimeMs
  const cv = (variance / result.avgTimeMs) * 100 // Coefficient of variation
  let consistency = '✓ Stable'
  if (cv > 30) {
    consistency = '⚠️ Variable (35% variance)'
  }
  log.info(
    `${result.scriptName.padEnd(32)} Variance: ${variance.toFixed(0)}ms (CV: ${cv.toFixed(1)}%) ${consistency}`
  )
}

// Recommendations
log.step('Recommendations for Phase 2:')

if (failing.length > 0) {
  log.info('Priority 1 (High Impact):')
  for (const result of failing.slice(0, 3)) {
    const target = targets[result.scriptName] || 2000
    const reduction = ((result.p95TimeMs - target) / result.p95TimeMs) * 100
    log.info(
      `  \u2022 ${result.scriptName}: Needs ${reduction.toFixed(0)}% reduction (extract utilities, optimize hotspots)`
    )
  }
}

if (warning.length > 0) {
  log.info('Priority 2 (Medium Impact):')
  for (const result of warning) {
    log.info(`  \u2022 ${result.scriptName}: Monitor during Phase 2 refactoring`)
  }
}

log.info(`Phase 2 targets: Reduce all scripts by 15-30% through utility extraction & caching`)

// Raw data export (for trend tracking)
log.step('Raw Profile Data (comma-separated):')
log.info('Script,Run1,Run2,Run3,Run4,Run5,Run6,Run7,Run8,Run9,Run10,Min,Max,Avg,P95')
for (const result of results) {
  const times = result.executionTimeMs.map((t) => t.toFixed(0)).join(',')
  log.info(
    `${result.scriptName},${times},${result.minTimeMs.toFixed(0)},${result.maxTimeMs.toFixed(0)},${result.avgTimeMs.toFixed(0)},${result.p95TimeMs.toFixed(0)}`
  )
}

log.result({ total: results.length, passed: passing.length, failed: failing.length })
flushAi()
