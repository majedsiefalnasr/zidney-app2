/**
 * @script dev:generate:package-docs
 * @domain dev
 * @category dev
 * @description Refresh root package.md from package.json, repo invocation scans, and optional detached-worktree audit evidence.
 * @usage bun run dev:generate:package-docs [-- --audit=ai:validate,arch:guard:ci]
 */

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { createLogger, exit, hasCiFlag, log } from '../utils/logger'
import { parseMetaHeader } from './script-docs'

const REPO_ROOT = process.cwd()
const PACKAGE_JSON_PATH = join(REPO_ROOT, 'package.json')
const PACKAGE_MD_PATH = join(REPO_ROOT, 'package.md')
const AUDIT_CACHE_PATH = join(REPO_ROOT, 'reports', 'package-script-audit.json')
const SUPPORTED_SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.yml',
  '.yaml',
  '.md',
  '.sh',
])
const EXCLUDED_SCAN_DIRS = new Set([
  '.git',
  '.nuxt',
  '.output',
  '.pnpm',
  '.vscode',
  '.yarn',
  'assets',
  'coverage',
  'dist',
  'logs',
  'node_modules',
  'out',
  'public',
  'temp',
  'test-perf-output',
  'test-perf-output-2',
])

const args = process.argv.slice(2)
const isCi = hasCiFlag(args)
const logger = createLogger('dev:generate:package-docs')
logger.setContext({ ci: isCi })

export interface ExistingSection {
  group?: string
  power?: string
  purpose?: string
  source?: string
  ciFlag?: string
  registeredUsage?: string
  updatedGeneratedFiles?: string
  removalAssessment?: string
}

export interface AuditRecord {
  script: string
  command: string
  usedCi: boolean
  exitCode: number
  changedFiles: string[]
  note?: string
  generatedAt: string
}

interface AuditCache {
  generatedAt: string
  audits: Record<string, AuditRecord>
}

interface ScriptMetaSummary {
  description?: string
  usage?: string
}

interface ScriptUsageRefs {
  workflows: string[]
  otherFiles: string[]
}

interface ScriptDocEntry {
  name: string
  command: string
  existing?: ExistingSection
  meta?: ScriptMetaSummary
  sourcePath?: string
  sourceContent?: string
  dependsOn: string[]
  usedBy: string[]
  usageRefs: ScriptUsageRefs
  auditRecord?: AuditRecord
}

interface CliOptions {
  auditScripts: string[]
}

function parseArgs(argv: readonly string[]): CliOptions {
  const auditArg = argv.find((arg) => arg.startsWith('--audit='))
  const auditScripts = auditArg
    ? auditArg
        .replace('--audit=', '')
        .split(',')
        .map((script) => script.trim())
        .filter(Boolean)
    : []

  return { auditScripts }
}

export function parseExistingPackageSections(content: string): Map<string, ExistingSection> {
  const sections = new Map<string, ExistingSection>()
  const regex = /^### (.+)$/gm
  const matches: Array<{ name: string; bodyStart: number; headingIndex: number }> = []
  let match = regex.exec(content)

  while (match !== null) {
    matches.push({
      name: match[1].trim(),
      headingIndex: match.index,
      bodyStart: regex.lastIndex,
    })
    match = regex.exec(content)
  }

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index]
    const next = index + 1 < matches.length ? matches[index + 1] : undefined
    const body = content.slice(current.bodyStart, next?.headingIndex ?? content.length)

    sections.set(current.name, {
      group: readSectionField(body, 'Group'),
      power: readSectionField(body, 'Power'),
      purpose: readSectionField(body, 'Purpose'),
      source: readSectionField(body, 'Source'),
      ciFlag: readSectionField(body, 'CI flag'),
      registeredUsage: readSectionField(body, 'Registered usage'),
      updatedGeneratedFiles: readSectionField(body, 'Updated or generated files'),
      removalAssessment: readSectionField(body, 'Removal assessment'),
    })
  }

  return sections
}

function readSectionField(body: string, label: string): string | undefined {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = body.match(new RegExp(`^- ${escapedLabel}: (.*)$`, 'm'))
  return match?.[1].trim()
}

