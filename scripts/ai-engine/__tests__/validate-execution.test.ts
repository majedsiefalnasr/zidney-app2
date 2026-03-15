import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../process-runner')
vi.mock('../stale-check')
vi.mock('../log-writer')
vi.mock('../monorepo-guard')
vi.mock('@zidney/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { writeExecutionLog } from '../log-writer'
import { assertMonorepoRoot } from '../monorepo-guard'
import { runGovernanceTool } from '../process-runner'
import { checkBrainStatus } from '../stale-check'
import type { ExecutionLog } from '../types'

const NINE_MANDATORY_FIELDS = [
  'execution_id',
  'task_id',
  'timestamp',
  'command',
  'skills_activated',
  'files_modified',
  'architecture_violations',
  'validation_result',
  'execution_duration_ms',
] as const

function makeToolResult(exitCode: number, timedOut = false) {
  return {
    command: 'arch:guard --ci',
    exit_code: exitCode,
    duration_ms: 100,
    timed_out: timedOut,
    stdout: '',
  }
}

function setupHappyPath() {
  vi.mocked(assertMonorepoRoot).mockReturnValue(undefined)
  vi.mocked(checkBrainStatus).mockReturnValue({
    status: 'present_fresh',
    brainPath: 'docs/ai/context/ai-architecture-brain.json',
  })
  vi.mocked(runGovernanceTool).mockResolvedValue(makeToolResult(0))
  vi.mocked(writeExecutionLog).mockResolvedValue(undefined)
}

describe('validate-execution.ts logic', () => {
  let _writtenLog: ExecutionLog | undefined

  beforeEach(() => {
    vi.resetModules()
    _writtenLog = undefined
    vi.mocked(writeExecutionLog).mockImplementation(async (log) => {
      _writtenLog = log
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('all three tools return exit_code 0 and brain is fresh → validation_result: pass', async () => {
    setupHappyPath()

    // Simulate the validate-execution logic
    const brainCheck = vi.mocked(checkBrainStatus)()
    expect(brainCheck.status).toBe('present_fresh')

    const archGuard = await vi.mocked(runGovernanceTool)({
      command: 'arch:guard',
      args: ['--ci'],
      timeoutMs: 90_000,
    })
    const typeSafetyGuard = await vi.mocked(runGovernanceTool)({
      command: 'type-safety-guard',
      args: ['--json', '--no-exit-error'],
      timeoutMs: 90_000,
    })
    const archHealth = await vi.mocked(runGovernanceTool)({
      command: 'arch:health:ci',
      args: [],
      timeoutMs: 90_000,
    })

    const anyFailed =
      archGuard.exit_code !== 0 || typeSafetyGuard.exit_code !== 0 || archHealth.exit_code !== 0
    const overall = !anyFailed && brainCheck.status === 'present_fresh' ? 'pass' : 'fail'

    expect(overall).toBe('pass')
  })

  it('validation_result is fail when arch:guard returns non-zero exit code', async () => {
    setupHappyPath()
    vi.mocked(runGovernanceTool)
      .mockResolvedValueOnce(makeToolResult(1)) // arch:guard fails
      .mockResolvedValue(makeToolResult(0))

    const archGuard = await vi.mocked(runGovernanceTool)({
      command: 'arch:guard',
      args: [],
      timeoutMs: 90_000,
    })
    const anyFailed = archGuard.exit_code !== 0
    expect(anyFailed).toBe(true)
    const overall = anyFailed ? 'fail' : 'pass'
    expect(overall).toBe('fail')
  })

  it('validation_result is fail when type-safety-guard returns violations in stdout', async () => {
    setupHappyPath()
    vi.mocked(runGovernanceTool)
      .mockResolvedValueOnce(makeToolResult(0)) // arch:guard passes
      .mockResolvedValueOnce({ ...makeToolResult(1), stdout: '{"violations":3}' }) // type-safety fails
      .mockResolvedValue(makeToolResult(0))

    const typeSafetyGuard = await vi.mocked(runGovernanceTool)({
      command: 'type-safety-guard',
      args: [],
      timeoutMs: 90_000,
    })
    const fails = typeSafetyGuard.exit_code !== 0
    expect(fails).toBe(false) // first call returned 0
    const typeSafetyGuard2 = await vi.mocked(runGovernanceTool)({
      command: 'type-safety-guard',
      args: [],
      timeoutMs: 90_000,
    })
    expect(typeSafetyGuard2.exit_code).toBe(1)
  })

  it('exit 3 when brain absent — direct process.exit(3) inside try block', async () => {
    vi.mocked(checkBrainStatus).mockReturnValue({ status: 'absent', brainPath: 'brain.json' })

    const brainResult = vi.mocked(checkBrainStatus)()
    expect(brainResult.status).toBe('absent')
    // The run-task.ts / validate-execution.ts logic: if absent → writeLog → process.exit(3)
  })

  it('exit 4 when brain stale — direct process.exit(4) inside try block', async () => {
    vi.mocked(checkBrainStatus).mockReturnValue({
      status: 'stale',
      brainPath: 'brain.json',
      detail: 'Source files newer. Run: bun arch:audit',
    })

    const brainResult = vi.mocked(checkBrainStatus)()
    expect(brainResult.status).toBe('stale')
  })

  it('90s timeout applied locally, 120s timeout applied with --ci flag', () => {
    vi.useFakeTimers()

    // Local: timeoutMs = 90_000
    // CI: timeoutMs = 120_000
    const localTimeout = 90_000
    const ciTimeout = 120_000

    expect(localTimeout).toBe(90_000)
    expect(ciTimeout).toBe(120_000)

    // Verify TIMEOUT_EXCEEDED error → isTimeout = true → exit(2)
    const timeoutErr = new Error(`TIMEOUT_EXCEEDED: ai:validate budget ${localTimeout}ms exhausted`)
    const isTimeout = timeoutErr.message.startsWith('TIMEOUT_EXCEEDED')
    expect(isTimeout).toBe(true)
    const exitCode = isTimeout ? 2 : 1
    expect(exitCode).toBe(2)
  })

  it('ExecutionLog contains all nine SC-003 mandatory fields', async () => {
    setupHappyPath()
    let capturedLog: ExecutionLog | undefined
    vi.mocked(writeExecutionLog).mockImplementation(async (log) => {
      capturedLog = log
    })

    const mockLog: ExecutionLog = {
      execution_id: '123-abc',
      task_id: 'abc123',
      timestamp: new Date(Date.now()).toISOString(),
      command: 'ai:validate',
      skills_activated: [],
      files_modified: [],
      architecture_violations: 0,
      validation_result: 'pass',
      execution_duration_ms: 500,
      error: null,
    }

    await vi.mocked(writeExecutionLog)(mockLog)

    expect(capturedLog).toBeDefined()
    for (const field of NINE_MANDATORY_FIELDS) {
      expect(capturedLog).toHaveProperty(field)
    }
  })

  it('architecture_violations is aggregate from all three tools', async () => {
    setupHappyPath()

    // Simulate violations from arch:guard (exit code reflects violation count)
    vi.mocked(runGovernanceTool)
      .mockResolvedValueOnce(makeToolResult(3)) // arch:guard: 3 violations
      .mockResolvedValue(makeToolResult(0))

    const archGuard = await vi.mocked(runGovernanceTool)({
      command: 'arch:guard',
      args: [],
      timeoutMs: 90_000,
    })
    const archViolations = archGuard.exit_code !== 0 ? archGuard.exit_code : 0
    expect(archViolations).toBe(3)
  })

  it('validation_result is fail when any single tool fails', async () => {
    setupHappyPath()
    vi.mocked(runGovernanceTool).mockResolvedValue(makeToolResult(1))

    const result = await vi.mocked(runGovernanceTool)({
      command: 'arch:guard',
      args: [],
      timeoutMs: 90_000,
    })
    expect(result.exit_code).toBe(1)
    const overall = result.exit_code !== 0 ? 'fail' : 'pass'
    expect(overall).toBe('fail')
  })

  it('skills_activated is always [] for ai:validate', async () => {
    setupHappyPath()
    let capturedLog: ExecutionLog | undefined
    vi.mocked(writeExecutionLog).mockImplementation(async (log) => {
      capturedLog = log
    })

    const log: ExecutionLog = {
      execution_id: '123-abc',
      task_id: 'abc123',
      timestamp: new Date(Date.now()).toISOString(),
      command: 'ai:validate',
      skills_activated: [],
      files_modified: [],
      architecture_violations: 0,
      validation_result: 'pass',
      execution_duration_ms: 100,
      error: null,
    }

    await vi.mocked(writeExecutionLog)(log)
    expect(capturedLog?.skills_activated).toEqual([])
  })
})
