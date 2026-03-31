#!/usr/bin/env bun

/**
 * @script dev:generate:script-docs
 * @domain dev
 * @category dev
 * @description Walk scripts/**\/*.ts, parse @script metadata headers, generate
 *   docs/scripts/SCRIPT_REGISTRY.md plus one page per root package.json runner.
 *   Exits 1 on missing required metadata fields.
 * @usage bun run dev:generate:script-docs
 */

import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { createLogger, exit, hasCiFlag, log } from '../utils/logger'

const correlationId = randomUUID()
const args = process.argv.slice(2)
const isCi = hasCiFlag(args)
const logger = createLogger('dev:generate:script-docs')
logger.setContext({ correlationId, ci: isCi })

const REPO_ROOT = process.cwd()
const SCRIPTS_DIR = join(REPO_ROOT, 'scripts')
const DOCS_DIR = join(REPO_ROOT, 'docs/scripts')
const PACKAGE_JSON_PATH = join(REPO_ROOT, 'package.json')
const PACKAGE_REFERENCE_PATH = join(REPO_ROOT, 'package.md')
const DOCS_INDEX_PATH = join(DOCS_DIR, 'README.md')
const REGISTRY_PATH = join(DOCS_DIR, 'SCRIPT_REGISTRY.md')
const RESERVED_DOC_FILES = new Set(['README.md', 'SCRIPT_REGISTRY.md', 'SCRIPT_MIGRATION_MAP.md'])

const ALLOWED_DOMAINS = new Set([
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
  'policy',
])

export interface ScriptMeta {
  script: string
  domain: string
  category: string
  description: string
  usage: string
  filePath: string
}

interface PackageReferenceSection {
  power?: string
  purpose?: string
  source?: string
  ciFlag?: string
  updatedGeneratedFiles?: string
  removalAssessment?: string
  dependsOn: string[]
  usedBy: string[]
}

interface RootScriptDocEntry {
  script: string
  command: string
  filePath: string
  sourcePath?: string
  meta?: ScriptMeta
  reference?: PackageReferenceSection
  dependsOn: string[]
  usedBy: string[]
}

export function walkTsFiles(dir: string, excludeDirs: string[] = ['__tests__']): string[] {
  const files: string[] = []
  try {
    for (const entry of readdirSync(dir)) {
      if (excludeDirs.includes(entry)) continue
      const full = join(dir, entry)
      let stat: ReturnType<typeof statSync>
      try {
        stat = statSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        files.push(...walkTsFiles(full, excludeDirs))
      } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        files.push(full)
      }
    }
  } catch {
    // ignore
  }
  return files
}

export function parseMetaHeader(content: string, filePath: string): ScriptMeta | null {
  const scriptMatch = content.match(/@script\s+([^\n*]+)/)
  if (!scriptMatch) return null

  const domainMatch = content.match(/@domain\s+([^\n*]+)/)
  const categoryMatch = content.match(/@category\s+([^\n*]+)/)
  const usageMatch = content.match(/@usage\s+([^\n*]+)/)
  const description = readMultilineHeaderValue(content, '@description')

  return {
    script: scriptMatch[1].trim(),
    domain: domainMatch ? domainMatch[1].trim() : 'unknown',
    category: categoryMatch ? categoryMatch[1].trim() : 'unknown',
    description,
    usage: usageMatch ? usageMatch[1].trim() : `bun run ${scriptMatch[1].trim()}`,
    filePath: filePath.replace(`${REPO_ROOT}/`, ''),
  }
}

function readMultilineHeaderValue(content: string, tag: string): string {
  const lines = content.split(/\r?\n/)
  const parts: string[] = []
  let collecting = false

  for (const line of lines) {
    const normalized = line.replace(/^\s*\/??\*+\s?/, '').trimEnd()

    if (!collecting) {
      if (normalized.startsWith(`${tag} `)) {
        parts.push(normalized.slice(tag.length + 1).trim())
        collecting = true
      }
      continue
    }

    if (normalized.startsWith('@') || normalized === '/' || normalized === '*/') {
      break
    }

    if (normalized.trim().length === 0) {
      continue
    }

    parts.push(normalized.trim())
  }

  return parts.join(' ').trim()
}