export function detectScriptDependencies(
  command: string,
  scriptNames: readonly string[],
  selfName: string
): string[] {
  const found = new Set<string>()
  const orderedNames = [...scriptNames].sort((left, right) => right.length - left.length)

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

export function formatUpdatedGeneratedFiles(auditRecord?: AuditRecord, fallback?: string): string {
  if (auditRecord) {
    if (auditRecord.exitCode === 0) {
      if (auditRecord.changedFiles.length === 0) {
        return 'Observed in isolated worktree run: no tracked file changes.'
      }
      return `Observed in isolated worktree run: ${auditRecord.changedFiles.join(', ')}.`
    }

    if (auditRecord.changedFiles.length === 0) {
      const note = auditRecord.note ? ` ${auditRecord.note}` : ''
      return `Audit attempt failed in isolated worktree: \`${auditRecord.command}\` exited non-zero before tracked file changes were observed.${note}`
    }

    const note = auditRecord.note ? ` ${auditRecord.note}` : ''
    return `Isolated worktree run failed; files touched before failure: ${auditRecord.changedFiles.join(', ')}.${note}`
  }

  return fallback ?? 'Not audited automatically in the isolated execution pass.'
}

function loadRootScripts(): Array<[string, string]> {
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as {
    scripts?: Record<string, string>
  }

  return Object.entries(packageJson.scripts ?? {})
}

function resolveSourcePath(command: string): string | undefined {
  const match = command.match(/(?:^|\s)(scripts\/[^\s'"`]+\.ts)(?=\s|$)/)
  return match?.[1]
}

function loadScriptMeta(sourcePath?: string): ScriptMetaSummary | undefined {
  if (!sourcePath) {
    return undefined
  }

  const absolutePath = join(REPO_ROOT, sourcePath)
  if (!existsSync(absolutePath)) {
    return undefined
  }

  const content = readFileSync(absolutePath, 'utf-8')
  const meta = parseMetaHeader(content, absolutePath)
  if (!meta) {
    return undefined
  }

  return { description: meta.description, usage: meta.usage }
}

function readSourceContent(sourcePath?: string): string | undefined {
  if (!sourcePath) {
    return undefined
  }

  const absolutePath = join(REPO_ROOT, sourcePath)
  if (!existsSync(absolutePath)) {
    return undefined
  }

  return readFileSync(absolutePath, 'utf-8')
}

function buildUsedByMap(entries: ScriptDocEntry[]): Map<string, string[]> {
  const usedBy = new Map<string, string[]>()

  for (const entry of entries) {
    for (const dependency of entry.dependsOn) {
      const current = usedBy.get(dependency) ?? []
      current.push(entry.name)
      usedBy.set(dependency, current)
    }
  }

  return usedBy
}

function walkScannableFiles(dir: string): string[] {
  const files: string[] = []

  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_SCAN_DIRS.has(entry)) {
      continue
    }

    const absolutePath = join(dir, entry)
    const stats = statSync(absolutePath)
    if (stats.isDirectory()) {
      files.push(...walkScannableFiles(absolutePath))
      continue
    }

    const nameParts = entry.split('.')
    const extension = entry.includes('.') ? `.${nameParts[nameParts.length - 1]}` : ''
    if (SUPPORTED_SCAN_EXTENSIONS.has(extension)) {
      files.push(absolutePath)
    }
  }

  return files
}

function scanUsageReferences(scriptNames: readonly string[]): Map<string, ScriptUsageRefs> {
  const refs = new Map<string, ScriptUsageRefs>()
  const knownScripts = new Set(scriptNames)
  const usageRegex = /\bbun run ([A-Za-z][A-Za-z0-9:_-]*)|\bbun ([A-Za-z][A-Za-z0-9:_-]*)/g

  for (const scriptName of scriptNames) {
    refs.set(scriptName, { workflows: [], otherFiles: [] })
  }

  for (const absolutePath of walkScannableFiles(REPO_ROOT)) {
    const relativePath = relative(REPO_ROOT, absolutePath)
    const content = readFileSync(absolutePath, 'utf-8')
    const lines = content.split(/\r?\n/)

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      const lineRegex = new RegExp(usageRegex.source, 'g')
      let match = lineRegex.exec(line)

      while (match !== null) {
        const scriptName = match[1] ?? match[2]
        if (knownScripts.has(scriptName)) {
          const target = refs.get(scriptName)
          const location = `${relativePath}:${index + 1}`
          if (relativePath.startsWith('.github/workflows/')) {
            target?.workflows.push(location)
          } else {
            target?.otherFiles.push(location)
          }
        }

        match = lineRegex.exec(line)
      }
    }
  }

  for (const ref of Array.from(refs.values())) {
    ref.workflows = uniqueSorted(ref.workflows)
    ref.otherFiles = uniqueSorted(ref.otherFiles)
  }

  return refs
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right))
}

