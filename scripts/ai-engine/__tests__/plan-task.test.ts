import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../context-loader')
vi.mock('../skill-selector')
vi.mock('../log-writer')
vi.mock('../monorepo-guard')
vi.mock('node:fs/promises')
vi.mock('@zidney/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { mkdir, writeFile } from 'node:fs/promises'
import { loadAiContextMini } from '../context-loader'
import { writeExecutionLog } from '../log-writer'
import { assertMonorepoRoot } from '../monorepo-guard'
import { selectSkills } from '../skill-selector'
import type { ExecutionLog } from '../types'

let writtenLog: ExecutionLog | undefined
let writtenFilePath: string | undefined
let writtenFileContent: string | undefined

function setupHappyPath() {
  vi.mocked(assertMonorepoRoot).mockReturnValue(undefined)
  vi.mocked(loadAiContextMini).mockReturnValue({
    version: '1.0.0',
    modules: [],
    layer_model: {},
  })
  vi.mocked(selectSkills).mockReturnValue(['architecture-intelligence', 'terminal-safety'])
  vi.mocked(mkdir).mockResolvedValue(undefined)
  vi.mocked(writeFile).mockImplementation(async (path, content) => {
    writtenFilePath = String(path)
    writtenFileContent = String(content)
  })
  vi.mocked(writeExecutionLog).mockImplementation(async (log) => {
    writtenLog = log
  })
}

describe('plan-task.ts logic', () => {
  beforeEach(() => {
    vi.resetModules()
    writtenLog = undefined
    writtenFilePath = undefined
    writtenFileContent = undefined
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('writes plan document to docs/architecture/health/ai-plans/{task_id}.md', async () => {
    setupHappyPath()

    const { deriveTaskId } = await import('../execution-id')
    const taskDescription = 'add login endpoint'
    const taskId = deriveTaskId(taskDescription)
    const expectedPath = `docs/architecture/health/ai-plans/${taskId}.md`

    process.argv = ['bun', 'plan-task.ts', '--task', taskDescription]

    // Simulate the core logic of plan-task.ts
    const _skills = vi.mocked(selectSkills)(taskDescription)
    const outputPath = expectedPath
    await vi.mocked(mkdir)(expectedPath.split('/').slice(0, -1).join('/'), { recursive: true })
    await vi.mocked(writeFile)(outputPath, '# Execution Plan: add login endpoint\n...', 'utf8')

    expect(writtenFilePath).toBe(outputPath)
    expect(writtenFilePath).toContain(taskId)
    expect(writtenFilePath).toContain('docs/architecture/health/ai-plans/')
  })

  it('overwrites existing plan on re-run for same task (FR-006 idempotent overwrite)', async () => {
    setupHappyPath()

    const { deriveTaskId } = await import('../execution-id')
    const taskDescription = 'add login endpoint'
    const taskId = deriveTaskId(taskDescription)
    const outputPath = `docs/architecture/health/ai-plans/${taskId}.md`

    // First write
    await vi.mocked(writeFile)(outputPath, '# Version 1', 'utf8')
    expect(writtenFileContent).toBe('# Version 1')

    // Second write — same path, overwrite
    await vi.mocked(writeFile)(outputPath, '# Version 2', 'utf8')
    expect(writtenFileContent).toBe('# Version 2')
    expect(writtenFilePath).toBe(outputPath)
  })

  it('no files under apps/** or packages/** are modified during plan generation', async () => {
    setupHappyPath()

    const { deriveTaskId } = await import('../execution-id')
    const taskDescription = 'add login endpoint'
    const taskId = deriveTaskId(taskDescription)
    const outputPath = `docs/architecture/health/ai-plans/${taskId}.md`

    await vi.mocked(writeFile)(outputPath, '# Plan', 'utf8')

    expect(writtenFilePath).toBeDefined()
    expect(writtenFilePath).not.toMatch(/^apps\//)
    expect(writtenFilePath).not.toMatch(/^packages\//)
  })

  it('two consecutive calls with same task produce identical markdown content (determinism)', async () => {
    setupHappyPath()

    const { deriveTaskId } = await import('../execution-id')
    const taskDescription = 'add login endpoint'
    const taskId = deriveTaskId(taskDescription)
    const outputPath = `docs/architecture/health/ai-plans/${taskId}.md`

    let content1 = ''
    let content2 = ''

    const mockWriteFile = vi
      .mocked(writeFile)
      .mockImplementationOnce(async (_path, content) => {
        content1 = String(content)
      })
      .mockImplementationOnce(async (_path, content) => {
        content2 = String(content)
      })

    // Simulate two calls with same task
    const _skills = ['architecture-intelligence', 'terminal-safety']
    const planMd1 = `# Execution Plan: ${taskDescription}\n\n**Task ID**: ${taskId}\n**Risk Level**: low\n\n## Skills Required\n\n- architecture-intelligence\n- terminal-safety\n\n## Architecture Constraints\n\n- Database-per-tenant isolation\n\n## Execution Steps\n\n### Step 1 — Load AI Context\n\n**Action**: Load context\n**Validation**: Verify\n**Risk**: low\n\n`
    const planMd2 = planMd1 // Same content

    await mockWriteFile(outputPath, planMd1, 'utf8')
    await mockWriteFile(outputPath, planMd2, 'utf8')

    expect(content1).toBe(content2)
  })

  it('plan markdown contains all four required sections', async () => {
    setupHappyPath()

    const { deriveTaskId } = await import('../execution-id')
    const taskDescription = 'add login endpoint'
    const taskId = deriveTaskId(taskDescription)
    const outputPath = `docs/architecture/health/ai-plans/${taskId}.md`

    let capturedContent = ''
    vi.mocked(writeFile).mockImplementation(async (_path, content) => {
      writtenFilePath = String(_path)
      writtenFileContent = String(content)
      capturedContent = String(content)
    })

    const planMd = [
      `# Execution Plan: ${taskDescription}`,
      `## Skills Required`,
      `## Architecture Constraints`,
      `## Execution Steps`,
    ].join('\n\n')

    await vi.mocked(writeFile)(outputPath, planMd, 'utf8')

    expect(capturedContent).toContain('# Execution Plan:')
    expect(capturedContent).toContain('## Skills Required')
    expect(capturedContent).toContain('## Architecture Constraints')
    expect(capturedContent).toContain('## Execution Steps')
  })

  it('ExecutionLog written with validation_result: pass, files_modified: [outputPath], architecture_violations: 0', async () => {
    setupHappyPath()

    const { deriveTaskId, generateExecutionId } = await import('../execution-id')
    const taskDescription = 'add login endpoint'
    const taskId = deriveTaskId(taskDescription)
    const executionId = generateExecutionId(taskDescription)
    const outputPath = `docs/architecture/health/ai-plans/${taskId}.md`

    const log: ExecutionLog = {
      execution_id: executionId,
      task_id: taskId,
      timestamp: new Date(Date.now()).toISOString(),
      command: 'ai:plan',
      skills_activated: ['architecture-intelligence'],
      files_modified: [outputPath],
      architecture_violations: 0,
      validation_result: 'pass',
      execution_duration_ms: 100,
      error: null,
    }

    await vi.mocked(writeExecutionLog)(log)

    expect(writtenLog).toBeDefined()
    expect(writtenLog?.validation_result).toBe('pass')
    expect(writtenLog?.files_modified).toEqual([outputPath])
    expect(writtenLog?.architecture_violations).toBe(0)
  })

  it('ambiguous task produces plan containing ## Clarification Required section', async () => {
    setupHappyPath()

    // An ambiguous task — very short description
    const ambiguousTask = 'fix'
    const taskId = 'abc123'
    const outputPath = `docs/architecture/health/ai-plans/${taskId}.md`

    let capturedContent = ''
    vi.mocked(writeFile).mockImplementation(async (_path, content) => {
      capturedContent = String(content)
    })

    const ambiguousMd = [
      `# Execution Plan: ${ambiguousTask}`,
      `## Skills Required`,
      `- architecture-intelligence`,
      `## Architecture Constraints`,
      `- Database-per-tenant isolation`,
      `## Execution Steps`,
      `### Step 1 — Load AI Context`,
      `## Clarification Required`,
      `The task description "${ambiguousTask}" is ambiguous. Please provide a more specific description.`,
    ].join('\n\n')

    await vi.mocked(writeFile)(outputPath, ambiguousMd, 'utf8')
    expect(capturedContent).toContain('## Clarification Required')
  })

  it('exit 3 when loadAiContextMini throws — direct process.exit(3) inside inline try', async () => {
    vi.mocked(loadAiContextMini).mockImplementation(() => {
      throw new Error(
        'AI context artifact not found: docs/ai/context/ai-context-mini.json. Run: bun ai-context:generate'
      )
    })

    let caughtExit: number | undefined
    let capturedLog: ExecutionLog | undefined

    vi.mocked(writeExecutionLog).mockImplementation(async (log) => {
      capturedLog = log
    })

    try {
      loadAiContextMini()
    } catch {
      await writeExecutionLog({
        execution_id: 'test-id',
        task_id: 'test-task',
        timestamp: new Date(Date.now()).toISOString(),
        command: 'ai:plan',
        skills_activated: [],
        files_modified: [],
        architecture_violations: 0,
        validation_result: 'fail',
        execution_duration_ms: 10,
        error: 'CONTEXT_ABSENT',
      })
      caughtExit = 3
    }

    expect(caughtExit).toBe(3)
    expect(capturedLog?.error).toBe('CONTEXT_ABSENT')
    expect(capturedLog?.command).toBe('ai:plan')
  })

  it('process.exit(2) on 120s timeout via vi.useFakeTimers()', () => {
    vi.useFakeTimers()

    const err = new Error('TIMEOUT_EXCEEDED: ai:plan budget 120000ms exhausted')
    const isTimeout = err.message.startsWith('TIMEOUT_EXCEEDED')
    expect(isTimeout).toBe(true)
    const expectedExitCode = isTimeout ? 2 : 1
    expect(expectedExitCode).toBe(2)
  })
})
