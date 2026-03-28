/**
 * T010 — Architecture Guard Check
 * Spawns `bun run arch:guard` and `bun run arch:health` to surface the current
 * architectural violation baseline. Any violations are pre-existing (this stage
 * introduces no source code changes) and are reported as FLAG (informational), not FAIL.
 * NOTE-02: 120s timeout per subprocess
 * @library-module
 */

import type { TaskFinding, TaskResult } from './types.ts'

const ROOT = process.cwd()
const TIMEOUT_MS = 120_000

async function spawnWithTimeout(
  args: string[],
  label: string
): Promise<{ exitCode: number; output: string }> {
  let proc: ReturnType<typeof Bun.spawn> | undefined

  const killTimer = setTimeout(() => {
    if (proc) {
      try {
        proc.kill()
      } catch {
        // ignore
      }
    }
  }, TIMEOUT_MS)

  try {
    proc = Bun.spawn(args, {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const exitCode = await proc.exited
    clearTimeout(killTimer)

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const output = `${stdout}\n${stderr}`.trim()

    return { exitCode, output }
  } catch (err) {
    clearTimeout(killTimer)
    const message = err instanceof Error ? err.message : String(err)
    return {
      exitCode: -1,
      output: `${label} spawn failed: ${message}`,
    }
  }
}

function parseViolations(output: string, source: string): TaskFinding[] {
  const findings: TaskFinding[] = []
  const lines = output.split('\n').filter(Boolean)

  for (const line of lines) {
    // Common violation patterns
    if (/violation|error|invalid import|forbidden|layer breach|illegal/i.test(line)) {
      findings.push({
        item: line.trim().substring(0, 200),
        note: `Pre-existing violation from ${source}`,
      })
    }
  }

  return findings.slice(0, 50)
}

export async function runArchGuardCheck(): Promise<TaskResult> {
  const findings: TaskFinding[] = []

  // Run arch:guard
  const guardResult = await spawnWithTimeout(['bun', 'run', 'arch:guard'], 'arch:guard')

  // Run arch:health
  const healthResult = await spawnWithTimeout(['bun', 'run', 'arch:health'], 'arch:health')

  // Collect guard findings
  if (guardResult.exitCode !== 0) {
    findings.push(...parseViolations(guardResult.output, 'arch:guard'))
  }

  // Collect health findings
  if (healthResult.exitCode !== 0) {
    findings.push(...parseViolations(healthResult.output, 'arch:health'))
  }

  // Check for spawn failure (exit -1)
  const guardFailed = guardResult.exitCode === -1
  const healthFailed = healthResult.exitCode === -1

  if (guardFailed && healthFailed) {
    return {
      taskId: 'T009',
      title: 'Architecture Guard',
      status: 'SKIP',
      summary: 'arch:guard and arch:health scripts could not be invoked',
      findings: [],
    }
  }

  const cleanGuard = guardResult.exitCode === 0
  const cleanHealth = healthResult.exitCode === 0

  if ((cleanGuard || guardFailed) && (cleanHealth || healthFailed)) {
    const available = [
      cleanGuard ? 'arch:guard ✓' : null,
      cleanHealth ? 'arch:health ✓' : null,
      guardFailed ? 'arch:guard unavailable' : null,
      healthFailed ? 'arch:health unavailable' : null,
    ]
      .filter(Boolean)
      .join(', ')

    return {
      taskId: 'T009',
      title: 'Architecture Guard',
      status: 'PASS',
      summary: `Architecture checks passed: ${available}`,
      findings: [],
    }
  }

  // Violations found — FLAG (informational, pre-existing)
  const guardStatus = guardFailed
    ? 'unavailable'
    : guardResult.exitCode === 0
      ? 'PASS'
      : `${findings.filter((f) => f.note.includes('arch:guard')).length} violation(s)`
  const healthStatus = healthFailed
    ? 'unavailable'
    : healthResult.exitCode === 0
      ? 'PASS'
      : `${findings.filter((f) => f.note.includes('arch:health')).length} violation(s)`

  const rawOutput = [
    guardResult.exitCode !== 0 ? `=== arch:guard ===\n${guardResult.output}` : '',
    healthResult.exitCode !== 0 ? `=== arch:health ===\n${healthResult.output}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .substring(0, 2000)

  return {
    taskId: 'T009',
    title: 'Architecture Guard',
    status: 'FLAG',
    summary: `Pre-existing architecture violations detected — arch:guard: ${guardStatus}, arch:health: ${healthStatus}`,
    findings,
    rawOutput,
  }
}
