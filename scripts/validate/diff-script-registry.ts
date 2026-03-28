/**
 * @script validate:scripts:registry
 * @domain validate
 * @category governance
 * @description Compare scanned runtime spec script references against root package.json, produce diff report
 * @usage bun run validate:scripts:registry
 */

import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createLogger, exit, flushAi, log } from '../utils/logger'

const correlationId = randomUUID()
const logger = createLogger('diff-script-registry')
logger.setContext({ correlationId })

const REPO_ROOT = process.cwd()

interface ScanScript {
  name: string
  occurrences: number
  files: string[]
}

interface ScanOutput {
  inScope: number
  scripts: ScanScript[]
}

interface DiffEntry {
  name: string
  status: 'VALID' | 'MISSING' | 'UNREGISTERED' | 'ALIAS-NEEDED' | 'EXCLUDED'
  occurrences?: number
  packageJsonValue?: string
}

interface DiffReport {
  generatedAt: string
  correlationId: string
  summary: {
    total: number
    valid: number
    missing: number
    unregistered: number
    aliasNeeded: number
  }
  entries: DiffEntry[]
}

function loadScan(scanPath: string): ScanOutput {
  try {
    const content = readFileSync(scanPath, 'utf-8')
    return JSON.parse(content) as ScanOutput
  } catch (err) {
    logger.error('Failed to load scan output', {
      scanPath,
      error: err instanceof Error ? err.message : String(err),
    })
    exit(1)
  }
}

function loadRegisteredScripts(pkgPath: string): Map<string, string> {
  try {
    const content = readFileSync(pkgPath, 'utf-8')
    const pkg = JSON.parse(content) as { scripts?: Record<string, string> }
    const scripts = pkg.scripts ?? {}
    return new Map(Object.entries(scripts))
  } catch (err) {
    logger.error('Failed to load package.json', {
      pkgPath,
      error: err instanceof Error ? err.message : String(err),
    })
    exit(1)
  }
}

function main(): void {
  const args = process.argv.slice(2)

  const scanPathArg = args.find((a) => a.startsWith('--scan='))
  const scanPath = scanPathArg
    ? scanPathArg.replace('--scan=', '')
    : join(
        REPO_ROOT,
        'specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/runtime-script-scan.json'
      )

  const outputArg = args.find((a) => a.startsWith('--output='))
  const outputPath = outputArg
    ? outputArg.replace('--output=', '')
    : join(
        REPO_ROOT,
        'specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json'
      )

  const pkgPath = join(REPO_ROOT, 'package.json')

  log.header(
    'Diff script registry',
    'Compare scanned runtime spec script references against root package.json'
  )
  logger.info('Loading scan output', { scanPath })
  const scan = loadScan(scanPath)

  logger.info('Loading package.json scripts', { pkgPath })
  const registered = loadRegisteredScripts(pkgPath)

  const entries: DiffEntry[] = scan.scripts.map((s) => {
    const packageJsonValue = registered.get(s.name)
    if (packageJsonValue !== undefined) {
      return {
        name: s.name,
        status: 'VALID',
        occurrences: s.occurrences,
        packageJsonValue,
      }
    }
    return {
      name: s.name,
      status: 'MISSING',
      occurrences: s.occurrences,
    }
  })

  const summary = {
    total: entries.length,
    valid: entries.filter((e) => e.status === 'VALID').length,
    missing: entries.filter((e) => e.status === 'MISSING').length,
    unregistered: entries.filter((e) => e.status === 'UNREGISTERED').length,
    aliasNeeded: entries.filter((e) => e.status === 'ALIAS-NEEDED').length,
  }

  const report: DiffReport = {
    generatedAt: new Date().toISOString(),
    correlationId,
    summary,
    entries,
  }

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(report, null, 2))

  logger.info('Diff report written', { outputPath, summary })
  log.badge('DIFF COMPLETE', 'success')
  log.progressResult({ success: 1 }, { title: 'Registry Diff Generation', showPercentage: false })
  flushAi()

  // Generate SCRIPT_REGISTRY.md if requested
  const registryArg = args.find((a) => a.startsWith('--registry='))
  if (registryArg) {
    const registryPath = registryArg.replace('--registry=', '')
    writeScriptRegistry(entries, registryPath)
  }
}

function writeScriptRegistry(entries: DiffEntry[], registryPath: string): void {
  const lines: string[] = [
    '# Script Registry',
    '',
    `> Generated: ${new Date().toISOString()}`,
    '',
    '## All Runtime-Referenced Scripts',
    '',
    '| Script | Domain | Status |',
    '|--------|--------|--------|',
  ]

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const domain = entry.name.includes(':') ? entry.name.split(':')[0] : 'root'
    const statusEmoji =
      entry.status === 'VALID'
        ? '✅ VALID'
        : entry.status === 'MISSING'
          ? '❌ MISSING'
          : entry.status === 'UNREGISTERED'
            ? '⚠️ UNREGISTERED'
            : '🔧 ALIAS-NEEDED'
    lines.push(`| \`${entry.name}\` | ${domain} | ${statusEmoji} |`)
  }

  mkdirSync(dirname(registryPath), { recursive: true })
  writeFileSync(registryPath, `${lines.join('\n')}\n`)
  logger.info('SCRIPT_REGISTRY.md written', { registryPath })
}

main()
