// CLI utility — exempt from service-layer logging standards (AGENTS.md §Logging Rules)

import { execSync } from 'child_process'
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs'
import { basename, join, relative } from 'path'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = process.cwd()

const SECRET_PATTERNS: RegExp[] = [
  /^\.env$/,
  /^\.env\..+/,
  /\.pem$/,
  /\.key$/,
  /\.secret$/,
  /\.p12$/,
  /\.pfx$/,
  /^docker-compose\.override\.yml$/,
]

const SKIP_DIRS = new Set(['node_modules', '.git', '.DS_Store'])

const VITEST_CONFIG_NAMES = new Set([
  'vitest.config.ts',
  'vitest.config.js',
  'vitest.workspace.ts',
  'vitest.workspace.js',
])

const ESLINT_CONFIG_PATTERNS: RegExp[] = [
  /^eslint\.config\.(mjs|js|cjs|ts)$/,
  /^\.eslintrc\.(js|cjs|json|yaml|yml)$/,
  /^\.eslintrc$/,
]

const PLAYWRIGHT_CONFIG_NAMES = new Set([
  'playwright.config.ts',
  'playwright.config.js',
])

const REQUIRED_README_SECTIONS = [
  'Purpose',
  'Responsibilities',
  'Dependencies',
  'Public API',
  'How to Run Tests',
  'Environment Variables',
  'Known Boundaries',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSecretFile(filename: string): boolean {
  return SECRET_PATTERNS.some((p) => p.test(filename))
}

type FileVisitor = (fullPath: string, filename: string, relPath: string) => void

function walkDir(dir: string, visitor: FileVisitor): void {
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    console.log(`[INFRA AUDIT] WARN: PARSE_ERROR ${relative(ROOT, dir)}`)
    return
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue

    const fullPath = join(dir, entry)
    let isDir = false
    try {
      isDir = statSync(fullPath).isDirectory()
    } catch {
      continue
    }

    if (isDir) {
      walkDir(fullPath, visitor)
    } else {
      if (isSecretFile(entry)) {
        console.log(`[INFRA AUDIT] SKIP: ${entry} (secret pattern)`)
        continue
      }
      visitor(fullPath, entry, relative(ROOT, fullPath))
    }
  }
}

function safeReadFile(fullPath: string): string | null {
  try {
    return readFileSync(fullPath, 'utf-8')
  } catch {
    console.log(`[INFRA AUDIT] WARN: PARSE_ERROR ${relative(ROOT, fullPath)}`)
    return null
  }
}

// ---------------------------------------------------------------------------
// Phase: Vitest Config Inventory
// ---------------------------------------------------------------------------

interface VitestConfigEntry {
  path: string
  environment: string | null
  globals: boolean | null
  coverageEnabled: boolean | null
  customReporters: string[]
  isWorkspace: boolean
}

