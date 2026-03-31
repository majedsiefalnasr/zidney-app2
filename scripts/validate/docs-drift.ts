#!/usr/bin/env bun

/**
 * @script validate:scripts:docs-drift
 * @domain validate
 * @category governance
 * @description Detects scripts in root package.json that have no corresponding
 *   documentation file in docs/scripts/. Reports missing docs and exits non-zero
 *   when undocumented scripts are found.
 * @usage bun run validate:scripts:docs-drift
 */

import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger, exit, hasCiFlag, log } from '../utils/logger'

const correlationId = randomUUID()
const args = process.argv.slice(2)
const isCi = hasCiFlag(args)
const logger = createLogger('validate:scripts:docs-drift')
logger.setContext({ correlationId, ci: isCi })

try {
  log.setScript('validate:scripts:docs-drift')
} catch {
  // ignore
}

const REPO_ROOT = process.cwd()
const DOCS_DIR = join(REPO_ROOT, 'docs', 'scripts')

/** Lifecycle/toolchain scripts exempt from documentation requirements */
const EXEMPT_SCRIPTS = new Set([
  'prepare',
  'prepublish',
  'prepublishOnly',
  'postinstall',
  'preinstall',
  'start',
  // Meta scripts that are aliases documented elsewhere
  'refactor-scripts',
  // Underscore-prefixed comments (not actual scripts)
  '_comments',
  '_validate',
  '_arch',
  '_test',
  '_dev',
  '_ai',
  '_db',
  '_infra',
  '_governance',
  '_ci',
  '_repo',
  '_other',
])

/**
 * Convert a package.json script key to the expected docs filename.
 * Convention: replace `:` with `-`, append `.md`
 * Examples:
 *   "validate:scripts:all" -> "validate-scripts-all.md"
 *   "arch:audit" -> "arch-audit.md"
 *   "test" -> "test.md"
 */
function scriptKeyToDocFilename(key: string): string {
  return `${key.replace(/:/g, '-')}.md`
}

function main(): void {
  log.header(
    'Docs Drift Guard',
    'Detects package.json scripts without corresponding docs/scripts/ documentation'
  )

  const pkgPath = join(REPO_ROOT, 'package.json')
  let scripts: Record<string, string>
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
      scripts?: Record<string, string>
    }
    scripts = pkg.scripts ?? {}
  } catch (err) {
    logger.error('Failed to load package.json', {
      error: err instanceof Error ? err.message : String(err),
    })
    exit(1)
    return
  }

  if (!existsSync(DOCS_DIR)) {
    logger.error('docs/scripts/ directory does not exist')
    exit(1)
    return
  }

  // Build set of script names that have documentation.
  // Strategy: parse each .md file for `bun run <script>` to map docs to script names.
  // This handles legacy naming where doc files don't follow <key>.md convention.
  const documentedScripts = new Set<string>()
  const docFiles = readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'))

  for (const file of docFiles) {
    const filePath = join(DOCS_DIR, file)
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }
    const match = content.match(/bun run ([A-Za-z][A-Za-z0-9:_-]*)/)
    if (match) {
      documentedScripts.add(match[1])
    }
    // Also accept if filename matches <key>.md convention
    const keyFromFilename = file.replace('.md', '').replace(/-/g, ':')
    documentedScripts.add(keyFromFilename)
  }

  const scriptKeys = Object.keys(scripts)
  const missing: string[] = []
  const documented: string[] = []

  for (const key of scriptKeys) {
    // Skip section markers and metadata (keys starting with _)
    if (key.startsWith('_')) continue
    if (EXEMPT_SCRIPTS.has(key)) continue

    if (documentedScripts.has(key)) {
      documented.push(key)
    } else {
      missing.push(key)
    }
  }

  logger.info('Docs drift scan complete', {
    total: scriptKeys.length,
    documented: documented.length,
    missing: missing.length,
    exempt: scriptKeys.length - documented.length - missing.length,
  })

  if (missing.length > 0) {
    log.section('Undocumented Scripts')
    const items = missing.map(
      (key) => `${key} — expected docs/scripts/${scriptKeyToDocFilename(key)}`
    )
    log.failList('Scripts missing documentation', items)

    log.badge('DOCS DRIFT DETECTED', 'error')
    log.result({
      passed: documented.length,
      failed: missing.length,
      total: scriptKeys.length,
      message: 'Run: bun run dev:generate:script-docs to auto-generate missing docs',
    })
    exit(1)
  }

  logger.info('All scripts are documented')
  log.badge('DOCS DRIFT PASSED', 'success')
  log.result({
    passed: documented.length,
    failed: 0,
    total: scriptKeys.length,
    message: 'All package.json scripts have docs',
  })
  exit(0)
}

main()
