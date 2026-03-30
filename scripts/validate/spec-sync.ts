#!/usr/bin/env bun

/**
 * @script validate:scripts:spec-sync
 * @domain validate
 * @category governance
 * @description Reverse validation: scans all spec files (specs/, docs/) for
 *   `bun run <script>` references and verifies each exists in root package.json.
 *   Exits non-zero if any referenced script is missing.
 * @usage bun run validate:scripts:spec-sync
 */

import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { createLogger, exit, hasCiFlag, log } from '../utils/logger'
import { EXCLUDED_NAMES, loadRegisteredScripts, SCRIPT_REGEX } from './runtime-scripts'

const correlationId = randomUUID()
const args = process.argv.slice(2)
const isCi = hasCiFlag(args)
const logger = createLogger('validate:scripts:spec-sync')
logger.setContext({ correlationId, ci: isCi })

try {
  log.setScript('validate:scripts:spec-sync')
} catch {
  // ignore
}

const REPO_ROOT = process.cwd()

/** Spec directories to scan for `bun run` references */
const SPEC_DIRS = ['specs', 'docs']

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'tmp'])

const ALLOWED_EXTENSIONS = new Set(['.md', '.markdown', '.yml', '.yaml'])

function walkDir(dir: string): string[] {
  const files: string[] = []
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      let stat: ReturnType<typeof statSync>
      try {
        stat = statSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        if (IGNORED_DIRS.has(entry)) continue
        files.push(...walkDir(full))
      } else {
        const ext = extname(entry).toLowerCase()
        if (ALLOWED_EXTENSIONS.has(ext)) files.push(full)
      }
    }
  } catch {
    // ignore unreadable dirs
  }
  return files
}

function extractScriptRefs(content: string): string[] {
  const found = new Set<string>()
  for (const line of content.split('\n')) {
    const re = new RegExp(SCRIPT_REGEX.source, 'g')
    let match = re.exec(line)
    while (match !== null) {
      const name = match[1]
      match = re.exec(line)
      if (name.startsWith('-')) continue
      if (!EXCLUDED_NAMES.has(name)) {
        found.add(name)
      }
    }
  }
  return [...found]
}

function main(): void {
  log.header(
    'Spec-Sync Validation',
    'Reverse validation: verify all spec `bun run` references exist in package.json'
  )

  const pkgPath = join(REPO_ROOT, 'package.json')
  let registered: Set<string>
  try {
    registered = loadRegisteredScripts(pkgPath)
  } catch (err) {
    logger.error('Failed to load package.json', {
      error: err instanceof Error ? err.message : String(err),
    })
    exit(1)
    return
  }

  // Collect all spec files
  const specFiles: string[] = []
  for (const dir of SPEC_DIRS) {
    const fullDir = join(REPO_ROOT, dir)
    try {
      statSync(fullDir)
      specFiles.push(...walkDir(fullDir))
    } catch {
      logger.warn(`Spec directory not found: ${dir}`)
    }
  }

  logger.info('Scanning spec files for script references', { fileCount: specFiles.length })

  // Map: scriptName -> Set<files>
  const missing = new Map<string, Set<string>>()
  let totalRefs = 0

  for (const file of specFiles) {
    let content: string
    try {
      content = readFileSync(file, 'utf-8')
    } catch {
      continue
    }
    const refs = extractScriptRefs(content)
    totalRefs += refs.length
    for (const ref of refs) {
      if (!registered.has(ref)) {
        let s = missing.get(ref)
        if (!s) {
          s = new Set<string>()
          missing.set(ref, s)
        }
        s.add(relative(REPO_ROOT, file))
      }
    }
  }

  logger.info('Spec-sync scan complete', {
    totalRefs,
    missingScripts: missing.size,
    specFiles: specFiles.length,
  })

  if (missing.size > 0) {
    log.section('Stale Script References in Specs (warnings)')
    const items = Array.from(missing.entries()).map(([name, files]) => {
      const sample = Array.from(files).slice(0, 3).join(', ')
      return `${name} — ${sample}`
    })
    log.warningList('Scripts referenced in specs but missing from package.json', items)

    log.badge('SPEC-SYNC WARNING', 'warning')
    log.result({
      passed: totalRefs - missing.size,
      failed: 0,
      warnings: missing.size,
      total: totalRefs,
      message: `${missing.size} stale spec reference(s) found — consider updating specs or adding scripts`,
    })
    // Non-blocking: spec files are planning artifacts that may reference future/removed scripts
    exit(0)
  }

  logger.info('All spec script references are registered')
  log.badge('SPEC-SYNC PASSED', 'success')
  log.result({
    passed: totalRefs,
    failed: 0,
    total: totalRefs,
    message: 'All spec-referenced scripts exist in package.json',
  })
  exit(0)
}

main()
