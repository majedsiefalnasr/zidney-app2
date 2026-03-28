#!/usr/bin/env bun

/**
 * @script arch:type-safety-guard
 * @domain arch
 * @category governance
 * @description Unified architecture guard — runs type safety checks and validates import boundaries using the architecture contract.
 * @usage bun run arch:type-safety-guard
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runUnifiedArchitectureGuard } from './architecture-guard/runner'
import { exit, flushAi, hasCiFlag, log } from './utils/logger'

log.setScript('arch:type-safety-guard')

// Types
interface AllowedException {
  file: string
  line: number
  pattern: string
  justification: string
  sunsetDate?: string
  approved_by: string
  approved_date: string
}

interface AllowedExceptions {
  exceptions: AllowedException[]
}

interface Violation {
  file: string
  line: number
  column: number
  pattern: string
  code: string
  message: string
}

interface CliArgs {
  output: 'json' | 'markdown' | 'text'
  noExitError: boolean
  ci: boolean
}

// Parse command line arguments
function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  return {
    output: args.includes('--json') ? 'json' : args.includes('--markdown') ? 'markdown' : 'text',
    noExitError: args.includes('--no-exit-error'),
    ci: hasCiFlag(args),
  }
}

// Load allowed exceptions from all registry files
async function loadAllowedExceptions(): Promise<Map<string, AllowedException[]>> {
  const exceptionMap = new Map<string, AllowedException[]>()
  const registryFiles = [
    'scripts/ALLOWED_ANY_EXCEPTIONS.json',
    'packages/domain-core/ALLOWED_ANY_EXCEPTIONS.json',
    'packages/types/ALLOWED_ANY_EXCEPTIONS.json',
    'packages/validation/ALLOWED_ANY_EXCEPTIONS.json',
  ]

  for (const registryFile of registryFiles) {
    try {
      const content = await readFile(registryFile, 'utf-8')
      const data = JSON.parse(content) as AllowedExceptions
      for (const exception of data.exceptions) {
        if (!exceptionMap.has(exception.file)) {
          exceptionMap.set(exception.file, [])
        }
        exceptionMap.get(exception.file)?.push(exception)
      }
    } catch {
      // Registry file not found or cannot be read - skip it
    }
  }

  return exceptionMap
}

// Check if a violation is allowed
function isAllowed(
  violation: Violation,
  allowedExceptions: Map<string, AllowedException[]>
): boolean {
  const fileExceptions = allowedExceptions.get(violation.file)
  if (!fileExceptions) return false

  return fileExceptions.some(
    (exc) => Math.abs(exc.line - violation.line) <= 1 && exc.pattern === violation.pattern
  )
}

// Recursively collect TypeScript files
async function collectTypeScriptFiles(): Promise<string[]> {
  const files: string[] = []
  const dirs = ['apps', 'packages']

  async function walkDir(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'tests') {
          await walkDir(fullPath)
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
          !entry.name.endsWith('.test.ts') &&
          !entry.name.endsWith('.test.tsx') &&
          !entry.name.endsWith('.spec.ts') &&
          !entry.name.endsWith('.spec.tsx')
        ) {
          files.push(fullPath)
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  for (const dir of dirs) {
    await walkDir(dir)
  }

  return files
}

// Scan files for type safety violations
async function scanForViolations(files: string[]): Promise<Violation[]> {
  const violations: Violation[] = []

  const patterns = {
    explicitAny: /:\s*any\b/,
    asAny: /\bas\s+any\b/,
    genericAny: /<any>/,
  }

  for (const file of files) {
    try {
      const content = await Bun.file(file).text()
      const lines = content.split('\n')

      lines.forEach((line, lineIdx) => {
        const lineNum = lineIdx + 1

        // Check for `: any`
        const explicitAnyMatch = line.match(patterns.explicitAny)
        if (explicitAnyMatch) {
          violations.push({
            file,
            line: lineNum,
            column: (explicitAnyMatch.index || 0) + 1,
            pattern: 'explicit-any',
            code: line.trim(),
            message: 'Explicit "any" type detected',
          })
        }

        // Check for `as any`
        const asAnyMatch = line.match(patterns.asAny)
        if (asAnyMatch) {
          violations.push({
            file,
            line: lineNum,
            column: (asAnyMatch.index || 0) + 1,
            pattern: 'type-assertion-any',
            code: line.trim(),
            message: '"as any" type assertion detected',
          })
        }

        // Check for `<any>`
        const genericAnyMatch = line.match(patterns.genericAny)
        if (genericAnyMatch) {
          violations.push({
            file,
            line: lineNum,
            column: (genericAnyMatch.index || 0) + 1,
            pattern: 'generic-any',
            code: line.trim(),
            message: 'Generic "any" type detected',
          })
        }
      })
    } catch {
      // Silently skip files we can't read
    }
  }

  return violations
}

// Output violations as text
function outputText(violations: Violation[]): void {
  if (violations.length === 0) {
    log.success('No type safety violations detected')
    return
  }

  log.warn(`Type Safety Violations Found: ${violations.length}`)

  const byFile = violations.reduce<Record<string, Violation[]>>((acc, v) => {
    if (!acc[v.file]) acc[v.file] = []
    acc[v.file].push(v)
    return acc
  }, {})

  for (const [file, vios] of Object.entries(byFile)) {
    log.info(`${file}`)
    for (const v of vios) {
      log.info(`  ${v.line}:${v.column} [${v.pattern}] ${v.message}`)
      log.info(`    ${v.code}`)
    }
  }
}

// Output violations as JSON
function outputJSON(violations: Violation[]): void {
  process.stdout.write(`${JSON.stringify({ violations, total: violations.length }, null, 2)}\n`)
}

// Output violations as Markdown
function outputMarkdown(violations: Violation[]): void {
  const lines: string[] = []
  lines.push('# Type Safety Violations Report\n')
  lines.push(`**Generated**: ${new Date().toISOString()}`)
  lines.push(`**Total Violations**: ${violations.length}\n`)

  if (violations.length === 0) {
    lines.push('✅ No violations detected')
    process.stdout.write(`${lines.join('\n')}\n`)
    return
  }

  const byFile = violations.reduce<Record<string, Violation[]>>((acc, v) => {
    if (!acc[v.file]) acc[v.file] = []
    acc[v.file].push(v)
    return acc
  }, {})

  for (const [file, vios] of Object.entries(byFile)) {
    lines.push(`## ${file}\n`)
    lines.push('| Line | Column | Pattern | Message |')
    lines.push('|------|--------|---------|---------|')

    for (const v of vios) {
      lines.push(`| ${v.line} | ${v.column} | ${v.pattern} | ${v.message} |`)
    }
    lines.push('')
  }
  process.stdout.write(`${lines.join('\n')}\n`)
}

// Main entry point
async function main(): Promise<void> {
  const args = parseArgs()

  if (args.output !== 'json') {
    log.header('TYPE SAFETY GUARD', 'Validates TypeScript code for type safety violations')
  }

  if (process.argv.includes('--unified-runner')) {
    const code = await runUnifiedArchitectureGuard(process.argv.slice(2))
    if (args.output !== 'json') {
      log.result({ total: 1, passed: code === 0 ? 1 : 0, failed: code === 0 ? 0 : 1 })
    }
    flushAi()
    exit(code)
  }
  const files = await collectTypeScriptFiles()
  const violations = await scanForViolations(files)
  const allowedExceptions = await loadAllowedExceptions()

  // Filter out allowed violations
  const unapprovedViolations = violations.filter((v) => !isAllowed(v, allowedExceptions))

  switch (args.output) {
    case 'json':
      outputJSON(unapprovedViolations)
      break
    case 'markdown':
      outputMarkdown(unapprovedViolations)
      break
    default:
      outputText(unapprovedViolations)
  }

  if (args.output !== 'json') {
    log.result({
      total: violations.length,
      passed: violations.length - unapprovedViolations.length,
      failed: unapprovedViolations.length,
      message:
        unapprovedViolations.length > 0 ? 'Type safety violations found' : 'All checks passed',
    })
  }
  flushAi()

  if (unapprovedViolations.length > 0 && !args.noExitError) {
    exit(1)
  }
}

main().catch((error) => {
  log.error(`Guard script error: ${error}`)
  flushAi()
  exit(1)
})
