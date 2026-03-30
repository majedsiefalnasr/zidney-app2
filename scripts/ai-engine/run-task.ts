#!/usr/bin/env bun
/**
 * @script ai:run
 * @domain ai
 * @category dev
 * @description Execute AI task orchestration with governance validation,
 *   execution logging, and deterministic exit codes.
 * @usage bun run ai:run --task "<task-description>"
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger, exit, log } from '../utils/logger'
import { loadAiContextMini } from './context-loader'
import { deriveTaskId, generateExecutionId } from './execution-id'
import { writeExecutionLog } from './log-writer'
import { assertMonorepoRoot } from './monorepo-guard'
import { runGovernanceTool } from './process-runner'
import { selectSkills } from './skill-selector'
import { checkBrainStatus } from './stale-check'
import type { ExecutionLog } from './types'

const logger = createLogger('ai-engine:run-task')
log.setScript('ai:run')

/** Private timeout helper — rejects with TIMEOUT_EXCEEDED error and sets isTimeout flag. */
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

function parseArgs(): { taskDescription: string; taskId: string | null; dryRun: boolean } {
  const argv = process.argv.slice(2)
  let taskDescription = ''
  let taskId: string | null = null
  let dryRun = false

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--task' && argv[i + 1]) {
      taskDescription = argv[i + 1]
      i++
    } else if (argv[i] === '--task-id' && argv[i + 1]) {
      taskId = argv[i + 1]
      i++
    } else if (argv[i] === '--dry-run') {
      dryRun = true
    }
  }

  return { taskDescription, taskId, dryRun }
}

async function main(): Promise<void> {
  const start = Date.now()
  const { taskDescription, taskId: overrideTaskId, dryRun } = parseArgs()
  log.header('AI RUN', 'Execute the AI task orchestration flow')

  if (!taskDescription) {
    log.error('--task argument is required')
    exit(1)
  }

  assertMonorepoRoot()

  const executionId = generateExecutionId(taskDescription)
  const taskId = overrideTaskId ?? deriveTaskId(taskDescription)

  logger.info('Starting ai:run orchestration', { executionId, taskId, dryRun })

  // Load AI context — exit 3 DIRECTLY if absent (NOT thrown to outer catch)
  let skillsActivated: string[] = []

  try {
    loadAiContextMini()
  } catch (_err) {
    const duration = Date.now() - start
    await writeExecutionLog({
      execution_id: executionId,
      task_id: taskId,
      timestamp: new Date(Date.now()).toISOString(),
      command: 'ai:run',
      skills_activated: [],
      files_modified: [],
      architecture_violations: 0,
      validation_result: 'fail',
      execution_duration_ms: duration,
      error: 'CONTEXT_ABSENT',
    })
    exit(3)
  }

  skillsActivated = selectSkills(taskDescription)

  // Verify all selected skill directories exist — exit 3 DIRECTLY if missing
  const SKILLS_DIR = '.agents/skills'
  const missingSKills = skillsActivated.filter((s) => !existsSync(join(SKILLS_DIR, s)))
  if (missingSKills.length > 0) {
    const duration = Date.now() - start
    await writeExecutionLog({
      execution_id: executionId,
      task_id: taskId,
      timestamp: new Date(Date.now()).toISOString(),
      command: 'ai:run',
      skills_activated: skillsActivated,
      files_modified: [],
      architecture_violations: 0,
      validation_result: 'fail',
      execution_duration_ms: duration,
      error: `SKILL_DIR_ABSENT: ${missingSKills.join(', ')}`,
    })
    exit(3)
  }

  // Check brain status — direct exits inside try block (NOT thrown)
  const brainCheck = checkBrainStatus()
  if (brainCheck.status === 'absent') {
    const duration = Date.now() - start
    await writeExecutionLog({
      execution_id: executionId,
      task_id: taskId,
      timestamp: new Date(Date.now()).toISOString(),
      command: 'ai:run',
      skills_activated: skillsActivated,
      files_modified: [],
      architecture_violations: 0,
      validation_result: 'fail',
      execution_duration_ms: duration,
      error: 'BRAIN_ABSENT',
    })
    exit(3)
  }
  if (brainCheck.status === 'stale') {
    const duration = Date.now() - start
    await writeExecutionLog({
      execution_id: executionId,
      task_id: taskId,
      timestamp: new Date(Date.now()).toISOString(),
      command: 'ai:run',
      skills_activated: skillsActivated,
      files_modified: [],
      architecture_violations: 0,
      validation_result: 'fail',
      execution_duration_ms: duration,
      error: 'BRAIN_STALE',
    })
    exit(4)
  }

  // Dry run — skip execution, write pass log
  if (dryRun) {
    const duration = Date.now() - start
    await writeExecutionLog({
      execution_id: executionId,
      task_id: taskId,
      timestamp: new Date(Date.now()).toISOString(),
      command: 'ai:run',
      skills_activated: skillsActivated,
      files_modified: [],
      architecture_violations: 0,
      validation_result: 'pass',
      execution_duration_ms: duration,
      error: null,
    })
    log.result({ total: 1, passed: 1, failed: 0, message: 'Dry run complete' })
    exit(0)
  }

  // Run governance validation
  const timeoutMs = 300_000
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

  const archViolations = archGuard.exit_code !== 0 || archGuard.timed_out ? archGuard.exit_code : 0
  const validationResult =
    archGuard.exit_code === 0 &&
    !archGuard.timed_out &&
    typeSafetyGuard.exit_code === 0 &&
    !typeSafetyGuard.timed_out
      ? 'pass'
      : 'fail'

  const duration = Date.now() - start
  const executionLog: ExecutionLog = {
    execution_id: executionId,
    task_id: taskId,
    timestamp: new Date(Date.now()).toISOString(),
    command: 'ai:run',
    skills_activated: skillsActivated,
    files_modified: [],
    architecture_violations: archViolations,
    validation_result: validationResult,
    execution_duration_ms: duration,
    error:
      validationResult === 'fail' ? `arch:guard exited with code ${archGuard.exit_code}` : null,
  }

  await writeExecutionLog(executionLog)
  log.result({
    total: 1,
    passed: validationResult === 'pass' ? 1 : 0,
    failed: validationResult === 'pass' ? 0 : 1,
    message: validationResult === 'pass' ? 'AI run validation passed' : 'AI run validation failed',
  })
  exit(validationResult === 'pass' ? 0 : 1)
}

let isTimeout = false

withTimeout(main, 300_000, 'ai:run').catch(async (err: Error) => {
  isTimeout = err.message.startsWith('TIMEOUT_EXCEEDED')
  try {
    await writeExecutionLog({
      execution_id: generateExecutionId('ai:run-timeout'),
      task_id: deriveTaskId('ai:run'),
      timestamp: new Date(Date.now()).toISOString(),
      command: 'ai:run',
      skills_activated: [],
      files_modified: [],
      architecture_violations: 0,
      validation_result: 'fail',
      execution_duration_ms: 300_000,
      error: err.message,
    })
  } catch {
    // log write failed — still exit with correct code
  }
  log.error(err.message)
  exit(isTimeout ? 2 : 1)
})
