/**
 * Audit Log Verification Helpers
 * Used to verify audit trail entries for security and compliance
 */

import type { Pool } from 'pg'

export interface AuditLogEntry {
  id: string
  workspace_id: string
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  status: 'success' | 'failure'
  details: Record<string, any>
  ip_address: string | null
  created_at: string
}

export class AuditHelper {
  constructor(private db: Pool) {}

  /**
   * Query audit log with filters
   */
  async queryAuditLog(filters: {
    action?: string
    workspace_id?: string
    user_id?: string
    status?: 'success' | 'failure'
    resource_type?: string
  }): Promise<AuditLogEntry[]> {
    let query = 'SELECT * FROM audit_logs WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (filters.action) {
      query += ` AND action = $${paramIndex}`
      params.push(filters.action)
      paramIndex++
    }

    if (filters.workspace_id) {
      query += ` AND workspace_id = $${paramIndex}`
      params.push(filters.workspace_id)
      paramIndex++
    }

    if (filters.user_id) {
      query += ` AND user_id = $${paramIndex}`
      params.push(filters.user_id)
      paramIndex++
    }

    if (filters.status) {
      query += ` AND status = $${paramIndex}`
      params.push(filters.status)
      paramIndex++
    }

    if (filters.resource_type) {
      query += ` AND resource_type = $${paramIndex}`
      params.push(filters.resource_type)
      paramIndex++
    }

    query += ' ORDER BY created_at DESC'

    try {
      const result = await this.db.query(query, params)
      return result.rows
    } catch (_error) {
      // Table may not exist yet
      return []
    }
  }

  /**
   * Verify audit event exists with expected status
   */
  async verifyAuditEvent(
    action: string,
    workspaceId: string,
    expectedStatus: 'success' | 'failure'
  ): Promise<boolean> {
    const entries = await this.queryAuditLog({
      action,
      workspace_id: workspaceId,
      status: expectedStatus,
    })

    return entries.length > 0
  }

  /**
   * Count unauthorized access attempts
   */
  async countUnauthorizedAttempts(workspaceId: string): Promise<number> {
    const entries = await this.queryAuditLog({
      workspace_id: workspaceId,
      action: 'cross_tenant_access_attempt',
      status: 'failure',
    })

    return entries.length
  }

  /**
   * Get recent audit entries
   */
  async getRecentEntries(workspaceId: string, limit: number = 10): Promise<AuditLogEntry[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM audit_logs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2',
        [workspaceId, limit]
      )
      return result.rows
    } catch (_error) {
      return []
    }
  }
}

/**
 * Factory to create audit helper
 */
export function createAuditHelper(db: Pool): AuditHelper {
  return new AuditHelper(db)
}

// ============================================================================
// Repository Diagnostics Utilities (INFRA_17 Phase 1)
// ============================================================================

import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

export interface FileSizeReport {
  filePath: string
  sizeBytes: number
  lineCount: number
  status: 'normal' | 'oversized' | 'large'
}

export interface DirectorySizeReport {
  dirPath: string
  sizeBytes: number
  fileCount: number
  scaledSize: string // Human readable (KB, MB, GB)
}

export interface AIArtifactReport {
  artifactName: string
  sizeBytes: number
  compressedSizeBytes: number
  compressionRatio: number
  contentHash: string
}

export interface ScriptPerformanceReport {
  scriptName: string
  executionTimeMs: number[] // Array of 10 execution times
  minTimeMs: number
  maxTimeMs: number
  avgTimeMs: number
  p95TimeMs: number
}

/**
 * Analyzes file sizes and line counts across the repository
 */
export const FileSizeAnalyzer = {
  /**
   * Analyze single file
   */
  analyzeFile(filePath: string): FileSizeReport {
    const stats = fs.statSync(filePath)
    const content = fs.readFileSync(filePath, 'utf-8')
    const lineCount = content.split('\n').length

    return {
      filePath,
      sizeBytes: stats.size,
      lineCount,
      status: lineCount > 2000 ? 'oversized' : stats.size > 1_000_000 ? 'large' : 'normal',
    }
  },

  /**
   * Find all files exceeding threshold
   */
  findOversizedFiles(
    rootDir: string,
    lineLimitThreshold: number = 2000,
    sizeLimitThreshold: number = 1_000_000
  ): FileSizeReport[] {
    const results: FileSizeReport[] = []

    const walkDir = (dir: string) => {
      try {
        const files = fs.readdirSync(dir)
        for (const file of files) {
          const fullPath = path.join(dir, file)
          const stat = fs.statSync(fullPath)

          if (stat.isDirectory()) {
            // Skip common large directories
            if (!['node_modules', '.git', 'dist', 'build', 'coverage', '.next'].includes(file)) {
              walkDir(fullPath)
            }
          } else {
            const report = FileSizeAnalyzer.analyzeFile(fullPath)
            if (report.lineCount > lineLimitThreshold || report.sizeBytes > sizeLimitThreshold) {
              results.push(report)
            }
          }
        }
      } catch (_error) {
        // Ignore permission errors
      }
    }

    walkDir(rootDir)
    return results.sort((a, b) => b.sizeBytes - a.sizeBytes)
  },
}

/**
 * Analyzes directory sizes using system commands
 */