export function parsePackageReferenceSections(
  content: string
): Map<string, PackageReferenceSection> {
  const sections = new Map<string, PackageReferenceSection>()
  const headingRegex = /^### (.+)$/gm
  const matches: Array<{ name: string; start: number; headingIndex: number }> = []
  let match = headingRegex.exec(content)

  while (match !== null) {
    matches.push({
      name: match[1].trim(),
      start: headingRegex.lastIndex,
      headingIndex: match.index,
    })
    match = headingRegex.exec(content)
  }

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index]
    const next = index + 1 < matches.length ? matches[index + 1] : undefined
    const body = content.slice(current.start, next?.headingIndex ?? content.length)
    sections.set(current.name, {
      power: readBulletField(body, 'Power'),
      purpose: readBulletField(body, 'Purpose'),
      source: readBulletField(body, 'Source'),
      ciFlag: readBulletField(body, 'CI flag'),
      updatedGeneratedFiles: readBulletField(body, 'Updated or generated files'),
      removalAssessment: readBulletField(body, 'Removal assessment'),
      dependsOn: parseScriptList(readBulletField(body, 'Depends on')),
      usedBy: parseScriptList(readBulletField(body, 'Used by other root scripts')),
    })
  }

  return sections
}

function readBulletField(body: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const fieldMatch = body.match(new RegExp(`^- ${escaped}: (.*)$`, 'm'))
  return fieldMatch?.[1].trim()
}

function parseScriptList(raw?: string): string[] {
  if (!raw || raw === 'None' || raw === 'None found') {
    return []
  }

  return raw
    .split(',')
    .map((value) => value.replace(/`/g, '').trim())
    .filter(Boolean)
}

function loadRootScripts(): Array<[string, string]> {
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as {
    scripts?: Record<string, string>
  }
  return Object.entries(packageJson.scripts ?? {})
}

function resolveSourcePath(command: string): string | undefined {
  const sourceMatch = command.match(/(?:^|\s)(scripts\/[^\s'"`]+\.ts)(?=\s|$)/)
  return sourceMatch?.[1]
}

function loadSourceMeta(sourcePath?: string): ScriptMeta | undefined {
  if (!sourcePath) {
    return undefined
  }

  const absolutePath = join(REPO_ROOT, sourcePath)
  if (!existsSync(absolutePath)) {
    return undefined
  }

  const content = readFileSync(absolutePath, 'utf-8')
  return parseMetaHeader(content, absolutePath) ?? undefined
}

function detectScriptDependencies(
  command: string,
  scriptNames: readonly string[],
  selfName: string
): string[] {
  const found = new Set<string>()
  const orderedNames = Array.from(scriptNames).sort((left, right) => right.length - left.length)

  for (const candidate of orderedNames) {
    if (candidate === selfName) {
      continue
    }

    if (
      command.includes(`bun run ${candidate}`) ||
      command.includes(`bun ${candidate}`) ||
      command.includes(`&& bun ${candidate}`) ||
      command.includes(`|| bun ${candidate}`)
    ) {
      found.add(candidate)
    }
  }

  return Array.from(found)
}

function buildUsedByMap(entries: readonly RootScriptDocEntry[]): Map<string, string[]> {
  const usedBy = new Map<string, string[]>()

  for (const entry of entries) {
    for (const dependency of entry.dependsOn) {
      const current = usedBy.get(dependency) ?? []
      current.push(entry.script)
      usedBy.set(dependency, current)
    }
  }

  return usedBy
}

function loadExistingDocNameMap(): Map<string, string> {
  const mappings = new Map<string, string>()
  if (!existsSync(DOCS_DIR)) {
    return mappings
  }

  for (const entry of readdirSync(DOCS_DIR)) {
    if (!entry.endsWith('.md') || RESERVED_DOC_FILES.has(entry) || entry.startsWith('_')) {
      continue
    }

    const content = readFileSync(join(DOCS_DIR, entry), 'utf-8')
    const commandMatch = content.match(/bun run ([A-Za-z][A-Za-z0-9:_-]*)/)
    if (commandMatch) {
      mappings.set(commandMatch[1], entry)
    }
  }

  return mappings
}

export function resolveDocFileName(scriptName: string, existingFileName?: string): string {
  return existingFileName ?? `${scriptName.replace(/:/g, '-')}.md`
}

