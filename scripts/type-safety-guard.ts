#!/usr/bin/env bun

import { globSync } from 'bun'

// Types
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

// Parse command line arguments
function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  return {
    output: args.includes('--json') ? 'json' : args.includes('--markdown') ? 'markdown' : 'text',
    noExitError: args.includes('--no-exit-error'),
  }
}

// Collect TypeScript files from repository
function collectTypeScriptFiles(): string[] {
  const patterns = ['apps/**/*.ts', 'apps/**/*.tsx', 'packages/**/*.ts', 'packages/**/*.tsx']

  const allFiles = new Set<string>()
  for (const pattern of patterns) {
    const files = globSync(pattern)
    for (const f of files) {
      allFiles.add(f)
    }
  }

  return Array.from(allFiles)
}

// Scan files for type safety violations
async function scanForViolations(files: string[]): Promise<Violation[]> {
  const violations: Violation[] = []

  const patterns = {
    explicitAny: /:\s*any\b/g,
    asAny: /as\s+any\b/g,
    genericAny: /<any>/g,
  }

  for (const file of files) {
    try {
      const content = await Bun.file(file).text()
      const lines = content.split('\n')

      lines.forEach((line, lineIdx) => {
        const lineNum = lineIdx + 1

        // Check for `: any`
        if (patterns.explicitAny.test(line)) {
          const match = line.match(/:\s*any\b/)
          if (match) {
            violations.push({
              file,
              line: lineNum,
              column: (match.index || 0) + 1,
              pattern: 'explicit-any',
              code: line.trim(),
              message: 'Explicit "any" type detected',
            })
          }
        }

        // Check for `as any`
        if (patterns.asAny.test(line)) {
          const match = line.match(/as\s+any\b/)
          if (match) {
            violations.push({
              file,
              line: lineNum,
              column: (match.index || 0) + 1,
              pattern: 'type-assertion-any',
              code: line.trim(),
              message: '"as any" type assertion detected',
            })
          }
        }

        // Check for `<any>`
        if (patterns.genericAny.test(line)) {
          const match = line.match(/<any>/)
          if (match) {
            violations.push({
              file,
              line: lineNum,
              column: (match.index || 0) + 1,
              pattern: 'generic-any',
              code: line.trim(),
              message: 'Generic "any" type detected',
            })
          }
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
  const args = parseArgs()
  const files = collectTypeScriptFiles()
  const violations = await scanForViolations(files)

  switch (args.output) {
    case 'json':
      outputJSON(violations)
      break
    case 'markdown':
      outputMarkdown(violations)
      break
    default:
      outputText(violations)
  }

  if (violations.length > 0 && !args.noExitError) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('❌ Guard script error:', error)
  process.exit(1)
})