function summarizeRefs(values: readonly string[], limit = 12): string {
  if (values.length === 0) {
    return 'None found'
  }

  if (values.length <= limit) {
    return values.join(', ')
  }

  return `${values.slice(0, limit).join(', ')}, +${values.length - limit} more`
}

function inferGroup(scriptName: string, existing?: ExistingSection): string {
  if (existing?.group) {
    return existing.group
  }

  const domain = scriptName.includes(':') ? scriptName.split(':')[0] : scriptName
  switch (domain) {
    case 'arch':
      return 'Architecture'
    case 'validate':
      return 'Validation'
    case 'ai':
      return 'AI'
    case 'ci':
      return 'CI'
    case 'repo':
      return 'Repository'
    case 'db':
      return 'Database'
    case 'infra':
      return 'Infrastructure'
    case 'governance':
      return 'Governance'
    case 'policy':
      return 'Policy'
    case 'dev':
      return 'Development'
    case 'test':
      return 'Testing'
    case 'build':
    case 'lint':
    case 'typecheck':
    case 'format':
      return 'Quality'
    case 'prepare':
      return 'Lifecycle'
    default:
      return 'Misc'
  }
}

function inferPower(entry: ScriptDocEntry): string {
  if (entry.existing?.power) {
    return entry.existing.power
  }

  if (
    entry.name === 'prepare' ||
    entry.usageRefs.workflows.length > 0 ||
    entry.usedBy.length > 0 ||
    /^((validate|arch|governance|policy|ai):(guard|context|validate|runtime|generate)|build|test|lint|typecheck)/.test(
      entry.name
    )
  ) {
    return 'critical'
  }

  if (/placeholder|demo/i.test(entry.name) || entry.command.startsWith('echo ')) {
    return 'low'
  }

  return 'medium'
}

function inferPurpose(entry: ScriptDocEntry): string {
  if (entry.existing?.purpose) {
    return entry.existing.purpose
  }

  if (entry.meta?.description) {
    return entry.meta.description
  }

  if (entry.command.startsWith('echo ')) {
    return 'Placeholder alias retained for compatibility or future implementation.'
  }
  if (entry.command.startsWith('tsc --noEmit')) {
    return 'Run the TypeScript compiler in type-check-only mode.'
  }
  if (entry.command.startsWith('vitest run')) {
    return 'Run Vitest for the configured scope.'
  }
  if (entry.command.startsWith('biome check --write')) {
    return 'Run Biome checks and write fixable changes.'
  }
  if (entry.command.startsWith('biome check')) {
    return 'Run Biome checks across the repository.'
  }
  if (entry.command.startsWith('biome format --write')) {
    return 'Format files with Biome.'
  }
  if (entry.command.startsWith('prettier --write')) {
    return 'Format Markdown and YAML-family files with Prettier.'
  }
  if (entry.command.startsWith('prettier --check')) {
    return 'Check Markdown and YAML-family files against Prettier formatting.'
  }
  if (entry.command.startsWith('docker compose up')) {
    return 'Start the local infrastructure stack in detached mode.'
  }

  return 'Run the registered repository task for this area.'
}

function inferSource(entry: ScriptDocEntry): string {
  if (entry.existing?.source) {
    return entry.existing.source
  }

  if (!entry.sourcePath) {
    return 'Wrapper only; no single `scripts/*.ts` source file.'
  }

  return `\`${entry.sourcePath}\``
}

