#!/usr/bin/env bun
/**
 * Archive Strategy for Historical Snapshots (T065)
 *
 * Maintains a rolling archive of historical AI context snapshots
 * - Keeps latest 2 snapshots in docs/ai/context/
 * - Archives older snapshots to docs/ai/context/archive/
 * - Generates archive index for discovery
 *
 * Usage: bun scripts/dev/archive-snapshot-strategy.ts  [--prune] [--verbose]
 */

import { readdirSync, statSync, mkdirSync, renameSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '../core/logger-factory'

const logger = createLogger('archive-strategy')

interface SnapshotEntry {
  filename: string
  path: string
  timestamp: number
  size_bytes: number
  created_at: string
}

interface ArchiveIndex {
  updated_at: string
  total_archived: number
  entries: SnapshotEntry[]
  retention_policy: {
    keep_live: number
    archive_threshold_days: number
  }
}

async function main() {
  const args = process.argv.slice(2)
  const prune = args.includes('--prune')
  const verbose = args.includes('--verbose')

  const CONTEXT_DIR = 'docs/ai/context'
  const ARCHIVE_DIR = join(CONTEXT_DIR, 'archive')
  const KEEP_LIVE = 2 // Keep latest 2 in live directory
  const ARCHIVE_THRESHOLD_DAYS = 7

  logger.info('Archive strategy starting', { prune, verbose })

  // Create archive directory if needed
  mkdirSync(ARCHIVE_DIR, { recursive: true })

  // Find all artifact JSON files
  const allFiles = readdirSync(CONTEXT_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('.') && f !== 'archive')

  // Sort by modification time (newest first)
  const filesByTime = allFiles
    .map((filename) => {
      const fullPath = join(CONTEXT_DIR, filename)
      const stats = statSync(fullPath)
      return {
        filename,
        path: fullPath,
        timestamp: stats.mtimeMs,
        size_bytes: stats.size,
        created_at: new Date(stats.mtimeMs).toISOString(),
      }
    })
    .sort((a, b) => b.timestamp - a.timestamp)

  if (verbose) {
    console.log(`\n📋 Found ${filesByTime.length} artifact files`)
    for (const file of filesByTime.slice(0, 3)) {
      console.log(`  - ${file.filename} (${(file.size_bytes / 1024).toFixed(1)}KB)`)
    }
  }

  // Identify files to archive
  const toArchive = filesByTime.slice(KEEP_LIVE)
  const toPrune = toArchive.filter((f) => {
    const ageMs = Date.now() - f.timestamp
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    return ageDays > ARCHIVE_THRESHOLD_DAYS
  })

  if (verbose) {
    console.log(`\n📊 Archive analysis:`)
    console.log(`  Keep (live): ${filesByTime.slice(0, KEEP_LIVE).map((f) => f.filename).join(', ')}`)
    console.log(`  Archive candidates: ${toArchive.length}`)
    console.log(`  Prune candidates (>7 days old): ${toPrune.length}`)
  }

  // Perform archival if requested
  if (prune && toPrune.length > 0) {
    logger.info('Archiving old snapshots', { count: toPrune.length })

    for (const file of toPrune) {
      const timestamp = new Date(file.timestamp).toISOString().replace(/[:.]/g, '-')
      const archivedName = `${file.filename.replace('.json', '')}-${timestamp}.json`
      const archivedPath = join(ARCHIVE_DIR, archivedName)

      renameSync(file.path, archivedPath)
      logger.info('Archived', { from: file.filename, to: archivedName })

      if (verbose) {
        console.log(`  ✓ Archived ${file.filename} → ${archivedName}`)
      }
    }
  }

  // Generate/update archive index
  const archiveFiles = existsSync(ARCHIVE_DIR)
    ? readdirSync(ARCHIVE_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((filename) => {
          const fullPath = join(ARCHIVE_DIR, filename)
          const stats = statSync(fullPath)
          return {
            filename,
            path: fullPath,
            timestamp: stats.mtimeMs,
            size_bytes: stats.size,
            created_at: new Date(stats.mtimeMs).toISOString(),
          }
        })
    : []

  const index: ArchiveIndex = {
    updated_at: new Date().toISOString(),
    total_archived: archiveFiles.length,
    entries: archiveFiles.sort((a, b) => b.timestamp - a.timestamp),
    retention_policy: {
      keep_live: KEEP_LIVE,
      archive_threshold_days: ARCHIVE_THRESHOLD_DAYS,
    },
  }

  const indexPath = join(ARCHIVE_DIR, 'INDEX.json')
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8')
  logger.info('Archive index updated', { path: indexPath, count: archiveFiles.length })

  // Generate markdown archive list
  const mdPath = join(CONTEXT_DIR, 'ARCHIVE_INDEX.md')
  const mdContent = [
    '# AI Context Artifact Archive Index',
    '',
    `**Last Updated:** ${new Date().toISOString()}`,
    '',
    '## Archive Policy',
    '',
    `- **Keep Live:** Latest ${KEEP_LIVE} snapshots in \`docs/ai/context/\``,
    `- **Archive:** Snapshots older than ${ARCHIVE_THRESHOLD_DAYS} days`,
    `- **Location:** \`docs/ai/context/archive/\``,
    '',
    '## Archived Snapshots',
    '',
    '| Filename | Size (KB) | Created | Age (days) |',
    '|----------|-----------|---------|-----------|',
    ...archiveFiles.map((f) => {
      const ageDays = (Date.now() - f.timestamp) / (1000 * 60 * 60 * 24)
      return `| ${f.filename} | ${(f.size_bytes / 1024).toFixed(1)} | ${f.created_at.split('T')[0]} | ${ageDays.toFixed(0)} |`
    }),
    '',
    '## Live Snapshots',
    '',
    '| Filename | Size (KB) | Modified |',
    '|----------|-----------|----------|',
    ...filesByTime.slice(0, KEEP_LIVE).map((f) => {
      return `| ${f.filename} | ${(f.size_bytes / 1024).toFixed(1)} | ${f.created_at.split('T')[0]} |`
    }),
  ].join('\n')

  writeFileSync(mdPath, mdContent, 'utf-8')
  logger.info('Archive markdown index created', { path: mdPath })

  // Report
  console.log('\n📦 ARCHIVE STRATEGY COMPLETE\n')
  console.log(`Live Snapshots (kept): ${KEEP_LIVE}`)
  console.log(`Archived Snapshots: ${archiveFiles.length}`)
  console.log(`Archive Index: ${mdPath}`)

  process.exit(0)
}

main().catch((err) => {
  logger.error('Archive strategy failed', { error: String(err) })
  process.exit(1)
})
