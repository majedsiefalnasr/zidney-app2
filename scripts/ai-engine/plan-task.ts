/** @library-module */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createLogger } from '@zidney/logger'
import { loadAiContextMini } from './context-loader'
import { deriveTaskId, generateExecutionId } from './execution-id'
import { writeExecutionLog } from './log-writer'
import { assertMonorepoRoot } from './monorepo-guard'
import { selectSkills } from './skill-selector'
import type { ExecutionLog, ExecutionPlan, PlanStep } from './types'

const logger = createLogger('ai-engine:plan-task')

const DEFAULT_PLAN_DIR = 'docs/architecture/health/ai-plans'

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
  taskDescription: string
  taskId: string | null
  outputPath: string | null
} {
  const argv = process.argv.slice(2)
  let taskDescription = ''
  let taskId: string | null = null
  let outputPath: string | null = null

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--task' && argv[i + 1]) {
      taskDescription = argv[i + 1]
      i++
    } else if (argv[i] === '--task-id' && argv[i + 1]) {
      taskId = argv[i + 1]
      i++
    } else if (argv[i] === '--output' && argv[i + 1]) {
      outputPath = argv[i + 1]
      i++
    }
  }

  return { taskDescription, taskId, outputPath }
}

/**
 * Determine risk level from task description (deterministic).
 */
function determineRiskLevel(taskDescription: string): 'low' | 'medium' | 'high' {
  const desc = taskDescription.toLowerCase()
  if (/migration|database|schema|drop|delete|production/.test(desc)) return 'high'
  if (/refactor|rename|extract|split|move|auth|security/.test(desc)) return 'medium'
  return 'low'
}

/**
 * Determine if task is ambiguous (deterministic).
 * Ambiguous if description is fewer than 10 chars or contains only generic words.
 */
function isAmbiguousTask(taskDescription: string): boolean {
  if (taskDescription.trim().length < 10) return true
  if (/^(task|work|do it|implement|update|fix|change|improve)$/i.test(taskDescription.trim()))
    return true
  return false
}

/**
 * Compose a deterministic ExecutionPlan for the given task.
 * No random values, no wall-clock timestamps in plan content.
 */
function composePlan(
  taskDescription: string,
  taskId: string,
  executionId: string,
  skillsRequired: string[],
  outputPath: string
): ExecutionPlan {
  const riskLevel = determineRiskLevel(taskDescription)

  const steps: PlanStep[] = [
    {
      step: 1,
      description: 'Load AI Context',
      action: 'Load docs/ai/context/ai-context-mini.json to establish architecture awareness',
      validation: 'Verify artifact exists and contains valid JSON',
      risk: 'low',
    },
    {
      step: 2,
      description: 'Select Skills',
      action: `Activate skills: ${skillsRequired.join(', ')}`,
      validation: 'Verify all selected skill directories exist under .agents/skills/',
      risk: 'low',
    },
    {
      step: 3,
      description: 'Validate Architecture',
      action: 'Run bun arch:guard --ci to verify no pre-existing violations',
      validation: 'arch:guard exits 0',
      risk: riskLevel,
    },
    {
      step: 4,
      description: 'Execute Task',
      action: `Implement: ${taskDescription}`,
      validation: 'All modified files pass type-check and lint',
      risk: riskLevel,
    },
    {
      step: 5,
      description: 'Post-Execution Validation',
      action: 'Run bun ai:validate to confirm architecture compliance after changes',
      validation: 'ai:validate exits 0 with validation_result: pass',
      risk: 'low',
    },
  ]

  const architectureConstraints = [
    'Database-per-tenant isolation',
    'License middleware mandatory for workspace routes',
    'Import boundary: scripts/ai-engine/ → @zidney/logger, stdlib only',
    'All timestamps must use new Date(Date.now()).toISOString()',
    'No console.log, console.error, or console.warn in scripts',
    'Atomic writes: tmp-then-rename for all execution log artifacts',
    'Exit codes: 0=pass, 1=fail, 2=timeout, 3=missing, 4=stale',
  ]

  return {
    execution_id: executionId,
    task_id: taskId,
    timestamp: new Date(Date.now()).toISOString(),
    task_description: taskDescription,
    skills_required: skillsRequired,
    steps,
    architecture_constraints: architectureConstraints,
    risk_level: riskLevel,
    output_path: outputPath,
  }
}

