/**
 * File Analyzer Utility
 *
 * Purpose: Extract file analysis and metrics functions
 * Used by: ai-guard, infra-audit, architecture-diff, validate-architecture-brain
 *
 * Provides:
 * - Line counting
 * - File size measurement
 * - Directory traversal
 * - Large file detection
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface FileMetrics {
  path: string
  sizeBytes: number
  sizeMb: number
  lineCount: number
  charCount: number
}

export interface DirectoryMetrics {
  path: string
  totalSizeBytes: number
  totalFiles: number
  largeFiles: FileMetrics[]
  averageFileSize: number
}

/**
 * Count lines in a file
 */
export function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, 'utf-8')
    return content.split('\n').length
  } catch {
    return 0
  }
}

/**
 * Get file size in bytes
 */
export function getFileSize(filePath: string): number {
  try {
    const stat = statSync(filePath)
    return stat.size
  } catch {
    return 0
  }
}

/**
 * Analyze a single file
 */
export function analyzeFile(filePath: string): FileMetrics {
  const sizeBytes = getFileSize(filePath)
  const lineCount = countLines(filePath)
  let charCount = 0

  try {
    const content = readFileSync(filePath, 'utf-8')
    charCount = content.length
  } catch {
    // Unable to read
  }

  return {
    path: filePath,
    sizeBytes,
    sizeMb: sizeBytes / (1024 * 1024),
    lineCount,
    charCount,
  }
}

/**
 * Find all files matching extensions in a directory
 */
export function findFiles(
  dirPath: string,
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']
): string[] {
  const results: string[] = []

  function traverse(currentDir: string): void {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name)

        // Skip common ignored directories
        if (['.git', 'node_modules', '.next', 'dist', 'coverage', '.cache'].includes(entry.name)) {
          continue
        }

        if (entry.isDirectory()) {
          traverse(fullPath)
        } else if (entry.isFile()) {
          if (extensions.some((ext) => entry.name.endsWith(ext))) {
            results.push(fullPath)
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  traverse(dirPath)
  return results
}

/**
 * Find files exceeding size or line count thresholds
 */
export function findOversizedFiles(
  dirPath: string,
  options: { maxLines?: number; maxSizeKb?: number } = {}
): FileMetrics[] {
  const { maxLines = 2000, maxSizeKb = 1024 } = options
  const files = findFiles(dirPath)
  const oversized: FileMetrics[] = []

  for (const filePath of files) {
    const metrics = analyzeFile(filePath)
    if (metrics.lineCount > maxLines || metrics.sizeBytes / 1024 > maxSizeKb) {
      oversized.push(metrics)
    }
  }

  return oversized.sort((a, b) => b.lineCount - a.lineCount)
}

/**
 * Get directory metrics
 */
export function analyzeDirectory(
  dirPath: string,
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']
): DirectoryMetrics {
  const files = findFiles(dirPath, extensions)
  const fileMetrics: FileMetrics[] = []
  let totalSize = 0

  for (const filePath of files) {
    const metrics = analyzeFile(filePath)
    fileMetrics.push(metrics)
    totalSize += metrics.sizeBytes
  }

  const largeFiles = fileMetrics
    .filter((f) => f.lineCount > 500)
    .sort((a, b) => b.lineCount - a.lineCount)

  return {
    path: dirPath,
    totalSizeBytes: totalSize,
    totalFiles: files.length,
    largeFiles,
    averageFileSize: fileMetrics.length > 0 ? totalSize / fileMetrics.length : 0,
  }
}

/**
 * Format file metrics for output
 */
export function formatFileMetrics(metrics: FileMetrics): string {
  return `${metrics.path}: ${metrics.lineCount}L, ${metrics.sizeBytes}B`
}

/**
 * Format size in human-readable format
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

/**
 * Get the most oversized files in order
 */
export function getTopOversizedFiles(dirPath: string, count: number = 10): FileMetrics[] {
  const oversized = findOversizedFiles(dirPath)
  return oversized.slice(0, count)
}
