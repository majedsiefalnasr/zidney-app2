#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'

interface BenchmarkOptions {
  runs: number
  ci: boolean
}

interface BenchmarkResult {
  runs: number
  ci: boolean
  durations_ms: number[]
  p95_duration_ms: number
  budget_ms: number
  within_budget: boolean
}

export function parseBenchmarkArgs(args = process.argv.slice(2)): BenchmarkOptions {
  const runsIndex = args.indexOf('--runs')
  const runsValue = runsIndex >= 0 ? Number(args[runsIndex + 1]) : 20

  return {
    runs: Number.isFinite(runsValue) && runsValue > 0 ? runsValue : 20,
    ci: args.includes('--ci'),
  }
}

export function calculateP95(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  return Number(sorted[index] ?? 0)
}

export function runBenchmark(options: BenchmarkOptions): BenchmarkResult {
  const durations: number[] = []

  for (let index = 0; index < options.runs; index += 1) {
    const startedAt = Date.now()
    const result = spawnSync(
      process.execPath,
      [
        'scripts/architecture-health/architecture-health.ts',
        '--output',
        'json',
        ...(options.ci ? ['--ci'] : []),
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || 'architecture-health benchmark run failed')
    }

    durations.push(Date.now() - startedAt)
  }

  const budget_ms = options.ci ? 120_000 : 90_000
  const p95_duration_ms = calculateP95(durations)

  return {
    runs: options.runs,
    ci: options.ci,
    durations_ms: durations,
    p95_duration_ms,
    budget_ms,
    within_budget: p95_duration_ms <= budget_ms,
  }
}

function main(): void {
  const options = parseBenchmarkArgs()
  const result = runBenchmark(options)
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.within_budget ? 0 : 1
}

if ((import.meta as { main?: boolean }).main) {
  main()
}
