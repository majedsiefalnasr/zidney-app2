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

const scriptsToProfile = [
  'scripts/ai-guard.ts',
  'scripts/infra-audit.ts',
  'scripts/type-safety-guard.ts',
  'scripts/architecture-diff.ts',
  'scripts/governance/validate-architecture-brain.ts',
]

const runs = parseInt(process.argv[2] || '10', 10)

console.log(`⏱️  Profiling ${scriptsToProfile.length} scripts (${runs} runs each)...\n`)

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
console.log('📊 Performance Profile Results:\n')
console.log(
  'Script Name                      Min (ms)  Max (ms)  Avg (ms)  P95 (ms)  Target (ms)  Status'
)
console.log('─'.repeat(95))

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

  console.log(
    `${result.scriptName.padEnd(32)} ${minStr}    ${maxStr}    ${avgStr}    ${p95Str}    ${targetStr}    ${status}`
  )
}

// Summary by status
console.log('\n📈 Summary:\n')

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

console.log(`✓ Passing targets: ${passing.length}/${results.length}`)
console.log(`⚠️  Warning (within 10%): ${warning.length}`)
console.log(`🔴 Failing (>10% over): ${failing.length}`)

if (failing.length > 0) {
  console.log(`\nScripts needing optimization:`)
  for (const result of failing) {
    const target = targets[result.scriptName] || 2000
    const excess = result.p95TimeMs - target
    console.log(`  • ${result.scriptName}: ${excess.toFixed(0)}ms over target`)
  }
}

// Variability analysis
console.log('\n🔄 Variability Analysis (Consistency):\n')
for (const result of results) {
  const variance = result.maxTimeMs - result.minTimeMs
  const cv = (variance / result.avgTimeMs) * 100 // Coefficient of variation
  let consistency = '✓ Stable'
  if (cv > 30) {
    consistency = '⚠️ Variable (35% variance)'
  }
  console.log(
    `${result.scriptName.padEnd(32)} Variance: ${variance.toFixed(0)}ms (CV: ${cv.toFixed(1)}%) ${consistency}`
  )
}

// Recommendations
console.log('\n💡 Recommendations for Phase 2:\n')

if (failing.length > 0) {
  console.log('Priority 1 (High Impact):')
  for (const result of failing.slice(0, 3)) {
    const target = targets[result.scriptName] || 2000
    const reduction = ((result.p95TimeMs - target) / result.p95TimeMs) * 100
    console.log(
      `  • ${result.scriptName}: Needs ${reduction.toFixed(0)}% reduction (extract utilities, optimize hotspots)`
    )
  }
}

if (warning.length > 0) {
  console.log('\nPriority 2 (Medium Impact):')
  for (const result of warning) {
    console.log(`  • ${result.scriptName}: Monitor during Phase 2 refactoring`)
  }
}

console.log(`\nPhase 2 targets: Reduce all scripts by 15-30% through utility extraction & caching`)

// Raw data export (for trend tracking)
console.log('\n📥 Raw Profile Data (comma-separated):\n')
console.log('Script,Run1,Run2,Run3,Run4,Run5,Run6,Run7,Run8,Run9,Run10,Min,Max,Avg,P95')
for (const result of results) {
  const times = result.executionTimeMs.map((t) => t.toFixed(0)).join(',')
  console.log(
    `${result.scriptName},${times},${result.minTimeMs.toFixed(0)},${result.maxTimeMs.toFixed(0)},${result.avgTimeMs.toFixed(0)},${result.p95TimeMs.toFixed(0)}`
  )
}
