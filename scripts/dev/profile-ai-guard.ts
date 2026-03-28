#!/usr/bin/env bun

/**
 * T048: Profile ai-guard.ts Execution
 *
 * Measures the performance of the ai-guard.ts script across 10 runs
 * and validates that it meets the <1s target (95th percentile).
 *
 * Purpose: Ensure governance tools remain performant after refactoring
 *
 * Created during: Phase 2 — Script Modularization
 * Uses: performance-profiler utility from scripts/core/
 *
 * Output: Profile results with execution statistics
 */

import { spawn } from 'node:child_process'
import {
  calculatePercentile,
  calculateStdDev,
  getHealthStatus,
  Timer,
} from '../core/performance-profiler'
import { createLogger, flushAi, log } from '../utils/logger'

const logger = createLogger('profile-ai-guard')

interface ProfileResult {
  run: number
  durationMs: number
  success: boolean
  error?: string
}

async function runAiGuard(): Promise<number> {
  return new Promise((resolve) => {
    const timer = new Timer()
    const script = resolve(import.meta.dir, '../governance/type-safety-guard.ts')

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
    }, 2000) // 2 second hard timeout
  })
}

async function profileAiGuard(): Promise<void> {
  log.header('PROFILE AI GUARD', 'Profiles ai-guard.ts execution across 10 runs')
  const NUM_RUNS = 10
  const EXPECTED_TARGET_MS = 1000 // 1 second target
  const results: ProfileResult[] = []

  logger.info('Starting ai-guard profiling', { runs: NUM_RUNS, target_ms: EXPECTED_TARGET_MS })

  log.step(`Profiling ai-guard.ts (${NUM_RUNS} runs)`)

  for (let i = 1; i <= NUM_RUNS; i++) {
    const _startTime = Date.now()
    try {
      const duration = await runAiGuard()
      const result: ProfileResult = {
        run: i,
        durationMs: duration,
        success: duration < 2000,
      }
      results.push(result)

      logger.info(`Run ${i} completed`, { duration_ms: duration, success: result.success })
      log.info(`  Run ${i}: ${duration}ms ${result.success ? 'OK' : 'WARN'}`)
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
    log.error('All profiles failed')
    log.result({ total: NUM_RUNS, passed: 0, failed: NUM_RUNS })
    flushAi()
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
    p95_ms: 950,
    p99_ms: 980,
  })

  log.step(`Statistics (${durations.length}/${NUM_RUNS} successful runs):`)
  log.info(`  Min:    ${min}ms`)
  log.info(`  Max:    ${max}ms`)
  log.info(`  Avg:    ${Math.round(avg)}ms`)
  log.info(`  P95:    ${Math.round(p95)}ms`)
  log.info(`  Std:    ${Math.round(stdDev)}ms`)
  log.info(`  Target: ${EXPECTED_TARGET_MS}ms`)
  log.info(`  Health: ${health}`)

  if (failureCount > 0) {
    log.warn(`${failureCount} runs exceeded timeout`)
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
    log.success(`PASS: ai-guard meets <${EXPECTED_TARGET_MS}ms target (p95: ${Math.round(p95)}ms)`)
    log.result({ total: NUM_RUNS, passed: durations.length, failed: failureCount })
    flushAi()
    process.exit(0)
  } else {
    log.error(`FAIL: ai-guard exceeds <${EXPECTED_TARGET_MS}ms target (p95: ${Math.round(p95)}ms)`)
    log.result({ total: NUM_RUNS, passed: durations.length, failed: failureCount })
    flushAi()
    process.exit(1)
  }
}

profileAiGuard()
