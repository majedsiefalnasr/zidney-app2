/**
 * Shared output formatter for developer tooling scripts.
 *
 * All output uses process.stdout.write — console.log is banned.
 * This module is imported by repo-doctor, repo-fix, repo-onboard, repo-status.
 *
 * Stage: INFRA-18 — T001
 
 * @library-module
*/

export type CheckStatus = 'ok' | 'warn' | 'error'

const SYMBOL: Record<CheckStatus, string> = {
  ok: '✔',
  warn: '⚠',
  error: '✗',
}

/**
 * Write a single check result line to stdout.
 *
 * @param label - Human-readable check name
 * @param status - ok | warn | error
 * @param detail - Optional actionable detail appended after " — "
 */
export function line(label: string, status: CheckStatus, detail?: string): void {
  const suffix = detail ? ` — ${detail}` : ''
  process.stdout.write(`${SYMBOL[status]} ${label}${suffix}\n`)
}

/**
 * Write a section header to stdout.
 *
 * @param title - Section title
 */
export function section(title: string): void {
  process.stdout.write(`\n${title}\n${'-'.repeat(title.length)}\n`)
}

/**
 * Write a summary line to stdout.
 *
 * @param passed - Number of passing checks
 * @param total - Total number of checks
 */
export function summary(passed: number, total: number): void {
  const failed = total - passed
  const sym = failed === 0 ? SYMBOL.ok : SYMBOL.error
  const label = failed === 0 ? 'all checks passed' : `${failed.toString()} check(s) failed`
  process.stdout.write(`\n${sym} ${passed.toString()}/${total.toString()} — ${label}\n`)
}
