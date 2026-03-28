#!/usr/bin/env bun

/**
 * T050: Validate Script Duplication
 *
 * Analyzes the scripts/ directory to measure code duplication
 * across refactored and reorganized scripts. Validates that
 * refactoring achieved <5% duplication (up from ~30% baseline).
 *
 * Purpose: Measure modularization effectiveness
 *
 * Created during: Phase 2 — Script Modularization
 * Uses: file-analyzer utility from scripts/core/
 *
 * Output: Duplication report with metrics
 */

import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { createLogger, flushAi, log } from '../utils/logger'

const logger = createLogger('validate-script-duplication')

interface FileHash {
  path: string
  hash: string
  size: number
  lines: number
}

interface DuplicationMetrics {
  totalFiles: number
  totalLines: number
  duplicatedLines: number
  duplicateBlocks: Array<{ hash: string; files: string[]; lines: number; occurrences: number }>
  duplicationPercentage: number
  health: 'PASS' | 'WARN' | 'FAIL'
}

async function getScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentDir: string) {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name)
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await walk(fullPath)
          }
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.sh')) {
          files.push(fullPath)
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  await walk(dir)
  return files
}

function hashCode(content: string): string {
  return createHash('md5').update(content).digest('hex')
}

function getCodeChunks(content: string): Map<string, string[]> {
  const lines = content.split('\n')
  const chunks = new Map<string, string[]>()

  // Chunk by 10-line blocks for duplication detection
  const chunkSize = 10
  for (let i = 0; i < lines.length - chunkSize; i++) {
    const chunk = lines.slice(i, i + chunkSize).join('\n')
    const hash = hashCode(chunk)

    if (!chunks.has(hash)) {
      chunks.set(hash, [])
    }
    chunks.get(hash)?.push(`${i}:${i + chunkSize}`)
  }

  return chunks
}

async function validateScriptDuplication(): Promise<void> {
  const scriptsDir = join(import.meta.dir, '..')
  const duplicationTarget = 0.05 // 5%

  logger.info('Starting script duplication analysis', { target: `<${duplicationTarget * 100}%` })

  log.header(
    'VALIDATE SCRIPT DUPLICATION',
    'Analyzes scripts/ directory to measure code duplication'
  )
  log.info(`Analyzing script duplication in scripts/ (target: <${duplicationTarget * 100}%)`)

  // Collect all script files
  const scriptFiles = await getScriptFiles(scriptsDir)
  const filteredFiles = scriptFiles.filter((f) => {
    const rel = relative(scriptsDir, f)
    return !rel.includes('node_modules') && !rel.includes('ai-context/generators')
  })

  logger.info('Files analyzed', { count: filteredFiles.length })
  log.info(`Found ${filteredFiles.length} script files`)

  // Read and hash all files
  const fileHashes: FileHash[] = []
  let totalLines = 0

  for (const filePath of filteredFiles) {
    try {
      const content = await readFile(filePath, 'utf-8')
      const lines = content.split('\n').length
      const size = content.length

      fileHashes.push({
        path: relative(scriptsDir, filePath),
        hash: hashCode(content),
        size,
        lines,
      })

      totalLines += lines
    } catch {
      // Skip files that can't be read
    }
  }

  // Analyze duplication by chunks
  const chunkMap = new Map<string, string[]>()
  const fileChunks = new Map<string, Map<string, string[]>>()

  for (const file of fileHashes) {
    const content = await readFile(join(scriptsDir, file.path), 'utf-8')
    const chunks = getCodeChunks(content)
    fileChunks.set(file.path, chunks)

    for (const [chunkHash, _ranges] of chunks) {
      if (!chunkMap.has(chunkHash)) {
        chunkMap.set(chunkHash, [])
      }

      // Track which file this chunk is from
      chunkMap.get(chunkHash)?.push(file.path)
    }
  }

  // Find duplicate blocks (blocks that appear in multiple files)
  const duplicateBlocks: DuplicationMetrics['duplicateBlocks'] = []
  let duplicatedLines = 0

  for (const [chunkHash, files] of chunkMap) {
    const uniqueFiles = new Set(files)

    // Count only cross-file duplicates (duplicates in multiple files)
    if (uniqueFiles.size > 1) {
      duplicateBlocks.push({
        hash: chunkHash.substring(0, 8),
        files: Array.from(uniqueFiles),
        lines: 10,
        occurrences: files.length,
      })
      duplicatedLines += 10 * (files.length - 1) // Count extras
    }
  }

  const duplicationPercentage = totalLines > 0 ? duplicatedLines / totalLines : 0
  const health =
    duplicationPercentage <= duplicationTarget
      ? 'PASS'
      : duplicationPercentage <= duplicationTarget * 1.5
        ? 'WARN'
        : 'FAIL'

  const metrics: DuplicationMetrics = {
    totalFiles: fileHashes.length,
    totalLines,
    duplicatedLines,
    duplicateBlocks,
    duplicationPercentage,
    health,
  }

  logger.info('Duplication analysis complete', {
    total_files: metrics.totalFiles,
    total_lines: metrics.totalLines,
    duplicated_lines: metrics.duplicatedLines,
    duplication_percentage: (metrics.duplicationPercentage * 100).toFixed(2),
    health: metrics.health,
  })

  log.step('Duplication Metrics:')
  log.info(`  Total Files: ${metrics.totalFiles}`)
  log.info(`  Total Lines: ${metrics.totalLines}`)
  log.info(`  Duplicated Lines: ${metrics.duplicatedLines}`)
  log.info(`  Duplication: ${(metrics.duplicationPercentage * 100).toFixed(2)}%`)
  log.info(`  Target: <${(duplicationTarget * 100).toFixed(1)}%`)
  log.info(`  Health: ${metrics.health}`)

  if (metrics.duplicateBlocks.length > 0 && metrics.duplicateBlocks.length <= 10) {
    log.info(`  Duplicate Blocks (top 10):`)
    for (const block of metrics.duplicateBlocks.slice(0, 10)) {
      log.info(`    ${block.hash}: ${block.files.length} files \u00d7 ${block.lines} lines`)
    }
  }

  // Exit with status
  if (metrics.health === 'PASS') {
    log.success(
      `PASS: Script duplication at ${(metrics.duplicationPercentage * 100).toFixed(2)}% (target: <${duplicationTarget * 100}%)`
    )
    log.result({ total: metrics.totalFiles, passed: metrics.totalFiles, failed: 0 })
    flushAi()
    process.exit(0)
  } else if (metrics.health === 'WARN') {
    log.warn(
      `WARN: Script duplication at ${(metrics.duplicationPercentage * 100).toFixed(2)}% (target: <${duplicationTarget * 100}%)`
    )
    log.result({ total: metrics.totalFiles, passed: metrics.totalFiles, failed: 0 })
    flushAi()
    process.exit(0)
  } else {
    log.error(
      `FAIL: Script duplication at ${(metrics.duplicationPercentage * 100).toFixed(2)}% exceeds target (<${duplicationTarget * 100}%)`
    )
    log.result({ total: metrics.totalFiles, passed: 0, failed: metrics.totalFiles })
    flushAi()
    process.exit(1)
  }
}

validateScriptDuplication()
