#!/usr/bin/env bun

/**
 * @script governance:report
 * @domain governance
 * @category governance
 * @description Generates a consolidated governance health report at docs/governance/governance-report.md
 *
 * @usage bun run governance:report
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { $ } from 'bun'

interface GuardResult {
  name: string
  script: string
  exitCode: number
  passed: boolean
}

const REPORT_GUARDS: Array<{ name: string; script: string }> = [
  { name: 'Architecture Health', script: 'arch:health' },
  { name: 'AI Context Fresh', script: 'validate:ai-context-fresh' },
  { name: 'AI Context Schemas', script: 'validate:ai-context-schemas' },
]

function buildReport(timestamp: string, results: GuardResult[]): string {
  const rows = results
    .map((r) => {
      const status = r.passed ? '✅ PASS' : '❌ FAIL'
      return `| ${r.name.padEnd(20)} | ${status}   |`
    })
    .join('\n')

  const violations = results.filter((r) => !r.passed)

  const violationsSection =
    violations.length === 0
      ? '_None_'
      : violations
          .map((v) => `- **${v.name}** (\`${v.script}\`) exited with code ${v.exitCode}`)
          .join('\n')

  return `# Governance Report

**Generated:** ${timestamp}

## Guard Summary

| Guard                | Status  |
| -------------------- | ------- |
${rows}

## Blocking Violations

${violationsSection}

## Warnings

_None_
`
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString()

  console.log('╔══════════════════════════════════════════════╗')
  console.log('║         Governance Report Generator          ║')
  console.log('╚══════════════════════════════════════════════╝')
  console.log('')

  const results: GuardResult[] = []

  for (const guard of REPORT_GUARDS) {
    console.log(`▶ Running: ${guard.name} (${guard.script})`)
    const proc = await $`bun run ${guard.script}`.nothrow()
    const exitCode = proc.exitCode ?? 1
    const passed = exitCode === 0
    results.push({ name: guard.name, script: guard.script, exitCode, passed })
    console.log(passed ? `  ✔ ${guard.name} — PASS` : `  ✖ ${guard.name} — FAIL (exit ${exitCode})`)
  }

  const report = buildReport(timestamp, results)

  await mkdir('docs/governance', { recursive: true })
  await writeFile('docs/governance/governance-report.md', report, 'utf8')

  console.log('')
  console.log('✔ Report written to docs/governance/governance-report.md')

  // report.ts always exits 0 — informational only, not a gate
  process.exit(0)
}

main()
