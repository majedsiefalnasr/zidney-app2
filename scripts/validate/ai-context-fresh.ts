/**
 * @script validate:ai-context-fresh
 * @domain validate
 * @category validation
 * @description Check that the AI context mini artifact exists and is not older than 24 hours
 * @mode manual,ci
 * @usage bun run validate:ai-context-fresh
 * @dependencies node:fs,node:path,node:crypto
 */

import { randomUUID } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '../core/logger-factory'

const correlationId = randomUUID()
const logger = createLogger('validate:ai-context-fresh')
logger.setContext({ correlationId })

const REPO_ROOT = process.cwd()
const AI_CONTEXT_MINI = join(REPO_ROOT, 'docs/ai/context/ai-context-mini.json')
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

function main(): void {
  logger.info('Checking AI context freshness', { path: AI_CONTEXT_MINI, maxAgeHours: 24 })

  if (!existsSync(AI_CONTEXT_MINI)) {
    logger.error('AI context artifact missing', {
      path: AI_CONTEXT_MINI,
      hint: 'Run: bun run ai:context:generate',
    })
    process.exit(1)
  }

  let stat: ReturnType<typeof statSync>
  try {
    stat = statSync(AI_CONTEXT_MINI)
  } catch (err) {
    logger.error('Failed to stat AI context file', {
      path: AI_CONTEXT_MINI,
      error: err instanceof Error ? err.message : String(err),
    })
    process.exit(1)
  }

  const ageMs = Date.now() - stat.mtimeMs
  const ageHours = ageMs / (60 * 60 * 1000)

  if (ageMs > MAX_AGE_MS) {
    logger.error('AI context is stale', {
      path: AI_CONTEXT_MINI,
      ageHours: ageHours.toFixed(2),
      maxAgeHours: 24,
      hint: 'Run: bun run ai:context:refresh',
    })
    process.exit(1)
  }

  logger.info('AI context is fresh', {
    path: AI_CONTEXT_MINI,
    ageHours: ageHours.toFixed(2),
    maxAgeHours: 24,
    lastModified: stat.mtime.toISOString(),
  })
  process.exit(0)
}

main()
