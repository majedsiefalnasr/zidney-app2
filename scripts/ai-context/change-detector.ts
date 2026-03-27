/**
 * Change Detector - Detect source changes for intelligent regeneration
 * Task: T025
 * Path: scripts/ai-context/change-detector.ts
 * @library-module
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { log } from '../utils/logger'
import type { ChangeDetectionResult } from './types'

const CACHE_DIR = '.ai-context-cache'

/**
 * Compute SHA256-like hash of content (simplified for demo)
 */
function simpleHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(10, '0')
}

/**
 * Detect if sources have changed since last generation
 */
export async function detectChanges(
  repoRoot: string,
  sourceContent: string
): Promise<ChangeDetectionResult> {
  const cacheDir = join(repoRoot, CACHE_DIR)
  const cacheFile = join(cacheDir, 'source-hash.json')

  const currentHash = simpleHash(sourceContent)
  const now = new Date().toISOString()

  try {
    // Try to read previous cache
    const cacheContent = await readFile(cacheFile, 'utf-8').catch(() => null)

    if (!cacheContent) {
      // First generation
      return {
        changed: true,
        changed_sources: {},
        last_generated_at: now,
        time_since_generation_seconds: 0,
        should_regenerate: true,
      }
    }

    const cache = JSON.parse(cacheContent)
    const previousHash = cache.source_hash
    const lastGeneratedAt = cache.last_generated_at

    const lastTime = new Date(lastGeneratedAt)
    const currentTime = new Date(now)
    const timeSinceSeconds = (currentTime.getTime() - lastTime.getTime()) / 1000

    const hashChanged = currentHash !== previousHash
    const tooOld = timeSinceSeconds > 24 * 60 * 60 // 24 hours

    return {
      changed: hashChanged || tooOld,
      changed_sources: hashChanged
        ? {
            sources: {
              previous_hash: previousHash,
              current_hash: currentHash,
            },
          }
        : {},
      last_generated_at: lastGeneratedAt,
      time_since_generation_seconds: Math.round(timeSinceSeconds),
      should_regenerate: hashChanged || tooOld,
    }
  } catch (err) {
    log.warn(`Error reading cache:${String(err)}`)
    return {
      changed: true,
      changed_sources: {},
      last_generated_at: now,
      time_since_generation_seconds: 0,
      should_regenerate: true,
    }
  }
}

/**
 * Update change detection cache after generation
 */
export async function updateChangeCache(repoRoot: string, sourceContent: string): Promise<void> {
  const cacheDir = join(repoRoot, CACHE_DIR)
  const cacheFile = join(cacheDir, '.gitkeep')

  try {
    await mkdir(cacheDir, { recursive: true })

    const cacheData = {
      source_hash: simpleHash(sourceContent),
      last_generated_at: new Date().toISOString(),
      generator_version: '1.0.0',
    }

    await writeFile(join(cacheDir, 'source-hash.json'), JSON.stringify(cacheData, null, 2), 'utf-8')

    // Ensure cache dir is in gitignore
    await writeFile(cacheFile, '', 'utf-8')
  } catch (err) {
    log.warn(`Could not update change cache:${String(err)}`)
  }
}
