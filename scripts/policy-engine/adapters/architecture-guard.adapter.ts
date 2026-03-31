/**
 * Architecture Guard Adapter
 *
 * Wraps `bun run arch:guard` (or `arch:guard:changed`) and parses its JSON output
 * into PolicyResult[].
 *
 * Never throws. All errors are returned as error-severity PolicyResult entries.
 *
 * @module scripts/policy-engine/adapters/architecture-guard.adapter
 * @library-module
 */

import { createLogger } from '../../utils/logger'
import type { PolicyContext, PolicyResult } from '../types'

const logger = createLogger('policy-engine:adapter:arch-guard')

interface ArchGuardViolation {
  rule?: string
  severity?: string
  message?: string
  location?: { file?: string; line?: number }
  // Legacy flat fields (kept for backwards compat)
  file?: string
  from?: string
  to?: string
  [key: string]: unknown
}

interface ArchGuardReport {
  violations?: ArchGuardViolation[]
  verdict?: string
  [key: string]: unknown
}

function makeErrorResult(message: string): PolicyResult {
  return {
    ruleId: 'ARCH-001',
    domain: 'ARCH',
    severity: 'error',
    message,
  }
}

/**
 * Run the architecture guard tool and parse violations into PolicyResult[].
 *
 * Spawns: `bun run arch:guard:changed --json` (changed mode) or
 *         `bun run arch:guard --json` (full mode)
 */
export async function runArchitectureGuard(context: PolicyContext): Promise<PolicyResult[]> {
  const command = context.mode === 'changed' ? 'arch:guard:changed' : 'arch:guard'

  logger.debug(`Spawning ${command}`, { mode: context.mode })

  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn(['bun', 'run', command, '--check-only', '--output', 'json'], {
      signal: context.abortSignal,
      stdout: 'pipe',
      stderr: 'pipe',
    })
  } catch (err) {
    const message = `arch:guard adapter failed to spawn: ${String(err)}`
    logger.error(message)
    return [makeErrorResult(message)]
  }

  try {
    const [stdoutBuf, stderrBuf, exitCode] = await Promise.all([
      new Response(proc.stdout as ReadableStream).arrayBuffer(),
      new Response(proc.stderr as ReadableStream).arrayBuffer(),
      proc.exited,
    ])

    const stdout = new TextDecoder().decode(stdoutBuf).trim()
    const stderr = new TextDecoder().decode(stderrBuf).trim()

    if (exitCode !== 0) {
      const stderrExcerpt = stderr.slice(0, 300)
      const message = `arch:guard exited with code ${exitCode}: ${stderrExcerpt}`
      logger.warn(message, { exitCode })
      return [makeErrorResult(message)]
    }

    if (!stdout) {
      return []
    }

    let violations: ArchGuardViolation[]
    try {
      const parsed = JSON.parse(stdout) as ArchGuardReport | ArchGuardViolation[]
      // arch:guard --output json emits a GuardRunReport object; extract violations array
      if (Array.isArray(parsed)) {
        violations = parsed
      } else if (parsed && Array.isArray(parsed.violations)) {
        violations = parsed.violations
      } else {
        logger.warn('arch:guard JSON output has unexpected shape', { stdout: stdout.slice(0, 200) })
        return []
      }
    } catch {
      // Non-JSON output with exit 0 = possibly no violations
      if (stdout.includes('No violations') || stdout.trim() === '[]') {
        return []
      }
      logger.warn('arch:guard output is not parseable JSON', { stdout: stdout.slice(0, 200) })
      return []
    }

    return violations.map(
      (v): PolicyResult => ({
        ruleId: v.rule ?? 'ARCH-001',
        domain: 'ARCH',
        severity: v.severity === 'warning' ? 'warning' : 'error',
        message: v.message ?? `Import boundary violation: ${v.from ?? '?'} → ${v.to ?? '?'}`,
        file: v.location?.file ?? v.file,
      })
    )
  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))) {
      return [makeErrorResult('arch:guard was cancelled (engine timeout)')]
    }
    const message = `arch:guard adapter failed: ${String(err)}`
    logger.error(message)
    return [makeErrorResult(message)]
  }
}
