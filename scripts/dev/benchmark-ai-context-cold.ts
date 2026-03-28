#!/usr/bin/env bun

/**
 * AI Context Cold Run Benchmark (T072)
 *
 * Purpose: Measure ai-context generation time from scratch (no cache)
 * Target: <2 seconds for full cold generation
 *
 * Process:
 * 1. Clear all cache
 * 2. Run generate-ai-context.ts
 * 3. Measure total duration
 * 4. Record metrics
 */

import { execSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { createLogger, flushAi, log } from '../utils/logger'

const logger = createLogger('benchmark-cold-generation')

interface BenchmarkResult {
  run: number
  duration_ms: number
  status: 'PASS' | 'FAIL'
  target_ms: number
  message: string
}

async function main() {
  const RUNS = 3
  const TARGET_MS = 2000 // 2 seconds
  const results: BenchmarkResult[] = []

  log.header(
    'AI CONTEXT COLD RUN BENCHMARK',
    'Measures ai-context generation time from scratch (no cache)'
  )
  logger.info('Starting AI Context cold run benchmarks', { runs: RUNS, target_ms: TARGET_MS })
  log.info(`Test: Generate fresh artifacts (no cache)`)
  log.info(`Target: <${TARGET_MS}ms`)
  log.info(`Runs: ${RUNS}`)

  for (let i = 1; i <= RUNS; i++) {
    // Clear cache before each cold run
    const cacheDir = 'docs/ai/context/.cache'
    if (existsSync(cacheDir)) {
      rmSync(cacheDir, { recursive: true, force: true })
      logger.debug('Cache cleared for cold run', { run: i })
    }

    const startTime = performance.now()

    try {
      // Run generate-ai-context with force flag
      execSync('bun scripts/generate-ai-context.ts --force --validate', {
        stdio: 'pipe',
        cwd: process.cwd(),
      })

      const durationMs = performance.now() - startTime
      const status = durationMs <= TARGET_MS ? 'PASS' : 'FAIL'

      results.push({
        run: i,
        duration_ms: Math.round(durationMs),
        status,
        target_ms: TARGET_MS,
        message: `${durationMs.toFixed(0)}ms${status === 'PASS' ? ' ✓' : ' ✗ (over target)'}`,
      })

      log.info(`Run ${i}: ${results[i - 1].message}`)
    } catch (error) {
      const durationMs = performance.now() - startTime
      results.push({
        run: i,
        duration_ms: Math.round(durationMs),
        status: 'FAIL',
        target_ms: TARGET_MS,
        message: `Error: ${String(error).substring(0, 50)}...`,
      })

      log.error(`Run ${i}: FAIL - ${String(error).substring(0, 50)}...`)
    }
  }

  // Calculate statistics
  const passingRuns = results.filter((r) => r.status === 'PASS').length
  const avgDuration = results.reduce((sum, r) => sum + r.duration_ms, 0) / results.length
  const minDuration = Math.min(...results.map((r) => r.duration_ms))
  const maxDuration = Math.max(...results.map((r) => r.duration_ms))

  // Calculate 95th percentile
  const sorted = [...results].sort((a, b) => a.duration_ms - b.duration_ms)
  const p95Index = Math.ceil(sorted.length * 0.95) - 1
  const p95Duration = sorted[p95Index]?.duration_ms || maxDuration

  log.step('BENCHMARK RESULTS')
  log.info(`Passing Runs: ${passingRuns}/${RUNS}`)
  log.info(`Average: ${Math.round(avgDuration)}ms`)
  log.info(`Min: ${minDuration}ms`)
  log.info(`Max: ${maxDuration}ms`)
  log.info(`95th Percentile: ${p95Duration}ms`)

  // Overall result
  const overallPass = p95Duration <= TARGET_MS
  log.info(
    `Status: ${overallPass ? '\u2713 PASS' : '\u2717 FAIL'} (95th percentile ${overallPass ? '<=' : '>'} ${TARGET_MS}ms)`
  )

  // Save results
  const reportPath = 'docs/reports/cold-generation-benchmark.json'
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        benchmark: 'ai-context-cold-generation',
        target_ms: TARGET_MS,
        runs: RUNS,
        results,
        statistics: {
          passing_runs: passingRuns,
          average_ms: Math.round(avgDuration),
          min_ms: minDuration,
          max_ms: maxDuration,
          p95_ms: p95Duration,
        },
        overall_status: overallPass ? 'PASS' : 'FAIL',
      },
      null,
      2
    ),
    'utf-8'
  )

  logger.info('Benchmark complete', { report: reportPath, status: overallPass ? 'PASS' : 'FAIL' })
  log.result({ total: RUNS, passed: passingRuns, failed: RUNS - passingRuns })
  flushAi()
  process.exit(overallPass ? 0 : 1)
}

main().catch((err) => {
  logger.error('Benchmark failed', { error: String(err) })
  log.result({ total: 0, passed: 0, failed: 1 })
  flushAi()
  process.exit(1)
})
