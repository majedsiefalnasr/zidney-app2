#!/usr/bin/env bun

/**
 * @script dev:refactor:scripts
 * @domain dev
 * @category dev
 * @description Applies the migration map to rename all "bun run <old>"
 *   references across the repository. Supports both JSON format
 *   (docs/scripts/migration-map.json, preferred) and Markdown format
 *   (docs/scripts/SCRIPT_MIGRATION_MAP.md, legacy). Builds the old→new
 *   rename index, then rewrites all matching files in-place. Supports
 *   --dry-run to preview changes without writing. Exits 1 if any
 *   unresolved references remain. Writes reports to both
 *   reports/SCRIPT_REFACTOR_REPORT.md and docs/reports/script-refactor-report.json.
 * @usage bun run dev:refactor:scripts [--dry-run]
 */

import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger, exit, hasCiFlag, log } from '../utils/logger'
import type { MigrationEntry } from '../validate/types'

const correlationId = randomUUID()
const args = process.argv.slice(2)
const isCi = hasCiFlag(args)
const logger = createLogger('dev:refactor:scripts')
logger.setContext({ correlationId, ci: isCi })

const REPO_ROOT = process.cwd()
const MIGRATION_MAP_MD_PATH = join(REPO_ROOT, 'docs/scripts/SCRIPT_MIGRATION_MAP.md')
const MIGRATION_MAP_JSON_PATH = join(REPO_ROOT, 'docs/scripts/migration-map.json')
const REPORT_MD_PATH = join(REPO_ROOT, 'reports/SCRIPT_REFACTOR_REPORT.md')
const REPORT_JSON_PATH = join(REPO_ROOT, 'docs/reports/script-refactor-report.json')

const DRY_RUN = args.includes('--dry-run')

/** File patterns to scan and rewrite */
const SCAN_EXTENSIONS = new Set(['.json', '.ts', '.yml', '.yaml', '.md', '.sh'])

const EXCLUDE_DIRS = new Set(['node_modules', 'coverage', 'dist', '.git', '.turbo', '.cache'])

/** Files to exclude from scanning (they document old→new changes and naturally contain old names) */
const EXCLUDE_FILES = new Set([
  join(REPO_ROOT, 'reports/SCRIPT_REFACTOR_REPORT.md'),
  join(REPO_ROOT, 'docs/reports/script-refactor-report.json'),
])

// ---------------------------------------------------------------------------
// Parsing the migration map (Markdown format — legacy)
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
// Parsing the migration map (JSON format — v2.0)
// ---------------------------------------------------------------------------

interface JsonMigrationMap {
  version: string
  migrations: Record<string, { newName: string | null; type: string; reason: string }>
}

export function parseJsonMigrationMap(content: string): MigrationEntry[] {
  const map: JsonMigrationMap = JSON.parse(content)
  const entries: MigrationEntry[] = []

  for (const [oldName, entry] of Object.entries(map.migrations)) {
    // Skip removals (newName === null) — nothing to rename
    if (!entry.newName) continue

    entries.push({
      oldName,
      type: 'D', // JSON map does not carry legacy type codes; default to D (legacy)
      violation: entry.reason,
      newName: entry.newName,
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
      if (SCAN_EXTENSIONS.has(ext) && !EXCLUDE_FILES.has(full)) {
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
    const patterns = [
      { oldRef: `bun run ${oldName}`, newRef: `bun run ${newName}` },
      { oldRef: `bun ${oldName}`, newRef: `bun ${newName}` },
    ]

    for (const pattern of patterns) {
      if (!updated.includes(pattern.oldRef)) {
        continue
      }

      // Use a regex with a word-boundary lookahead to avoid prefix matching.
      // Matches "bun run format:write" only when NOT followed by ":" or a word char.
      const escaped = pattern.oldRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`${escaped}(?![:\\w])`, 'g')
      const matches = updated.match(re)
      if (!matches || matches.length === 0) continue

      const count = matches.length
      updated = updated.replace(re, pattern.newRef)
      replacements.push({ oldRef: pattern.oldRef, newRef: pattern.newRef, count })
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
      // Word-boundary check: match "bun run <old>" only when NOT followed by ":" or word char
      const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`bun (run )?${escaped}(?![:\\w])`)
      if (re.test(content)) {
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

  // Write Markdown report
  mkdirSync(join(REPO_ROOT, 'reports'), { recursive: true })
  if (!dryRun) {
    writeFileSync(REPORT_MD_PATH, lines.join('\n'), 'utf-8')
  }

  // Write JSON report
  const jsonReport = {
    generated: iso,
    mode: dryRun ? 'dry-run' : 'live',
    migrationCount,
    filesChanged: summaries.length,
    totalReplacements: summaries.reduce(
      (acc, s) => acc + s.replacements.reduce((a, r) => a + r.count, 0),
      0
    ),
    changes: summaries.map((s) => ({
      file: s.filePath,
      replacements: s.replacements,
    })),
    unresolvedReferences: remnants,
    status: remnants.length === 0 ? 'clean' : 'has-remnants',
  }

  mkdirSync(join(REPO_ROOT, 'docs/reports'), { recursive: true })
  if (!dryRun) {
    writeFileSync(REPORT_JSON_PATH, JSON.stringify(jsonReport, null, 2), 'utf-8')
  }

  process.stdout.write(lines.join('\n'))
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  log.header(
    'REFACTOR SCRIPTS',
    'Applies migration map to rename script runners across the repository'
  )
  if (isCi) {
    logger.error('dev:refactor:scripts mutates repository files and cannot run with --ci')
    exit(1)
  }
  if (DRY_RUN) {
    logger.info('Running in DRY RUN mode — no files will be written')
  }

  // Prefer JSON migration map; fall back to Markdown
  let migrations: MigrationEntry[]
  if (existsSync(MIGRATION_MAP_JSON_PATH)) {
    const mapContent = readFileSync(MIGRATION_MAP_JSON_PATH, 'utf-8')
    migrations = parseJsonMigrationMap(mapContent)
    logger.info('JSON migration map loaded', {
      path: 'docs/scripts/migration-map.json',
      count: migrations.length,
    })
  } else if (existsSync(MIGRATION_MAP_MD_PATH)) {
    const mapContent = readFileSync(MIGRATION_MAP_MD_PATH, 'utf-8')
    migrations = parseMigrationMap(mapContent)
    logger.info('Markdown migration map loaded', {
      path: 'docs/scripts/SCRIPT_MIGRATION_MAP.md',
      count: migrations.length,
    })
  } else {
    logger.error('No migration map found', {
      tried: [MIGRATION_MAP_JSON_PATH, MIGRATION_MAP_MD_PATH],
    })
    process.stderr.write(
      `\n❌ No migration map found. Expected:\n  - ${MIGRATION_MAP_JSON_PATH}\n  - ${MIGRATION_MAP_MD_PATH}\n`
    )
    exit(1)
  }
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

function isDirectExecution(): boolean {
  const entry = process.argv[1] ?? ''
  return /(?:^|[\\/])refactor-scripts\.ts$/.test(entry)
}

if (isDirectExecution()) {
  main()
}
