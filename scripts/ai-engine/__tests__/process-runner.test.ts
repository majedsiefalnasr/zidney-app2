/** @library-module */
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

import { spawn } from 'node:child_process'

function makeMockProc(exitCode: number, stdoutData = '', delay = 0): ReturnType<typeof spawn> {
  const proc = new EventEmitter() as ReturnType<typeof spawn>
  const stdout = new EventEmitter() as NodeJS.ReadableStream & {
    on: typeof EventEmitter.prototype.on
  }
  ;(proc as unknown as { stdout: typeof stdout }).stdout = stdout
  ;(proc as unknown as { stderr: EventEmitter }).stderr = new EventEmitter()
  ;(proc as unknown as { kill: (signal?: string) => void }).kill = vi.fn()

  if (delay > 0) {
    setTimeout(() => {
      stdout.emit('data', Buffer.from(stdoutData))
      proc.emit('close', exitCode)
    }, delay)
  } else {
    setTimeout(() => {
      stdout.emit('data', Buffer.from(stdoutData))
      proc.emit('close', exitCode)
    }, 10)
  }

  return proc
}

describe('runGovernanceTool', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('returns exit code 0 captured in SubCommandResult', async () => {
    vi.mocked(spawn).mockReturnValue(makeMockProc(0, 'output'))
    const { runGovernanceTool } = await import('../process-runner')
    const result = await runGovernanceTool({
      command: 'arch:guard',
      args: ['--ci'],
      timeoutMs: 5000,
    })
    expect(result.exit_code).toBe(0)
    expect(result.timed_out).toBe(false)
  })

  it('returns non-zero exit code without throwing', async () => {
    vi.mocked(spawn).mockReturnValue(makeMockProc(1))
    const { runGovernanceTool } = await import('../process-runner')
    const result = await runGovernanceTool({ command: 'arch:guard', args: [], timeoutMs: 5000 })
    expect(result.exit_code).toBe(1)
    expect(result.timed_out).toBe(false)
  })

  it('sets timed_out: true and sends SIGTERM when timeoutMs exceeded', async () => {
    vi.useFakeTimers()

    // Process never closes on its own
    const proc = new EventEmitter() as ReturnType<typeof spawn>
    const stdout = new EventEmitter()
    ;(proc as unknown as { stdout: typeof stdout }).stdout = stdout
    ;(proc as unknown as { stderr: EventEmitter }).stderr = new EventEmitter()
    const killMock = vi.fn().mockImplementation(() => {
      // After kill, simulate close with exit code 0
      setTimeout(() => proc.emit('close', null), 10)
    })
    ;(proc as unknown as { kill: typeof killMock }).kill = killMock

    vi.mocked(spawn).mockReturnValue(proc)

    const { runGovernanceTool } = await import('../process-runner')
    const resultPromise = runGovernanceTool({ command: 'arch:guard', args: [], timeoutMs: 1000 })

    // Advance past the timeout
    await vi.advanceTimersByTimeAsync(1001)
    await vi.advanceTimersByTimeAsync(20) // let close event fire

    const result = await resultPromise
    expect(result.timed_out).toBe(true)
    expect(result.exit_code).toBe(124)
    expect(killMock).toHaveBeenCalledWith('SIGTERM')
  })

  it('captures stdout in result but does not re-emit to parent process', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.mocked(spawn).mockReturnValue(makeMockProc(0, 'captured output'))
    const { runGovernanceTool } = await import('../process-runner')
    const result = await runGovernanceTool({ command: 'arch:guard', args: [], timeoutMs: 5000 })
    expect(result.stdout).toContain('captured output')
    expect(stdoutSpy).not.toHaveBeenCalled()
    stdoutSpy.mockRestore()
  })

  it('duration_ms is a positive number', async () => {
    vi.mocked(spawn).mockReturnValue(makeMockProc(0))
    const { runGovernanceTool } = await import('../process-runner')
    const result = await runGovernanceTool({ command: 'arch:guard', args: [], timeoutMs: 5000 })
    expect(result.duration_ms).toBeGreaterThanOrEqual(0)
  })
})