function buildRootScriptDocs(
  references: Map<string, PackageReferenceSection>,
  existingDocNames: Map<string, string>
): RootScriptDocEntry[] {
  const rootScripts = loadRootScripts().filter(([script]) => !script.startsWith('_'))
  const scriptNames = rootScripts.map(([script]) => script)

  const entries = rootScripts.map(([script, command]) => {
    const sourcePath = resolveSourcePath(command)
    const reference = references.get(script)
    return {
      script,
      command,
      filePath: resolveDocFileName(script, existingDocNames.get(script)),
      sourcePath,
      meta: loadSourceMeta(sourcePath),
      reference,
      dependsOn: reference?.dependsOn.length
        ? reference.dependsOn
        : detectScriptDependencies(command, scriptNames, script),
      usedBy: reference?.usedBy ?? [],
    } satisfies RootScriptDocEntry
  })

  const usedByMap = buildUsedByMap(entries)
  return entries.map((entry) => ({
    ...entry,
    usedBy: entry.usedBy.length > 0 ? entry.usedBy : (usedByMap.get(entry.script) ?? []),
  }))
}

function inferPurpose(entry: RootScriptDocEntry): string {
  if (entry.reference?.purpose) {
    return entry.reference.purpose
  }
  if (entry.meta?.description) {
    return entry.meta.description
  }
  if (entry.command.startsWith('echo ')) {
    return 'Placeholder root runner retained for compatibility or future implementation.'
  }
  if (entry.command.startsWith('vitest run')) {
    return 'Run the configured Vitest scope from the repository root.'
  }
  if (entry.command.startsWith('tsc --noEmit')) {
    return 'Run the TypeScript compiler in type-check-only mode.'
  }
  if (entry.command.startsWith('biome check')) {
    return 'Run Biome checks for the configured scope.'
  }
  if (entry.command.startsWith('prettier --')) {
    return 'Run Prettier for the configured scope.'
  }
  return 'Execute the registered repository runner for this workflow.'
}

