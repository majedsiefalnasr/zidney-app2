#!/usr/bin/env bun

/**
 * AI Context Warm Run Benchmark (T073)
 *
 * Purpose: Measure ai-context generation with cache hits
 * Target: <500ms for warm generation (cache hit scenario)
 *
 * Process:
 * 1. Generate baseline artifacts (cold run)
 * 2. Run generate-ai-context.ts multiple times WITHOUT clearing cache
 * 3. Measure duration per run (should hit cache)
 * 4. Calculate improvement over cold run
 */

import { execSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { createLogger, flushAi, log } from '../utils/logger'

const logger = createLogger('benchmark-warm-generation')

interface BenchmarkResult {
  run: number
  duration_ms: number
  status: 'PASS' | 'FAIL'
  target_ms: number
  cached?: boolean
}

async function main() {
  log.header(
    'BENCHMARK AI CONTEXT WARM',
    'Measures warm-run (cached) ai-context generation duration'
  )
  const WARM_RUNS = 5
  const TARGET_MS = 500 // 500ms for warm runs
  const results: BenchmarkResult[] = []

  logger.info('Starting AI Context warm run benchmarks', {
    warm_runs: WARM_RUNS,
    target_ms: TARGET_MS,
  })

  log.step(`AI Context Warm Run Benchmark (target: <${TARGET_MS}ms, ${WARM_RUNS} runs)`)

  // Step 1: Clear cache and do one cold run to populate cache
  log.step('Step 1: Cold run to populate cache...')
  const cacheDir = 'docs/ai/context/.cache'
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true })
  }

  try {
    execSync('bun run ai:context:refresh --validate', {
      stdio: 'pipe',
      cwd: process.cwd(),
    })
    log.success('Cache populated')
  } catch (error) {
    logger.error('Cold run failed', { error: String(error) })
    log.error('Failed to populate cache')
    log.result({ total: WARM_RUNS, passed: 0, failed: WARM_RUNS })
    flushAi()
    process.exit(1)
  }

  // Step 2: Run warm generation without clearing cache
  log.step('Step 2: Warm runs (without clearing cache)...')
  for (let i = 1; i <= WARM_RUNS; i++) {
    const startTime = performance.now()

    try {
      execSync('bun run ai:context:generate --validate', {
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
        cached: true,
      })

      log.info(
        `Run ${i}: ${durationMs.toFixed(0)}ms${status === 'PASS' ? ' OK' : ' (over target)'}`
      )
    } catch (error) {
      const durationMs = performance.now() - startTime
      results.push({
        run: i,
        duration_ms: Math.round(durationMs),
        status: 'FAIL',
        target_ms: TARGET_MS,
        cached: false,
      })

      log.warn(`Run ${i}: FAIL - ${String(error).substring(0, 50)}...`)
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

  log.step('Benchmark Results')
  log.info(`Passing Runs: ${passingRuns}/${WARM_RUNS}`)
  log.info(`Average: ${Math.round(avgDuration)}ms`)
  log.info(`Min: ${minDuration}ms`)
  log.info(`Max: ${maxDuration}ms`)
  log.info(`95th Percentile: ${p95Duration}ms`)

  const overallPass = p95Duration <= TARGET_MS
  if (overallPass) {
    log.success(`PASS (95th percentile ${p95Duration}ms <= ${TARGET_MS}ms)`)
  } else {
    log.error(`FAIL (95th percentile ${p95Duration}ms > ${TARGET_MS}ms)`)
  }

  // Save results
  const reportPath = 'docs/reports/warm-generation-benchmark.json'
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        benchmark: 'ai-context-warm-generation',
        target_ms: TARGET_MS,
        warm_runs: WARM_RUNS,
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

  log.result({ total: WARM_RUNS, passed: passingRuns, failed: WARM_RUNS - passingRuns })
  flushAi()
  process.exit(overallPass ? 0 : 1)
}

main().catch((err) => {
  logger.error('Benchmark failed', { error: String(err) })
  process.exit(1)
})
