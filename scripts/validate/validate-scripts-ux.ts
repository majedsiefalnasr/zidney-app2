import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { assertNoConsoleUsage, exit, log } from '../utils/logger'

const isFixMode = process.argv.includes('--fix')
const isCI = process.env.CI === 'true' || process.env.CI === '1'
// Auto-enable preview mode in CI if no explicit flags
const isPreviewMode =
  isCI && !isFixMode && !process.argv.includes('--staged') && !process.argv.includes('--dry')
const isStagedMode = process.argv.includes('--staged') || isPreviewMode
const isDryRun = process.argv.includes('--dry') || isPreviewMode

const ROOT_DIR = path.join(process.cwd(), 'scripts')

// Identify this script in the shared logger (used for AI-mode payloads)
log.setScript('scripts/validate/validate-scripts-ux')

const TARGET_EXTENSIONS = ['.js', '.ts', '.sh']

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage']

// Files that ARE the logger infrastructure or console reporters — console usage is intentional
const CONSOLE_EXEMPT_FILES = [
  'scripts/utils/logger.ts',
  'scripts/utils/logger.js',
  // Console reporter is the terminal output layer — inherently uses console
  'scripts/policy-engine/reporters/console.ts',
]

const EXIT_EXEMPT_FILES = [
  'scripts/utils/logger.ts',
  'scripts/utils/logger.js',
  'scripts/validate/validate-scripts-ux.ts',
]

function isScriptFile(file: string) {
  return TARGET_EXTENSIONS.includes(path.extname(file))
}

function isShellScript(file: string) {
  return path.extname(file) === '.sh'
}

function shouldIgnore(dir: string) {
  return IGNORE_DIRS.some((ignore) => dir.includes(ignore))
}

function scanDir(dir: string, results: string[] = []) {
  if (shouldIgnore(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      scanDir(fullPath, results)
    } else if (entry.isFile() && isScriptFile(entry.name)) {
      results.push(fullPath)
    }
  }

  return results
}

function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --name-only --cached', { encoding: 'utf-8' })
    return output
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)
      .map((f) => path.join(process.cwd(), f))
      .filter((f) => isScriptFile(f))
  } catch {
    return []
  }
}

