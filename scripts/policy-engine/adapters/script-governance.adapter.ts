/**
 * Script Governance Adapter
 *
 * Wraps `bun run validate:scripts:all --json` and maps violation types
 * to the appropriate SCRIPTS-* ruleIds.
 *
 * Never throws. All errors are returned as error-severity PolicyResult entries.
 *
 * @module scripts/policy-engine/adapters/script-governance.adapter
 * @library-module
 */

import { createLogger } from '../../utils/logger'
import type { PolicyContext, PolicyResult } from '../types'

const logger = createLogger('policy-engine:adapter:script-governance')

type ViolationType =
  | 'naming-violation'
  | 'duplicate-script'
  | 'broken-reference'
  | 'missing-docs'
  | string

interface ScriptViolation {
  type?: ViolationType
  message?: string
  file?: string
  scriptName?: string
  suggestion?: string
  [key: string]: unknown
}

const VIOLATION_RULE_MAP: Record<string, string> = {
  'naming-violation': 'SCRIPTS-001',
  'duplicate-script': 'SCRIPTS-002',
  'broken-reference': 'SCRIPTS-003',
  'missing-docs': 'SCRIPTS-004',
}

function makeErrorResult(message: string): PolicyResult {
  return {
    ruleId: 'SCRIPTS-001',
    domain: 'SCRIPTS',
    severity: 'error',
    message,
  }
}

/**
 * Run script governance validation and parse violations into PolicyResult[].
 *
 * Spawns: `bun run validate:scripts:all --json`
 */
export async function runScriptGovernance(context: PolicyContext): Promise<PolicyResult[]> {
  logger.debug('Spawning validate:scripts:all --json')

  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn(['bun', 'run', 'validate:scripts:all', '--json'], {
      signal: context.abortSignal,
      stdout: 'pipe',
      stderr: 'pipe',
    })
  } catch (err) {
    return [makeErrorResult(`validate:scripts:all failed to spawn: ${String(err)}`)]
  }

  try {
    const [stdoutBuf, stderrBuf, exitCode] = await Promise.all([
      new Response(proc.stdout as ReadableStream).arrayBuffer(),
      new Response(proc.stderr as ReadableStream).arrayBuffer(),
      proc.exited,
    ])

    const stdout = new TextDecoder().decode(stdoutBuf).trim()
    const stderr = new TextDecoder().decode(stderrBuf).trim()

    if (exitCode !== 0 && !stdout) {
      const message = `validate:scripts:all exited with code ${exitCode}: ${stderr.slice(0, 300)}`
      logger.warn(message, { exitCode })
      return [makeErrorResult(message)]
    }

    if (!stdout) {
      return []
    }

    let violations: ScriptViolation[]
    try {
      const parsed = JSON.parse(stdout)
      violations = Array.isArray(parsed) ? parsed : []
    } catch {
      logger.warn('validate:scripts:all output is not parseable JSON', {
        stdout: stdout.slice(0, 200),
      })
      return []
    }

    return violations.map((v): PolicyResult => {
      const type = v.type ?? ''
      const ruleId = VIOLATION_RULE_MAP[type] ?? 'SCRIPTS-001'

      return {
        ruleId,
        domain: 'SCRIPTS',
        severity: ruleId === 'SCRIPTS-001' || ruleId === 'SCRIPTS-003' ? 'error' : 'warning',
        message: v.message ?? `Script violation (${type}): ${v.scriptName ?? 'unknown'}`,
        file: v.file,
        suggestion: v.suggestion,
      }
    })
  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))) {
      return [makeErrorResult('validate:scripts:all was cancelled (engine timeout)')]
    }
    const message = `script-governance adapter failed: ${String(err)}`
    logger.error(message)
    return [makeErrorResult(message)]
  }
}
