/**
 * Unit tests for ai-guard.ts exported pure functions
 *
 * Stage: STAGE_INFRA_06_ARCHITECTURE_GUARD
 *
 * These tests validate each pure, exported function in isolation.
 * Module-level side effects are suppressed because ai-guard.ts uses
 * `import.meta.main` to guard the runGuard() entry-point call.
 */

import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  detectFileModule,
  detectModule,
  extractImports,
  validateArchitectureMap,
  validateCrossAppImports,
  validateRelativeLeaks,
  validateRules,
} from '../../../scripts/ai-guard'

const fixturesDir = path.join(process.cwd(), 'tests/unit/ai-guard/fixtures')

// ---------------------------------------------------------------------------
// detectModule
// ---------------------------------------------------------------------------
describe('detectModule', () => {
  it('resolves @zidney/ scoped package alias', () => {
    expect(detectModule('@zidney/logger')).toBe('logger')
  })

  it('resolves packages/ path prefix', () => {
    expect(detectModule('packages/domain-core/src/index')).toBe('domain-core')
  })

  it('resolves apps/ path prefix', () => {
    expect(detectModule('apps/api/src/routes')).toBe('api')
  })

  it('returns null for external third-party packages', () => {
    expect(detectModule('hono')).toBeNull()
  })

  it('returns null for node built-ins', () => {
    expect(detectModule('node:fs')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// detectFileModule
// ---------------------------------------------------------------------------
describe('detectFileModule', () => {
  it('detects module for a packages/ file', () => {
    expect(detectFileModule('packages/domain-core/src/tenant.ts')).toBe('domain-core')
  })

  it('detects module for an apps/ file', () => {
    expect(detectFileModule('apps/api/src/routes/workspace.ts')).toBe('api')
  })

  it('returns null for files outside packages/ and apps/', () => {
    expect(detectFileModule('scripts/ai-guard.ts')).toBeNull()
  })

  it('returns null for root-level files', () => {
    expect(detectFileModule('package.json')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// extractImports
// ---------------------------------------------------------------------------
describe('extractImports', () => {
  it('extracts @zidney/ imports from valid-package-imports.ts', () => {
    const imports = extractImports(path.join(fixturesDir, 'valid-package-imports.ts'))
    expect(imports).toContain('@zidney/types')
    expect(imports).toContain('@zidney/logger')
    expect(imports).toContain('@zidney/validation')
  })

  it('extracts cross-app imports from cross-app-violation.ts', () => {
    const imports = extractImports(path.join(fixturesDir, 'cross-app-violation.ts'))
    expect(imports).toContain('apps/mmc/src/services/something')
    expect(imports).toContain('apps/backoffice/src/utils/helper')
  })

  it('extracts apps/ imports from packages-import-apps-violation.ts', () => {
    const imports = extractImports(path.join(fixturesDir, 'packages-import-apps-violation.ts'))
    expect(imports).toContain('apps/api/src/routes/workspace')
    expect(imports).toContain('apps/worker/src/jobs/attempt-finalize')
  })

  it('extracts relative imports from relative-leak-violation.ts', () => {
    const imports = extractImports(path.join(fixturesDir, 'relative-leak-violation.ts'))
    expect(imports).toContain('../../apps/api/src/utils/tenant')
    expect(imports).toContain('../../../packages/domain-core/src/index')
  })

  it('returns empty array for non-existent file', () => {
    const imports = extractImports('/this/file/does/not/exist.ts')
    expect(imports).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// validateRules
// ---------------------------------------------------------------------------
describe('validateRules', () => {
  const forbiddenRules: Record<string, string[]> = {
    api: ['worker'],
    'domain-core': ['api', 'worker', 'mmc'],
  }

  it('returns no violations when no forbidden imports are present', () => {
    const violations = validateRules('Dependency', 'api', ['@zidney/logger'], forbiddenRules)
    expect(violations).toHaveLength(0)
  })

  it('detects a forbidden dependency violation', () => {
    const violations = validateRules(
      'Dependency',
      'domain-core',
      ['apps/api/src/something'],
      forbiddenRules
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('domain-core')
    expect(violations[0]).toContain('api')
  })

  it('returns no violations when rules is undefined', () => {
    const violations = validateRules('Dependency', 'api', ['apps/worker/src/job'])
    expect(violations).toHaveLength(0)
  })

  it('handles multiple violations in a single call', () => {
    const violations = validateRules(
      'Dependency',
      'domain-core',
      ['apps/api/src/x', 'apps/worker/src/y'],
      forbiddenRules
    )
    expect(violations).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// validateCrossAppImports
// ---------------------------------------------------------------------------
describe('validateCrossAppImports', () => {
  it('flags a direct cross-app import', () => {
    const violations = validateCrossAppImports('api', 'apps/api/src/index.ts', [
      'apps/mmc/src/services/something',
    ])
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('Cross-app violation')
    expect(violations[0]).toContain('apps/api')
    expect(violations[0]).toContain('apps/mmc')
  })

  it('passes harmlessly for package files (non-app)', () => {
    const violations = validateCrossAppImports('domain-core', 'packages/domain-core/src/index.ts', [
      'apps/api/src/something',
    ])
    expect(violations).toHaveLength(0)
  })

  it('returns no violations when there are no cross-app imports', () => {
    const violations = validateCrossAppImports('api', 'apps/api/src/index.ts', [
      '@zidney/logger',
      'packages/domain-core/src/index',
    ])
    expect(violations).toHaveLength(0)
  })

  it('does not flag an app importing itself', () => {
    const violations = validateCrossAppImports('api', 'apps/api/src/routes/workspace.ts', [
      'apps/api/src/db/tenant',
    ])
    expect(violations).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// validateRelativeLeaks
// ---------------------------------------------------------------------------
describe('validateRelativeLeaks', () => {
  it('flags a relative path that traverses into apps/', () => {
    const violations = validateRelativeLeaks('packages/domain-core/src/tenant.ts', [
      '../../apps/api/src/utils/tenant',
    ])
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('Relative architecture leak')
  })

  it('flags a relative path that traverses into packages/', () => {
    const violations = validateRelativeLeaks('apps/api/src/index.ts', [
      '../../../packages/domain-core/src/index',
    ])
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('Relative architecture leak')
  })

  it('allows safe relative imports within the same module', () => {
    const violations = validateRelativeLeaks('apps/api/src/routes/workspace.ts', [
      './workspace-handler',
      '../middleware/auth',
    ])
    expect(violations).toHaveLength(0)
  })

  it('ignores non-relative absolute imports', () => {
    const violations = validateRelativeLeaks('apps/api/src/index.ts', [
      '@zidney/logger',
      'hono',
      'packages/domain-core/src/index',
    ])
    expect(violations).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// validateArchitectureMap
// ---------------------------------------------------------------------------
describe('validateArchitectureMap', () => {
  const mockArchMap = {
    modules: {
      'packages/domain-core': {
        layer: 'domain',
        allowed_dependencies: ['packages/types', 'packages/logger'],
        forbidden_dependencies: ['apps/api', 'apps/worker'],
      },
      'packages/logger': {
        layer: 'infrastructure',
        allowed_dependencies: [],
        forbidden_dependencies: [],
      },
    },
  }

  it('returns no violations for allowed dependency', () => {
    const violations = validateArchitectureMap(
      'packages/domain-core',
      'domain-core',
      ['packages/types/src/index', 'packages/logger/src/index'],
      mockArchMap
    )
    expect(violations).toHaveLength(0)
  })

  it('flags an explicitly forbidden dependency', () => {
    const violations = validateArchitectureMap(
      'packages/domain-core',
      'domain-core',
      ['apps/api/src/routes'],
      mockArchMap
    )
    expect(violations.some((v) => v.includes('ARCH_MAP forbidden dependency'))).toBe(true)
  })

  it('flags a dependency not in the allowed list', () => {
    const violations = validateArchitectureMap(
      'packages/domain-core',
      'domain-core',
      ['packages/validation/src/index'],
      mockArchMap
    )
    expect(violations.some((v) => v.includes('ARCH_MAP dependency not allowed'))).toBe(true)
  })

  it('returns no violations for a module not in the arch map', () => {
    const violations = validateArchitectureMap(
      'packages/unknown-module',
      'unknown-module',
      ['apps/api/src/routes'],
      mockArchMap
    )
    expect(violations).toHaveLength(0)
  })
})
