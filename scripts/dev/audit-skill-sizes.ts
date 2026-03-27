#!/usr/bin/env bun

/**
 * T096: Audit all SKILL.md files for line count
 *
 * Scans all SKILL.md files in .agents/skills/ and identifies:
 * - Total files
 * - Line count per file
 * - Files exceeding 500 line limit
 * - Oversized candidates for splitting
 *
 * Success criteria: Identify all files >500 lines for Phase 5 remediation
 */

import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { $ } from 'bun'
import { flushAi, log } from '../utils/logger'

interface SkillAudit {
  path: string
  name: string
  lineCount: number
  oversized: boolean
  status: 'OK' | 'OVERSIZED' | 'MARGINAL'
}

async function auditSkillFiles(): Promise<void> {
  log.header(
    'AUDIT SKILL SIZES',
    'Scans all SKILL.md files and identifies files exceeding 500 line limit'
  )

  // Find all SKILL.md files using bun shell
  const findResult = await $`find .agents -name "SKILL.md" -type f`.text()
  const skillFiles = findResult
    .trim()
    .split('\n')
    .filter((f) => f.length > 0)
    .map((f) => f.trim())

  log.info(`Found ${skillFiles.length} SKILL.md files`)

  const audits: SkillAudit[] = []
  let oversizedCount = 0
  let marginalCount = 0

  for (const filePath of skillFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8')
      const lineCount = content.split('\n').length
      const skillName = dirname(filePath).split('/').pop() || 'unknown'

      let status: 'OK' | 'OVERSIZED' | 'MARGINAL' = 'OK'
      if (lineCount > 500) {
        status = 'OVERSIZED'
        oversizedCount++
      } else if (lineCount >= 450) {
        status = 'MARGINAL'
        marginalCount++
      }

      audits.push({
        path: filePath.replace(process.cwd(), '.'),
        name: skillName,
        lineCount,
        oversized: lineCount > 500,
        status,
      })
    } catch (error) {
      log.error(`Error reading ${filePath}: ${String(error)}`)
    }
  }

  // Sort by line count (descending)
  audits.sort((a, b) => b.lineCount - a.lineCount)

  // Print audit results
  log.step('SKILL.md Audit Results')
  log.info('| Skill | Lines | Status | Action |')
  log.info('|-------|-------|--------|--------|')

  for (const audit of audits) {
    const statusIcon = audit.status === 'OVERSIZED' ? '⚠️' : audit.status === 'MARGINAL' ? '⚡' : '✓'
    log.info(
      `| ${audit.name.padEnd(40)} | ${String(audit.lineCount).padStart(5)} | ${statusIcon} ${audit.status.padEnd(8)} | ${
        audit.oversized ? 'SPLIT' : audit.status === 'MARGINAL' ? 'REVIEW' : 'OK'
      } |`
    )
  }

  log.step('Summary Metrics:')
  log.info(`  Total SKILL.md files: ${audits.length}`)
  log.info(`  OK (<450 lines): ${audits.length - oversizedCount - marginalCount}`)
  log.info(`  Marginal (450-500 lines): ${marginalCount}`)
  log.info(`  Oversized (>500 lines): ${oversizedCount}`)
  log.info(`Phase 5 Target: All files <500 lines`)

  if (oversizedCount > 0) {
    log.warn('Action Required:')
    const oversized = audits.filter((a) => a.status === 'OVERSIZED')
    for (const audit of oversized) {
      log.warn(`  - ${audit.name}: ${audit.lineCount} lines → SPLIT`)
    }
    log.info('  Tasks T097-T102 will address these files.')
  } else {
    log.success('All SKILL.md files within limits!')
  }

  // Write audit report
  const reportPath = './reports/.skill-audit-report.json'
  const report = {
    timestamp: new Date().toISOString(),
    totalFiles: audits.length,
    oversizedCount,
    marginalCount,
    okCount: audits.length - oversizedCount - marginalCount,
    targetMetric: 'All SKILL.md <500 lines',
    achievedStatus: oversizedCount === 0 ? 'PASS' : 'NEEDS_REMEDIATION',
    audits,
  }

  await Bun.write(reportPath, JSON.stringify(report, null, 2))
  log.success(`Full audit report saved to: ${reportPath}`)
  log.result({
    total: audits.length,
    passed: audits.length - oversizedCount - marginalCount,
    failed: oversizedCount,
  })
  flushAi()
  // Exit with success (report generated regardless of status)
  process.exit(0)
}

auditSkillFiles().catch((error) => {
  log.error(`Audit failed: ${String(error)}`)
  flushAi()
  process.exit(1)
})
