/**
 * @script infra:cache:clean
 * @domain infra
 * @category maintenance
 * @description Remove build caches and temporary output directories to free disk space
 * @mode manual
 * @usage bun run infra:cache:clean
 * @dependencies node:fs,node:path,node:crypto
 */

import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '../core/logger-factory'

const correlationId = randomUUID()
const logger = createLogger('maintenance:cache-clean')
logger.setContext({ correlationId })

const REPO_ROOT = process.cwd()

// Static cache directories
const STATIC_CACHE_DIRS = ['.turbo', 'node_modules/.cache']

// Dynamic patterns: apps/*/dist
function getAppDistDirs(): string[] {
  const appsDir = join(REPO_ROOT, 'apps')
  if (!existsSync(appsDir)) return []
  try {
    return readdirSync(appsDir)
      .map((app) => join('apps', app, 'dist'))
      .filter((d) => existsSync(join(REPO_ROOT, d)))
  } catch {
    return []
  }
}

const CACHE_DIRS = [...STATIC_CACHE_DIRS, ...getAppDistDirs()]

function main(): void {
  logger.info('Starting cache clean', { dirs: CACHE_DIRS })

  let removed = 0
  let skipped = 0

  for (const relDir of CACHE_DIRS) {
    const absDir = join(REPO_ROOT, relDir)

    if (!existsSync(absDir)) {
      logger.info('Directory not found — skipping', { dir: relDir })
      skipped++
      continue
    }

    let stat: ReturnType<typeof statSync>
    try {
      stat = statSync(absDir)
    } catch {
      skipped++
      continue
    }

    if (!stat.isDirectory()) {
      skipped++
      continue
    }

    try {
      rmSync(absDir, { recursive: true, force: true })
      logger.info('Removed cache directory', { dir: relDir })
      removed++
    } catch (err) {
      logger.warn('Failed to remove cache directory', {
        dir: relDir,
        error: err instanceof Error ? err.message : String(err),
      })
      skipped++
    }
  }

  logger.info('Cache clean complete', { removed, skipped, total: CACHE_DIRS.length })
  process.exit(0)
}

main()
