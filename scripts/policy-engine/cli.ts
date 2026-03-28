/**
 * Policy Engine CLI — Entry Point
 *
 * Entry point for `bun run policy:check`.
 * Parses arguments, loads context, runs engine, reports results, and exits.
 *
 * Usage:
 *   bun run policy:check               # --changed mode (default)
 *   bun run policy:check --full        # full repo mode
 *   bun run policy:check --changed     # changed-files mode
 *   bun run policy:check --reporter=json
 *   bun run policy:check --full --reporter=json
 *
 * Exit codes:
 *   0 — no error-severity violations
 *   1 — one or more error-severity violations (or ENGINE-001 timeout)
 *
 * @module scripts/policy-engine/cli
 
 * @library-module
*/

// ── Side-effect imports: trigger registerRule() in each rule file ─────────────
import './rules/ai/AI-001.rule'
import './rules/architecture/ARCH-001.rule'
import './rules/scripts/SCRIPTS-001.rule'
import './rules/scripts/SCRIPTS-002.rule'
import './rules/scripts/SCRIPTS-003.rule'
import './rules/scripts/SCRIPTS-004.rule'
import './rules/security/SECURITY-001.rule'
import './rules/types/TYPES-001.rule'

import { exit, hasCiFlag, log } from '../utils/logger'
import { loadContext } from './context/loader'
import { PolicyEngine } from './engine'
import { ConsoleReporter } from './reporters/console'
import { JsonReporter } from './reporters/json'
import type { Reporter, ReporterType } from './types'

// ── Argument parsing ──────────────────────────────────────────────────────────

interface ParsedArgs {
  mode: 'changed' | 'full'
  timeout: number
  reporterType: ReporterType
  ci: boolean
}

function parseArgs(argv: string[]): ParsedArgs {
  let mode: 'changed' | 'full' = 'changed'
  let timeout = 2_000
  let reporterType: ReporterType = 'console'
  const ci = hasCiFlag(argv)

  for (const arg of argv) {
    if (arg === '--full') {
      mode = 'full'
      timeout = 30_000
    } else if (arg === '--changed') {
      mode = 'changed'
      timeout = 2_000
    } else if (arg === '--reporter=json' || arg === '--json') {
      reporterType = 'json'
    } else if (arg === '--reporter=console') {
      reporterType = 'console'
    }
  }

  return { mode, timeout, reporterType, ci }
}

function createReporter(type: ReporterType): Reporter {
  if (type === 'json') return new JsonReporter()
  return new ConsoleReporter()
}

// ── Main ──────────────────────────────────────────────────────────────────────

log.header('POLICY ENGINE', 'Unified governance policy checks')

const args = parseArgs(Bun.argv.slice(2))
if (args.ci) {
  log.info('[policy:check] CI mode enabled')
}
const reporter = createReporter(args.reporterType)
const engine = new PolicyEngine()

const { context, warnings } = await loadContext(args.mode, args.timeout)
const results = await engine.check(context, warnings)

reporter.report(results)

const hasErrors = results.some((r) => r.severity === 'error')
const passed = results.filter((r) => r.severity !== 'error').length
const failed = results.filter((r) => r.severity === 'error').length

log.result({
  total: results.length,
  passed,
  failed,
  message: hasErrors ? 'Policy violations detected' : 'All policies passed',
})

exit(hasErrors ? 1 : 0)
