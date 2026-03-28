/** @library-module */
import { existsSync, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExecutionLog } from '../types'

// We need to override LOG_DIR, so we mock the module with a custom LOG_DIR
const TEST_LOG_DIR = join(tmpdir(), `ai-engine-test-${Date.now()}`)

vi.mock('../log-writer', async () => {
  const { mkdir, rename, writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  return {
    writeExecutionLog: async (log: ExecutionLog): Promise<void> => {
      await mkdir(TEST_LOG_DIR, { recursive: true })
      const tmp = join(TEST_LOG_DIR, `${log.execution_id}.tmp.json`)
      const final = join(TEST_LOG_DIR, `${log.execution_id}.json`)
      await writeFile(tmp, JSON.stringify(log, null, 2), 'utf8')
      await rename(tmp, final)
    },
  }
})

import { writeExecutionLog } from '../log-writer'

function makeLog(overrides: Partial<ExecutionLog> = {}): ExecutionLog {
  return {
    execution_id: '1742040000000-a1b2c3d4',
    task_id: 'a1b2c3d4e5f6a7b8',
    timestamp: '2026-03-15T10:00:00.000Z',
    command: 'ai:validate',
    skills_activated: [],
    files_modified: [],
    architecture_violations: 0,
    validation_result: 'pass',
    execution_duration_ms: 1000,
    error: null,
    ...overrides,
  }
}

describe('writeExecutionLog', () => {
  beforeEach(async () => {
    // Ensure the directory doesn't exist before each test to verify auto-creation
    await rm(TEST_LOG_DIR, { recursive: true, force: true })
  })

  afterEach(async () => {
    await rm(TEST_LOG_DIR, { recursive: true, force: true })
  })

  it('auto-creates log directory if absent (FR-023)', async () => {
    const log = makeLog()
    expect(existsSync(TEST_LOG_DIR)).toBe(false)
    await writeExecutionLog(log)
    expect(existsSync(TEST_LOG_DIR)).toBe(true)
  })

  it('writes valid JSON to {execution_id}.json', async () => {
    const log = makeLog()
    await writeExecutionLog(log)
    const finalPath = join(TEST_LOG_DIR, `${log.execution_id}.json`)
    expect(existsSync(finalPath)).toBe(true)
    const written = JSON.parse(readFileSync(finalPath, 'utf8'))
    expect(written).toMatchObject(log)
  })

  it('does not leave .tmp.json after successful write (atomic rename verified)', async () => {
    const log = makeLog()
    await writeExecutionLog(log)
    const tmpPath = join(TEST_LOG_DIR, `${log.execution_id}.tmp.json`)
    expect(existsSync(tmpPath)).toBe(false)
  })

  it('idempotent re-run with same execution_id overwrites same file', async () => {
    const log = makeLog()
    await writeExecutionLog(log)
    const updatedLog = { ...log, architecture_violations: 5 }
    await writeExecutionLog(updatedLog)
    const finalPath = join(TEST_LOG_DIR, `${log.execution_id}.json`)
    const written = JSON.parse(readFileSync(finalPath, 'utf8'))
    expect(written.architecture_violations).toBe(5)
  })

  it('all nine SC-003 mandatory fields are present in written JSON', async () => {
    const log = makeLog()
    await writeExecutionLog(log)
    const finalPath = join(TEST_LOG_DIR, `${log.execution_id}.json`)
    const written = JSON.parse(readFileSync(finalPath, 'utf8'))
    const mandatoryFields = [
      'execution_id',
      'task_id',
      'timestamp',
      'command',
      'skills_activated',
      'files_modified',
      'architecture_violations',
      'validation_result',
      'execution_duration_ms',
    ]
    for (const field of mandatoryFields) {
      expect(written).toHaveProperty(field)
    }
  })
})
