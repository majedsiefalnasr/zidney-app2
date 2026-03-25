/**
 * @script validate:script:naming
 * @domain validate
 * @category governance
 * @description Validates all package.json script keys conform to the
 *   <domain>:<action>[:<scope>] naming convention. Allowed domains: db, arch,
 *   validate, ai, ci, repo, dev, infra, test. Lifecycle-exempt names are skipped.
 *   Reports ALL violations before exiting non-zero.
 * @usage bun run validate:script:naming
 * @mode ci,manual
 * @dependencies node:fs,node:path,node:crypto
 */

import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '../core/logger-factory'
import type { ScriptEntry, ViolationRecord } from './types'

const correlationId = randomUUID()
const logger = createLogger('validate:script:naming')
logger.setContext({ correlationId })

const REPO_ROOT = process.cwd()

/** Canonical allowed domain prefixes */
export const ALLOWED_DOMAINS = new Set([
  'db',
  'arch',
  'validate',
  'ai',
  'ci',
  'repo',
  'dev',
  'infra',
  'test',
  'governance',
])

/** Names exempt from validation (lifecycle scripts defined by package managers / tools) */
export const LIFECYCLE_EXEMPT = new Set([
  'prepare',
  'prepublish',
  'prepublishOnly',
  'postinstall',
  'preinstall',
  'postpublish',
  'pretest',
  'test',
  'posttest',
  'prebuild',
  'build',
  'postbuild',
  'prestart',
  'start',
  'poststart',
  // Toolchain commands — intentionally not domain-prefixed in root package.json
  'typecheck',
  'lint',
  'format',
  'dev',
  'type-check',
])

/**
 * Prefixes that are toolchain-domain (not governance-domain). Scripts whose
 * first segment matches one of these are exempt from the domain:action rule
 * in the ROOT package.json. (Workspace packages are always exempt.)
 */
export const TOOLCHAIN_EXEMPT_PREFIXES = new Set([
  'typecheck',
  'lint',
  'format',
  'build',
  'preview',
])

/** Full naming pattern: <domain>:<action>[:<scope>] */
export const NAMING_RE =
  /^(db|arch|validate|ai|ci|repo|dev|infra|test|governance):[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)?$/

export function collectPackageJsonFiles(repoRoot: string): string[] {
  const results: string[] = []
  const workspacesDir = join(repoRoot, 'apps')
  const packagesDir = join(repoRoot, 'packages')

  // Root
  results.push(join(repoRoot, 'package.json'))

  for (const baseDir of [workspacesDir, packagesDir]) {
    let entries: string[]
    try {
      entries = readdirSync(baseDir)
    } catch {
      continue
    }
    for (const entry of entries) {
      const pkgPath = join(baseDir, entry, 'package.json')
      try {
        statSync(pkgPath)
        results.push(pkgPath)
      } catch {
        // no package.json in this dir
      }
    }
  }

  return results
}

export function parseScriptEntries(pkgFile: string): ScriptEntry[] {
  let json: { scripts?: Record<string, string> }
  try {
    json = JSON.parse(readFileSync(pkgFile, 'utf-8'))
  } catch {
    return []
  }

  const scripts = json.scripts ?? {}
  const isRoot = pkgFile === join(REPO_ROOT, 'package.json')
  const workspaceName = isRoot ? null : (pkgFile.split('/').slice(-2, -1)[0] ?? null)

  return Object.entries(scripts).map(([name, command]) => ({
    name,
    command: String(command),
    packageFile: pkgFile,
    workspaceName,
  }))
}

export function validateNaming(entries: ScriptEntry[]): ViolationRecord[] {
  const violations: ViolationRecord[] = []

  for (const entry of entries) {
    // Workspace packages (apps/*, packages/*) are not subject to domain conventions
    if (entry.workspaceName !== null) continue

    if (LIFECYCLE_EXEMPT.has(entry.name)) continue

    // Toolchain-prefixed scripts (typecheck:*, lint:*, format:*, build:*, preview:*) are exempt
    const firstSegment = entry.name.split(':')[0]
    if (TOOLCHAIN_EXEMPT_PREFIXES.has(firstSegment)) continue

    if (!NAMING_RE.test(entry.name)) {
      const knownDomain = ALLOWED_DOMAINS.has(firstSegment)

      violations.push({
        rule: 'script-naming-convention',
        file: entry.packageFile,
        scriptName: entry.name,
        message: `"${entry.name}" does not match <domain>:<action>[:<scope>] pattern`,
        hint: knownDomain
          ? `Domain "${firstSegment}" is valid — check action/scope segments`
          : `Unknown domain "${firstSegment}". Allowed: ${[...ALLOWED_DOMAINS].join(', ')}`,
      })
    }
  }

  return violations
}

function main(): void {
  logger.info('Starting script naming validation', { repoRoot: REPO_ROOT })

  const pkgFiles = collectPackageJsonFiles(REPO_ROOT)
  logger.info('Package files found', { count: pkgFiles.length })

  let allEntries: ScriptEntry[] = []
  for (const pkgFile of pkgFiles) {
    allEntries = allEntries.concat(parseScriptEntries(pkgFile))
  }
  logger.info('Script entries collected', { count: allEntries.length })

  const violations = validateNaming(allEntries)

  if (violations.length === 0) {
    logger.info('All script names are compliant')
    process.stdout.write('\n✓ validate:script:naming — all script names conform to convention\n')
    process.exit(0)
  }

  logger.error('Script naming violations found', { count: violations.length })
  process.stderr.write(`\n❌ validate:script:naming — ${violations.length} violation(s) found:\n\n`)

  for (const v of violations) {
    const pkg = v.file.replace(`${REPO_ROOT}/`, '')
    process.stderr.write(`  [${pkg}] "${v.scriptName}"\n`)
    process.stderr.write(`    ${v.message}\n`)
    if (v.hint) process.stderr.write(`    Hint: ${v.hint}\n`)
    process.stderr.write('\n')
  }

  process.exit(1)
}

if (import.meta.main) {
  main()
}