function stripWrapping(value?: string): string | undefined {
  return value?.replace(/`/g, '').trim()
}

function inferWhyItExists(entry: RootScriptDocEntry): string {
  const power = entry.reference?.power
    ? `This runner is currently classified as ${entry.reference.power}. `
    : ''
  const removal = entry.reference?.removalAssessment
    ? `${stripWrapping(entry.reference.removalAssessment)} `
    : ''
  const source = entry.sourcePath
    ? `Its implementation lives in ${entry.sourcePath} and is exposed through the root package.json interface.`
    : 'It provides a stable root package.json interface over underlying tools or chained child runners.'
  return `${power}${removal}${source}`.trim()
}

function inferWhenToRun(entry: RootScriptDocEntry): string[] {
  const script = entry.script
  const bullets: string[] = []

  if (script.endsWith(':ci') || entry.reference?.ciFlag?.includes('CI')) {
    bullets.push('When reproducing CI behavior locally or validating CI-only output paths.')
  }
  if (/^(validate|arch|governance|policy):/.test(script)) {
    bullets.push(
      'Before opening or updating a pull request that touches the related governance surface.'
    )
  }
  if (/^(test|lint|typecheck|format|build)/.test(script)) {
    bullets.push('When running repository quality checks before commit or push.')
  }
  if (/^dev:/.test(script)) {
    bullets.push('During local development when you need the associated developer workflow.')
  }
  if (/^db:/.test(script)) {
    bullets.push(
      'When operating against a configured database environment for maintenance or diagnostics.'
    )
  }
  if (/^infra:security/.test(script)) {
    bullets.push(
      'When running repository security scans locally or in hardened validation pipelines.'
    )
  }
  if (bullets.length === 0) {
    bullets.push('When the corresponding repository workflow requires this root runner.')
  }

  return Array.from(new Set(bullets))
}

function inferCiBehavior(entry: RootScriptDocEntry): string {
  if (entry.reference?.ciFlag) {
    return stripWrapping(entry.reference.ciFlag) ?? 'No explicit CI behavior documented.'
  }
  if (entry.script.endsWith(':ci') || entry.command.includes('--ci')) {
    return 'This runner is already the CI-specific entrypoint.'
  }
  return 'No explicit root-level `--ci` contract was detected for this runner.'
}

function inferAuditNote(entry: RootScriptDocEntry): string {
  const note =
    stripWrapping(entry.reference?.updatedGeneratedFiles) ??
    'No isolated execution audit note is currently recorded.'
  const implementationCommand = stripWrapping(entry.command)
  if (!implementationCommand) {
    return note
  }

  return note.split(implementationCommand).join(`bun run ${entry.script}`)
}

function renderRelationships(entry: RootScriptDocEntry): string[] {
  return [
    '## Related Scripts',
    '',
    `- Depends on: ${entry.dependsOn.length > 0 ? entry.dependsOn.map((value) => `\`${value}\``).join(', ') : 'None'}`,
    `- Used by other root scripts: ${entry.usedBy.length > 0 ? entry.usedBy.map((value) => `\`${value}\``).join(', ') : 'None found'}`,
    '',
  ]
}

export function generateScriptDoc(entry: RootScriptDocEntry): string {
  const purpose = inferPurpose(entry)
  const source =
    stripWrapping(entry.reference?.source) ??
    (entry.sourcePath ? entry.sourcePath : 'Wrapper only; no single scripts/*.ts source file.')
  const packageUsage = `bun run ${entry.script}`

  const lines = [
    `# ${entry.script}`,
    '',
    '## Command',
    '',
    '```sh',
    packageUsage,
    '```',
    '',
    '## Purpose',
    '',
    purpose,
    '',
    '## Why It Exists',
    '',
    inferWhyItExists(entry),
    '',
    '## Source',
    '',
    `- Package runner: \`${packageUsage}\``,
    `- Implementation: ${source}`,
    `- Metadata-backed script file: ${entry.meta?.filePath ? `\`${entry.meta.filePath}\`` : 'No metadata-backed implementation file detected.'}`,
    '',
    '## CI Behavior',
    '',
    inferCiBehavior(entry),
    '',
    '## When to Run',
    '',
    ...inferWhenToRun(entry).map((bullet) => `- ${bullet}`),
    '',
    ...renderRelationships(entry),
    '## Audit Notes',
    '',
    `- ${inferAuditNote(entry)}`,
    '',
  ]

  return `${lines.join('\n').trimEnd()}\n`
}

function groupHeading(script: string): string {
  if (!script.includes(':')) {
    if (['build', 'format', 'lint', 'prepare', 'typecheck'].includes(script)) {
      return 'quality'
    }
    return 'misc'
  }

  return script.split(':')[0]
}

function generateDocsIndex(entries: readonly RootScriptDocEntry[]): string {
  const grouped = new Map<string, RootScriptDocEntry[]>()
  const orderedEntries = Array.from(entries).sort((left, right) =>
    left.script.localeCompare(right.script)
  )

  for (const entry of orderedEntries) {
    const key = groupHeading(entry.script)
    const current = grouped.get(key) ?? []
    current.push(entry)
    grouped.set(key, current)
  }

  const lines = [
    '# Script Knowledge Base',
    '',
    '> Auto-generated by `bun run dev:generate:script-docs`. Do not edit manually.',
    '',
    'This directory contains one page per root `package.json` script runner, plus the metadata-backed script registry used by governance validation.',
    '',
    '## Scope',
    '',
    `- Root package.json runners documented: ${entries.length}`,
    '- Metadata-backed script implementations are also listed in `SCRIPT_REGISTRY.md`.',
    '',
  ]

  for (const group of Array.from(grouped.keys()).sort((left, right) => left.localeCompare(right))) {
    lines.push(`## ${group}`, '')
    const items = grouped.get(group) ?? []
    for (const entry of items) {
      lines.push(`- [${entry.script}](${entry.filePath}) — ${inferPurpose(entry)}`)
    }
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function generateRegistry(metas: ScriptMeta[]): string {
  // Sort by domain ASC, then script name ASC
  const sorted = [...metas].sort((a, b) => {
    if (a.domain !== b.domain) return a.domain.localeCompare(b.domain)
    return a.script.localeCompare(b.script)
  })

  // Group by domain
  const byDomain = new Map<string, ScriptMeta[]>()
  for (const meta of sorted) {
    const list = byDomain.get(meta.domain) ?? []
    list.push(meta)
    byDomain.set(meta.domain, list)
  }

  const lines: string[] = [
    '# Zidney Script Registry',
    '',
    '> Auto-generated by `bun run dev:generate:script-docs`. Do not edit manually.',
    `> Last generated: ${new Date().toISOString()}`,
    '',
  ]

  for (const domain of Array.from(byDomain.keys())) {
    const scripts = byDomain.get(domain) ?? []
    lines.push(`## ${domain}`, '')
    lines.push(
      '| Script Name | Source File | Category | Description | Usage |',
      '| ----------- | ----------- | -------- | ----------- | ----- |'
    )
    for (const meta of scripts) {
      lines.push(
        `| \`${meta.script}\` | \`${meta.filePath}\` | ${meta.category} | ${meta.description} | \`${meta.usage}\` |`
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}

function loadPackageReferenceSections(): Map<string, PackageReferenceSection> {
  if (!existsSync(PACKAGE_REFERENCE_PATH)) {
    return new Map<string, PackageReferenceSection>()
  }

  return parsePackageReferenceSections(readFileSync(PACKAGE_REFERENCE_PATH, 'utf-8'))
}

export function findStaleDocFiles(existingFiles: string[], expectedFiles: string[]): string[] {
  const expected = new Set([...expectedFiles, ...Array.from(RESERVED_DOC_FILES)])

  return existingFiles.filter((fileName) => fileName.endsWith('.md') && !expected.has(fileName))
}

function main(): void {
  log.header(
    'SCRIPT REGISTRY GENERATOR',
    'Generates docs/scripts/SCRIPT_REGISTRY.md from @script metadata'
  )
  if (isCi) {
    log.info('[dev:generate:script-docs] CI mode enabled')
  }
  logger.info('Generating script registry', { scriptsDir: SCRIPTS_DIR })

  if (!existsSync(DOCS_DIR)) {
    mkdirSync(DOCS_DIR, { recursive: true })
  }

  const tsFiles = walkTsFiles(SCRIPTS_DIR)
  logger.info('TypeScript script files found', { count: tsFiles.length })

  const metas: ScriptMeta[] = []
  const violations: string[] = []

  for (const filePath of tsFiles) {
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }

    const meta = parseMetaHeader(content, filePath)
    if (!meta) continue

    // Validate required fields
    const missing: string[] = []
    if (!meta.domain || meta.domain === 'unknown') missing.push('@domain')
    if (!meta.category || meta.category === 'unknown') missing.push('@category')
    if (!meta.description) missing.push('@description')
    if (!meta.usage) missing.push('@usage')
    if (meta.domain !== 'unknown' && !ALLOWED_DOMAINS.has(meta.domain))
      missing.push(`@domain="${meta.domain}" (not in allowed set)`)

    if (missing.length > 0) {
      violations.push(
        `  ${filePath.replace(`${REPO_ROOT}/`, '')}\n    Missing: ${missing.join(', ')}`
      )
    }

    metas.push(meta)
  }

  if (violations.length > 0) {
    logger.error('Script metadata violations found', { count: violations.length })
    process.stderr.write(`\n❌ Script metadata violations found: ${violations.length}\n\n`)
    for (const v of violations) {
      process.stderr.write(`${v}\n\n`)
    }
    log.result({ total: metas.length, passed: 0, failed: violations.length })
    exit(1)
  }

  const registry = generateRegistry(metas)
  const rootScriptDocs = buildRootScriptDocs(
    loadPackageReferenceSections(),
    loadExistingDocNameMap()
  )
  const staleDocFiles = findStaleDocFiles(
    readdirSync(DOCS_DIR),
    rootScriptDocs.map((entry) => entry.filePath)
  )

  for (const fileName of staleDocFiles) {
    rmSync(join(DOCS_DIR, fileName), { force: true })
  }

  writeFileSync(REGISTRY_PATH, registry, 'utf-8')
  for (const entry of rootScriptDocs) {
    writeFileSync(join(DOCS_DIR, entry.filePath), generateScriptDoc(entry), 'utf-8')
  }
  writeFileSync(DOCS_INDEX_PATH, generateDocsIndex(rootScriptDocs), 'utf-8')

  logger.info('Registry written', {
    path: REGISTRY_PATH,
    scripts: metas.length,
    removedDocs: staleDocFiles.length,
  })
  process.stdout.write(
    `\n✓ Script docs written to docs/scripts/ (${rootScriptDocs.length} root runners)\n`
  )
  log.result({ total: rootScriptDocs.length, passed: rootScriptDocs.length, failed: 0 })
  exit(0)
}

function isDirectExecution(): boolean {
  const entry = process.argv[1] ?? ''
  return /(?:^|[\\/])script-docs\.ts$/.test(entry)
}

if (isDirectExecution()) {
  main()
}
