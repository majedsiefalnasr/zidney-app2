/**
 * @script validate:script:infrastructure
 * @domain validate
 * @category governance
 * @description Validates that all scripts/*.ts files have the mandatory 5-field
 *   metadata header (@script, @domain, @category, @description, @usage) and that
 *   the SCRIPT_REGISTRY.md is up-to-date (no drift vs. what the generator would
 *   produce). Reports all violations before exiting non-zero.
 * @usage bun run validate:script:infrastructure
 * @mode ci,manual
 * @dependencies node:fs,node:path,node:crypto
 */

import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '../core/logger-factory'
import { generateRegistry, parseMetaHeader, walkTsFiles } from '../generate/script-docs'
import type { ViolationRecord } from './types'

const correlationId = randomUUID()
const logger = createLogger('validate:script:infrastructure')
logger.setContext({ correlationId })

const REPO_ROOT = process.cwd()
const SCRIPTS_DIR = join(REPO_ROOT, 'scripts')
const REGISTRY_PATH = join(REPO_ROOT, 'docs/scripts/SCRIPT_REGISTRY.md')

const REQUIRED_TAGS = ['@script', '@domain', '@category', '@description', '@usage'] as const

export function validateMetadataHeaders(scriptsDir: string, repoRoot: string): ViolationRecord[] {
  const violations: ViolationRecord[] = []
  const tsFiles = walkTsFiles(scriptsDir)

  for (const filePath of tsFiles) {
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }

    // A file without ANY @script tag is simply not a governed script — skip it
    if (!content.includes('@script')) continue

    const relPath = filePath.replace(`${repoRoot}/`, '')
    const missing: string[] = []
    for (const tag of REQUIRED_TAGS) {
      const re = new RegExp(`${tag}\\s+\\S`)
      if (!re.test(content)) {
        missing.push(tag)
      }
    }

    if (missing.length > 0) {
      violations.push({
        rule: 'script-missing-metadata',
        file: relPath,
        message: `Missing required metadata tags: ${missing.join(', ')}`,
        hint: `Add ${missing.join(', ')} to the JSDoc header block`,
      })
    }
  }

  return violations
}

export function validateRegistryFreshness(
  scriptsDir: string,
  registryPath: string,
  repoRoot: string
): ViolationRecord[] {
  if (!existsSync(registryPath)) {
    return [
      {
        rule: 'script-registry-missing',
        file: registryPath.replace(`${repoRoot}/`, ''),
        message: 'SCRIPT_REGISTRY.md does not exist',
        hint: 'Run: bun run dev:generate:script-docs',
      },
    ]
  }

  const existingContent = readFileSync(registryPath, 'utf-8')
  const tsFiles = walkTsFiles(scriptsDir)

  const metas = tsFiles.flatMap((filePath) => {
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      return []
    }
    const meta = parseMetaHeader(content, filePath)
    return meta ? [meta] : []
  })

  const freshContent = generateRegistry(metas)

  // Normalize: strip generated metadata and formatter-introduced changes
  // Handles: timestamp, trailing whitespace, blank lines, markdown table alignment
  const normalize = (s: string) => {
    return s
      .split('\n')
      .filter((l) => !l.startsWith('> Last generated:')) // Strip timestamp
      .map((l) => {
        // For markdown table rows (contains pipes |)
        if (l.includes('|')) {
          // Check if it's a separator row (all dashes and pipes)
          const isSeparator = /^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(l)
          if (isSeparator) {
            // Normalize separator: `| --- | --- |` regardless of dash count or padding
            const cellCount = l.split('|').length - 2 // Count pipes, subtract outer ones
            return `| ${Array(cellCount).fill('---').join(' | ')} |`
          }
          // For data rows: split by pipes, trim each cell, rejoin with consistent spacing
          return l
            .split('|')
            .map((cell) => cell.trim())
            .join('|')
            .trimEnd()
        }
        // For non-table lines, just trim trailing whitespace
        return l.trimEnd()
      })
      .filter((l) => l.length > 0) // Remove blank lines
      .join('\n')
      .trim()
  }

  if (normalize(existingContent) !== normalize(freshContent)) {
    return [
      {
        rule: 'script-registry-stale',
        file: registryPath.replace(`${repoRoot}/`, ''),
        message: 'SCRIPT_REGISTRY.md is out of date',
        hint: 'Run: bun run dev:generate:script-docs to regenerate',
      },
    ]
  }

  return []
}

function main(): void {
  logger.info('Starting script infrastructure validation', { repoRoot: REPO_ROOT })

  const violations: ViolationRecord[] = []

  // 1 — Metadata headers
  const headerViolations = validateMetadataHeaders(SCRIPTS_DIR, REPO_ROOT)
  violations.push(...headerViolations)
  logger.info('Metadata header check', { violations: headerViolations.length })

  // 2 — Registry freshness
  const registryViolations = validateRegistryFreshness(SCRIPTS_DIR, REGISTRY_PATH, REPO_ROOT)
  violations.push(...registryViolations)
  logger.info('Registry freshness check', { violations: registryViolations.length })

  if (violations.length === 0) {
    logger.info('Script infrastructure is valid')
    process.stdout.write(
      '\n✓ validate:script:infrastructure — all scripts have valid metadata and registry is fresh\n'
    )
    process.exit(0)
  }

  logger.error('Script infrastructure violations found', { count: violations.length })
  process.stderr.write(
    `\n❌ validate:script:infrastructure — ${violations.length} violation(s) found:\n\n`
  )

  for (const v of violations) {
    const loc = v.line ? `${v.file}:${v.line}` : v.file
    process.stderr.write(`  [${v.rule}] ${loc}\n`)
    process.stderr.write(`    ${v.message}\n`)
    if (v.hint) process.stderr.write(`    Hint: ${v.hint}\n`)
    process.stderr.write('\n')
  }

  process.exit(1)
}

if (import.meta.main) {
  main()
}
