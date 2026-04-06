#!/usr/bin/env bun
/**
 * @script test:coverage:analyze
 * @domain test
 * @category analysis
 * @description Analyze coverage JSON and report lowest branch coverage in packages/domain-core.
 * @usage bun run test:coverage:analyze
 */

import fs from 'node:fs'
import path from 'node:path'
import { exit, log } from './utils/logger'

type CoverageInfo = {
  b?: Record<string, number[]>
  [k: string]: unknown
}

// Identify this script in the shared logger and print a header
log.setScript('scripts/coverage-analyze')
log.header(
  'COVERAGE ANALYZE',
  'Analyze coverage JSON and report lowest branch coverage in packages/domain-core.'
)

const coverageFinalPath = path.join(process.cwd(), 'coverage', 'coverage-final.json')

let data: Record<string, CoverageInfo> | null = null

if (fs.existsSync(coverageFinalPath)) {
  const raw = fs.readFileSync(coverageFinalPath, 'utf8')
  try {
    data = JSON.parse(raw)
  } catch (err) {
    log.error('Failed to parse JSON:', (err as Error).message)
    exit(2)
  }
} else {
  // Fallback: vitest/v8 writes many partial files under coverage/.tmp; combine them approximately
  const tmpDir = path.join(process.cwd(), 'coverage', '.tmp')
  if (!fs.existsSync(tmpDir)) {
    log.error('coverage-final.json not found at', coverageFinalPath)
    exit(2)
  }

  const files = fs
    .readdirSync(tmpDir)
    .filter((f) => f.startsWith('coverage-') && f.endsWith('.json'))
    .sort()
  if (files.length === 0) {
    log.error('No coverage .tmp files found in', tmpDir)
    exit(2)
  }

  const agg: Record<string, { total: number; covered: number }> = {}
  for (const f of files) {
    const raw = fs.readFileSync(path.join(tmpDir, f), 'utf8')
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch (_e) {
      log.warn('Failed to parse', f)
      continue
    }
    const results = Array.isArray(json.result) ? json.result : Array.isArray(json) ? json : []
    for (const entry of results) {
      const url: string = entry.url || ''
      if (!url || !url.startsWith('file://')) continue
      const filePath = url.replace('file://', '')
      if (!filePath.includes('packages/domain-core')) continue
      if (!Array.isArray(entry.functions)) continue
      let total = 0
      let covered = 0
      for (const fn of entry.functions) {
        if (!Array.isArray(fn.ranges)) continue
        for (const range of fn.ranges) {
          total += 1
          if (range.count && range.count > 0) covered += 1
        }
      }
      if (!agg[filePath]) agg[filePath] = { total: 0, covered: 0 }
      agg[filePath].total += total
      agg[filePath].covered += covered
    }
  }

  data = {}
  for (const [filePath, obj] of Object.entries(agg)) {
    const counts: number[] = []
    for (let i = 0; i < obj.covered; i++) counts.push(1)
    for (let i = obj.covered; i < obj.total; i++) counts.push(0)
    data[filePath] = { b: { '0': counts } }
  }
}

if (!data) {
  log.error('No coverage data available')
  exit(2)
}

type Row = {
  file: string
  totalLocations: number
  coveredLocations: number
  branchCoverage: number
}

const rows: Row[] = []
for (const [filePath, info] of Object.entries(data)) {
  if (!filePath.includes('packages/domain-core')) continue
  const b = info.b || {}
  const totalLocations = Object.values(b).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
    0
  )
  const coveredLocations = Object.values(b).reduce(
    (sum, arr) =>
      sum + (Array.isArray(arr) ? (arr as number[]).reduce((s, c) => s + (c > 0 ? 1 : 0), 0) : 0),
    0
  )
  const branchCoverage = totalLocations === 0 ? NaN : (coveredLocations / totalLocations) * 100
  rows.push({
    file: path.relative(process.cwd(), filePath),
    totalLocations,
    coveredLocations,
    branchCoverage,
  })
}

rows.sort((a, b) => {
  if (Number.isNaN(a.branchCoverage)) return 1
  if (Number.isNaN(b.branchCoverage)) return -1
  return a.branchCoverage - b.branchCoverage
})

log.info(
  'Lowest branch-coverage files in packages/domain-core (showing files with >0 branch locations):'
)
log.info('Coverage%  covered/total  path')
let shown = 0
for (const r of rows) {
  if (r.totalLocations === 0) continue
  log.info(
    `${Number.isNaN(r.branchCoverage) ? 'N/A' : r.branchCoverage.toFixed(2).padStart(7)}%   ${String(
      r.coveredLocations
    ).padStart(3)}/${String(r.totalLocations).padEnd(3)}   ${r.file}`
  )
  shown++
  if (shown >= 20) break
}

if (shown === 0) {
  log.info('No domain-core files with branch locations found.')
  log.result({
    total: rows.length,
    passed: rows.length,
    failed: 0,
    message: 'No domain-core files with branch locations found.',
  })
  exit(0)
}

log.result({ total: rows.length, passed: shown, failed: 0, message: 'Completed coverage analysis' })
exit(0)
