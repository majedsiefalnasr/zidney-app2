import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { assertNoConsoleUsage, flushAi, log } from '../utils/logger'

const isFixMode = process.argv.includes('--fix')
const isCI = process.env.CI === 'true' || process.env.CI === '1'
// Auto-enable preview mode in CI if no explicit flags
const isPreviewMode =
  isCI && !isFixMode && !process.argv.includes('--staged') && !process.argv.includes('--dry')
const isStagedMode = process.argv.includes('--staged') || isPreviewMode
const isDryRun = process.argv.includes('--dry') || isPreviewMode

const ROOT_DIR = path.join(process.cwd(), 'scripts')

const TARGET_EXTENSIONS = ['.js', '.ts', '.sh']

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage']

// Files that ARE the logger infrastructure or console reporters — console usage is intentional
const CONSOLE_EXEMPT_FILES = [
  'scripts/utils/logger.ts',
  'scripts/utils/logger.js',
  // Console reporter is the terminal output layer — inherently uses console
  'scripts/policy-engine/reporters/console.ts',
]

// Marker comment in a file that opts out of header/result requirements (library modules)
const LIBRARY_MODULE_MARKER = '@library-module'

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
  if (content.includes('log.result(') || content.includes('log.end(') || content.includes('log.progressResult(')) return true
  return false
}

function hasFlatLogs(content: string): boolean {
  return /console\.(log|info)\(/.test(content)
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
  const content = fs.readFileSync(filePath, 'utf-8')

  const issues: string[] = []

  const relativePath = filePath.replace(process.cwd() + path.sep, '').replace(/\\/g, '/')
  const isLibrary = content.includes(LIBRARY_MODULE_MARKER)
  const isShell = isShellScript(filePath)

  // Header/result checks — skip for library modules
  if (!isLibrary) {
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
      message: `All scripts valid${fixed.length ? ` (${fixed.length} fixed)` : ''}${dry.length ? ` (${dry.length} dry-run)` : ''}`,
    })

    flushAi()
    process.exit(0)
  }

  log.step(`Checking ${scriptFiles.length} scripts`)

  log.error(`Failed scripts: ${failed.length}`)

  for (const f of failed) {
    log.group(f.filePath)

    if (f.issues) {
      for (const issue of f.issues) {
        log.error(issue)
      }
    }

    if (f.suggestion) {
      log.info(`Fix preview:`)
      log.step(f.suggestion)
    }

    log.groupEnd()
  }

  log.result({
    total: scriptFiles.length,
    passed: scriptFiles.length - failed.length,
    failed: failed.length,
    message: 'Fix issues before commit',
  })

  flushAi()
  process.exit(1)
}

main()
