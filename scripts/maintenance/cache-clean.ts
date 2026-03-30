#!/usr/bin/env bun

/**
 * @script infra:cache:clean
 * @domain infra
 * @category maintenance
 * @description Remove build caches and temporary output directories to free disk space
 * @usage bun run infra:cache:clean
 */

import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger, exit, hasCiFlag, log } from '../utils/logger'

const correlationId = randomUUID()
const logger = createLogger('infra:cache:clean')
const isCi = hasCiFlag(process.argv.slice(2))
logger.setContext({ correlationId, ci: isCi })

log.setScript('infra:cache:clean')
log.header('Cache Clean', 'Remove build caches and temporary output directories to free disk space')

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
  if (isCi) {
    logger.error('infra:cache:clean is a local cleanup command and cannot run with --ci')
    exit(1)
  }
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
  log.result({
    total: CACHE_DIRS.length,
    passed: removed,
    failed: skipped,
    message: 'Cache clean complete',
  })
  exit(0)
}

main()
