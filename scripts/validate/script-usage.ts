#!/usr/bin/env bun

/**
 * @script validate:scripts:usage
 * @domain validate
 * @category governance
 * @description Scans all .ts, .json, .yml, .yaml, .md, and .sh files for
 *   "bun run <name>" references and validates that every referenced name exists
 *   in a package.json scripts block. Reports all broken/orphan references
 *   before exiting non-zero.
 * @usage bun run validate:scripts:usage
 */

import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { createLogger, exit, hasCiFlag, log } from '../utils/logger'
import { collectPackageJsonFiles, parseScriptEntries } from './script-naming'
import type { ViolationRecord } from './types'

const correlationId = randomUUID()
const args = process.argv.slice(2)
const isCi = hasCiFlag(args)
const logger = createLogger('validate:scripts:usage')
logger.setContext({ correlationId, ci: isCi })

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

const EXCLUDE_PATH_PREFIXES = ['docs/ai/context/', 'docs/architecture/health/']

// Script names that may appear in prose or comments and should be ignored
// by the usage validator to avoid false-positives (for example: "bun run calls").
const EXCLUDE_SCRIPT_NAMES = new Set(['calls'])

/** Matches: bun run [--flags] <script-name> */
export const USAGE_RE = /bun run (?:--?\S+ )*([\w:.-]+)/g

/** Matches direct implementation invocations such as: bun scripts/foo/bar.ts --flag */
export const DIRECT_COMMAND_RE = /\bbun (scripts\/[^\s'"`]+\.(?:ts|js|sh)(?:\s+--?[^\n`]+)*)/g

export function walkScanFiles(dir: string, rootDir: string = dir): string[] {
  const results: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    const rel = full.replace(`${rootDir}/`, '')
    if (EXCLUDE_DIRS.has(entry)) continue
    if (EXCLUDE_PATH_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue
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

export function collectRegisteredCommands(repoRoot: string): Map<string, string> {
  const commands = new Map<string, string>()
  const pkgFiles = collectPackageJsonFiles(repoRoot)

  for (const pkgFile of pkgFiles) {
    for (const entry of parseScriptEntries(pkgFile)) {
      commands.set(entry.command.replace(/^bun\s+/, '').trim(), entry.name)
    }
  }

  return commands
}

export function extractDirectCommandRefs(
  filePath: string,
  content: string,
  registeredCommands: Map<string, string>
): Array<{ command: string; scriptName: string; line: number }> {
  const refs: Array<{ command: string; scriptName: string; line: number }> = []
  if (basename(filePath) === 'package.json') {
    return refs
  }

  const lines = content.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    DIRECT_COMMAND_RE.lastIndex = 0
    let match: RegExpExecArray | null = DIRECT_COMMAND_RE.exec(line)

    while (match !== null) {
      const command = match[1].trim()
      const scriptName = registeredCommands.get(command)
      if (scriptName) {
        refs.push({ command, scriptName, line: index + 1 })
      }
      match = DIRECT_COMMAND_RE.exec(line)
    }
  }

  return refs
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
  repoRoot: string,
  registeredCommands: Map<string, string> = collectRegisteredCommands(repoRoot)
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
      if (EXCLUDE_SCRIPT_NAMES.has(name)) continue
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

    const directRefs = extractDirectCommandRefs(filePath, content, registeredCommands)
    for (const ref of directRefs) {
      violations.push({
        rule: 'script-usage-direct-command',
        file: filePath.replace(`${repoRoot}/`, ''),
        line: ref.line,
        scriptName: ref.scriptName,
        message: `Use "bun run ${ref.scriptName}" instead of "bun ${ref.command}"`,
        hint: `Replace the direct script path with "bun run ${ref.scriptName}"`,
      })
    }
  }

  return violations
}

function isDirectExecution(): boolean {
  const entry = process.argv[1] ?? ''
  return /(?:^|[\\/])script-usage\.ts$/.test(entry)
}

function main(): void {
  log.header(
    'Validate script usage',
    'Scan files for repository script references and validate known scripts'
  )
  logger.info('Starting script usage validation', { repoRoot: REPO_ROOT })

  const knownScripts = collectKnownScripts(REPO_ROOT)
  const registeredCommands = collectRegisteredCommands(REPO_ROOT)
  logger.info('Known scripts loaded', { count: knownScripts.size })

  const scanFiles = walkScanFiles(REPO_ROOT)
  logger.info('Files to scan', { count: scanFiles.length })

  const violations = validateUsages(scanFiles, knownScripts, REPO_ROOT, registeredCommands)

  if (violations.length === 0) {
    logger.info('All script references are valid')
    log.badge('USAGE VALID', 'success')
    log.progressResult(
      { success: scanFiles.length },
      { title: 'Script Reference Validation', showPercentage: true }
    )
    exit(0)
  }

  logger.error('Script usage violations found', { count: violations.length })
  for (const v of violations) {
    logger.error(`${v.file}:${v.line ?? '?'} — ${v.message}`, { hint: v.hint })
  }

  log.badge('USAGE VIOLATIONS', 'error')
  log.progressResult(
    { error: violations.length },
    { title: 'Invalid Script References', showPercentage: false }
  )
  exit(1)
}

if (isDirectExecution()) {
  main()
}
