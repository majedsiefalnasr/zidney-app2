#!/usr/bin/env bun

/**
 * Type Safety Guard — Refactored Entry Point
 *
 * Validates TypeScript code for type safety violations and enforces approved exceptions.
 * Uses core utilities for JSON validation and performance measurement.
 *
 * T033 — Refactored to use:
 * - schema-validator (validate exception registries)
 * - performance-profiler (measure execution time)
 * - logger-factory (structured output)
 *
 * Phase 2: Script Modularization — Governance Tools
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createLogger } from '../core/logger-factory'
import { getHealthStatus, Timer } from '../core/performance-profiler'
import { validateSchema } from '../core/schema-validator'

const logger = createLogger('type-safety-guard')

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
}

// Removed unused TypeSafetyReport interface (was flagged by linter)

// Parse command line arguments
function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  return {
    output: args.includes('--json') ? 'json' : args.includes('--markdown') ? 'markdown' : 'text',
    noExitError: args.includes('--no-exit-error'),
  }
}

// Validate allowed exceptions schema
async function validateExceptionsSchema(exceptions: unknown): Promise<boolean> {
  const schema = {
    type: 'object',
    properties: {
      exceptions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            line: { type: 'number' },
            pattern: { type: 'string' },
            justification: { type: 'string' },
            sunsetDate: { type: 'string' },
            approved_by: { type: 'string' },
            approved_date: { type: 'string' },
          },
          required: ['file', 'line', 'pattern', 'approved_by', 'approved_date'],
        },
      },
    },
    required: ['exceptions'],
  }

  try {
    const result = validateSchema(exceptions, schema)
    return result.valid
  } catch {
    return false
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
      const data = JSON.parse(content) as unknown

      // Validate schema before using
      const isValid = await validateExceptionsSchema(data)
      if (!isValid) {
        logger.warn(`Invalid exception schema in ${registryFile}`, { file: registryFile })
        continue
      }

      const parsedData = data as AllowedExceptions
      for (const exception of parsedData.exceptions) {
        if (!exceptionMap.has(exception.file)) {
          exceptionMap.set(exception.file, [])
        }
        exceptionMap.get(exception.file)?.push(exception)
      }
    } catch (_error) {
      logger.debug(`Registry file not found or cannot be parsed: ${registryFile}`)
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
    console.log('✅ No type safety violations detected')
    return
  }

  console.log(`\n🔍 Type Safety Violations Found: ${violations.length}\n`)

  const byFile = violations.reduce<Record<string, Violation[]>>((acc, v) => {
    if (!acc[v.file]) acc[v.file] = []
    acc[v.file].push(v)
    return acc
  }, {})

  for (const [file, vios] of Object.entries(byFile)) {
    console.log(`📄 ${file}`)
    for (const v of vios) {
      console.log(`  ${v.line}:${v.column} [${v.pattern}] ${v.message}`)
      console.log(`    ${v.code}`)
    }
    console.log()
  }
}

// Output violations as JSON
function outputJSON(violations: Violation[]): void {
  console.log(JSON.stringify({ violations, total: violations.length }, null, 2))
}

// Output violations as Markdown
function outputMarkdown(violations: Violation[]): void {
  console.log('# Type Safety Violations Report\n')
  console.log(`**Generated**: ${new Date().toISOString()}`)
  console.log(`**Total Violations**: ${violations.length}\n`)

  if (violations.length === 0) {
    console.log('✅ No violations detected')
    return
  }

  const byFile = violations.reduce<Record<string, Violation[]>>((acc, v) => {
    if (!acc[v.file]) acc[v.file] = []
    acc[v.file].push(v)
    return acc
  }, {})

  for (const [file, vios] of Object.entries(byFile)) {
    console.log(`## ${file}\n`)
    console.log('| Line | Column | Pattern | Message |')
    console.log('|------|--------|---------|---------|')

    for (const v of vios) {
      console.log(`| ${v.line} | ${v.column} | ${v.pattern} | ${v.message} |`)
    }
    console.log()
  }
}

// Main entry point
async function main(): Promise<void> {
  const timer = new Timer()
  const args = parseArgs()

  try {
    logger.info('Type safety guard started')

    const files = await collectTypeScriptFiles()
    logger.debug(`Collected ${files.length} TypeScript files`)

    const violations = await scanForViolations(files)
    logger.debug(`Found ${violations.length} total violations`)

    const allowedExceptions = await loadAllowedExceptions()
    const unapprovedViolations = violations.filter((v) => !isAllowed(v, allowedExceptions))

    const executionTimeMs = timer.end()
    const health = getHealthStatus(executionTimeMs, { max_ms: 1000, p95_ms: 900, p99_ms: 950 })

    logger.info('Type safety guard completed', {
      total_violations: violations.length,
      approved_violations: violations.length - unapprovedViolations.length,
      unapproved_violations: unapprovedViolations.length,
      execution_time_ms: executionTimeMs,
      health: health,
    })

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

    if (unapprovedViolations.length > 0 && !args.noExitError) {
      process.exit(1)
    }
  } catch (error) {
    logger.error('Type safety guard error', { error: String(error) })
    console.error('❌ Guard script error:', error)
    process.exit(1)
  }
}

// Execute if run directly
if (import.meta.main) {
  main()
}

// Exports for testing
export { isAllowed, loadAllowedExceptions, scanForViolations, validateExceptionsSchema }
