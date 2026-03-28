/**
 * @script dev:refactor:scripts
 * @domain dev
 * @category dev
 * @description Applies the SCRIPT_MIGRATION_MAP to rename all "bun run <old>"
 *   references across the repository. Reads docs/scripts/SCRIPT_MIGRATION_MAP.md,
 *   builds the old→new rename index, then rewrites all matching files in-place.
 *   Supports --dry-run to preview changes without writing. Exits 1 if any
 *   unresolved references remain after the run. Writes a summary report to
 *   reports/SCRIPT_REFACTOR_REPORT.md.
 * @usage bun run dev:refactor:scripts
 * @mode manual
 * @dependencies node:fs,node:path,node:crypto
 */

import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger, exit, log } from '../utils/logger'
import type { MigrationEntry } from '../validate/types'

const correlationId = randomUUID()
const logger = createLogger('dev:refactor:scripts')
logger.setContext({ correlationId })

const REPO_ROOT = process.cwd()
const MIGRATION_MAP_PATH = join(REPO_ROOT, 'docs/scripts/SCRIPT_MIGRATION_MAP.md')
const REPORT_PATH = join(REPO_ROOT, 'reports/SCRIPT_REFACTOR_REPORT.md')

const DRY_RUN = process.argv.includes('--dry-run')

/** File patterns to scan and rewrite */
const SCAN_EXTENSIONS = new Set(['.json', '.ts', '.yml', '.yaml', '.md', '.sh'])

const EXCLUDE_DIRS = new Set(['node_modules', 'coverage', 'dist', '.git', '.turbo', '.cache'])

// ---------------------------------------------------------------------------
// Parsing the migration map
// ---------------------------------------------------------------------------

