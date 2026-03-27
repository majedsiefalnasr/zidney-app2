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
import { flushAi, log } from '../utils/logger'

interface GuardResult {
  name: string
  script: string
  exitCode: number
  passed: boolean
}

const GUARDS: Array<{ name: string; script: string }> = [
  { name: 'Context Build', script: 'arch:context:build' },
  { name: 'Context Validate', script: 'arch:context:validate' },
  { name: 'Architecture Guard', script: 'arch:guard' },
  { name: 'Type Safety', script: 'validate:types' },
  { name: 'Runtime Scripts', script: 'validate:scripts:runtime' },
  { name: 'Script Usage', script: 'validate:scripts:usage' },
  { name: 'Security CI', script: 'infra:security:ci' },
  { name: 'AI Context Validate', script: 'ai:context:validate' },
]

async function main(): Promise<void> {
  log.header('GOVERNANCE GATE', 'Unified governance gate — composes all guards in sequence')

  const results: GuardResult[] = []

  for (const guard of GUARDS) {
    log.step(`Running: ${guard.name} (${guard.script})`)
    const proc = await $`bun run ${guard.script}`.nothrow()
    const exitCode = proc.exitCode ?? 1
    const passed = exitCode === 0
    results.push({ name: guard.name, script: guard.script, exitCode, passed })
    if (passed) {
      log.success(`${guard.name} — PASS`)
    } else {
      log.error(`${guard.name} — FAIL (exit ${exitCode})`)
    }
  }

  const failures = results.filter((r) => !r.passed)

  if (failures.length > 0) {
    log.error(`Governance gate FAILED — ${failures.length} guard(s) did not pass.`)
    for (const f of failures) {
      log.error(`  • ${f.name} (${f.script}) — exit code ${f.exitCode}`)
    }
    log.result({
      total: results.length,
      passed: results.length - failures.length,
      failed: failures.length,
      message: 'Governance gate failed.',
    })
    flushAi()
    process.exit(1)
  } else {
    log.success(`Governance gate PASSED — all ${results.length} guards passed.`)
    log.result({
      total: results.length,
      passed: results.length,
      failed: 0,
      message: 'Governance gate passed.',
    })
    flushAi()
    process.exit(0)
  }
}

main()
