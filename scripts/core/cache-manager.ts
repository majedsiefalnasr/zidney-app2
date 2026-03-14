/**
 * Cache Manager Utility
 *
 * Purpose: Implement selective caching for expensive artifact generation (Phase 3 Q2)
 * Used by: ai-context generators, infra-audit
 *
 * Provides:
 * - File hash-based cache validation
 * - TTL-based expiry
 * - Cache hit/miss tracking
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { glob } from 'glob'

export interface CacheEntry {
  timestamp: string
  artifact: 'dependency-graph' | 'runtime-dependents'
  fileHashes: Record<string, string>
  sourceFilesSet: string[]
  content: unknown
  contentHash: string
  generationTimeMs: number
  compressionRatio: number
  expirationMs?: number
  invalidateOnChange: string[]
}

export interface CacheStats {
  hits: number
  misses: number
  expirations: number
  hitratio: number
}

/**
 * Cache manager for selective artifact caching
 */
export class CacheManager {
  private cacheDir = 'docs/ai/context/.cache'
  private stats: CacheStats = { hits: 0, misses: 0, expirations: 0, hitratio: 0 }

  constructor(private artifactType: 'dependency-graph' | 'runtime-dependents') {}

  /**
   * Get cache file path
   */
  private getCachePath(): string {
    return join(this.cacheDir, `${this.artifactType}.cache.json`)
  }

  /**
   * Calculate file hashes for validation
   */
  async calculateFileHashes(patterns: string[]): Promise<Record<string, string>> {
    const hashes: Record<string, string> = {}

    for (const pattern of patterns) {
      const files = await glob(pattern, { ignore: ['node_modules/**', 'dist/**', '.git/**'] })

      for (const file of files) {
        if (existsSync(file)) {
          try {
            const content = readFileSync(file, 'utf-8')
            hashes[file] = createHash('sha256').update(content).digest('hex').slice(0, 16)
          } catch {
            // Skip unreadable files
          }
        }
      }
    }

    return hashes
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(entry: CacheEntry, currentHashes: Record<string, string>): boolean {
    // Check expiration
    if (entry.expirationMs) {
      const now = new Date(entry.timestamp).getTime() + entry.expirationMs
      if (Date.now() > now) {
        this.stats.expirations++
        return false
      }
    }

    // Check file hashes
    for (const [file, hash] of Object.entries(entry.fileHashes)) {
      if (currentHashes[file] !== hash) {
        return false
      }
    }

    // Check for new source files
    for (const file of entry.sourceFilesSet) {
      if (!(file in currentHashes)) {
        return false
      }
    }

    return true
  }

  /**
   * Try to get cached artifact
   */
  async get<T>(sourcePatterns: string[]): Promise<T | null> {
    const cachePath = this.getCachePath()

    if (!existsSync(cachePath)) {
      this.stats.misses++
      return null
    }

    try {
      const cacheContent = readFileSync(cachePath, 'utf-8')
      const entry = JSON.parse(cacheContent) as CacheEntry

      // Verify artifact type matches
      if (entry.artifact !== this.artifactType) {
        this.stats.misses++
        return null
      }

      // Calculate current hashes
      const currentHashes = await this.calculateFileHashes(sourcePatterns)

      // Validate cache
      if (!this.isCacheValid(entry, currentHashes)) {
        this.stats.misses++
        return null
      }

      // Cache hit!
      this.stats.hits++
      this.updateHitRatio()
      return entry.content as T
    } catch {
      this.stats.misses++
      return null
    }
  }

  /**
   * Save artifact to cache
   */
  async set(
    content: unknown,
    sourcePatterns: string[],
    generationTimeMs: number,
    expirationMs?: number
  ): Promise<void> {
    const fileHashes = await this.calculateFileHashes(sourcePatterns)
    const contentHash = createHash('sha256')
      .update(JSON.stringify(content))
      .digest('hex')
      .slice(0, 16)

    // Calculate compression ratio (rough estimate)
    const rawSize = JSON.stringify(content).length
    const compressedEstimate = Math.round(rawSize / 6) // Average gzip ratio
    const compressionRatio = rawSize / compressedEstimate

    const entry: CacheEntry = {
      timestamp: new Date().toISOString(),
      artifact: this.artifactType,
      fileHashes,
      sourceFilesSet: sourcePatterns,
      content,
      contentHash,
      generationTimeMs,
      compressionRatio,
      expirationMs,
      invalidateOnChange: sourcePatterns,
    }

    // Ensure cache directory exists
    const cachePath = this.getCachePath()
    mkdirSync(dirname(cachePath), { recursive: true })

    // Write cache
    writeFileSync(cachePath, JSON.stringify(entry, null, 2), 'utf-8')
  }

  /**
   * Clear cache
   */
  clear(): void {
    const cachePath = this.getCachePath()
    if (existsSync(cachePath)) {
      try {
        require('node:fs').unlinkSync(cachePath)
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * Clear all caches
   */
  static clearAll(): void {
    const cacheDir = 'docs/ai/context/.cache'
    if (existsSync(cacheDir)) {
      try {
        require('node:fs').rmSync(cacheDir, { recursive: true })
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * Update hit ratio
   */
  private updateHitRatio(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitratio = total > 0 ? this.stats.hits / total : 0
  }

  /**
   * Get cache stats
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Format stats for display
   */
  formatStats(): string {
    const _total = this.stats.hits + this.stats.misses
    const lines: string[] = [
      `Cache Stats (${this.artifactType}):`,
      `Hits: ${this.stats.hits}`,
      `Misses: ${this.stats.misses}`,
      `Expirations: ${this.stats.expirations}`,
      `Hit Ratio: ${(this.stats.hitratio * 100).toFixed(1)}%`,
    ]

    return lines.join('\n')
  }
}

/**
 * Helper to create cache manager
 */
export function createCacheManager(
  artifactType: 'dependency-graph' | 'runtime-dependents'
): CacheManager {
  return new CacheManager(artifactType)
}