export const DirectorySizeAnalyzer = {
  /**
   * Get directory size using du command (macOS/Linux)
   */
  analyzeDirectory(dirPath: string): DirectorySizeReport {
    try {
      const output = execSync(`du -sh "${dirPath}"`, { encoding: 'utf-8' }).trim()
      const [sizeStr] = output.split('\t')

      // Parse human-readable size to bytes
      const sizeBytes = DirectorySizeAnalyzer.parseHumanSize(sizeStr)

      // Count files
      const fileCount = execSync(`find "${dirPath}" -type f 2>/dev/null | wc -l`, {
        encoding: 'utf-8',
      })
        .trim()
        .split('\n')
        .pop()
      const count = parseInt(fileCount || '0', 10)

      return {
        dirPath,
        sizeBytes,
        fileCount: count,
        scaledSize: sizeStr,
      }
    } catch (_error) {
      return {
        dirPath,
        sizeBytes: 0,
        fileCount: 0,
        scaledSize: '0K',
      }
    }
  },

  /**
   * Parse human-readable size (1.2M, 512K) to bytes
   */
  parseHumanSize(sizeStr: string): number {
    const units: Record<string, number> = {
      K: 1024,
      M: 1024 ** 2,
      G: 1024 ** 3,
      T: 1024 ** 4,
    }

    const match = sizeStr.toUpperCase().match(/^([\d.]+)([KMGT])$/)
    if (!match) return 0

    const [, num, unit] = match
    return Math.round(parseFloat(num) * units[unit])
  },

  /**
   * Analyze multiple key directories
   */
  analyzeKeyDirectories(rootDir: string): DirectorySizeReport[] {
    const keyDirs = [
      'node_modules',
      'apps/api',
      'apps/backoffice',
      'apps/frontoffice',
      'apps/mmc',
      'apps/worker',
      'packages',
      'scripts',
      'docs/ai/context',
      'coverage',
      'dist',
      'build',
    ]

    return keyDirs
      .map((dir) => {
        const fullPath = path.join(rootDir, dir)
        if (fs.existsSync(fullPath)) {
          return DirectorySizeAnalyzer.analyzeDirectory(fullPath)
        }
        return null
      })
      .filter((report): report is DirectorySizeReport => report !== null)
  },
}

/**
 * Analyzes AI context artifacts
 */
export const AIContextAnalyzer = {
  /**
   * Analyze single artifact file
   */
  analyzeArtifact(artifactPath: string): AIArtifactReport {
    const content = fs.readFileSync(artifactPath, 'utf-8')
    const sizeBytes = Buffer.byteLength(content, 'utf-8')

    // Simulate gzip compression ratio (typical JSON compression ~6-8x)
    const compressedEstimate = Math.floor(sizeBytes / 7)

    // Simple hash (not cryptographic, just for change detection)
    const contentHash = AIContextAnalyzer.simpleHash(content)

    return {
      artifactName: path.basename(artifactPath),
      sizeBytes,
      compressedSizeBytes: compressedEstimate,
      compressionRatio: sizeBytes / compressedEstimate,
      contentHash,
    }
  },

  /**
   * Analyze all AI context artifacts in directory
   */
  analyzeArtifactDirectory(contextDir: string): AIArtifactReport[] {
    const artifactPatterns = [
      'ai-context-mini.json',
      'ai-module-map.json',
      'ai-dependency-graph.json',
      'ai-architecture-brain.json',
      'ai-runtime-map.json',
      'ai-runtime-dependents.json',
      'ai-layer-model.json',
      'ai-architecture-diff.json',
    ]

    return artifactPatterns
      .map((pattern) => {
        const fullPath = path.join(contextDir, pattern)
        if (fs.existsSync(fullPath)) {
          return AIContextAnalyzer.analyzeArtifact(fullPath)
        }
        return null
      })
      .filter((report): report is AIArtifactReport => report !== null)
  },

  /**
   * Simple hash function for content change detection
   */
  simpleHash(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16)
  },
}

/**
 * Profiles script execution performance
 */
export const ScriptPerformanceProfiler = {
  /**
   * Profile a script by running it multiple times
   */
  profileScript(scriptPath: string, runs: number = 10): ScriptPerformanceReport {
    const times: number[] = []

    for (let i = 0; i < runs; i++) {
      const start = performance.now()
      try {
        execSync(`bun ${scriptPath}`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        })
      } catch (_error) {
        // Continue even if script fails
      }
      const end = performance.now()
      times.push(end - start)
    }

    const sorted = times.sort((a, b) => a - b)
    const p95Index = Math.ceil(runs * 0.95) - 1

    return {
      scriptName: path.basename(scriptPath),
      executionTimeMs: times,
      minTimeMs: Math.min(...times),
      maxTimeMs: Math.max(...times),
      avgTimeMs: times.reduce((a, b) => a + b, 0) / times.length,
      p95TimeMs: sorted[p95Index],
    }
  },

  /**
   * Profile multiple scripts
   */
  profileMultipleScripts(scriptPaths: string[], runs: number = 10): ScriptPerformanceReport[] {
    return scriptPaths.map((scriptPath) =>
      ScriptPerformanceProfiler.profileScript(scriptPath, runs)
    )
  },
}

/**
 * Factory to create repository diagnostics helper
 */
export function createRepositoryDiagnosticsHelper() {
  return {
    fileSizeAnalyzer: FileSizeAnalyzer,
    directorySizeAnalyzer: DirectorySizeAnalyzer,
    aiContextAnalyzer: AIContextAnalyzer,
    scriptPerformanceProfiler: ScriptPerformanceProfiler,
  }
}
