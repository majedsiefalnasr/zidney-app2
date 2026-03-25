/**
 * Architecture Guard Adapter
 *
 * Wraps `bun run arch:guard` (or `arch:guard:changed`) and parses its JSON output
 * into PolicyResult[].
 *
 * Never throws. All errors are returned as error-severity PolicyResult entries.
 *
 * @module scripts/policy-engine/adapters/architecture-guard.adapter
 */

import { createLogger } from '@zidney/logger'
import type { PolicyContext, PolicyResult } from '../types'

const logger = createLogger('policy-engine:adapter:arch-guard')

interface ArchGuardViolation {
  message?: string
  file?: string
  from?: string
  to?: string
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
    proc = Bun.spawn(['bun', 'run', command, '--json'], {
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
      violations = JSON.parse(stdout) as ArchGuardViolation[]
    } catch {
      // Non-JSON output with exit 0 = possibly no violations
      if (stdout.includes('No violations') || stdout.trim() === '[]') {
        return []
      }
      // Try to extract a JSON array from the output
      const match = stdout.match(/\[[\s\S]*\]/)
      if (match) {
        try {
          violations = JSON.parse(match[0]) as ArchGuardViolation[]
        } catch {
          logger.warn('arch:guard output is not parseable JSON', { stdout: stdout.slice(0, 200) })
          return []
        }
      } else {
        logger.warn('arch:guard output is not parseable JSON', { stdout: stdout.slice(0, 200) })
        return []
      }
    }

    if (!Array.isArray(violations)) {
      logger.warn('arch:guard JSON output is not an array', {
        type: typeof violations,
      })
      return []
    }

    return violations.map(
      (v): PolicyResult => ({
        ruleId: 'ARCH-001',
        domain: 'ARCH',
        severity: 'error',
        message: v.message ?? `Import boundary violation: ${v.from ?? '?'} → ${v.to ?? '?'}`,
        file: v.file,
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