function scanVitestConfigs(allFiles: Map<string, string>): VitestConfigEntry[] {
  console.log('[INFRA AUDIT] Phase: Vitest Config Inventory...')
  const results: VitestConfigEntry[] = []

  for (const [relPath, fullPath] of allFiles) {
    const filename = basename(fullPath)
    if (!VITEST_CONFIG_NAMES.has(filename)) continue

    const content = safeReadFile(fullPath) ?? ''
    const isWorkspace = filename.startsWith('vitest.workspace')

    // Extract environment
    const envMatch = content.match(/environment\s*:\s*['"]([^'"]+)['"]/)
    const environment = envMatch ? envMatch[1] : null

    // Extract globals
    const globalsMatch = content.match(/globals\s*:\s*(true|false)/)
    const globals = globalsMatch ? globalsMatch[1] === 'true' : null

    // Check coverage enabled
    const coverageEnabled = /coverage\s*:/.test(content)

    // Custom reporters
    const reporterMatch = content.match(/reporter\s*:\s*\[([^\]]+)\]/)
    const customReporters: string[] = []
    if (reporterMatch) {
      const reporters = reporterMatch[1].match(/['"]([^'"]+)['"]/g)
      if (reporters) {
        customReporters.push(...reporters.map((r) => r.replace(/['"]/g, '')))
      }
    }

    results.push({
      path: relPath,
      environment,
      globals,
      coverageEnabled,
      customReporters,
      isWorkspace,
    })
  }

  return results
}

function classifyConsolidationRisk(
  configs: VitestConfigEntry[]
): 'LOW' | 'MEDIUM' | 'HIGH' {
  const count = configs.length
  if (count <= 1) return 'LOW'
  if (count <= 3) return 'MEDIUM'
  return 'HIGH'
}

// ---------------------------------------------------------------------------
// Phase: ESLint Config Inventory
// ---------------------------------------------------------------------------

interface ESLintConfigEntry {
  path: string
  format: 'flat' | 'legacy'
}

function scanEslintConfigs(allFiles: Map<string, string>): ESLintConfigEntry[] {
  console.log('[INFRA AUDIT] Phase: ESLint Config Inventory...')
  const results: ESLintConfigEntry[] = []

  for (const [relPath, _fullPath] of allFiles) {
    const filename = basename(relPath)
    if (!ESLINT_CONFIG_PATTERNS.some((p) => p.test(filename))) continue

    const isFlat = /^eslint\.config\.(mjs|js|cjs|ts)$/.test(filename)
    results.push({ path: relPath, format: isFlat ? 'flat' : 'legacy' })
  }

  return results
}

function classifyPrettierConflictRisk(
  allFiles: Map<string, string>
): 'SAFE' | 'NEEDS_ALIGNMENT' | 'CONFLICT_PRESENT' {
  // Check for eslint-config-prettier in any package.json
  for (const [_relPath, fullPath] of allFiles) {
    if (basename(fullPath) !== 'package.json') continue
    const content = safeReadFile(fullPath)
    if (content && content.includes('eslint-config-prettier')) {
      return 'SAFE'
    }
  }
  return 'NEEDS_ALIGNMENT'
}

// ---------------------------------------------------------------------------
// Phase: Test File Counter
// ---------------------------------------------------------------------------

interface TestFileCounts {
  unitTestFiles: number
  integrationTestFiles: number
  specTestFiles: number
  totalTestFiles: number
  perApp: Record<string, { unit: number; integration: number; spec: number }>
}

function countTestFiles(allFiles: Map<string, string>): TestFileCounts {
  console.log('[INFRA AUDIT] Phase: Test File Counter...')
  let unitTestFiles = 0
  let integrationTestFiles = 0
  let specTestFiles = 0

  const perApp: Record<
    string,
    { unit: number; integration: number; spec: number }
  > = {}

  for (const [relPath] of allFiles) {
    const isTestTs =
      relPath.endsWith('.test.ts') || relPath.endsWith('.test.js')
    const isSpecTs = relPath.endsWith('.spec.ts')

    // Unit tests: apps/*/src/**/*.test.ts
    if (isTestTs && relPath.match(/^apps\/[^/]+\/src\//)) {
      unitTestFiles++
      const appMatch = relPath.match(/^apps\/([^/]+)\//)
      if (appMatch) {
        const app = appMatch[1]
        if (!perApp[app]) perApp[app] = { unit: 0, integration: 0, spec: 0 }
        perApp[app].unit++
      }
    }

    // Integration tests: tests/integration/** or apps/*/tests/integration/**
    if (
      isTestTs &&
      (relPath.startsWith('tests/integration/') ||
        relPath.match(/^apps\/[^/]+\/tests\/integration\//))
    ) {
      integrationTestFiles++
      const appMatch = relPath.match(/^apps\/([^/]+)\//)
      if (appMatch) {
        const app = appMatch[1]
        if (!perApp[app]) perApp[app] = { unit: 0, integration: 0, spec: 0 }
        perApp[app].integration++
      }
    }

    // Spec tests: **/*.spec.ts
    if (isSpecTs) {
      specTestFiles++
      const appMatch = relPath.match(/^apps\/([^/]+)\//)
      if (appMatch) {
        const app = appMatch[1]
        if (!perApp[app]) perApp[app] = { unit: 0, integration: 0, spec: 0 }
        perApp[app].spec++
      }
    }
  }

  return {
    unitTestFiles,
    integrationTestFiles,
    specTestFiles,
    totalTestFiles: unitTestFiles + integrationTestFiles + specTestFiles,
    perApp,
  }
}

// ---------------------------------------------------------------------------
// Phase: Playwright Config Detector
// ---------------------------------------------------------------------------

interface PlaywrightEntry {
  path: string
  app: string
}

function detectPlaywrightConfigs(
  allFiles: Map<string, string>
): PlaywrightEntry[] {
  console.log('[INFRA AUDIT] Phase: Playwright Detector...')
  const results: PlaywrightEntry[] = []

  for (const [relPath, fullPath] of allFiles) {
    const filename = basename(fullPath)
    if (!PLAYWRIGHT_CONFIG_NAMES.has(filename)) continue
    const appMatch = relPath.match(/^apps\/([^/]+)\//)
    const app = appMatch ? appMatch[1] : 'root'
    results.push({ path: relPath, app })
  }

  return results
}

// ---------------------------------------------------------------------------
// Phase: README Scanner
// ---------------------------------------------------------------------------

type ReadmeStatus = 'PRESENT' | 'PRESENT_EMPTY' | 'MISSING' | 'README_MISSING'

interface ReadmeAuditEntry {
  directory: string
  hasReadme: boolean
  status: ReadmeStatus
  sections?: Record<string, ReadmeStatus>
}

function checkReadmeSections(content: string): Record<string, ReadmeStatus> {
  const sections: Record<string, ReadmeStatus> = {}
  for (const section of REQUIRED_README_SECTIONS) {
    const headingPattern = new RegExp(`^#{1,3}\\s+${section}`, 'im')
    const match = content.match(headingPattern)
    if (!match) {
      sections[section] = 'MISSING'
      continue
    }
    // Check if there's content after the heading
    const afterHeading = content.slice(
      content.indexOf(match[0]) + match[0].length
    )
    const nextHeading = afterHeading.match(/^#{1,3}\s+/m)
    const body = nextHeading
      ? afterHeading.slice(0, afterHeading.indexOf(nextHeading[0]))
      : afterHeading
    const hasContent = body.replace(/\s/g, '').length > 0
    sections[section] = hasContent ? 'PRESENT' : 'PRESENT_EMPTY'
  }
  return sections
}

function scanReadmeAudit(): ReadmeAuditEntry[] {
  console.log('[INFRA AUDIT] Phase: README Scanner...')
  const results: ReadmeAuditEntry[] = []
  const topDirs = ['apps', 'packages']

  for (const topDir of topDirs) {
    const fullTopDir = join(ROOT, topDir)
    if (!existsSync(fullTopDir)) continue

    let subdirs: string[] = []
    try {
      subdirs = readdirSync(fullTopDir).filter((d) => {
        try {
          return statSync(join(fullTopDir, d)).isDirectory()
        } catch {
          return false
        }
      })
    } catch {
      continue
    }

    for (const subdir of subdirs) {
      const dirPath = join(fullTopDir, subdir)
      const relDir = `${topDir}/${subdir}`

      // Check for README.md (case-insensitive)
      let readmePath: string | null = null
      try {
        const dirEntries = readdirSync(dirPath)
        const readmeEntry = dirEntries.find(
          (f) => f.toLowerCase() === 'readme.md'
        )
        if (readmeEntry) readmePath = join(dirPath, readmeEntry)
      } catch {
        // skip
      }

      if (!readmePath) {
        results.push({
          directory: relDir,
          hasReadme: false,
          status: 'README_MISSING',
        })
        continue
      }

      const content = safeReadFile(readmePath)
      if (!content) {
        results.push({
          directory: relDir,
          hasReadme: true,
          status: 'PRESENT_EMPTY',
        })
        continue
      }

      const sections = checkReadmeSections(content)
      results.push({
        directory: relDir,
        hasReadme: true,
        status: 'PRESENT',
        sections,
      })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Phase: Skipped/Flaky Test Scanner
// ---------------------------------------------------------------------------

const SKIP_PATTERNS: RegExp[] = [
  /\.skip\s*\(/,
  /\.todo\s*\(/,
  /\bxit\s*\(/,
  /\bxdescribe\s*\(/,
]

const FLAKY_PATTERNS: RegExp[] = [
  /\.retry\s*\(/,
  /\/\/\s*(flaky|FLAKY|unstable|UNSTABLE)/,
  /retry\s*:\s*[1-9]/,
]

interface SkippedFlakyResult {
  count: number
  files: string[]
  detectionMethod: 'STATIC_SCAN_ONLY'
}

function scanSkippedFlakyTests(allFiles: Map<string, string>): {
  skippedTests: SkippedFlakyResult
  flakyTests: SkippedFlakyResult
} {
  console.log('[INFRA AUDIT] Phase: Skipped/Flaky Test Scanner...')
  const skippedFiles: string[] = []
  const flakyFiles: string[] = []

  for (const [relPath, fullPath] of allFiles) {
    // Only scan test/spec files
    if (
      !relPath.endsWith('.test.ts') &&
      !relPath.endsWith('.test.js') &&
      !relPath.endsWith('.spec.ts') &&
      !relPath.endsWith('.spec.js')
    )
      continue

    const content = safeReadFile(fullPath)
    if (!content) continue

    if (SKIP_PATTERNS.some((p) => p.test(content))) {
      skippedFiles.push(relPath)
    }

    if (FLAKY_PATTERNS.some((p) => p.test(content))) {
      flakyFiles.push(relPath)
    }
  }

  return {
    skippedTests: {
      count: skippedFiles.length,
      files: skippedFiles,
      detectionMethod: 'STATIC_SCAN_ONLY',
    },
    flakyTests: {
      count: flakyFiles.length,
      files: flakyFiles,
      detectionMethod: 'STATIC_SCAN_ONLY',
    },
  }
}

// ---------------------------------------------------------------------------
// Phase: Git SHA
// ---------------------------------------------------------------------------

function getGitSha(): string {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: ROOT,
      encoding: 'utf-8',
    }).trim()
  } catch {
    return 'UNKNOWN'
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('[INFRA AUDIT] Starting infrastructure audit...')
console.log(`[INFRA AUDIT] Root: ${ROOT}`)

// Build full file map
const allFiles = new Map<string, string>() // relPath -> fullPath
walkDir(ROOT, (fullPath, _filename, relPath) => {
  allFiles.set(relPath, fullPath)
})

console.log(`[INFRA AUDIT] Total files scanned: ${allFiles.size}`)

// Run all phases
const gitSha = getGitSha()
const vitestConfigs = scanVitestConfigs(allFiles)
const eslintConfigs = scanEslintConfigs(allFiles)
const playwrightConfigs = detectPlaywrightConfigs(allFiles)
const testFileCounts = countTestFiles(allFiles)
const readmeAudit = scanReadmeAudit()
const { skippedTests, flakyTests } = scanSkippedFlakyTests(allFiles)
const consolidationRisk = classifyConsolidationRisk(vitestConfigs)
const prettierConflictRisk = classifyPrettierConflictRisk(allFiles)

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

console.log('[INFRA AUDIT] Writing infra-audit-report.json...')

const report = {
  timestamp: new Date().toISOString(),
  gitSha,
  vitestConfigs,
  eslintConfigs,
  playwrightConfigs,
  totalTestFiles: testFileCounts,
  readmeAudit,
  skippedTests,
  flakyTests,
  consolidationRisk,
  prettierConflictRisk,
}

const outputPath = join(ROOT, 'infra-audit-report.json')
writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8')

console.log('[INFRA AUDIT] ✓ Complete. Output: infra-audit-report.json')
console.log(`[INFRA AUDIT] Summary:`)
console.log(
  `  - Vitest configs: ${vitestConfigs.length} (consolidationRisk: ${consolidationRisk})`
)
console.log(
  `  - ESLint configs: ${eslintConfigs.length} (prettierConflictRisk: ${prettierConflictRisk})`
)
console.log(`  - Playwright configs: ${playwrightConfigs.length}`)
console.log(`  - Total test files: ${testFileCounts.totalTestFiles}`)
console.log(`  - Skipped tests: ${skippedTests.count}`)
console.log(`  - Flaky tests: ${flakyTests.count}`)
console.log(
  `  - README missing: ${readmeAudit.filter((r) => !r.hasReadme).length}`
)