function inferCiFlag(entry: ScriptDocEntry): string {
  if (entry.existing?.ciFlag) {
    return entry.existing.ciFlag
  }

  if (entry.name.endsWith(':ci') || entry.command.includes('--ci')) {
    return 'Dedicated CI runner by name; this entrypoint is already the CI-specific variant.'
  }

  if (!entry.sourcePath && entry.dependsOn.length > 0) {
    return `Indirect wrapper; CI behavior depends on child runner(s): ${entry.dependsOn.join(', ')}.`
  }

  if (!entry.sourcePath) {
    return 'Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.'
  }

  if (entry.sourceContent?.includes('cannot run with --ci')) {
    return 'Explicitly rejected in the implementation.'
  }

  if (
    entry.sourceContent?.includes('hasCiFlag') ||
    entry.sourceContent?.includes("'--ci'") ||
    entry.sourceContent?.includes('"--ci"') ||
    entry.sourceContent?.includes('process.env.CI')
  ) {
    return 'Supported explicitly in the implementation.'
  }

  return 'No explicit `--ci` handling detected in the implementation.'
}

function inferRemovalAssessment(entry: ScriptDocEntry, power: string): string {
  if (entry.existing?.removalAssessment) {
    return entry.existing.removalAssessment
  }

  if (entry.usedBy.length > 0) {
    return `Not safe to remove directly. Other root scripts depend on it: ${entry.usedBy.join(', ')}.`
  }

  if (entry.usageRefs.workflows.length > 0) {
    const workflowFiles = uniqueSorted(
      entry.usageRefs.workflows.map((ref) => ref.split(':').slice(0, -1).join(':'))
    )
    return `Do not remove without updating CI or workflow automation. Direct workflow usage found in: ${workflowFiles.join(', ')}.`
  }

  if (power === 'critical') {
    return 'Treat as protected. It is a primary quality, build, test, or governance entrypoint.'
  }

  if (entry.command.startsWith('echo ')) {
    return 'Low-risk cleanup candidate, but verify no undocumented manual workflow still calls it.'
  }

  return 'Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.'
}

function parseFlags(command: string): Array<{ flag: string; value?: string }> {
  const tokens = command.match(/"[^"]*"|'[^']*'|[^\s]+/g) ?? []
  const flags: Array<{ flag: string; value?: string }> = []
  const stopTokens = new Set(['&&', '||', '|'])

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    if (stopTokens.has(token) || token === 'bun' || token === 'run') {
      continue
    }
    if (token.startsWith('scripts/')) {
      continue
    }
    if (!token.startsWith('-')) {
      continue
    }

    let value: string | undefined
    const next = tokens[index + 1]
    if (next && !next.startsWith('-') && !stopTokens.has(next)) {
      value = normalizeToken(next)
      index += 1
    }

    flags.push({ flag: normalizeToken(token), value })
  }

  return flags
}

