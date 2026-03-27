/**
 * @script validate:ai-context-fresh
 * @domain validate
 * @category validation
 * @description Check that the AI context mini artifact exists and is not older than 24 hours
 * @usage bun run validate:ai-context-fresh
 */

import { randomUUID } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger, exit, log } from '../utils/logger'

const correlationId = randomUUID()
const isAiMode = process.argv.includes('--ai')
const logger = createLogger('validate:ai-context-fresh', isAiMode)
logger.setContext({ correlationId })

const REPO_ROOT = process.cwd()
const AI_CONTEXT_MINI = join(REPO_ROOT, 'docs/ai/context/ai-context-mini.json')
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

function main(): void {
  log.header(
    'Validate AI context freshness',
    'Check that the AI context mini artifact exists and is not older than 24 hours'
  )
  log.section('Validation')
  log.step('Checking AI context freshness')
  logger.info('Checking AI context freshness', { path: AI_CONTEXT_MINI, maxAgeHours: 24 })

  if (!existsSync(AI_CONTEXT_MINI)) {
    const msg = 'AI context artifact missing'
    logger.error(msg, {
      path: AI_CONTEXT_MINI,
      hint: 'Run: bun run ai:context:generate',
    })
    exit(1)
  }

  let stat: ReturnType<typeof statSync>
  try {
    stat = statSync(AI_CONTEXT_MINI)
  } catch (err) {
    const msg = 'Failed to stat AI context file'
    logger.error(msg, {
      path: AI_CONTEXT_MINI,
      error: err instanceof Error ? err.message : String(err),
    })
    exit(1)
  }

  const ageMs = Date.now() - stat.mtimeMs
  const ageHours = ageMs / (60 * 60 * 1000)

  if (ageMs > MAX_AGE_MS) {
    const msg = 'AI context is stale'
    logger.error(msg, {
      path: AI_CONTEXT_MINI,
      ageHours: ageHours.toFixed(2),
      maxAgeHours: 24,
      hint: 'Run: bun run ai:context:refresh',
    })
    exit(1)
  }

  const msg = 'AI context is fresh'
  logger.info(msg, {
    path: AI_CONTEXT_MINI,
    ageHours: ageHours.toFixed(2),
    maxAgeHours: 24,
    lastModified: stat.mtime.toISOString(),
  })
  log.resultSimple(`CONTEXT FRESH`, 'success')
  exit(0)
}

main()
