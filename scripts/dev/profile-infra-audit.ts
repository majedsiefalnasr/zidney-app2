#!/usr/bin/env bun

/**
 * T049: Profile infra-audit.ts Execution
 *
 * Measures the performance of the infra-audit.ts script across 10 runs
 * and validates that it meets the <3s target (95th percentile).
 *
 * Purpose: Ensure architecture tools remain performant after refactoring
 *
 * Created during: Phase 2 — Script Modularization
 * Uses: performance-profiler utility from scripts/core/
 *
 * Output: Profile results with execution statistics
 */

import { spawn } from 'node:child_process'
import { createLogger } from '../core/logger-factory'
import {
  calculatePercentile,
  calculateStdDev,
  getHealthStatus,
  Timer,
} from '../core/performance-profiler'

const logger = createLogger('profile-infra-audit')

interface ProfileResult {
  run: number
  durationMs: number
  success: boolean
  error?: string
}

async function runInfraAudit(): Promise<number> {
  return new Promise((resolve) => {
    const timer = new Timer()
    const script = resolve(import.meta.dir, '../architecture/infra-audit.ts')

    const proc = spawn('bun', [script], {
      stdio: 'pipe',
      cwd: resolve(import.meta.dir, '../..'),
    })

    let timeout: NodeJS.Timeout | null = null

    proc.on('exit', (_code) => {
      const duration = timer.end()
      if (timeout) clearTimeout(timeout)
      resolve(duration)
    })

    proc.on('error', () => {
      const duration = timer.end()
      if (timeout) clearTimeout(timeout)
      resolve(duration)
    })

    // Kill if takes too long
    timeout = setTimeout(() => {
      proc.kill()
      resolve(timer.end())
    }, 5000) // 5 second hard timeout
  })
}

async function profileInfraAudit(): Promise<void> {
  const NUM_RUNS = 10
  const EXPECTED_TARGET_MS = 3000 // 3 second target
  const results: ProfileResult[] = []

  logger.info('Starting infra-audit profiling', { runs: NUM_RUNS, target_ms: EXPECTED_TARGET_MS })

  console.log(`\n📊 Profiling infra-audit.ts (${NUM_RUNS} runs)\n`)

  for (let i = 1; i <= NUM_RUNS; i++) {
    const _startTime = Date.now()
    try {
      const duration = await runInfraAudit()
      const result: ProfileResult = {
        run: i,
        durationMs: duration,
        success: duration < 5000,
      }
      results.push(result)

      logger.info(`Run ${i} completed`, { duration_ms: duration, success: result.success })
      console.log(`  Run ${i}: ${duration}ms ${result.success ? '✓' : '⚠'}`)
    } catch (error) {
      results.push({
        run: i,
        durationMs: 0,
        success: false,
        error: String(error),
      })
      logger.error(`Run ${i} failed`, { error: String(error) })
    }
  }

  // Calculate statistics
  const durations = results.filter((r) => r.success).map((r) => r.durationMs)
  const failureCount = results.filter((r) => !r.success).length

  if (durations.length === 0) {
    console.log('\n❌ All profiles failed')
    process.exit(1)
  }

  const sortedDurations = [...durations].sort((a, b) => a - b)
  const min = sortedDurations[0]
  const max = sortedDurations[sortedDurations.length - 1]
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length
  const p95 = calculatePercentile(durations, 0.95)
  const stdDev = calculateStdDev(durations)

  const health = getHealthStatus(p95, {
    max_ms: EXPECTED_TARGET_MS,
    p95_ms: 2850,
    p99_ms: 2950,
  })

  console.log(`\n📈 Statistics (${durations.length}/${NUM_RUNS} successful runs):`)
  console.log(`  Min:    ${min}ms`)
  console.log(`  Max:    ${max}ms`)
  console.log(`  Avg:    ${Math.round(avg)}ms`)
  console.log(`  P95:    ${Math.round(p95)}ms`)
  console.log(`  Std:    ${Math.round(stdDev)}ms`)
  console.log(`  Target: ${EXPECTED_TARGET_MS}ms`)
  console.log(`  Health: ${health}`)

  if (failureCount > 0) {
    console.log(`\n⚠️  ${failureCount} runs exceeded timeout`)
  }

  logger.info('Profiling complete', {
    p95_ms: Math.round(p95),
    target_ms: EXPECTED_TARGET_MS,
    health,
    success_rate: `${durations.length}/${NUM_RUNS}`,
  })

  // Exit with status
  const passed = p95 <= EXPECTED_TARGET_MS && failureCount === 0
  if (passed) {
    console.log(
      `\n✅ PASS: infra-audit meets <${EXPECTED_TARGET_MS}ms target (p95: ${Math.round(p95)}ms)\n`
    )
    process.exit(0)
  } else {
    console.log(
      `\n❌ FAIL: infra-audit exceeds <${EXPECTED_TARGET_MS}ms target (p95: ${Math.round(p95)}ms)\n`
    )
    process.exit(1)
  }
}

profileInfraAudit()