/**
 * Generate deterministic markdown for the execution plan.
 * No wall-clock timestamps in plan document content (FR-006).
 */
function renderPlanMarkdown(plan: ExecutionPlan): string {
  const ambiguous = isAmbiguousTask(plan.task_description)

  let md = `# Execution Plan: ${plan.task_description}\n\n`
  md += `**Task ID**: ${plan.task_id}\n`
  md += `**Risk Level**: ${plan.risk_level}\n\n`

  md += `## Skills Required\n\n`
  for (const skill of plan.skills_required) {
    md += `- ${skill}\n`
  }
  md += '\n'

  md += `## Architecture Constraints\n\n`
  for (const constraint of plan.architecture_constraints) {
    md += `- ${constraint}\n`
  }
  md += '\n'

  md += `## Execution Steps\n\n`
  for (const step of plan.steps) {
    md += `### Step ${step.step} — ${step.description}\n\n`
    md += `**Action**: ${step.action}\n`
    md += `**Validation**: ${step.validation}\n`
    md += `**Risk**: ${step.risk}\n\n`
  }

  if (ambiguous) {
    md += `## Clarification Required\n\n`
    md += `The task description "${plan.task_description}" is ambiguous. `
    md += `Please provide a more specific description that includes:\n\n`
    md += `- The target module or file(s) to modify\n`
    md += `- The expected behavior change\n`
    md += `- Any affected dependencies or services\n`
  }

  return md
}

async function main(): Promise<void> {
  const start = Date.now()
  const { taskDescription, taskId: overrideTaskId, outputPath: overrideOutputPath } = parseArgs()

  if (!taskDescription) {
    process.stderr.write(
      `${JSON.stringify({ error: 'MISSING_TASK', message: '--task argument is required' })}\n`
    )
    process.exit(1)
  }

  assertMonorepoRoot()

  const taskId = overrideTaskId ?? deriveTaskId(taskDescription)
  const executionId = generateExecutionId(taskDescription)
  const outputPath = overrideOutputPath ?? `${DEFAULT_PLAN_DIR}/${taskId}.md`

  logger.info('Starting ai:plan orchestration', { executionId, taskId, outputPath })

  // Load AI context — exit 3 DIRECTLY if absent (inline try/catch, NOT re-thrown to outer catch)
  let skillsRequired: string[] = []

  try {
    loadAiContextMini()
  } catch (_err) {
    const duration = Date.now() - start
    await writeExecutionLog({
      execution_id: executionId,
      task_id: taskId,
      timestamp: new Date(Date.now()).toISOString(),
      command: 'ai:plan',
      skills_activated: [],
      files_modified: [],
      architecture_violations: 0,
      validation_result: 'fail',
      execution_duration_ms: duration,
      error: 'CONTEXT_ABSENT',
    })
    process.exit(3)
  }

  skillsRequired = selectSkills(taskDescription)

  const plan = composePlan(taskDescription, taskId, executionId, skillsRequired, outputPath)
  const markdown = renderPlanMarkdown(plan)

  // Write plan file
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, markdown, 'utf8')

  const duration = Date.now() - start
  const log: ExecutionLog = {
    execution_id: executionId,
    task_id: taskId,
    timestamp: new Date(Date.now()).toISOString(),
    command: 'ai:plan',
    skills_activated: skillsRequired,
    files_modified: [outputPath],
    architecture_violations: 0,
    validation_result: 'pass',
    execution_duration_ms: duration,
    error: null,
  }

  await writeExecutionLog(log)
  process.exit(0)
}

let isTimeout = false

withTimeout(main, 120_000, 'ai:plan').catch(async (err: Error) => {
  isTimeout = err.message.startsWith('TIMEOUT_EXCEEDED')
  try {
    await writeExecutionLog({
      execution_id: generateExecutionId('ai:plan-timeout'),
      task_id: deriveTaskId('ai:plan'),
      timestamp: new Date(Date.now()).toISOString(),
      command: 'ai:plan',
      skills_activated: [],
      files_modified: [],
      architecture_violations: 0,
      validation_result: 'fail',
      execution_duration_ms: 120_000,
      error: err.message,
    })
  } catch {
    // log write failed — still exit with correct code
  }
  process.exit(isTimeout ? 2 : 1)
})
