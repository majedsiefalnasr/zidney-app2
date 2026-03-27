/**
 * Cache Invalidation Detector — Detect when cache should be invalidated
 *
 * Purpose: Monitor critical configuration files and invalidate cache when they change
 * @library-module
 *
 * Files monitored:
 * - package.json / bun.lock (dependency changes)
 * - tsconfig.json / tsconfig.base.json (TypeScript config changes)
 * - ARCHITECTURE_MAP.json (architecture contract changes)
 * - .eslintrc* / eslint.config.* (lint rule changes)
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { log } from '../utils/logger'

interface ConfigSnapshot {
  timestamp: number
  fileHashes: Record<string, string>
  invalidationReason?: string
}

export class CacheInvalidationDetector {
  private snapshotPath: string
  private monitoredFiles: string[]

  constructor(snapshotDir: string = '.cache') {
    this.snapshotPath = join(snapshotDir, 'config-snapshot.json')
    this.monitoredFiles = [
      'package.json',
      'bun.lock',
      'tsconfig.json',
      'tsconfig.base.json',
      'docs/architecture/intelligence/ARCHITECTURE_MAP.json',
      'docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json',
      '.eslintrc.json',
      '.eslintrc.js',
      'eslint.config.js',
      '.prettierrc.json',
      '.prettierrc.js',
    ]

    // Ensure snapshot directory exists
    const snapshotDir_ = join(snapshotDir)
    if (!existsSync(snapshotDir_)) {
      mkdirSync(snapshotDir_, { recursive: true })
    }
  }

  /**
   * Check if cache should be invalidated based on file changes
   */
  public shouldInvalidate(): { invalid: boolean; reason?: string } {
    // On first run (no snapshot), don't invalidate (cache is empty anyway)
    if (!existsSync(this.snapshotPath)) {
      this.createSnapshot()
      return { invalid: false, reason: 'first_run' }
    }

    try {
      const snapshot = this.loadSnapshot()
      if (!snapshot) {
        return { invalid: false, reason: 'snapshot_unreadable' }
      }

      // Check each monitored file for changes
      for (const filePath of this.monitoredFiles) {
        if (!existsSync(filePath)) {
          // File was deleted
          if (snapshot.fileHashes[filePath]) {
            return { invalid: true, reason: `deleted: ${filePath}` }
          }
          continue
        }

        const currentHash = this.hashFile(filePath)
        const previousHash = snapshot.fileHashes[filePath]

        if (previousHash === undefined) {
          // New file appeared
          return { invalid: true, reason: `created: ${filePath}` }
        }

        if (currentHash !== previousHash) {
          // File was modified
          return { invalid: true, reason: `modified: ${filePath}` }
        }
      }

      // No changes detected
      return { invalid: false }
    } catch (error) {
      log.warn(`[CacheInvalidationDetector] Error checking invalidation: ${String(error)}`)
      return { invalid: false }
    }
  }

  /**
   * Create a snapshot of current monitored file hashes
   */
  public createSnapshot(): void {
    const fileHashes: Record<string, string> = {}

    for (const filePath of this.monitoredFiles) {
      if (existsSync(filePath)) {
        fileHashes[filePath] = this.hashFile(filePath)
      }
    }

    const snapshot: ConfigSnapshot = {
      timestamp: Date.now(),
      fileHashes,
    }

    try {
      writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8')
    } catch (error) {
      log.warn(`[CacheInvalidationDetector] Failed to save snapshot: ${String(error)}`)
    }
  }

  /**
   * Get the current snapshot
   */
  private loadSnapshot(): ConfigSnapshot | null {
    try {
      const content = readFileSync(this.snapshotPath, 'utf-8')
      return JSON.parse(content) as ConfigSnapshot
    } catch {
      return null
    }
  }

  /**
   * Hash a file
   */
  private hashFile(filePath: string): string {
    try {
      const content = readFileSync(filePath, 'utf-8')
      return createHash('sha256').update(content).digest('hex')
    } catch {
      return ''
    }
  }

  /**
   * Get list of monitored files
   */
  public getMonitoredFiles(): string[] {
    return this.monitoredFiles
  }

  /**
   * Add a file to the monitored list
   */
  public addMonitoredFile(filePath: string): void {
    if (!this.monitoredFiles.includes(filePath)) {
      this.monitoredFiles.push(filePath)
    }
  }

  /**
   * Remove a file from the monitored list
   */
  public removeMonitoredFile(filePath: string): void {
    const index = this.monitoredFiles.indexOf(filePath)
    if (index > -1) {
      this.monitoredFiles.splice(index, 1)
    }
  }
}

/**
 * Create a default cache invalidation detector
 */
export function createCacheInvalidationDetector(): CacheInvalidationDetector {
  return new CacheInvalidationDetector()
}