function normalizeToken(token: string): string {
  return token.replace(/^['"]|['"]$/g, '')
}

function describeFlag(flag: string): string {
  switch (flag) {
    case '--ci':
      return 'Enable CI-oriented behavior and reporting.'
    case '--json':
      return 'Emit machine-readable JSON output.'
    case '--check':
      return 'Check-only mode; fail if drift exists.'
    case '--force':
      return 'Bypass freshness checks and force regeneration.'
    case '--dry-run':
      return 'Preview behavior without writing tracked files.'
    case '--full':
      return 'Runner-level option passed directly to the underlying tool.'
    case '--changed':
      return 'Restrict processing to changed files.'
    case '--no-exit-error':
      return 'Prevent non-zero exit when reporting findings.'
    case '--reporter':
      return 'Select reporter output format.'
    case '--project':
      return 'Run only the specified Vitest project.'
    case '--dir':
      return 'Target a specific directory.'
    case '-p':
      return 'Pass an alternate TypeScript project file.'
    case '-W':
    case '-j':
    case '-l':
    case '-d':
      return 'Runner-level option passed directly to the underlying tool.'
    default:
      return 'Runner-level option passed directly to the underlying tool.'
  }
}

function renderUsage(entry: ScriptDocEntry, purpose: string): string[] {
  const lines = ['- Usage:', `  - Primary purpose: ${purpose}`]
  const flags = parseFlags(entry.command)

  if (flags.length === 0) {
    lines.push(
      `  - Flags: none baked into this runner. You can append more args with \`bun run ${entry.name} -- <args>\` only if the underlying tool supports them.`
    )
    return lines
  }

  for (const parsedFlag of flags) {
    const description = describeFlag(parsedFlag.flag)
    if (parsedFlag.value) {
      lines.push(
        `  - Flag \`${parsedFlag.flag} ${parsedFlag.value}\`: ${description} Value: ${parsedFlag.value}.`
      )
    } else {
      lines.push(`  - Flag \`${parsedFlag.flag}\`: ${description}`)
    }
  }

  return lines
}

function classifyAuditCommand(entry: ScriptDocEntry): {
  command: string
  args: string[]
  usedCi: boolean
} {
  if (entry.command.includes('--ci') || entry.name.endsWith(':ci')) {
    return { command: `bun run ${entry.name}`, args: ['run', entry.name], usedCi: true }
  }

  const supportsCi =
    entry.sourceContent?.includes('hasCiFlag') ||
    entry.sourceContent?.includes("'--ci'") ||
    entry.sourceContent?.includes('"--ci"') ||
    entry.sourceContent?.includes('process.env.CI') ||
    false

  if (supportsCi) {
    return {
      command: `bun run ${entry.name} -- --ci`,
      args: ['run', entry.name, '--', '--ci'],
      usedCi: true,
    }
  }

  return { command: `bun run ${entry.name}`, args: ['run', entry.name], usedCi: false }
}

function stripAnsi(value: string): string {
  let current = value

  while (true) {
    const start = current.indexOf('\u001B[')
    if (start === -1) {
      return current
    }

    let end = start + 2
    while (end < current.length && /[0-9;]/.test(current[end])) {
      end += 1
    }

    if (current[end] === 'm') {
      end += 1
    }

    current = `${current.slice(0, start)}${current.slice(end)}`
  }
}

function extractAuditNote(output: string): string | undefined {
  const lines = output
    .split(/\r?\n/)
    .map((line) => stripAnsi(line).trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('::group::') && !line.startsWith('::endgroup::'))

  const interesting = lines.filter((line) =>
    /fail|error|warn|violation|exit|pass|required/i.test(line)
  )
  const chosen = (interesting.length > 0 ? interesting : lines).slice(-2)
  if (chosen.length === 0) {
    return undefined
  }

  return `Output note: ${chosen.join(' ')}`
}

function loadAuditCache(): AuditCache {
  if (!existsSync(AUDIT_CACHE_PATH)) {
    return { generatedAt: new Date().toISOString(), audits: {} }
  }

  return JSON.parse(readFileSync(AUDIT_CACHE_PATH, 'utf-8')) as AuditCache
}

function saveAuditCache(cache: AuditCache): void {
  mkdirSync(dirname(AUDIT_CACHE_PATH), { recursive: true })
  writeFileSync(AUDIT_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf-8')
}

function runDetachedAudit(entry: ScriptDocEntry): AuditRecord {
  const auditCommand = classifyAuditCommand(entry)
  const tempWorktree = mkdtempSync(join(tmpdir(), 'package-doc-audit-'))

  let output = ''
  let exitCode = 1
  let changedFiles: string[] = []

  try {
    runOrThrow(
      'git',
      ['-C', REPO_ROOT, 'worktree', 'add', '--detach', tempWorktree, 'HEAD'],
      REPO_ROOT
    )

    const runResult = spawnSync('bun', auditCommand.args, {
      cwd: tempWorktree,
      encoding: 'utf-8',
      env: {
        ...process.env,
        CI: auditCommand.usedCi ? '1' : process.env.CI,
      },
    })

    output = `${runResult.stdout ?? ''}${runResult.stderr ?? ''}`
    exitCode = runResult.status ?? 1

    const diffResult = spawnSync('git', ['diff', '--name-only', '--relative'], {
      cwd: tempWorktree,
      encoding: 'utf-8',
    })
    changedFiles = (diffResult.stdout ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
  } finally {
    spawnSync('git', ['-C', REPO_ROOT, 'worktree', 'remove', '--force', tempWorktree], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    })
    rmSync(tempWorktree, { recursive: true, force: true })
  }

  return {
    script: entry.name,
    command: auditCommand.command,
    usedCi: auditCommand.usedCi,
    exitCode,
    changedFiles,
    note: extractAuditNote(output),
    generatedAt: new Date().toISOString(),
  }
}

function runOrThrow(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, encoding: 'utf-8' })
  if ((result.status ?? 1) !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
    throw new Error(`${command} ${args.join(' ')} failed: ${output}`)
  }
}

function buildEntries(existingSections: Map<string, ExistingSection>): ScriptDocEntry[] {
  const scriptPairs = loadRootScripts()
  const scriptNames = scriptPairs.map(([name]) => name)

  const entries = scriptPairs.map(([name, command]) => {
    const sourcePath = resolveSourcePath(command)
    return {
      name,
      command,
      existing: existingSections.get(name),
      meta: loadScriptMeta(sourcePath),
      sourcePath,
      sourceContent: readSourceContent(sourcePath),
      dependsOn: detectScriptDependencies(command, scriptNames, name),
      usedBy: [],
      usageRefs: { workflows: [], otherFiles: [] },
    } satisfies ScriptDocEntry
  })

  const usedByMap = buildUsedByMap(entries)
  const usageRefsMap = scanUsageReferences(scriptNames)

  return entries.map((entry) => ({
    ...entry,
    usedBy: usedByMap.get(entry.name) ?? [],
    usageRefs: usageRefsMap.get(entry.name) ?? { workflows: [], otherFiles: [] },
  }))
}

function renderWorkflowBoundRunners(entries: readonly ScriptDocEntry[]): string[] {
  const workflowBound = entries
    .filter((entry) => entry.usageRefs.workflows.length > 0)
    .map((entry) => `- \`${entry.name}\`: ${summarizeRefs(entry.usageRefs.workflows, 2)}`)

  return [
    '## Workflow-Bound Runners',
    '',
    '- These runners are invoked directly from `.github/workflows` and should be treated as non-removable until the relevant workflow is changed.',
    ...(workflowBound.length > 0 ? workflowBound : ['- None found']),
    '',
  ]
}

function renderScriptEntry(entry: ScriptDocEntry): string[] {
  const group = inferGroup(entry.name, entry.existing)
  const power = inferPower(entry)
  const purpose = inferPurpose(entry)
  const source = inferSource(entry)
  const ciFlag = inferCiFlag(entry)
  const updatedGeneratedFiles = formatUpdatedGeneratedFiles(
    entry.auditRecord,
    entry.existing?.updatedGeneratedFiles ?? classifyUnauditedFallback(entry)
  )
  const removalAssessment = inferRemovalAssessment(entry, power)

  const lines = [
    `### ${entry.name}`,
    '',
    `- Group: ${group}`,
    `- Command: \`${entry.command}\``,
    `- Power: ${power}`,
    `- Purpose: ${purpose}`,
    `- Source: ${source}`,
    `- CI flag: ${ciFlag}`,
  ]

  if (entry.meta?.usage || entry.existing?.registeredUsage) {
    lines.push(
      `- Registered usage: ${entry.meta?.usage ? `\`${entry.meta.usage}\`` : entry.existing?.registeredUsage}`
    )
  }

  lines.push(...renderUsage(entry, purpose))
  lines.push(
    `- Depends on: ${entry.dependsOn.length > 0 ? entry.dependsOn.map((value) => `\`${value}\``).join(', ') : 'None'}`
  )
  lines.push(
    `- Used by other root scripts: ${entry.usedBy.length > 0 ? entry.usedBy.map((value) => `\`${value}\``).join(', ') : 'None found'}`
  )
  lines.push('- Used in:')
  lines.push(`  - Workflows: ${summarizeRefs(entry.usageRefs.workflows)}`)
  lines.push(`  - Other files: ${summarizeRefs(entry.usageRefs.otherFiles)}`)
  lines.push(`- Updated or generated files: ${updatedGeneratedFiles}`)
  lines.push(`- Removal assessment: ${removalAssessment}`)
  lines.push('')

  return lines
}

function classifyUnauditedFallback(entry: ScriptDocEntry): string {
  if (!entry.sourcePath && entry.dependsOn.length > 0) {
    return 'Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.'
  }
  if (entry.command.includes('playwright')) {
    return 'Not audited automatically: browser/end-to-end workflow.'
  }
  if (entry.command.includes('docker compose up') || entry.command.includes('concurrently')) {
    return 'Not audited automatically: long-running service launcher.'
  }
  if (entry.name.startsWith('db:') || entry.command.includes('psql')) {
    return 'Not audited automatically: requires database connectivity or interactive/manual access.'
  }
  if (entry.command.startsWith('echo ')) {
    return 'Not audited automatically in the isolated execution pass.'
  }
  if (entry.command.includes('trivy') || entry.name.startsWith('infra:security')) {
    return 'Not audited automatically: external scanner dependency or long-running security scan.'
  }
  if (/refactor|fix|cache:clean|seed/.test(entry.name)) {
    return 'Not audited automatically: mutates repository state.'
  }
  return 'Not audited automatically in the isolated execution pass.'
}

function renderDocument(entries: readonly ScriptDocEntry[]): string {
  const powers = entries.reduce(
    (accumulator, entry) => {
      const power = inferPower(entry)
      if (power === 'critical' || power === 'medium' || power === 'low') {
        accumulator[power] += 1
      }
      return accumulator
    },
    { critical: 0, medium: 0, low: 0 }
  )

  const lines = [
    '# Package Script Reference',
    '',
    'This document consolidates every root runner in `package.json` into one decision-making reference: what it does, which flags are baked into the runner, what depends on it, where it is invoked, and whether it is safe to remove.',
    '',
    'Refresh this file with `bun run dev:generate:package-docs`.',
    '',
    '## How To Read This File',
    '',
    '- `Power` is the practical blast-radius label for the runner itself, not the underlying implementation file.',
    '- `critical` means CI, install lifecycle, governance, or primary build/test quality paths depend on it.',
    '- `medium` means it is part of normal developer workflows or is a composition alias, but the current scan did not find direct workflow enforcement.',
    '- `low` means the runner looks optional, debug/demo-oriented, or placeholder-like.',
    '- `Used in` is based on a direct invocation scan for `bun run <script>` or `bun <script>`. Documentation-only mentions are intentionally excluded.',
    '',
    '- `Updated or generated files` is based on an isolated worktree execution audit for safe non-interactive scripts. Runners that were unsafe, long-running, interactive, or wrapper-only are marked as not audited automatically.',
    '- `CI flag` distinguishes between explicit `--ci` parsing, baseline support via the shared logger, indirect CI support through child runners, and wrapper aliases that do not own a `--ci` mode.',
    '',
    '## Summary',
    '',
    `- Total root runners: ${entries.length}`,
    `- Critical: ${powers.critical}`,
    `- Medium: ${powers.medium}`,
    `- Low: ${powers.low}`,
    '',
    ...renderWorkflowBoundRunners(entries),
    '## Script Inventory',
    '',
  ]

  for (const entry of entries) {
    lines.push(...renderScriptEntry(entry))
  }

  return `${lines.join('\n').trimEnd()}\n`
}

function main(): void {
  const options = parseArgs(args)
  log.header('PACKAGE DOCS GENERATOR', 'Refresh root package.md from scripts and audit evidence')
  if (isCi) {
    log.info('[dev:generate:package-docs] CI mode enabled')
  }

  const existingSections = existsSync(PACKAGE_MD_PATH)
    ? parseExistingPackageSections(readFileSync(PACKAGE_MD_PATH, 'utf-8'))
    : new Map<string, ExistingSection>()

  let entries = buildEntries(existingSections)
  const auditCache = loadAuditCache()

  for (const entry of entries) {
    entry.auditRecord = auditCache.audits[entry.name]
  }

  if (options.auditScripts.length > 0) {
    for (const scriptName of options.auditScripts) {
      const entry = entries.find((candidate) => candidate.name === scriptName)
      if (!entry) {
        logger.warn('Skipping unknown audit target', { scriptName })
        continue
      }

      logger.info('Running detached audit', { scriptName })
      const auditRecord = runDetachedAudit(entry)
      auditCache.audits[scriptName] = auditRecord
      entry.auditRecord = auditRecord
    }

    auditCache.generatedAt = new Date().toISOString()
    saveAuditCache(auditCache)
  }

  entries = buildEntries(existingSections).map((entry) => ({
    ...entry,
    auditRecord: auditCache.audits[entry.name],
  }))

  writeFileSync(PACKAGE_MD_PATH, renderDocument(entries), 'utf-8')
  logger.info('package.md refreshed', { outputPath: PACKAGE_MD_PATH, scripts: entries.length })
  log.result({ total: entries.length, passed: entries.length, failed: 0 })
  exit(0)
}

function isDirectExecution(): boolean {
  const entry = process.argv[1] ?? ''
  return /(?:^|[\\/])package-docs\.ts$/.test(entry)
}

if (isDirectExecution()) {
  main()
}
