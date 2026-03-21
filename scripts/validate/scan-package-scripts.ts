/**
 * @script validate:scan:packages
 * @domain validate
 * @category governance
 * @description Walk all runtime spec docs and extract unique script references
 * @mode manual,ci
 * @usage bun run validate:scan:packages
 * @dependencies node:fs,node:path,node:crypto
 */

import { randomUUID } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createLogger } from '../core/logger-factory'

const correlationId = randomUUID()
const logger = createLogger('scan-package-scripts')
logger.setContext({ correlationId })

const SCRIPT_REGEX = /bun run ([a-zA-Z][a-zA-Z0-9:_-]*)/g
const EXCLUDED_NAMES = new Set([
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
    // directory may not exist
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
      // Exclude CLI flag forms (capture starts with -)
      if (name.startsWith('-')) continue
      if (!EXCLUDED_NAMES.has(name)) {
        found.add(name)
      }
    }
  }
  return [...found]
}

interface ScriptEntry {
  name: string
  occurrences: number
  files: string[]
}

interface ScanOutput {
  scanDate: string
  correlationId: string
  specsDir: string
  totalFiles: number
  totalScanned: number
  excluded: number
  excludedNames: string[]
  inScope: number
  scripts: ScriptEntry[]
}

function main(): void {
  const args = process.argv.slice(2)
  const outputArg = args.find((a) => a.startsWith('--output='))
  const defaultOut = join(
    REPO_ROOT,
    'specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/runtime-script-scan.json'
  )
  const outputPath = outputArg ? outputArg.replace('--output=', '') : defaultOut

  const specsDir = join(REPO_ROOT, 'specs/runtime')
  logger.info('Starting runtime spec scan', { specsDir, outputPath })

  const mdFiles = walkMarkdownFiles(specsDir)
  logger.info('Markdown files found', { count: mdFiles.length })

  // Collect all references with per-file tracking
  const refMap = new Map<string, Set<string>>()
  const excludedSet = new Set<string>()

  for (const file of mdFiles) {
    let content: string
    try {
      content = readFileSync(file, 'utf-8')
    } catch {
      continue
    }
    const refs = extractScriptReferences(content)
    for (const ref of refs) {
      if (!refMap.has(ref)) {
        refMap.set(ref, new Set())
      }
      ;(refMap.get(ref) as Set<string>).add(file)
    }
    // Count excluded separately (re-scan with EXCLUDED set)
    for (const line of content.split('\n')) {
      const lineRe = new RegExp(SCRIPT_REGEX.source, 'g')
      let match = lineRe.exec(line)
      while (match !== null) {
        const name = match[1]
        match = lineRe.exec(line)
        if (!name.startsWith('-') && EXCLUDED_NAMES.has(name)) {
          excludedSet.add(name)
        }
      }
    }
  }

  const scripts: ScriptEntry[] = [...refMap.entries()]
    .map(([name, filesSet]) => ({
      name,
      occurrences: filesSet.size,
      files: [...filesSet].map((f) => f.replace(`${REPO_ROOT}/`, '')),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const output: ScanOutput = {
    scanDate: new Date().toISOString(),
    correlationId,
    specsDir: specsDir.replace(`${REPO_ROOT}/`, ''),
    totalFiles: mdFiles.length,
    totalScanned: scripts.length + excludedSet.size,
    excluded: excludedSet.size,
    excludedNames: [...excludedSet].sort(),
    inScope: scripts.length,
    scripts,
  }

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(output, null, 2))

  logger.info('Scan complete', {
    totalFiles: mdFiles.length,
    inScope: scripts.length,
    excluded: excludedSet.size,
    outputPath,
  })
}

main()
