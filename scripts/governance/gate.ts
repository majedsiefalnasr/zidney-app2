#!/usr/bin/env bun

/**
 * @script governance:gate
 * @domain governance
 * @category governance
 * @description Unified governance gate — composes all guards in sequence (report-all mode)
 *
 * @usage bun run governance:gate
 */

import { $ } from 'bun'

interface GuardResult {
  name: string
  script: string
  exitCode: number
  passed: boolean
}

const GUARDS: Array<{ name: string; script: string }> = [
  { name: 'Architecture Guard', script: 'arch:guard' },
  { name: 'Type Safety', script: 'validate:types' },
  { name: 'Runtime Scripts', script: 'validate:runtime:scripts' },
  { name: 'Script Usage', script: 'validate:script:usage' },
  { name: 'Security CI', script: 'infra:security:ci' },
  { name: 'AI Context Validate', script: 'ai-context:validate' },
]

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║         Unified Governance Gate              ║')
  console.log('╚══════════════════════════════════════════════╝')
  console.log('')

  const results: GuardResult[] = []

  for (const guard of GUARDS) {
    console.log(`▶ Running: ${guard.name} (${guard.script})`)
    const proc = await $`bun run ${guard.script}`.nothrow()
    const exitCode = proc.exitCode ?? 1
    const passed = exitCode === 0
    results.push({ name: guard.name, script: guard.script, exitCode, passed })
    console.log(passed ? `  ✔ ${guard.name} — PASS` : `  ✖ ${guard.name} — FAIL (exit ${exitCode})`)
    console.log('')
  }

  // Summary table
  console.log('══════════════════════════════════════════════')
  console.log('  Guard Summary')
  console.log('══════════════════════════════════════════════')

  const nameWidth = Math.max(...results.map((r) => r.name.length), 20)
  const header = `  ${'Guard'.padEnd(nameWidth)}  Status`
  console.log(header)
  console.log(`  ${'─'.repeat(nameWidth)}  ──────`)

  for (const r of results) {
    const status = r.passed ? '✔ PASS' : '✖ FAIL'
    console.log(`  ${r.name.padEnd(nameWidth)}  ${status}`)
  }

  console.log('══════════════════════════════════════════════')

  const failures = results.filter((r) => !r.passed)

  if (failures.length > 0) {
    console.error(`\n❌ Governance gate FAILED — ${failures.length} guard(s) did not pass.`)
    for (const f of failures) {
      console.error(`   • ${f.name} (${f.script}) — exit code ${f.exitCode}`)
    }
    process.exit(1)
  } else {
    console.log(`\n✔ Governance gate PASSED — all ${results.length} guards passed.`)
    process.exit(0)
  }
}

main()
