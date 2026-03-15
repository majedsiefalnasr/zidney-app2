import { spawn } from 'node:child_process'
import type { SubCommandResult } from './types'

const BUN = process.execPath

export interface RunOptions {
  command: string
  args: string[]
  timeoutMs: number
}

/**
 * Run a governance sub-command with timeout enforcement.
 * stdio: 'pipe' — zero stdout/stderr leaks to orchestrator (FR-011).
 * Returns SubCommandResult regardless of exit code — caller decides on failure action.
 */
export async function runGovernanceTool(
  opts: RunOptions
): Promise<SubCommandResult & { stdout: string }> {
  const start = Date.now()
  return new Promise((resolve) => {
    let timedOut = false
    let stdout = ''

    const proc = spawn(BUN, ['run', opts.command, ...opts.args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGTERM')
    }, opts.timeoutMs)

    proc.on('close', (code) => {
      clearTimeout(timer)
      resolve({
        command: [opts.command, ...opts.args].join(' '),
        exit_code: timedOut ? 124 : (code ?? 1),
        duration_ms: Date.now() - start,
        timed_out: timedOut,
        stdout,
      })
    })
  })
}