export function parseMigrationMap(content: string): MigrationEntry[] {
  const entries: MigrationEntry[] = []
  const tableRe = /^\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|/
  let inTable = false

  for (const line of content.split('\n')) {
    const trim = line.trim()
    if (!inTable) {
      // Detect the header row
      if (trim.startsWith('| Old Name') || trim.startsWith('| **Old Name')) {
        inTable = true
      }
      continue
    }
    // Skip separator rows
    if (/^\|[-| ]+\|$/.test(trim)) continue
    if (!tableRe.test(trim)) {
      inTable = false
      continue
    }
    const cells = trim
      .split('|')
      .slice(1, -1)
      .map((c) => c.replace(/`/g, '').trim())

    if (cells.length < 4) continue
    const [oldName, type, violation, newName] = cells
    if (!oldName || !newName || oldName === 'Old Name') continue

    entries.push({
      oldName,
      type: (type as MigrationEntry['type']) ?? 'D',
      violation,
      newName,
    })
  }

  return entries
}

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

export function buildFileList(dir: string): string[] {
  const results: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let stat: ReturnType<typeof statSync>
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      results.push(...buildFileList(full))
    } else {
      const ext = entry.includes('.') ? `.${entry.split('.').pop()}` : ''
      if (SCAN_EXTENSIONS.has(ext)) {
        results.push(full)
      }
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Replacement logic
// ---------------------------------------------------------------------------

type ReplaceSummary = {
  filePath: string
  replacements: Array<{ oldRef: string; newRef: string; count: number }>
}

export function replaceInFile(
  filePath: string,
  migrations: MigrationEntry[],
  dryRun: boolean
): ReplaceSummary | null {
  let content: string
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }

  let updated = content
  const replacements: ReplaceSummary['replacements'] = []

  for (const { oldName, newName } of migrations) {
    const pattern = `bun run ${oldName}`
    const replacement = `bun run ${newName}`
    if (updated.includes(pattern)) {
      const count = updated.split(pattern).length - 1
      updated = updated.replaceAll(pattern, replacement)
      replacements.push({ oldRef: pattern, newRef: replacement, count })
    }
  }

  if (replacements.length === 0) return null

  if (!dryRun) {
    writeFileSync(filePath, updated, 'utf-8')
  }

  return { filePath: filePath.replace(`${REPO_ROOT}/`, ''), replacements }
}

// ---------------------------------------------------------------------------
// Validate no remnants remain
// ---------------------------------------------------------------------------

export function validateNoRemnants(
  files: string[],
  migrations: MigrationEntry[]
): Array<{ file: string; refs: string[] }> {
  const remnants: Array<{ file: string; refs: string[] }> = []

  for (const filePath of files) {
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }
    const found: string[] = []
    for (const { oldName } of migrations) {
      if (content.includes(`bun run ${oldName}`)) {
        found.push(oldName)
      }
    }
    if (found.length > 0) {
      remnants.push({ file: filePath.replace(`${REPO_ROOT}/`, ''), refs: found })
    }
  }

  return remnants
}

// ---------------------------------------------------------------------------
// Report writer
// ---------------------------------------------------------------------------

export function writeReport(
  summaries: ReplaceSummary[],
  remnants: Array<{ file: string; refs: string[] }>,
  dryRun: boolean,
  migrationCount: number
): void {
  const iso = new Date().toISOString()
  const lines: string[] = [
    '# Script Refactor Report',
    '',
    `> Generated: ${iso}`,
    `> Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`,
    `> Migration entries applied: ${migrationCount}`,
    '',
    '## Changes Made',
    '',
  ]

  if (summaries.length === 0) {
    lines.push('_No changes were necessary._', '')
  } else {
    for (const s of summaries) {
      lines.push(`### ${s.filePath}`, '')
      for (const r of s.replacements) {
        lines.push(`- \`${r.oldRef}\` → \`${r.newRef}\` (${r.count}x)`)
      }
      lines.push('')
    }
  }

  lines.push('## Unresolved References', '')

  if (remnants.length === 0) {
    lines.push('✅ Unresolved references: 0', '')
  } else {
    lines.push(`❌ Unresolved references: ${remnants.length}`, '')
    for (const r of remnants) {
      lines.push(`### ${r.file}`, '')
      for (const ref of r.refs) {
        lines.push(`- \`bun run ${ref}\``)
      }
      lines.push('')
    }
  }

  mkdirSync(join(REPO_ROOT, 'reports'), { recursive: true })
  if (!dryRun) {
    writeFileSync(REPORT_PATH, lines.join('\n'), 'utf-8')
  }

  process.stdout.write(lines.join('\n'))
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  log.header(
    'REFACTOR SCRIPTS',
    'Applies SCRIPT_MIGRATION_MAP to rename bun run references across the repository'
  )
  if (DRY_RUN) {
    logger.info('Running in DRY RUN mode — no files will be written')
  }

  if (!existsSync(MIGRATION_MAP_PATH)) {
    logger.error('Migration map not found', { path: MIGRATION_MAP_PATH })
    process.stderr.write(`\n❌ Migration map not found: ${MIGRATION_MAP_PATH}\n`)
    exit(1)
  }

  const mapContent = readFileSync(MIGRATION_MAP_PATH, 'utf-8')
  const migrations = parseMigrationMap(mapContent)
  logger.info('Migration entries loaded', { count: migrations.length })

  const files = buildFileList(REPO_ROOT)
  logger.info('Files to process', { count: files.length })

  const summaries: ReplaceSummary[] = []
  let totalReplacements = 0

  for (const filePath of files) {
    const summary = replaceInFile(filePath, migrations, DRY_RUN)
    if (summary) {
      summaries.push(summary)
      totalReplacements += summary.replacements.reduce((acc, r) => acc + r.count, 0)
    }
  }

  logger.info('Replacements applied', { files: summaries.length, total: totalReplacements })

  // Re-collect files after in-place edits
  const refreshedFiles = DRY_RUN ? files : buildFileList(REPO_ROOT)
  const remnants = validateNoRemnants(refreshedFiles, migrations)

  writeReport(summaries, remnants, DRY_RUN, migrations.length)

  if (remnants.length > 0) {
    logger.error('Unresolved references remain', { count: remnants.length })
    log.result({ total: migrations.length, passed: summaries.length, failed: remnants.length })
    exit(1)
  }

  logger.info('Refactor complete', { changed: summaries.length, dryRun: DRY_RUN })
  log.result({ total: migrations.length, passed: summaries.length, failed: 0 })
  exit(0)
}

if (import.meta.main) {
  main()
}
