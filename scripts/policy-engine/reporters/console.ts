/**
 * Console Reporter
 *
 * Formats PolicyResult[] as human-readable, grouped-by-domain output to stdout.
 *
 * Output structure:
 *   ━━━ ARCH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   [ERROR] ARCH-001  src/foo.ts
 *     Import boundary violation
 *     Suggestion: Remove import from ui-system
 *
 *   ────────────────────────────────────
 *     2 error(s)   1 warning(s)   0 info(s)
 *   ────────────────────────────────────
 *
 * @module scripts/policy-engine/reporters/console
 */

import type { PolicyDomain, PolicyResult, Reporter } from '../types'

const SEVERITY_ORDER: Record<string, number> = {
  error: 0,
  warning: 1,
  info: 2,
}

const SEVERITY_LABEL: Record<string, string> = {
  error: '[ERROR]',
  warning: '[WARN] ',
  info: '[INFO] ',
}

const SUMMARY_DIVIDER = '─'.repeat(50)

export class ConsoleReporter implements Reporter {
  report(results: PolicyResult[]): void {
    if (results.length === 0) {
      console.log(`\n${SUMMARY_DIVIDER}`)
      console.log('  ✓ All governance checks passed — no violations found.')
      console.log(`${SUMMARY_DIVIDER}\n`)
      return
    }

    // Group results by domain
    const byDomain = new Map<PolicyDomain, PolicyResult[]>()

    for (const result of results) {
      const existing = byDomain.get(result.domain) ?? []
      existing.push(result)
      byDomain.set(result.domain, existing)
    }

    // Sort domains alphabetically (ENGINE last)
    const sortedDomains = [...byDomain.keys()].sort((a, b) => {
      if (a === 'ENGINE') return 1
      if (b === 'ENGINE') return -1
      return a.localeCompare(b)
    })

    console.log()

    for (const domain of sortedDomains) {
      const domainResults = byDomain.get(domain)!

      // Domain header
      const header = `━━━ ${domain} ${'━'.repeat(Math.max(0, 44 - domain.length))}`
      console.log(header)

      // Sort within domain: error → warning → info
      const sorted = [...domainResults].sort(
        (a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2)
      )

      for (const result of sorted) {
        const severityLabel = SEVERITY_LABEL[result.severity] ?? '[INFO] '
        const fileInfo = result.file ? `  ${result.file}` : '  (no file)'
        const locationInfo =
          result.line != null
            ? `:${result.line}${result.column != null ? `:${result.column}` : ''}`
            : ''

        console.log(`${severityLabel} ${result.ruleId}${fileInfo}${locationInfo}`)
        console.log(`  ${result.message}`)

        if (result.suggestion) {
          console.log(`  Suggestion: ${result.suggestion}`)
        }

        console.log()
      }
    }

    // Summary line
    const errors = results.filter((r) => r.severity === 'error').length
    const warnings = results.filter((r) => r.severity === 'warning').length
    const infos = results.filter((r) => r.severity === 'info').length

    console.log(SUMMARY_DIVIDER)
    console.log(`  ${errors} error(s)   ${warnings} warning(s)   ${infos} info(s)`)
    console.log(`${SUMMARY_DIVIDER}\n`)
  }
}
