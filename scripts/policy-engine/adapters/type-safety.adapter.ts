/**
 * Type Safety Adapter
 *
 * Wraps `bun typecheck` (tsc) and `bun arch:type-safety-guard --json`
 * and parses errors into PolicyResult[].
 *
 * Never throws. All errors are returned as error-severity PolicyResult entries.
 *
 * @module scripts/policy-engine/adapters/type-safety.adapter
 
 * @library-module
*/

import { createLogger } from '@zidney/logger'
import type { PolicyContext, PolicyResult } from '../types'

const logger = createLogger('policy-engine:adapter:type-safety')

// Matches: path/to/file.ts(10,5): error TS2345: <message>
const TSC_DIAGNOSTIC_REGEX = /^(.+\.ts[x]?)\((\d+),(\d+)\): error (TS\d+): (.+)$/

interface TypeSafetyGuardViolation {
  file?: string
  line?: number
  column?: number
  message?: string
  ruleId?: string
  [key: string]: unknown
}

function makeErrorResult(message: string): PolicyResult {
  return {
    ruleId: 'TYPES-001',
    domain: 'TYPES',
    severity: 'error',
    message,
  }
}

async function runTscTypecheck(context: PolicyContext): Promise<PolicyResult[]> {
  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn(['bun', 'typecheck'], {
      signal: context.abortSignal,
      stdout: 'pipe',
      stderr: 'pipe',
    })
  } catch (err) {
    return [makeErrorResult(`bun typecheck failed to spawn: ${String(err)}`)]
  }

  try {
    const [stdoutBuf, stderrBuf, exitCode] = await Promise.all([
      new Response(proc.stdout as ReadableStream).arrayBuffer(),
      new Response(proc.stderr as ReadableStream).arrayBuffer(),
      proc.exited,
    ])

    // tsc writes errors to stderr
    const stderr = new TextDecoder().decode(stderrBuf)
    const stdout = new TextDecoder().decode(stdoutBuf)
    const combined = stderr + stdout

    const results: PolicyResult[] = []

    for (const line of combined.split('\n')) {
      const match = TSC_DIAGNOSTIC_REGEX.exec(line.trim())
      if (match) {
        const [, file, lineNum, colNum, tsCode, msg] = match
        results.push({
          ruleId: 'TYPES-001',
          domain: 'TYPES',
          severity: 'error',
          file,
          line: Number(lineNum),
          column: Number(colNum),
          message: `${tsCode}: ${msg}`,
        })
      }
    }

    if (exitCode !== 0 && results.length === 0) {
      const stderrExcerpt = (stderr + stdout).trim().slice(0, 300)
      return [makeErrorResult(`bun typecheck exited with code ${exitCode}: ${stderrExcerpt}`)]
    }

    return results
  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))) {
      return [makeErrorResult('bun typecheck was cancelled (engine timeout)')]
    }
    return [makeErrorResult(`bun typecheck adapter failed: ${String(err)}`)]
  }
}

async function runTypeSafetyGuard(context: PolicyContext): Promise<PolicyResult[]> {
  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn(['bun', 'arch:type-safety-guard', '--json'], {
      signal: context.abortSignal,
      stdout: 'pipe',
      stderr: 'pipe',
    })
  } catch (err) {
    return [makeErrorResult(`bun arch:type-safety-guard failed to spawn: ${String(err)}`)]
  }

  try {
    const [stdoutBuf, stderrBuf, exitCode] = await Promise.all([
      new Response(proc.stdout as ReadableStream).arrayBuffer(),
      new Response(proc.stderr as ReadableStream).arrayBuffer(),
      proc.exited,
    ])

    const stdout = new TextDecoder().decode(stdoutBuf).trim()
    const stderr = new TextDecoder().decode(stderrBuf).trim()

    if (!stdout) {
      if (exitCode !== 0) {
        return [
          makeErrorResult(
            `bun arch:type-safety-guard exited with code ${exitCode}: ${stderr.slice(0, 300)}`
          ),
        ]
      }
      return []
    }

    let violations: TypeSafetyGuardViolation[]
    try {
      const parsed = JSON.parse(stdout)
      violations = Array.isArray(parsed) ? parsed : []
    } catch {
      logger.warn('arch:type-safety-guard output is not parseable JSON', {
        stdout: stdout.slice(0, 200),
      })
      return []
    }

    return violations.map(
      (v): PolicyResult => ({
        ruleId: 'TYPES-001',
        domain: 'TYPES',
        severity: 'error',
        file: v.file,
        line: v.line,
        column: v.column,
        message: v.message ?? 'Type safety violation detected',
      })
    )
  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))) {
      return [makeErrorResult('bun arch:type-safety-guard was cancelled (engine timeout)')]
    }
    return [makeErrorResult(`arch:type-safety-guard adapter failed: ${String(err)}`)]
  }
}

/**
 * Run type-safety checks (bun typecheck + bun arch:type-safety-guard) and
 * merge results into PolicyResult[].
 */
export async function runTypeSafety(context: PolicyContext): Promise<PolicyResult[]> {
  logger.debug('Running type safety checks')

  const [tscResults, guardResults] = await Promise.all([
    runTscTypecheck(context),
    runTypeSafetyGuard(context),
  ])

  return [...tscResults, ...guardResults]
}
