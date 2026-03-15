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

interface SkillAudit {
  path: string
  name: string
  lineCount: number
  oversized: boolean
  status: 'OK' | 'OVERSIZED' | 'MARGINAL'
}

async function auditSkillFiles(): Promise<void> {
  console.log('📊 SKILL.md Audit - T096\n')

  // Find all SKILL.md files using bun shell
  const findResult = await $`find .agents -name "SKILL.md" -type f`.text()
  const skillFiles = findResult
    .trim()
    .split('\n')
    .filter((f) => f.length > 0)
    .map((f) => f.trim())

  console.log(`Found ${skillFiles.length} SKILL.md files\n`)

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
      console.error(`Error reading ${filePath}:`, error)
    }
  }

  // Sort by line count (descending)
  audits.sort((a, b) => b.lineCount - a.lineCount)

  // Print audit results
  console.log('📋 SKILL.md Audit Results\n')
  console.log('| Skill | Lines | Status | Action |')
  console.log('|-------|-------|--------|--------|')

  for (const audit of audits) {
    const statusIcon = audit.status === 'OVERSIZED' ? '⚠️' : audit.status === 'MARGINAL' ? '⚡' : '✓'
    console.log(
      `| ${audit.name.padEnd(40)} | ${String(audit.lineCount).padStart(5)} | ${statusIcon} ${audit.status.padEnd(8)} | ${
        audit.oversized ? 'SPLIT' : audit.status === 'MARGINAL' ? 'REVIEW' : 'OK'
      } |`
    )
  }

  console.log('\n---\n')
  console.log('📊 Summary Metrics:')
  console.log(`  Total SKILL.md files: ${audits.length}`)
  console.log(`  OK (<450 lines): ${audits.length - oversizedCount - marginalCount}`)
  console.log(`  Marginal (450-500 lines): ${marginalCount}`)
  console.log(`  Oversized (>500 lines): ${oversizedCount}`)
  console.log(`\n✅ Phase 5 Target: All files <500 lines\n`)

  if (oversizedCount > 0) {
    console.log('🔴 Action Required:')
    const oversized = audits.filter((a) => a.status === 'OVERSIZED')
    for (const audit of oversized) {
      console.log(`  - ${audit.name}: ${audit.lineCount} lines → SPLIT`)
    }
    console.log('\n  Tasks T097-T102 will address these files.\n')
  } else {
    console.log('✅ All SKILL.md files within limits!\n')
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
  console.log(`📄 Full audit report saved to: ${reportPath}\n`)

  // Exit with success (report generated regardless of status)
  process.exit(0)
}

auditSkillFiles().catch((error) => {
  console.error('Audit failed:', error)
  process.exit(1)
})
