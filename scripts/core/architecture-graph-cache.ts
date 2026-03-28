/**
 * Architecture Graph Cache — Persistent caching layer for dependency graphs
 * @library-module
 *
 * Purpose: Cache architecture dependency graphs to avoid regenerating them on every run
 *
 * Strategy:
 * 1. Store analyzed dependency graph in .cache/architecture-graph.json
 * 2. Validate cache on module/config changes
 * 3. Support TTL-based expiry (default 24h)
 * 4. Provide cache hit/miss metrics for optimization
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { log } from '../utils/logger'

interface CachedGraph {
  timestamp: number
  ttlMs: number
  expiresAt: number
  sourceHashes: Record<string, string>
  graph: {
    nodes: string[]
    edges: { from: string; to: string }[]
    metadata: Record<string, unknown>
  }
  contentHash: string
}

interface CacheValidationResult {
  valid: boolean
  reason?: 'expired' | 'source_changed' | 'corrupt'
  hitRatio?: number
}

export class ArchitectureGraphCache {
  private cacheDirPath: string
  private cacheFilePath: string
  private hits: number = 0
  private misses: number = 0

  constructor(cacheDir: string = '.cache', fileName: string = 'architecture-graph') {
    this.cacheDirPath = cacheDir
    this.cacheFilePath = join(cacheDir, `${fileName}.json`)
    this.ensureCacheDir()
  }

  /**
   * Ensure cache directory exists
   */
  private ensureCacheDir(): void {
    if (!existsSync(this.cacheDirPath)) {
      mkdirSync(this.cacheDirPath, { recursive: true })
    }
  }

  /**
   * Store dependency graph in cache
   */
  public cacheGraph(
    nodes: string[],
    edges: { from: string; to: string }[],
    sourceHashes: Record<string, string>,
    ttlMs: number = 24 * 60 * 60 * 1000 // 24 hours
  ): void {
    const now = Date.now()
    const graph: CachedGraph = {
      timestamp: now,
      ttlMs,
      expiresAt: now + ttlMs,
      sourceHashes,
      graph: {
        nodes,
        edges,
        metadata: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
        },
      },
      contentHash: this.hashGraph(nodes, edges),
    }

    try {
      writeFileSync(this.cacheFilePath, JSON.stringify(graph, null, 2), 'utf-8')
      this.misses++
    } catch (error) {
      log.warn(`[ArchitectureGraphCache] Failed to write cache: ${String(error)}`)
    }
  }

  /**
   * Load graph from cache if valid
   */
  public loadCache(): {
    graph: { nodes: string[]; edges: { from: string; to: string }[] }
    valid: boolean
  } | null {
    if (!existsSync(this.cacheFilePath)) {
      this.misses++
      return null
    }

    try {
      const content = readFileSync(this.cacheFilePath, 'utf-8')
      const cached = JSON.parse(content) as CachedGraph

      const validation = this.validateCache(cached)
      if (!validation.valid) {
        this.misses++
        return null
      }

      this.hits++
      return {
        graph: cached.graph as {
          nodes: string[]
          edges: { from: string; to: string }[]
        },
        valid: true,
      }
    } catch (error) {
      this.misses++
      log.warn(`[ArchitectureGraphCache] Failed to load cache: ${String(error)}`)
      return null
    }
  }

  /**
   * Validate cached graph
   */
  private validateCache(cached: CachedGraph): CacheValidationResult {
    // Check expiration
    if (Date.now() > cached.expiresAt) {
      return { valid: false, reason: 'expired' }
    }

    // Check structure
    if (!cached.graph || !Array.isArray(cached.graph.nodes) || !Array.isArray(cached.graph.edges)) {
      return { valid: false, reason: 'corrupt' }
    }

    // Verify content hash (integrity check)
    const expectedHash = this.hashGraph(cached.graph.nodes, cached.graph.edges)
    if (expectedHash !== cached.contentHash) {
      return { valid: false, reason: 'corrupt' }
    }

    return { valid: true }
  }

  /**
   * Invalidate cache (e.g., when source files change)
   */
  public invalidate(): void {
    try {
      if (existsSync(this.cacheFilePath)) {
        // Remove cache file
        const fs = require('node:fs')
        fs.unlinkSync(this.cacheFilePath)
      }
      this.misses++
    } catch (error) {
      log.warn(`[ArchitectureGraphCache] Failed to invalidate cache: ${String(error)}`)
    }
  }

  /**
   * Check if cache should be invalidated based on source changes
   */
  public shouldInvalidate(currentSourceHashes: Record<string, string>): boolean {
    if (!existsSync(this.cacheFilePath)) {
      return false // No cache to invalidate
    }

    try {
      const content = readFileSync(this.cacheFilePath, 'utf-8')
      const cached = JSON.parse(content) as CachedGraph

      // Compare source hashes
      for (const [source, hash] of Object.entries(currentSourceHashes)) {
        if (cached.sourceHashes[source] !== hash) {
          return true // Source changed
        }
      }

      // Check for removed sources
      for (const source of Object.keys(cached.sourceHashes)) {
        if (!(source in currentSourceHashes)) {
          return true // Source removed
        }
      }

      return false
    } catch {
      return false
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): {
    hits: number
    misses: number
    hitRatio: number
    totalRequests: number
  } {
    const total = this.hits + this.misses
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio: total > 0 ? this.hits / total : 0,
      totalRequests: total,
    }
  }

  /**
   * Clear all cache statistics
   */
  public resetStats(): void {
    this.hits = 0
    this.misses = 0
  }

  /**
   * Hash a graph for integrity verification
   */
  private hashGraph(nodes: string[], edges: { from: string; to: string }[]): string {
    const nodesStr = nodes.sort().join('|')
    const edgesStr = edges
      .sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`))
      .map((e) => `${e.from}:${e.to}`)
      .join('|')

    const content = `${nodesStr}::${edgesStr}`
    return createHash('sha256').update(content).digest('hex')
  }

  /**
   * Get cache file path
   */
  public getCacheFilePath(): string {
    return this.cacheFilePath
  }

  /**
   * Check if cache exists and is valid
   */
  public isCacheValid(): boolean {
    if (!existsSync(this.cacheFilePath)) {
      return false
    }

    try {
      const content = readFileSync(this.cacheFilePath, 'utf-8')
      const cached = JSON.parse(content) as CachedGraph
      const validation = this.validateCache(cached)
      return validation.valid
    } catch {
      return false
    }
  }
}

/**
 * Create a default architecture graph cache instance
 */
export function createArchitectureGraphCache(
  _ttlMs: number = 24 * 60 * 60 * 1000
): ArchitectureGraphCache {
  return new ArchitectureGraphCache()
}
