import { existsSync, readFileSync } from 'node:fs'
import { createLogger } from '@zidney/logger'
import { deriveTaskId, generateExecutionId } from './execution-id'
import { writeExecutionLog } from './log-writer'
import { assertMonorepoRoot } from './monorepo-guard'
import { runGovernanceTool } from './process-runner'
import { checkBrainStatus } from './stale-check'
import type { ExecutionLog } from './types'

const logger = createLogger('ai-engine:validate-execution')

const ARCH_HEALTH_JSON = 'docs/architecture/health/architecture-health.json'

/** Private timeout helper. */
function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let fired = false
    const timer = setTimeout(() => {
      fired = true
      reject(new Error(`TIMEOUT_EXCEEDED: ${label} budget ${timeoutMs}ms exhausted`))
    }, timeoutMs)

    fn()
      .then((result) => {
        if (!fired) {
          clearTimeout(timer)
          resolve(result)
        }
      })
      .catch((err) => {
        if (!fired) {
          clearTimeout(timer)
          reject(err)
        }
      })
  })
}

function parseArgs(): {
  ci: boolean
  taskDescription: string
  executionIdOverride: string | null
} {
  const argv = process.argv.slice(2)
  let ci = Boolean(process.env.CI)
  let taskDescription = 'validate'
  let executionIdOverride: string | null = null

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ci') {
      ci = true
    } else if (argv[i] === '--task' && argv[i + 1]) {
      taskDescription = argv[i + 1]
      i++
    } else if (argv[i] === '--execution-id' && argv[i + 1]) {
      executionIdOverride = argv[i + 1]
      i++
    }
  }

  return { ci, taskDescription, executionIdOverride }
}

async function main(): Promise<void> {
  const start = Date.now()
  const { ci, taskDescription, executionIdOverride } = parseArgs()
  const timeoutMs = ci ? 120_000 : 90_000

  assertMonorepoRoot()

  const executionId = executionIdOverride ?? generateExecutionId(taskDescription)
  const taskId = deriveTaskId(taskDescription)

  logger.info('Starting ai:validate orchestration', { executionId, taskId, ci, timeoutMs })

  // Check brain status — direct exits inside try block (NOT thrown)
  const brainCheck = checkBrainStatus()
  if (brainCheck.status === 'absent') {
    const duration = Date.now() - start
    await writeExecutionLog({
      execution_id: executionId,
      task_id: taskId,
      timestamp: new Date(Date.now()).toISOString(),
      command: 'ai:validate',
      skills_activated: [],
      files_modified: [],
      architecture_violations: 0,
      validation_result: 'fail',
      execution_duration_ms: duration,
      error: 'BRAIN_ABSENT',
    })
    process.exit(3)
  }
  if (brainCheck.status === 'stale') {
    const duration = Date.now() - start
    await writeExecutionLog({
      execution_id: executionId,
      task_id: taskId,
      timestamp: new Date(Date.now()).toISOString(),
      command: 'ai:validate',
      skills_activated: [],
      files_modified: [],
      architecture_violations: 0,
      validation_result: 'fail',
      execution_duration_ms: duration,
      error: 'BRAIN_STALE',
    })
    process.exit(4)
  }

  // Run governance tools
  const archGuard = await runGovernanceTool({
    command: 'arch:guard',
    args: ['--ci'],
    timeoutMs,
  })

  const typeSafetyGuard = await runGovernanceTool({
    command: 'type-safety-guard',
    args: ['--json', '--no-exit-error'],
    timeoutMs,
  })

  const archHealth = await runGovernanceTool({
    command: 'arch:health:ci',
    args: [],
    timeoutMs,
  })

  // Sub-command timeout propagation — throw to outer catch
  if (archGuard.timed_out || typeSafetyGuard.timed_out || archHealth.timed_out) {
    throw new Error('TIMEOUT_EXCEEDED: sub-command budget exhausted')
  }

  // Determine violation count
  let archViolations = 0
  if (archGuard.exit_code !== 0) {
    archViolations += archGuard.exit_code > 0 ? archGuard.exit_code : 1
  }
  if (archHealth.exit_code === 0) {
    if (existsSync(ARCH_HEALTH_JSON)) {
      try {
        const healthData = JSON.parse(readFileSync(ARCH_HEALTH_JSON, 'utf8')) as {
          total_violations?: number
        }
        archViolations += healthData.total_violations ?? 0
      } catch {
        // malformed health file — treat as 0
      }
    }
    // file absent after exit 0 → 0 violations (sentinel)
  } else {
    archViolations += -1 // sentinel: tool failed
  }

  // Determine overall result
  const anyFailed =
    archGuard.exit_code !== 0 || typeSafetyGuard.exit_code !== 0 || archHealth.exit_code !== 0

  const overall = !anyFailed && brainCheck.status === 'present_fresh' ? 'pass' : 'fail'

  const duration = Date.now() - start

  let errorMsg: string | null = null
  if (overall === 'fail') {
    if (archGuard.exit_code !== 0) errorMsg = `arch:guard exited with code ${archGuard.exit_code}`
    else if (typeSafetyGuard.exit_code !== 0)
      errorMsg = `type-safety-guard exited with code ${typeSafetyGuard.exit_code}`
    else if (archHealth.exit_code !== 0)
      errorMsg = `arch:health exited with code ${archHealth.exit_code}`
  }

  const log: ExecutionLog = {
    execution_id: executionId,
    task_id: taskId,
    timestamp: new Date(Date.now()).toISOString(),
    command: 'ai:validate',
    skills_activated: [],
    files_modified: [],
    architecture_violations: Math.max(0, archViolations),
    validation_result: overall,
    execution_duration_ms: duration,
    error: errorMsg,
  }

  await writeExecutionLog(log)
  process.exit(overall === 'pass' ? 0 : 1)
}

let isTimeout = false

withTimeout(main, process.argv.includes('--ci') ? 120_000 : 90_000, 'ai:validate').catch(
  async (err: Error) => {
    isTimeout = err.message.startsWith('TIMEOUT_EXCEEDED')
    try {
      await writeExecutionLog({
        execution_id: generateExecutionId('ai:validate-timeout'),
        task_id: deriveTaskId('validate'),
        timestamp: new Date(Date.now()).toISOString(),
        command: 'ai:validate',
        skills_activated: [],
        files_modified: [],
        architecture_violations: 0,
        validation_result: 'fail',
        execution_duration_ms: process.argv.includes('--ci') ? 120_000 : 90_000,
        error: err.message,
      })
    } catch {
      // log write failed — still exit with correct code
    }
    process.exit(isTimeout ? 2 : 1)
  }
)
