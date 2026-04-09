#!/usr/bin/env bun

/**
 * @script dev:generate:script-docs
 * @domain dev
 * @category dev
 * @description Walk scripts/**\/*.ts, parse @script metadata headers, generate
 *   docs/scripts/SCRIPT_REGISTRY.md plus one page per root package.json runner.
 *   Supports --check-only to validate the current docs state without writing files.
 *   Exits 1 on missing required metadata fields or docs drift in check-only mode.
 * @usage bun run dev:generate:script-docs [-- --check-only] [--ci]
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
const checkOnly = args.includes('--check-only')
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

export interface ScriptFlag {
  name: string
  type: 'boolean' | 'string' | 'number'
  description: string
  example?: string
}

export interface ScriptMeta {
  script: string
  domain: string
  category: string
  description: string
  usage: string
  filePath: string
  /** Flags detected via `@flag` annotations or code-pattern scanning. */
  flags: ScriptFlag[]
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

interface GeneratedDocsSnapshot {
  registry: string
  docsIndex: string
  perScriptDocs: Map<string, string>
  staleDocFiles: string[]
}

interface CheckOnlyResult {
  missingFiles: string[]
  staleFiles: string[]
  changedFiles: string[]
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

// ─────────────────────────────────────────────────────────────────────────────
// Flag detection
// ─────────────────────────────────────────────────────────────────────────────

/** Standard descriptions and examples for flags shared across many scripts. */
const COMMON_FLAG_DESCRIPTIONS: Record<string, string> = {
  '--ai': 'Emit machine-readable JSON to stdout instead of human-readable output.',
  '--ci': 'Enable CI non-interactive mode. Disables spinners and prompts.',
  '--silent': 'Suppress all non-error output.',
  '--json': 'Output results as JSON.',
  '--pretty': 'Pretty-print JSON output.',
  '--compact': 'Use compact (minimal) output format.',
  '--check-only': 'Validate without writing any files. Exits 1 on drift.',
  '--fix': 'Automatically apply fixes where possible.',
  '--verbose': 'Enable verbose output.',
  '--force': 'Force execution even if checks fail or files already exist.',
  '--changed': 'Only analyse files changed in the current git diff.',
  '--dry-run': 'Report what would be done without making any changes.',
  '--full': 'Run a full (non-incremental) analysis.',
}

/**
 * Parse explicit `@flag` JSDoc annotations from a script source file.
 *
 * Format:  @flag --name boolean|string|number Description text [ | example ]
 *
 * The ` | example` suffix is optional. `SCRIPT_NAME` in the example is replaced
 * with the actual script name.
 */
function parseExplicitFlags(content: string, scriptName: string): ScriptFlag[] {
  const flags: ScriptFlag[] = []
  const re =
    /^[^@\n]*@flag\s+(--[\w-]+)\s+(boolean|string|number)\s+([^|\n]+?)(?:\s*\|\s*([^\n]+?))?$/gm
  let m: RegExpExecArray | null = re.exec(content)
  while (m !== null) {
    flags.push({
      name: m[1].trim(),
      type: m[2] as ScriptFlag['type'],
      description: m[3].trim(),
      example: m[4]?.trim().replace('SCRIPT_NAME', scriptName),
    })
    m = re.exec(content)
  }
  return flags
}

/**
 * Auto-detect flags from common code patterns when no explicit `@flag`
 * annotations are present.
 *
 * Detects:
 *  - `args.includes('--xxx')` / `process.argv.includes('--xxx')` → boolean
 *  - `arg === '--xxx'` → boolean (upgraded to `string` when `args[++i]` follows)
 */
function detectFlagsFromCode(content: string, scriptName: string): ScriptFlag[] {
  const map = new Map<string, ScriptFlag>()

  const mkFlag = (name: string, type: ScriptFlag['type']): ScriptFlag => ({
    name,
    type,
    description: COMMON_FLAG_DESCRIPTIONS[name] ?? '',
    example: `bun run ${scriptName} -- ${name}`,
  })

  const includesRe = /(?:args|process\.argv)\.includes\(\s*'(--[\w-]+)'\s*\)/g
  let m: RegExpExecArray | null = includesRe.exec(content)
  while (m !== null) {
    if (!map.has(m[1])) map.set(m[1], mkFlag(m[1], 'boolean'))
    m = includesRe.exec(content)
  }

  const argEqRe = /\barg\s*===\s*'(--[\w-]+)'/g
  m = argEqRe.exec(content)
  while (m !== null) {
    if (!map.has(m[1])) map.set(m[1], mkFlag(m[1], 'boolean'))
    m = argEqRe.exec(content)
  }

  // Upgrade to string when arg is used as key for the next argv token:
  // e.g.  else if (arg === '--save') config.saveDir = args[++i]
  const strRe = /arg\s*===\s*'(--[\w-]+)'[^;{]*?args\[\+\+i\]/gs
  m = strRe.exec(content)
  while (m !== null) {
    const existing = map.get(m[1])
    if (existing) existing.type = 'string'
    else map.set(m[1], mkFlag(m[1], 'string'))
    m = strRe.exec(content)
  }

  return Array.from(map.values())
}

/**
 * Return flags for a script: explicit `@flag` declarations take priority;
 * falls back to code-pattern detection.
 */
export function parseScriptFlags(content: string, scriptName: string): ScriptFlag[] {
  const explicit = parseExplicitFlags(content, scriptName)
  return explicit.length > 0 ? explicit : detectFlagsFromCode(content, scriptName)
}

/**
 * Render a `## Flags` documentation section.
 * Returns an empty array when the script has no flags.
 */
function renderFlagsSection(flags: ScriptFlag[], scriptName: string): string[] {
  if (flags.length === 0) return []
  const lines: string[] = [
    '## Flags',
    '',
    '| Flag | Type | Description | Example |',
    '| ---- | ---- | ----------- | ------- |',
  ]
  for (const flag of flags) {
    const example = flag.example ?? `bun run ${scriptName} -- ${flag.name}`
    lines.push(
      `| \`${flag.name}\` | \`${flag.type}\` | ${flag.description || '—'} | \`${example}\` |`
    )
  }
  lines.push('')
  return lines
}

export function parseMetaHeader(content: string, filePath: string): ScriptMeta | null {
  const scriptMatch = content.match(/@script\s+([^\n*]+)/)
  if (!scriptMatch) return null

  const domainMatch = content.match(/@domain\s+([^\n*]+)/)
  const categoryMatch = content.match(/@category\s+([^\n*]+)/)
  const usageMatch = content.match(/@usage\s+([^\n*]+)/)
  const description = readMultilineHeaderValue(content, '@description')
  const scriptName = scriptMatch[1].trim()

  return {
    script: scriptName,
    domain: domainMatch ? domainMatch[1].trim() : 'unknown',
    category: categoryMatch ? categoryMatch[1].trim() : 'unknown',
    description,
    usage: usageMatch ? usageMatch[1].trim() : `bun run ${scriptName}`,
    filePath: filePath.replace(`${REPO_ROOT}/`, ''),
    flags: parseScriptFlags(content, scriptName),
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
    (entry.sourcePath ? entry.sourcePath : 'Wrapper only; no single scripts/\\*.ts source file.')
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
    ...renderFlagsSection(entry.meta?.flags ?? [], entry.script),
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
      '| Script Name | Source File | Category | Description | Usage | Flags |',
      '| ----------- | ----------- | -------- | ----------- | ----- | ----- |'
    )
    for (const meta of scripts) {
      const flagsCell =
        (meta.flags ?? []).length > 0
          ? (meta.flags ?? []).map((f) => `\`${f.name}\``).join(', ')
          : '—'
      lines.push(
        `| \`${meta.script}\` | \`${meta.filePath}\` | ${meta.category} | ${meta.description} | \`${meta.usage}\` | ${flagsCell} |`
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function normalizeGeneratedDocContent(filePath: string, content: string): string {
  const relativePath = filePath.replace(`${REPO_ROOT}/`, '')
  const isRegistryPath =
    relativePath === 'docs/scripts/SCRIPT_REGISTRY.md' ||
    filePath === 'docs/scripts/SCRIPT_REGISTRY.md' ||
    filePath.endsWith('/docs/scripts/SCRIPT_REGISTRY.md')
  const normalizedLines = content
    .split('\n')
    .filter((line) => !(isRegistryPath && line.startsWith('> Last generated:')))
    .map((line) => line.trimEnd().replace(/\\\*/g, '*'))

  while (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1] === '') {
    normalizedLines.pop()
  }

  return normalizedLines.join('\n')
}

function buildGeneratedDocsSnapshot(
  metas: readonly ScriptMeta[],
  rootScriptDocs: readonly RootScriptDocEntry[]
): GeneratedDocsSnapshot {
  const perScriptDocs = new Map<string, string>()
  for (const entry of rootScriptDocs) {
    perScriptDocs.set(join(DOCS_DIR, entry.filePath), generateScriptDoc(entry))
  }

  const existingDocFiles = existsSync(DOCS_DIR) ? readdirSync(DOCS_DIR) : []

  return {
    registry: generateRegistry([...metas]),
    docsIndex: generateDocsIndex(rootScriptDocs),
    perScriptDocs,
    staleDocFiles: findStaleDocFiles(
      existingDocFiles,
      rootScriptDocs.map((entry) => entry.filePath)
    ),
  }
}

export function validateGeneratedDocsState(snapshot: GeneratedDocsSnapshot): CheckOnlyResult {
  const filesToValidate = new Map<string, string>([
    [REGISTRY_PATH, snapshot.registry],
    [DOCS_INDEX_PATH, snapshot.docsIndex],
    ...Array.from(snapshot.perScriptDocs.entries()),
  ])

  return compareGeneratedDocsFiles(
    filesToValidate,
    snapshot.staleDocFiles.map((fileName) => `docs/scripts/${fileName}`)
  )
}

export function compareGeneratedDocsFiles(
  filesToValidate: ReadonlyMap<string, string>,
  staleFiles: readonly string[],
  repoRoot = REPO_ROOT
): CheckOnlyResult {
  const normalizePath = (filePath: string) =>
    filePath.startsWith(`${repoRoot}/`) ? filePath.replace(`${repoRoot}/`, '') : filePath

  const missingFiles: string[] = []
  const changedFiles: string[] = []

  for (const [filePath, expectedContent] of filesToValidate) {
    if (!existsSync(filePath)) {
      missingFiles.push(normalizePath(filePath))
      continue
    }

    const currentContent = readFileSync(filePath, 'utf-8')
    if (
      normalizeGeneratedDocContent(filePath, currentContent) !==
      normalizeGeneratedDocContent(filePath, expectedContent)
    ) {
      changedFiles.push(normalizePath(filePath))
    }
  }

  return {
    missingFiles,
    staleFiles: Array.from(staleFiles),
    changedFiles,
  }
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
  if (checkOnly) {
    log.info('[dev:generate:script-docs] Check-only mode enabled')
  }
  logger.info('Generating script registry', { scriptsDir: SCRIPTS_DIR })

  if (!checkOnly && !existsSync(DOCS_DIR)) {
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

  const rootScriptDocs = buildRootScriptDocs(
    loadPackageReferenceSections(),
    loadExistingDocNameMap()
  )
  const snapshot = buildGeneratedDocsSnapshot(metas, rootScriptDocs)

  if (checkOnly) {
    const check = validateGeneratedDocsState(snapshot)
    const driftCount =
      check.missingFiles.length + check.staleFiles.length + check.changedFiles.length

    if (driftCount === 0) {
      logger.info('Script docs are up to date', { files: rootScriptDocs.length + 2 })
      process.stdout.write(
        `\n✓ Script docs are up to date (${rootScriptDocs.length} root runners)\n`
      )
      log.result({ total: rootScriptDocs.length, passed: rootScriptDocs.length, failed: 0 })
      exit(0)
    }

    logger.error('Script docs drift detected', {
      missingFiles: check.missingFiles.length,
      staleFiles: check.staleFiles.length,
      changedFiles: check.changedFiles.length,
    })
    process.stderr.write(`\n❌ Script docs drift detected: ${driftCount}\n\n`)
    for (const filePath of check.missingFiles) {
      process.stderr.write(`  missing: ${filePath}\n`)
    }
    for (const filePath of check.changedFiles) {
      process.stderr.write(`  changed: ${filePath}\n`)
    }
    for (const filePath of check.staleFiles) {
      process.stderr.write(`  stale:   ${filePath}\n`)
    }
    process.stderr.write('\nRun: bun run dev:generate:script-docs\n')
    log.result({
      total: rootScriptDocs.length,
      passed: 0,
      failed: driftCount,
      message: 'Script docs are out of date',
    })
    exit(1)
  }

  for (const fileName of snapshot.staleDocFiles) {
    rmSync(join(DOCS_DIR, fileName), { force: true })
  }

  writeFileSync(REGISTRY_PATH, snapshot.registry, 'utf-8')
  for (const [filePath, content] of snapshot.perScriptDocs) {
    writeFileSync(filePath, content, 'utf-8')
  }
  writeFileSync(DOCS_INDEX_PATH, snapshot.docsIndex, 'utf-8')

  logger.info('Registry written', {
    path: REGISTRY_PATH,
    scripts: metas.length,
    removedDocs: snapshot.staleDocFiles.length,
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
