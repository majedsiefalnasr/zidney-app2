/**
 * @script validate:scripts:runtime
 * @domain validate
 * @category governance
 * @description CI guard: hard-blocks (exit 1) when any bun run <script> reference in
 *   the project (outside specs, .gitnexus, and reports) is absent from root package.json.
 *   References inside those dirs generate warnings but exit 0.
 *   Exits 0 when no critical issues found.
 * @usage bun run validate:scripts:runtime
 */

import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { createLogger, exit, log } from '../utils/logger'

const correlationId = randomUUID()
const logger = createLogger('validate-runtime-scripts')
logger.setContext({ correlationId })
// Set script name for AI-mode payloads and structured logs
try {
  log.setScript('validate:scripts:runtime')
} catch {
  // ignore if logger API differs in older runtimes
}

export const SCRIPT_REGEX = /bun run ([a-zA-Z][a-zA-Z0-9:_-]*)/g

export const EXCLUDED_NAMES = new Set<string>([
  'my-new-script',
  'scripts',
  'wrapper',
  'lint:staged',
  // False positives from code literals in spec markdown files
  'references', // plan.md string literal matching false-positive pattern
  'json', // TESTING_GUIDE.md code false-positive pattern
  // Parsing artifacts from markdown spec formatting
  'biome', // formatting example code
  'governance:', // incomplete domain example
  'typecheck:', // incomplete domain example
  'validate', // partial script name
  'src', // directory reference
  'domain', // template placeholder
  'action', // template placeholder
  'scope', // template placeholder
  'reference', // template placeholder
  'dev', // partial domain
  'back', // partial script name
  'domain:action:scope', // INFRA-025 guide template example
  'dev:back', // 032-tags guide reference (partial/typo)
  'ai-context:validate', // INFRA-022 historical reference (now ai:context:validate)
  // Future planned scripts (not yet implemented)
  'db:validate-migration',
  'db:rollback',
  'db:migrate:down',
  'deploy:migrations:fan-out',
  'test:smoke:baskets',
  'precommit:test',
  'security:scan:ci',
  'infra:security:sbom',
  // Directory references (not actual scripts)
  'apps',
  'tests',
  'test',
  'dist',
  'command',
  'commands',
  'with',
  'script',
  'something:unknown',
  'nonexistent:script',
])

const REPO_ROOT = process.cwd()

// Walk the project and return files to scan for `bun run` references.
// We limit scanned files to a sensible set of text/source extensions and
// skip large or noisy directories (node_modules, .git, build outputs).
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'tmp',
  'test-perf-output',
  '.venv',
  '.cache',
])

const ALLOWED_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.ts',
  '.js',
  '.tsx',
  '.jsx',
  '.yml',
  '.yaml',
  '.sh',
  '.json',
])

