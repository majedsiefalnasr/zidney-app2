/**
 * @script validate:runtime:scripts
 * @domain validate
 * @category governance
 * @description CI guard: hard-blocks (exit 1) when any bun run <script> reference in
 *   specs/runtime/** is absent from root package.json. Exits 0 when all are registered.
 * @usage bun run validate:runtime:scripts
 */

import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '../core/logger-factory'

const correlationId = randomUUID()
const logger = createLogger('validate-runtime-scripts')
logger.setContext({ correlationId })

export const SCRIPT_REGEX = /bun run ([a-zA-Z][a-zA-Z0-9:_-]*)/g

export const EXCLUDED_NAMES = new Set<string>([
  'my-new-script',
  'scripts',
  'wrapper',
  'lint:staged',
  // False positives from code literals in spec markdown files
  'references', // plan.md string literal matching false-positive pattern
  'json', // TESTING_GUIDE.md code false-positive pattern
])

const REPO_ROOT = process.cwd()

export function walkMarkdownFiles(dir: string): string[] {
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
        files.push(...walkMarkdownFiles(full))
      } else if (entry.endsWith('.md')) {
        files.push(full)
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
  const specsDir = join(REPO_ROOT, 'specs/runtime')
  const pkgPath = join(REPO_ROOT, 'package.json')

  logger.info('Scanning runtime spec docs for script references', { specsDir })

  const mdFiles = walkMarkdownFiles(specsDir)

  const allRefs = new Set<string>()
  for (const file of mdFiles) {
    let content: string
    try {
      content = readFileSync(file, 'utf-8')
    } catch {
      continue
    }
    for (const ref of extractScriptReferences(content)) {
      allRefs.add(ref)
    }
  }

  logger.info('Extracted script references', { count: allRefs.size })

  let registered: Set<string>
  try {
    registered = loadRegisteredScripts(pkgPath)
  } catch (err) {
    logger.error('Failed to load package.json', {
      error: err instanceof Error ? err.message : String(err),
    })
    process.exit(1)
  }

  const missing: string[] = []
  for (const ref of allRefs) {
    if (!registered.has(ref)) {
      missing.push(ref)
      logger.error('Unregistered script reference found', { script: ref })
    }
  }

  if (missing.length > 0) {
    logger.error('CI guard FAILED: unregistered script references', {
      missing,
      count: missing.length,
      hint: 'Add missing scripts to root package.json scripts block',
    })
    process.exit(1)
  }

  logger.info('CI guard PASSED: all runtime spec script references are registered', {
    total: allRefs.size,
    registered: registered.size,
  })
  process.exit(0)
}

if (import.meta.main) {
  main()
}
