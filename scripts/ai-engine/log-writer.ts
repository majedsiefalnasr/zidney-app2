/** @library-module */
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ExecutionLog } from './types'

const LOG_DIR = 'docs/architecture/health/ai-execution-logs'

/**
 * Write execution log atomically using tmp-then-rename pattern (FR-010, SC-012).
 * Creates the log directory if absent (FR-023).
 */
export async function writeExecutionLog(log: ExecutionLog): Promise<void> {
  await mkdir(LOG_DIR, { recursive: true })
  const tmp = join(LOG_DIR, `${log.execution_id}.tmp.json`)
  const final = join(LOG_DIR, `${log.execution_id}.json`)
  await writeFile(tmp, JSON.stringify(log, null, 2), 'utf8')
  await rename(tmp, final)
}
