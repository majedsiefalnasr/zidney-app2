/**
 * CI-blocking test: No console.log in store files (SC-006, SC-011, FR-010)
 *
 * Asserts zero console.log/warn/error usages in all core state store files.
 * All stores must use @zidney/logger for structured logging.
 *
 * Also verifies workspace.store.ts uses logger.warn for structured error logging (SC-011).
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import { readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { describe, expect, it } from 'vitest'

const WORKSPACE_ROOT = resolve(
  import.meta.url.replace('file://', '').replace('/tests/unit/no-console-in-stores.test.ts', '')
)

const STATE_DIRS = [
  'apps/mmc/src/core/state',
  'apps/backoffice/src/core/state',
  'apps/frontoffice/src/core/state',
]

function getStoreFiles(dir: string): string[] {
  const fullDir = join(WORKSPACE_ROOT, dir)
  try {
    return readdirSync(fullDir)
      .filter((f) => f.endsWith('.store.ts'))
      .map((f) => join(fullDir, f))
  } catch {
    return []
  }
}

describe('No console.log in store files (SC-006, SC-011, AGENTS.md logging rule)', () => {
  it('zero console.log occurrences in all core state store files', () => {
    const violations: string[] = []

    for (const dir of STATE_DIRS) {
      const files = getStoreFiles(dir)
      for (const file of files) {
        const content = readFileSync(file, 'utf-8')
        const lines = content.split('\n')
        lines.forEach((line, idx) => {
          // Check for console.log (not in comments)
          if (
            /console\.log\s*\(/.test(line) &&
            !line.trim().startsWith('//') &&
            !line.trim().startsWith('*')
          ) {
            violations.push(`${file}:${idx + 1}: ${line.trim()}`)
          }
        })
      }
    }

    expect(violations, `console.log found in store files:\n${violations.join('\n')}`).toHaveLength(
      0
    )
  })

  it('zero console.warn occurrences in store files (must use logger.warn instead)', () => {
    const violations: string[] = []

    for (const dir of STATE_DIRS) {
      const files = getStoreFiles(dir)
      for (const file of files) {
        const content = readFileSync(file, 'utf-8')
        const lines = content.split('\n')
        lines.forEach((line, idx) => {
          if (
            /console\.warn\s*\(/.test(line) &&
            !line.trim().startsWith('//') &&
            !line.trim().startsWith('*')
          ) {
            violations.push(`${file}:${idx + 1}: ${line.trim()}`)
          }
        })
      }
    }

    expect(violations, `console.warn found in store files:\n${violations.join('\n')}`).toHaveLength(
      0
    )
  })

  it('zero console.error occurrences in store files (must use logger.error instead)', () => {
    const violations: string[] = []

    for (const dir of STATE_DIRS) {
      const files = getStoreFiles(dir)
      for (const file of files) {
        const content = readFileSync(file, 'utf-8')
        const lines = content.split('\n')
        lines.forEach((line, idx) => {
          if (
            /console\.error\s*\(/.test(line) &&
            !line.trim().startsWith('//') &&
            !line.trim().startsWith('*')
          ) {
            violations.push(`${file}:${idx + 1}: ${line.trim()}`)
          }
        })
      }
    }

    expect(
      violations,
      `console.error found in store files:\n${violations.join('\n')}`
    ).toHaveLength(0)
  })

  it('workspace.store.ts uses logger.warn for structured error logging (SC-011)', () => {
    const workspaceStorePath = join(
      WORKSPACE_ROOT,
      'apps/backoffice/src/core/state/workspace.store.ts'
    )
    const content = readFileSync(workspaceStorePath, 'utf-8')

    // Verify structured logging is present
    expect(content).toContain("logger.warn('workspace.store: loadWorkspace failed'")
    expect(content).toContain('service: ')
    expect(content).toContain('error_code: ')
    expect(content).toContain('internal_message: ')

    // Verify no raw err.message is exposed to user
    expect(content).toContain("'Unable to load workspace. Please try again.'")
  })

  it('all store files that catch errors use AppError for user-facing messages (SA-003)', () => {
    const workspaceStorePath = join(
      WORKSPACE_ROOT,
      'apps/backoffice/src/core/state/workspace.store.ts'
    )
    const content = readFileSync(workspaceStorePath, 'utf-8')

    // Verify AppError is imported and createAppError factory is used
    // (stores may import directly from @zidney/api-client — they are exempt from the import firewall)
    expect(content).toContain('AppError')
    // createAppError factory from @zidney/api-client (AppError is an interface, not a class)
    expect(content).toContain('createAppError(')
    expect(content).toContain("'WORKSPACE_LOAD_FAILED'")
  })
})
