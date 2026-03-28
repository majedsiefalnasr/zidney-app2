#!/usr/bin/env bun

/**
 * T104: Create dependency usage verification script
 *
 * Searches codebase for usage of each dependency via grep:
 * - Checks imports in .ts, .tsx, .js, .jsx, .vue files
 * - Counts occurrences per dependency
 * - Identifies potentially unused dependencies
 * - Conservative approach: only mark as unused if 0 grep results
 *
 * Success criteria: Usage map for all dependencies (T105 analysis)
 */

import { readFileSync } from 'node:fs'
import { $ } from 'bun'
import { flushAi, log } from '../utils/logger'

interface DependencyUsage {
  name: string
  isDirect: boolean
  isDev: boolean
  version: string
  usageCount: number
  usagePatterns: string[]
  status: 'USED' | 'UNUSED' | 'INDIRECT'
}

async function verifyDependencyUsage(): Promise<void> {
  log.header('VERIFY DEPENDENCY USAGE', 'Checks codebase usage of all declared dependencies')
  log.step('Dependency Usage Verification - T104')

  const pkgContent = readFileSync('package.json', 'utf-8')
  const pkg = JSON.parse(pkgContent)

  const usageMap = new Map<string, DependencyUsage>()

  // Get all direct dependencies
  const directDeps = Object.entries(pkg.dependencies || {})
  const devDeps = Object.entries(pkg.devDependencies || {})

  log.info(`Scanning ${directDeps.length + devDeps.length} dependencies...`)

  // Analyze production dependencies
  if (directDeps.length > 0) {
    log.step('Production Dependencies')
    for (const [name, version] of directDeps) {
      await analyzeDependency(name, version as string, false, false, usageMap)
    }
  }

  // Analyze dev dependencies
  if (devDeps.length > 0) {
    log.step('Development Dependencies')
    for (const [name, version] of devDeps) {
      await analyzeDependency(name, version as string, true, false, usageMap)
    }
  }

  // Sort by usage
  const sorted = Array.from(usageMap.values()).sort((a, b) => b.usageCount - a.usageCount)

  log.step('Dependency Usage Summary')

  const used = sorted.filter((d) => d.status === 'USED')
  const unused = sorted.filter((d) => d.status === 'UNUSED')
  const indirect = sorted.filter((d) => d.status === 'INDIRECT')

  log.info(`| Dependency | Version | Type | Usage | Status |`)
  log.info(`|------------|---------|------|-------|--------|`)

  for (const dep of sorted.slice(0, 10)) {
    const type = dep.isDev ? 'dev' : 'prod'
    const status = dep.status === 'USED' ? 'OK' : dep.status === 'UNUSED' ? 'UNUSED' : 'INDIRECT'
    log.info(
      `| ${dep.name.padEnd(25)} | ${dep.version.padEnd(7)} | ${type.padEnd(4)} | ${String(dep.usageCount).padStart(5)} | ${status} |`
    )
  }

  log.step('Summary')
  log.info(`Total dependencies: ${sorted.length}`)
  log.info(`Used: ${used.length}`)
  log.info(`Unused (candidates): ${unused.length}`)
  log.info(`Indirect only: ${indirect.length}`)

  if (unused.length > 0) {
    log.step('Unused Dependency Candidates')
    for (const dep of unused) {
      const type = dep.isDev ? '(dev)' : '(prod)'
      log.warn(`${dep.name}@${dep.version} ${type}`)
    }
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: sorted.length,
      used: used.length,
      unused: unused.length,
      indirect: indirect.length,
    },
    dependencies: sorted,
    candidates_for_removal: unused.map((d) => ({
      name: d.name,
      version: d.version,
      type: d.isDev ? 'dev' : 'prod',
      reason: 'Zero grep occurrences found',
    })),
  }

  await Bun.write('.dependency-usage-report.json', JSON.stringify(report, null, 2))
  log.success(`Usage report saved to: .dependency-usage-report.json`)
  log.result({ total: sorted.length, passed: used.length, failed: unused.length })
  flushAi()
  process.exit(0)
}

async function analyzeDependency(
  name: string,
  version: string,
  isDev: boolean,
  _isIndirect: boolean,
  usageMap: Map<string, DependencyUsage>
): Promise<void> {
  // Prepare search patterns
  const patterns = [
    `import.*from\\s+['"](${escapeRegex(name)}|${escapeRegex(name)}/.*)['"']`, // ES imports
    `require\\(['"](${escapeRegex(name)}|${escapeRegex(name)}/.*)['"']\\)`, // CommonJS requires
    `from\\s+['"](${escapeRegex(name)}|${escapeRegex(name)}/.*)['"']`, // Vue/dynamic imports
  ]

  let totalCount = 0
  const patterns_found: string[] = []

  // Search in source files
  try {
    for (const pattern of patterns) {
      const grepResult =
        await $`grep -r "${pattern}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.mjs" . 2>/dev/null || true`.text()

      if (grepResult.trim()) {
        const matches = grepResult
          .trim()
          .split('\n')
          .filter((l) => l.length > 0)
        totalCount += matches.length
        if (matches.length > 0) {
          patterns_found.push(`${pattern} (${matches.length})`)
        }
      }
    }
  } catch (_error) {
    // Grep failed, assume not found
  }

  const status = totalCount > 0 ? 'USED' : 'UNUSED'

  const entry: DependencyUsage = {
    name,
    version,
    isDev,
    isDirect: true,
    usageCount: totalCount,
    usagePatterns: patterns_found,
    status: status as 'USED' | 'UNUSED' | 'INDIRECT',
  }

  usageMap.set(name, entry)

  const icon = status === 'USED' ? '✓' : '✗'
  log.info(`${icon} ${name}@${version} — ${totalCount} references`)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

verifyDependencyUsage()