function suggestFix(content: string) {
  let updated = content

  // safe replacements only (avoid edge cases like comments via simple heuristic)
  updated = updated
    .replace(/\bconsole\.log\(/g, 'log.info(')
    .replace(/\bconsole\.error\(/g, 'log.error(')
    .replace(/\bconsole\.warn\(/g, 'log.warn(')
    .replace(/\bconsole\.info\(/g, 'log.info(')

  // inject logger import if missing and logger is used
  if (updated !== content && !updated.includes("from '../utils/logger'")) {
    const importLine = "import { log } from '../utils/logger'\n"

    // place after existing imports or at top
    if (/^import .* from .*/m.test(updated)) {
      updated = updated.replace(/(^import .*\n)/, `$1${importLine}`)
    } else {
      updated = importLine + updated
    }
  }

  return updated
}

function hasHeader(content: string): boolean {
  // Raw terminal pattern (shell scripts or old style)
  if (content.includes('START:') || content.includes('━━')) return true
  // Logger API calls (preferred TS/JS style)
  if (content.includes('log.header(') || content.includes('log.start(')) return true
  return false
}

function hasResultBlock(content: string): boolean {
  // Raw terminal pattern (shell scripts or old style)
  if (content.includes('SUMMARY') || content.includes('RESULT')) return true
  // Logger API calls (preferred TS/JS style)
  if (
    content.includes('log.result(') ||
    content.includes('log.end(') ||
    content.includes('log.progressResult(') ||
    content.includes('log.resultSimple(') ||
    content.includes('log.badge(')
  )
    return true
  return false
}

function hasFlatLogs(content: string): boolean {
  return /console\.(log|info)\(/.test(content)
}

function hasDirectProcessExit(content: string): boolean {
  return /\bprocess\.exit\s*\(/.test(content)
}

function hasExitUsage(content: string): boolean {
  return /\bexit\s*\(/.test(content)
}

function hasManagedAiScriptIdentity(content: string): boolean {
  return (
    content.includes('log.setScript(') ||
    content.includes('createLogger(') ||
    content.includes('getGlobalLogger(')
  )
}

function hasShellAiSummarySupport(content: string): boolean {
  const hasAiFlag =
    content.includes('--ai') ||
    content.includes('AI_MODE') ||
    content.includes('is_ai_mode') ||
    /\bshell_ai_parse_args\b/.test(content) ||
    content.includes('shell-ai.sh')
  const hasStructuredSummary =
    /\bshell_ai_init\b/.test(content) ||
    /\bshell_ai_finish\b/.test(content) ||
    content.includes('ai_output(')

  return hasAiFlag && hasStructuredSummary
}

function isExecutableScript(filePath: string, content: string, isShell: boolean): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const isTestFile =
    normalizedPath.includes('/__tests__/') || /\.(test|spec)\.[^.]+$/.test(normalizedPath)

  if (isTestFile) {
    return false
  }

  if (content.includes('@library-module')) {
    return false
  }

  return isShell || content.includes('@script ')
}

interface ValidationResult {
  filePath: string
  valid: boolean
  fixed?: boolean
  dry?: boolean
  issues?: string[]
  suggestion?: string
}

function validateFile(filePath: string) {
  // If the file does not exist (deleted in staged changes), skip validation.
  if (!fs.existsSync(filePath)) {
    return { filePath, valid: true }
  }

  const content = fs.readFileSync(filePath, 'utf-8')

  const issues: string[] = []

  const relativePath = filePath.replace(process.cwd() + path.sep, '').replace(/\\/g, '/')
  const isShell = isShellScript(filePath)
  const isExecutable = isExecutableScript(filePath, content, isShell)

  // Header/result checks apply to executable scripts even if they also carry
  // a library marker, since those files still act as CLI entrypoints.
  if (isExecutable) {
    if (!hasHeader(content)) issues.push('Missing header (START block)')
    if (!hasResultBlock(content)) issues.push('Missing result/summary block')
  }

  // Console usage check — skip for logger itself and for shell scripts
  const isConsoleExempt =
    isShell || CONSOLE_EXEMPT_FILES.some((exempt) => relativePath.endsWith(exempt))

  if (!isConsoleExempt) {
    if (hasFlatLogs(content)) issues.push('Flat console logs detected')

    try {
      assertNoConsoleUsage(content)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      issues.push(msg)
    }
  }

  const isExitExempt = EXIT_EXEMPT_FILES.some((exempt) => relativePath.endsWith(exempt))

  if (isExecutable && !isShell && !isExitExempt) {
    if (hasDirectProcessExit(content)) {
      issues.push('Direct process.exit() detected; use shared exit() wrapper')
    }

    if (!hasExitUsage(content)) {
      issues.push('Missing shared exit() usage for executable script')
    }

    if (!hasManagedAiScriptIdentity(content)) {
      issues.push('Missing AI script identity (use log.setScript() or createLogger())')
    }
  }

  if (isShell && isExecutable && !hasShellAiSummarySupport(content)) {
    issues.push('Missing structured shell AI summary support')
  }

  if (issues.length === 0) {
    return { filePath, valid: true }
  }

  const fixed = suggestFix(content)

  if (isFixMode && fixed !== content) {
    if (!isDryRun) {
      fs.writeFileSync(filePath, fixed, 'utf-8')
    }
    return { filePath, valid: true, fixed: true, dry: isDryRun }
  }

  return {
    filePath,
    valid: false,
    issues,
    suggestion: fixed.slice(0, 200),
  }
}

function main() {
  const scriptFiles = isStagedMode ? getStagedFiles() : scanDir(ROOT_DIR)
  if (scriptFiles.length === 0) {
    log.empty('No scripts found to validate')
    exit(0)
  }
  log.header('SCRIPT UX VALIDATION', 'Validates scripts against UX and logging standards')

  const results = scriptFiles.map(validateFile) as ValidationResult[]
  const fixed = results.filter((r) => r.fixed)
  const dry = results.filter((r) => r.dry)

  const failed = results.filter((r) => !r.valid)

  if (failed.length === 0) {
    log.result({
      total: scriptFiles.length,
      passed: scriptFiles.length,
      failed: 0,
      message: 'All scripts valid',
      details: {
        fixedFiles: fixed.length || undefined,
        dryRunFiles: dry.length || undefined,
        mode: isStagedMode ? 'staged' : 'full',
      },
    })
    exit(0)
  }

  log.sectionStep(`Scanning ${scriptFiles.length} scripts`)

  const failedFiles = failed.map((f) => f.filePath)
  log.failList('Failed scripts', failedFiles)

  for (const f of failed) {
    log.group(f.filePath)

    if (f.issues && f.issues.length > 0) {
      log.failList('Issues', f.issues)
    }

    if (f.suggestion) {
      log.step('Fix preview:')
      log.step(f.suggestion)
    }

    log.groupEnd()
  }

  log.result({
    total: scriptFiles.length,
    passed: scriptFiles.length - failed.length,
    failed: failed.length,
    message: 'Fix issues before commit',
    details: {
      fixedFiles: fixed.length || undefined,
      dryRunFiles: dry.length || undefined,
      mode: isStagedMode ? 'staged' : 'full',
    },
  })
  exit(1)
}

main()
