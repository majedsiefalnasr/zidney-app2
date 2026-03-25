import { execSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// --- Exit codes ---
// 0 = all rules passed or only warning-severity violations
// 1 = at least one error-severity rule violation
// 2 = infrastructure/runner failure (import error, stale context, uncaught exception)

const correlationId = `fix03-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const workspaceRoot = resolve(process.cwd())
const isChanged = process.argv.includes('--changed')
const mode = isChanged ? 'changed' : 'full'

let rules: import('./types').PolicyRule[]
try {
  const registry = await import('./registry')
  rules = registry.rules
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write(
    `${JSON.stringify({
      success: false,
      data: null,
      error: { code: 'POLICY_ENGINE_IMPORT_FAILURE', message: msg },
    })}\n`
  )
  process.exit(2)
}

// --- GitNexus context for --changed mode ---
let changedFiles: string[] = []
let impactedModules: string[] = []

if (isChanged) {
  const ctxPath = join(workspaceRoot, 'docs/ai/context/gitnexus-context.json')
  if (!existsSync(ctxPath)) {
    process.stderr.write(
      `${JSON.stringify({
        success: false,
        data: null,
        error: {
          code: 'GITNEXUS_CONTEXT_MISSING',
          message: `GitNexus context not found at ${ctxPath}`,
        },
      })}\n`
    )
    process.exit(2)
  }
  try {
    const stat = statSync(ctxPath)
    const headSha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
    const headTs =
      Number(execSync(`git log -1 --format=%ct ${headSha}`, { encoding: 'utf-8' }).trim()) * 1000
    // Allow up to 5 minutes time delta between file mtime and commit timestamp
    // (normal delay between file write and commit record)
    const TIME_BUFFER_MS = 5 * 60 * 1000
    if (stat.mtimeMs < headTs - TIME_BUFFER_MS) {
      process.stderr.write(
        `${JSON.stringify({
          success: false,
          data: null,
          error: {
            code: 'GITNEXUS_CONTEXT_STALE',
            message:
              'gitnexus-context.json is older than latest git commit. Run: bun run arch:gitnexus:context',
          },
        })}\n`
      )
      process.exit(2)
    }
    const ctx = JSON.parse(readFileSync(ctxPath, 'utf-8'))
    changedFiles = Array.isArray(ctx.changedFiles) ? ctx.changedFiles : []
    impactedModules = Array.isArray(ctx.impactedModules) ? ctx.impactedModules : []
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(
      `${JSON.stringify({
        success: false,
        data: null,
        error: { code: 'GITNEXUS_CONTEXT_READ_ERROR', message: msg },
      })}\n`
    )
    process.exit(2)
  }
  // No-op when no changed files
  if (changedFiles.length === 0) {
    process.stdout.write(
      `${JSON.stringify({
        success: true,
        data: {
          correlationId,
          mode,
          summary: 'No changed files detected — policy check skipped (no-op)',
        },
        error: null,
      })}\n`
    )
    process.exit(0)
  }
}

const context: import('./types').PolicyContext = {
  mode,
  changedFiles,
  impactedModules,
  workspaceRoot,
  correlationId,
  autoFixedPaths: [],
}

const results: import('./types').PolicyResult[] = []
let infraHardFail = false

for (const rule of rules) {
  let result: import('./types').PolicyResult
  try {
    result = await rule.run(context)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result = {
      ruleId: rule.id,
      domain: rule.domain,
      passed: false,
      severity: 'error',
      messages: [`Uncaught exception in rule: ${msg}`],
      violatingPaths: [],
    }
  }
  results.push(result)
  process.stdout.write(`${JSON.stringify({ correlationId, ...result })}\n`)
  // ENVIRONMENT_READY failure = hard stop; no subsequent rules run
  if (rule.id === 'RULE_FIX_03_ENVIRONMENT_READY' && !result.passed) {
    infraHardFail = true
    break
  }
}

const hasError = results.some((r) => !r.passed && r.severity === 'error')
const summary = {
  correlationId,
  mode,
  total: results.length,
  passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length,
  infraHardFail,
}

if (hasError || infraHardFail) {
  process.stdout.write(
    `${JSON.stringify({
      success: false,
      data: { summary },
      error: { code: 'POLICY_VIOLATIONS_DETECTED', message: 'One or more policy rules failed' },
    })}\n`
  )
  process.exit(1)
} else {
  process.stdout.write(`${JSON.stringify({ success: true, data: { summary }, error: null })}\n`)
  process.exit(0)
}
