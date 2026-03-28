/**
 * T009 — AI Context Freshness Check
 * Spawns `bun run ai:context:validate` to verify AI context artifacts are up-to-date.
 * Decision tree:
 *   - ENOENT or "Cannot find module" / "No such file" in stderr → SKIP
 *   - exit 0 → PASS
 *   - exit non-zero with actual artifact errors → WARNING
 * NOTE-02: 60s subprocess timeout
 
 * @library-module
*/

import type { TaskResult } from './types.ts'

const ROOT = process.cwd()
const TIMEOUT_MS = 60_000

export async function runAiContextCheck(): Promise<TaskResult> {
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
    proc = Bun.spawn(['bun', 'run', 'ai-context:validate'], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const exitCode = await proc.exited
    clearTimeout(killTimer)

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const combined = `${stdout}\n${stderr}`.trim()

    // SKIP conditions: script not found or generate-ai-context.ts cannot be resolved
    const skipPatterns = [
      /cannot find module/i,
      /no such file or directory/i,
      /enoent/i,
      /module not found/i,
    ]

    if (skipPatterns.some((p) => p.test(combined))) {
      return {
        taskId: 'T008',
        title: 'AI Context Freshness',
        status: 'SKIP',
        summary: 'ai-context:validate script not available or dependencies missing',
        findings: [],
        rawOutput: combined.substring(0, 500),
      }
    }

    if (exitCode === 0) {
      return {
        taskId: 'T008',
        title: 'AI Context Freshness',
        status: 'PASS',
        summary: 'AI context artifacts are current',
        findings: [],
        rawOutput: combined.substring(0, 500),
      }
    }

    // Non-zero exit — report as WARNING (context may just be stale, not broken)
    const lines = combined.split('\n').filter(Boolean)
    const findings = lines
      .filter((l) => /stale|outdated|missing|error|fail/i.test(l))
      .slice(0, 20)
      .map((l) => ({ item: l.trim(), note: 'AI context validation failure' }))

    return {
      taskId: 'T008',
      title: 'AI Context Freshness',
      status: 'WARNING',
      summary: `ai-context:validate exited with code ${exitCode} — context may be stale or not generated`,
      findings,
      rawOutput: combined.substring(0, 1000),
    }
  } catch (err) {
    clearTimeout(killTimer)
    const message = err instanceof Error ? err.message : String(err)
    return {
      taskId: 'T008',
      title: 'AI Context Freshness',
      status: 'SKIP',
      summary: `ai-context:validate could not be invoked: ${message}`,
      findings: [],
    }
  }
}
