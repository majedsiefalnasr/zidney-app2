/**
 * @script validate:script:usage
 * @domain validate
 * @category governance
 * @description Scans all .ts, .json, .yml, .yaml, .md, and .sh files for
 *   "bun run <name>" references and validates that every referenced name exists
 *   in a package.json scripts block. Reports all broken/orphan references
 *   before exiting non-zero.
 * @usage bun run validate:script:usage
 * @mode ci,manual
 * @dependencies node:fs,node:path,node:crypto
 */

import { randomUUID } from 'node:crypto'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '../core/logger-factory'
import { collectPackageJsonFiles, parseScriptEntries } from './script-naming'
import type { ViolationRecord } from './types'

const correlationId = randomUUID()
const logger = createLogger('validate:script:usage')
logger.setContext({ correlationId })

const REPO_ROOT = process.cwd()

const SCAN_EXTENSIONS = new Set(['.ts', '.json', '.yml', '.yaml', '.md', '.sh'])

const EXCLUDE_DIRS = new Set([
  'node_modules',
  'coverage',
  'dist',
  '.git',
  '__tests__',
  '.turbo',
  '.cache',
  // Auto-generated and historical artifact directories not subject to usage validation
  '.gitnexus',
  'runtime', // specs/runtime — historical stage artifacts
  'templates', // specs/templates — workflow templates with generic examples
  'reports', // generated refactor/audit reports documenting historical script names
  'phases', // specs/phases — stage specification documents (may reference past/future scripts)
])

/** Matches: bun run [--flags] <script-name> */
export const USAGE_RE = /bun run (?:--?\S+ )*([\w:.-]+)/g

export function walkScanFiles(dir: string, rootDir: string = dir): string[] {
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
      results.push(...walkScanFiles(full, rootDir))
    } else {
      const ext = entry.includes('.') ? `.${entry.split('.').pop()}` : ''
      if (SCAN_EXTENSIONS.has(ext)) {
        results.push(full)
      }
    }
  }
  return results
}

export function extractUsages(
  _filePath: string,
  content: string
): Array<{ name: string; line: number }> {
  const usages: Array<{ name: string; line: number }> = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    USAGE_RE.lastIndex = 0
    let match: RegExpExecArray | null = USAGE_RE.exec(line)
    while (match !== null) {
      const name = match[1]
      const matchEnd = match.index + match[0].length
      // Skip flag-like captures: `bun run -e "..."` matches `-e` as script name
      // Skip path-like captures: `bun run src/index.ts` matches `src` (stops at `/`)
      if (!name.startsWith('-') && !(matchEnd < line.length && line[matchEnd] === '/')) {
        usages.push({ name, line: i + 1 })
      }
      match = USAGE_RE.exec(line)
    }
  }

  return usages
}

export function collectKnownScripts(repoRoot: string): Set<string> {
  const known = new Set<string>()
  const pkgFiles = collectPackageJsonFiles(repoRoot)
  for (const pkgFile of pkgFiles) {
    for (const entry of parseScriptEntries(pkgFile)) {
      known.add(entry.name)
    }
  }
  return known
}

export function validateUsages(
  scanFiles: string[],
  knownScripts: Set<string>,
  repoRoot: string
): ViolationRecord[] {
  const violations: ViolationRecord[] = []

  for (const filePath of scanFiles) {
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }

    const usages = extractUsages(filePath, content)
    for (const { name, line } of usages) {
      if (!knownScripts.has(name)) {
        violations.push({
          rule: 'script-usage-unknown',
          file: filePath.replace(`${repoRoot}/`, ''),
          line,
          scriptName: name,
          message: `"bun run ${name}" references an unknown script`,
          hint: `Add "${name}" to the appropriate package.json or update the reference`,
        })
      }
    }
  }

  return violations
}

function main(): void {
  logger.info('Starting script usage validation', { repoRoot: REPO_ROOT })

  const knownScripts = collectKnownScripts(REPO_ROOT)
  logger.info('Known scripts loaded', { count: knownScripts.size })

  const scanFiles = walkScanFiles(REPO_ROOT)
  logger.info('Files to scan', { count: scanFiles.length })

  const violations = validateUsages(scanFiles, knownScripts, REPO_ROOT)

  if (violations.length === 0) {
    logger.info('All script references are valid')
    process.stdout.write('\n✓ validate:script:usage — all "bun run" references are valid\n')
    process.exit(0)
  }

  logger.error('Script usage violations found', { count: violations.length })
  process.stderr.write(`\n❌ validate:script:usage — ${violations.length} broken reference(s):\n\n`)

  for (const v of violations) {
    process.stderr.write(`  ${v.file}:${v.line ?? '?'}\n`)
    process.stderr.write(`    ${v.message}\n`)
    if (v.hint) process.stderr.write(`    Hint: ${v.hint}\n`)
    process.stderr.write('\n')
  }

  process.exit(1)
}

if (import.meta.main) {
  main()
}