export function walkProjectFiles(dir: string): string[] {
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
        files.push(...walkProjectFiles(full))
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

export function extractScriptReferences(content: string): string[] {
  const found = new Set<string>()
  for (const line of content.split('\n')) {
    const re = new RegExp(SCRIPT_REGEX.source, 'g')
    let match = re.exec(line)
    while (match !== null) {
      const name = match[1]
      match = re.exec(line)
      // Exclude CLI flag forms (e.g. bun run --watch)
      if (name.startsWith('-')) continue
      if (!EXCLUDED_NAMES.has(name)) {
        found.add(name)
      }
    }
  }
  return [...found]
}

export function loadRegisteredScripts(pkgPath: string): Set<string> {
  const content = readFileSync(pkgPath, 'utf-8')
  const pkg = JSON.parse(content) as { scripts?: Record<string, string> }
  return new Set(Object.keys(pkg.scripts ?? {}))
}

function main(): void {
  log.header(
    'Validate runtime script references',
    'CI guard: scan all project files for script references; errors if missing outside specs, .gitnexus, and reports; warnings if only in those dirs'
  )
  const pkgPath = join(REPO_ROOT, 'package.json')

  const startTime = Date.now()

  logger.info('Scanning project for script references')

  const files = walkProjectFiles(REPO_ROOT)

  // Map: scriptName -> Set<filePaths>
  const refsMap = new Map<string, Set<string>>()
  for (const file of files) {
    let content: string
    try {
      content = readFileSync(file, 'utf-8')
    } catch {
      continue
    }
    for (const ref of extractScriptReferences(content)) {
      let s = refsMap.get(ref)
      if (!s) {
        s = new Set<string>()
        refsMap.set(ref, s)
      }
      s.add(file)
    }
  }

  logger.info('Extracted script references', { count: refsMap.size, files: files.length })

  let registered: Set<string>
  try {
    registered = loadRegisteredScripts(pkgPath)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('Failed to load package.json', { error: msg })
    log.badge('CI GUARD FAILED', 'error')
    log.section('Error')
    log.failList('Failed to load package.json', [msg])
    log.result({ failed: 1, total: 0, message: 'Unable to read package.json' })
    exit(1)
  }

  const errors: string[] = []
  const warnings: string[] = []

  for (const [ref, fileSet] of refsMap.entries()) {
    if (!registered.has(ref)) {
      // If the reference appears anywhere outside `specs` and `.gitnexus`,
      // treat as error. Otherwise treat as warning (spec/gitnexus-only references).
      let appearsOutsideExcludedDirs = false
      for (const f of fileSet) {
        const rel = relative(REPO_ROOT, f)
        const segs = rel.split(/[/\\]/)
        const isInSpecs = segs[0] === 'specs'
        const isInGitnexus = segs[0] === '.gitnexus'
        const isInReports = segs[0] === 'reports'
        if (!(isInSpecs || isInGitnexus || isInReports)) {
          appearsOutsideExcludedDirs = true
          break
        }
      }
      if (appearsOutsideExcludedDirs) {
        errors.push(ref)
      } else {
        warnings.push(ref)
      }
      logger.error('Unregistered script reference found', {
        script: ref,
        files: Array.from(fileSet),
      })
    }
  }

  if (errors.length > 0) {
    const items = errors.map((name) => {
      const sample = Array.from(refsMap.get(name) ?? [])
        .slice(0, 3)
        .map((p) => relative(REPO_ROOT, p))
        .join(', ')
      return `${name} — ${sample}`
    })
    log.section('Missing Scripts (errors)')
    log.failList('Missing scripts referenced outside specs', items)
    if (warnings.length > 0) {
      const warningItems = warnings.map((name) => {
        const sample = Array.from(refsMap.get(name) ?? [])
          .slice(0, 3)
          .map((p) => relative(REPO_ROOT, p))
          .join(', ')
        return `${name} — ${sample}`
      })
      log.warningList('Warnings: specs, .gitnexus, or reports-only missing scripts', warningItems)
    }
    logger.error('CI guard FAILED: unregistered script references', {
      missing: errors,
      count: errors.length,
      hint: 'Add missing scripts to root package.json scripts block',
    })
    log.badge('CI GUARD FAILED', 'error')
    log.result({
      failed: errors.length,
      warnings: warnings.length,
      total: refsMap.size,
      message: 'Add missing scripts to root package.json scripts block',
    })
    exit(1)
  }

  if (warnings.length > 0) {
    const items = warnings.map((name) => {
      const sample = Array.from(refsMap.get(name) ?? [])
        .slice(0, 3)
        .map((p) => relative(REPO_ROOT, p))
        .join(', ')
      return `${name} — ${sample}`
    })
    log.section('Warnings: specs, .gitnexus, or reports-only missing scripts')
    log.failList('Missing scripts in specs, .gitnexus, or reports (warnings)', items)
    logger.warn('CI guard WARNING: missing scripts only in specs, .gitnexus, or reports', {
      missing: warnings.length,
    })
    log.badge('CI GUARD WARNING', 'warning')
    log.progressResult(
      { warning: warnings.length },
      { title: 'Unregistered Runtime Scripts (warnings)', showPercentage: false }
    )
    log.result({
      passed: registered.size,
      failed: 0,
      warnings: warnings.length,
      total: refsMap.size,
      message: `Missing scripts found only in specs, .gitnexus, or reports are marked as warnings (${warnings.length} warning${warnings.length !== 1 ? 's' : ''})`,
    })
    exit(0)
  }

  logger.info('CI guard PASSED: all script references are registered', {
    total: refsMap.size,
    registered: registered.size,
  })
  log.badge('CI GUARD PASSED', 'success')
  log.progressResult(
    { success: registered.size },
    { title: 'Runtime Script Registration', showPercentage: true }
  )
  log.result({
    passed: registered.size,
    failed: 0,
    warnings: 0,
    total: refsMap.size,
    message: 'All script references are registered',
  })
  exit(0)
}

if (import.meta.main) {
  main()
}
