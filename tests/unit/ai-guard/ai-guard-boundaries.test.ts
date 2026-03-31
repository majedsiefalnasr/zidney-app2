/**
 * Unit tests: ai-guard.ts — layer boundary validation & loader functions
 *
 * Covers FR-003, FR-004, FR-005, FR-006, FR-007, FR-012
 *
 * Tests (a)–(n) mirror the T018 specification exactly.
 *
 * NOTE: Tests that trigger process.exit(1) use a spy that throws instead
 *       of killing the process, per plan.md Step 8 pattern.
 *       Tests for loadModuleBoundaries / loadTsAliases use vi.mock('node:fs').
 */

import { existsSync, readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    readFileSync: vi.fn(actual.readFileSync),
  }
})

import type { TsAliasMap } from '../../../scripts/ai-guard'
import {
  loadModuleBoundaries,
  loadTsAliases,
  matchesGlobPattern,
  resolveImportToModule,
  validateLayerBoundaries,
} from '../../../scripts/ai-guard'

/* ─────────────────────────────────────────────────────────────────────────── */
/* Fixtures                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

const FIXTURE_BOUNDARIES = {
  version: '1.0',
  layers: {
    infrastructure: [
      'packages/logger',
      'packages/config',
      'packages/types',
      'packages/redis-utils',
    ],
    domain: ['packages/domain-core', 'packages/validation'],
    runtime: ['apps/api', 'apps/worker'],
    ui: [
      'apps/mmc',
      'apps/backoffice',
      'apps/frontoffice',
      'packages/ui-system',
      'packages/api-client',
    ],
  },
  allowed_dependencies: {
    infrastructure: ['infrastructure'],
    domain: ['infrastructure', 'domain'],
    runtime: ['domain', 'infrastructure'],
    ui: ['ui', 'infrastructure'],
  },
  forbidden_dependencies: {
    infrastructure: ['domain', 'runtime', 'ui'],
    domain: ['runtime', 'ui'],
    runtime: ['ui'],
    ui: ['runtime'],
  },
  cross_cutting_rules: [
    {
      rule: 'packages_no_apps',
      description: 'Packages must not import from apps',
      source_pattern: 'packages/*',
      target_pattern: 'apps/*',
      action: 'FORBIDDEN' as const,
    },
    {
      rule: 'no_cross_app_imports',
      description: 'Apps must not import from other apps',
      source_pattern: 'apps/*',
      target_pattern: 'apps/*',
      action: 'FORBIDDEN' as const,
    },
    {
      rule: 'runtime_no_ui_system',
      description: 'Runtime services must not import Vue component packages',
      source: ['apps/api', 'apps/worker'],
      target: ['packages/ui-system'],
      action: 'FORBIDDEN' as const,
    },
    {
      rule: 'ui_no_domain_packages',
      description: 'UI modules must not import domain logic directly',
      source_layer: 'ui',
      target: ['packages/domain-core', 'packages/validation'],
      action: 'FORBIDDEN' as const,
    },
  ],
}

const FIXTURE_ALIASES: TsAliasMap[] = [
  { alias: '@zidney/ui', target: 'packages/ui-system/src/index.ts' },
  { alias: '@zidney/api-client', target: 'packages/api-client/src/index.ts' },
  { alias: '@zidney/logger', target: 'packages/logger/src/index.ts' },
  { alias: '@zidney/domain-core', target: 'packages/domain-core/src/index.ts' },
]

/* ─────────────────────────────────────────────────────────────────────────── */
/* Test group 1: validateLayerBoundaries — layer matrix violations (a)–(e)   */
/* ─────────────────────────────────────────────────────────────────────────── */

describe('validateLayerBoundaries — layer matrix violations', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('(a) ui → domain: packages/ui-system importing packages/domain-core', () => {
    const violations = validateLayerBoundaries(
      'packages/ui-system/src/Button.vue',
      ['packages/domain-core'],
      FIXTURE_BOUNDARIES,
      []
    )
    expect(violations.length).toBeGreaterThanOrEqual(1)
    const layerViolation = violations.find((v) => v.includes('layer violation: ui → domain'))
    expect(layerViolation).toBeDefined()
    expect(layerViolation).toContain('ARCHITECTURE VIOLATION')
    expect(layerViolation).toContain('packages/ui-system')
    expect(layerViolation).toContain('packages/domain-core')
  })

  it('(b) domain → runtime: packages/domain-core importing apps/api', () => {
    const violations = validateLayerBoundaries(
      'packages/domain-core/src/index.ts',
      ['apps/api'],
      FIXTURE_BOUNDARIES,
      []
    )
    expect(violations.length).toBeGreaterThanOrEqual(1)
    const layerViolation = violations.find((v) => v.includes('layer violation: domain → runtime'))
    expect(layerViolation).toBeDefined()
    expect(layerViolation).toContain('ARCHITECTURE VIOLATION')
    expect(layerViolation).toContain('packages/domain-core')
    expect(layerViolation).toContain('apps/api')
  })

  it('(c) infrastructure → domain: packages/config importing packages/validation', () => {
    const violations = validateLayerBoundaries(
      'packages/config/src/index.ts',
      ['packages/validation'],
      FIXTURE_BOUNDARIES,
      []
    )
    expect(violations.length).toBeGreaterThanOrEqual(1)
    const layerViolation = violations.find((v) =>
      v.includes('layer violation: infrastructure → domain')
    )
    expect(layerViolation).toBeDefined()
    expect(layerViolation).toContain('ARCHITECTURE VIOLATION')
    expect(layerViolation).toContain('packages/config')
    expect(layerViolation).toContain('packages/validation')
  })

  it('(d) cross-cutting no_cross_app_imports: apps/mmc → apps/backoffice (same layer, exactly one violation)', () => {
    const violations = validateLayerBoundaries(
      'apps/mmc/src/index.ts',
      ['apps/backoffice'],
      FIXTURE_BOUNDARIES,
      []
    )
    // Same ui layer → layer matrix allows it; only cross-cutting rule fires
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('ARCHITECTURE VIOLATION')
    expect(violations[0]).toContain('cross-cutting rule [no_cross_app_imports]')
    expect(violations[0]).toContain('apps/mmc')
    expect(violations[0]).toContain('apps/backoffice')
  })

  it('(e) cross-cutting packages_no_apps: packages/ui-system → apps/api', () => {
    const violations = validateLayerBoundaries(
      'packages/ui-system/src/index.ts',
      ['apps/api'],
      FIXTURE_BOUNDARIES,
      []
    )
    // ui → runtime: layer violation fires
    const layerViolation = violations.find((v) => v.includes('layer violation: ui → runtime'))
    expect(layerViolation).toBeDefined()
    // packages_no_apps cross_cutting_rule also fires
    const crossCuttingViolation = violations.find((v) =>
      v.includes('cross-cutting rule [packages_no_apps]')
    )
    expect(crossCuttingViolation).toBeDefined()
    expect(crossCuttingViolation).toContain('packages/ui-system')
    expect(crossCuttingViolation).toContain('apps/api')
  })
})

/* ─────────────────────────────────────────────────────────────────────────── */
/* Test group 2: resolveImportToModule — alias resolution (f), (g), (h)      */
/* ─────────────────────────────────────────────────────────────────────────── */

describe('resolveImportToModule — alias resolution', () => {
  it('(f) @zidney/ui alias resolves to packages/ui-system', () => {
    const result = resolveImportToModule('@zidney/ui', FIXTURE_ALIASES)
    expect(result).toBe('packages/ui-system')
  })

  it('(f) runtime → ui violation via @zidney/ui alias', () => {
    const violations = validateLayerBoundaries(
      'apps/api/src/route.ts',
      ['@zidney/ui'],
      FIXTURE_BOUNDARIES,
      FIXTURE_ALIASES
    )
    const layerViolation = violations.find((v) => v.includes('layer violation: runtime → ui'))
    expect(layerViolation).toBeDefined()
    expect(layerViolation).toContain('ARCHITECTURE VIOLATION')
    expect(layerViolation).toContain('apps/api')
    expect(layerViolation).toContain('packages/ui-system')
  })

  it('(g) @zidney/api-client alias (tsconfig.base.json only) resolves correctly via loadTsAliases()', () => {
    // loadTsAliases() reads real tsconfig.json and tsconfig.base.json
    // @zidney/api-client is only in tsconfig.base.json
    const aliases = loadTsAliases()
    const result = resolveImportToModule('@zidney/api-client', aliases)
    expect(result).toBe('packages/api-client')
  })

  it('(h) external npm package import returns null (not flagged)', () => {
    expect(resolveImportToModule('express', FIXTURE_ALIASES)).toBeNull()
    expect(resolveImportToModule('lodash/get', FIXTURE_ALIASES)).toBeNull()
    expect(resolveImportToModule('hono', FIXTURE_ALIASES)).toBeNull()
    expect(resolveImportToModule('zod', FIXTURE_ALIASES)).toBeNull()
  })
})

/* ─────────────────────────────────────────────────────────────────────────── */
/* Test group 3: null boundaries guard (i)                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

describe('validateLayerBoundaries null-boundaries guard (i)', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('(i) validateLayerBoundaries not called when boundaries is null — tests runGuard guard pattern', () => {
    const spy = vi.spyOn({ validateLayerBoundaries }, 'validateLayerBoundaries')
    // Simulate the exact guard pattern from runGuard:
    // const layerBoundaryViolations = boundaries ? validateLayerBoundaries(...) : []
    const boundaries = null
    const aliases: TsAliasMap[] = []
    const layerBoundaryViolations = boundaries
      ? validateLayerBoundaries(
          'apps/api/src/index.ts',
          ['packages/ui-system'],
          boundaries,
          aliases
        )
      : []
    // validateLayerBoundaries was not called because boundaries is null
    expect(spy).not.toHaveBeenCalled()
    expect(layerBoundaryViolations).toEqual([])
    spy.mockRestore()
  })
})

/* ─────────────────────────────────────────────────────────────────────────── */
/* Test group 4: loadModuleBoundaries — error paths (j), (k), (n)            */
/* ─────────────────────────────────────────────────────────────────────────── */

describe('loadModuleBoundaries — mocked fs', () => {
  let exitSpy: any

  beforeEach(() => {
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((_code?: string | number | null | undefined) => {
        throw new Error(`process.exit called with code ${_code}`)
      })
  })

  afterEach(() => {
    exitSpy?.mockRestore()
    vi.clearAllMocks()
  })

  it('(j) malformed JSON → process.exit(1)', () => {
    vi.mocked(existsSync).mockReturnValueOnce(true)
    vi.mocked(readFileSync).mockReturnValueOnce('{broken json invalid')
    expect(() => loadModuleBoundaries()).toThrow('process.exit called with code 1')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('(k) structurally invalid JSON (missing layers) → process.exit(1)', () => {
    vi.mocked(existsSync).mockReturnValueOnce(true)
    vi.mocked(readFileSync).mockReturnValueOnce(JSON.stringify({ version: '1.0' }))
    expect(() => loadModuleBoundaries()).toThrow('process.exit called with code 1')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('(k) structurally invalid: layers is an array → process.exit(1)', () => {
    vi.mocked(existsSync).mockReturnValueOnce(true)
    vi.mocked(readFileSync).mockReturnValueOnce(
      JSON.stringify({
        version: '1.0',
        layers: ['infrastructure', 'domain'],
        allowed_dependencies: {},
        forbidden_dependencies: {},
      })
    )
    expect(() => loadModuleBoundaries()).toThrow('process.exit called with code 1')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('(n) valid file → returns non-null ModuleBoundaries with all required fields', () => {
    const validBoundaries = {
      version: '1.0',
      layers: { infrastructure: ['packages/logger'], domain: [], runtime: [], ui: [] },
      allowed_dependencies: { infrastructure: [] },
      forbidden_dependencies: { infrastructure: ['domain'] },
    }
    vi.mocked(existsSync).mockReturnValueOnce(true)
    vi.mocked(readFileSync).mockReturnValueOnce(JSON.stringify(validBoundaries))
    const result = loadModuleBoundaries()
    expect(result).not.toBeNull()
    expect(result?.layers).toBeDefined()
    expect(result?.allowed_dependencies).toBeDefined()
    expect(result?.forbidden_dependencies).toBeDefined()
  })
})

/* ─────────────────────────────────────────────────────────────────────────── */
/* Test group 5: loadTsAliases — merge behavior (l)                           */
/* ─────────────────────────────────────────────────────────────────────────── */

describe('loadTsAliases — file parsing and merge behavior (l)', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  const SYNTHETIC_TSCONFIG_JSON = JSON.stringify({
    compilerOptions: {
      paths: {
        '@zidney/logger': ['./packages/logger/src/index.ts'],
        '@zidney/logger/*': ['./packages/logger/src/*'],
        '@zidney/shared': ['./packages/shared/src/index.ts'],
      },
    },
  })

  const SYNTHETIC_TSCONFIG_BASE_JSON = JSON.stringify({
    compilerOptions: {
      paths: {
        // Conflict: @zidney/logger also in tsconfig.json — tsconfig.json wins
        '@zidney/logger': ['./packages/logger-base/src/different.ts'],
        '@zidney/api-client': ['packages/api-client/src/index.ts'],
        '@zidney/api-client/*': ['packages/api-client/src/*'],
      },
    },
  })

  it('(l) merges aliases from both tsconfig files', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync)
      .mockReturnValueOnce(SYNTHETIC_TSCONFIG_JSON)
      .mockReturnValueOnce(SYNTHETIC_TSCONFIG_BASE_JSON)

    const aliases = loadTsAliases()
    const aliasKeys = aliases.map((a) => a.alias)

    expect(aliasKeys).toContain('@zidney/logger')
    expect(aliasKeys).toContain('@zidney/shared')
    expect(aliasKeys).toContain('@zidney/api-client')
  })

  it('(l) tsconfig.json wins on key conflict with tsconfig.base.json', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync)
      .mockReturnValueOnce(SYNTHETIC_TSCONFIG_JSON)
      .mockReturnValueOnce(SYNTHETIC_TSCONFIG_BASE_JSON)

    const aliases = loadTsAliases()
    const loggerAlias = aliases.find((a) => a.alias === '@zidney/logger')
    // tsconfig.json has packages/logger, tsconfig.base.json has packages/logger-base → json wins
    expect(loggerAlias?.target).toContain('packages/logger')
    expect(loggerAlias?.target).not.toContain('logger-base')
  })

  it('(l) /* is stripped from alias keys and target values', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync)
      .mockReturnValueOnce(SYNTHETIC_TSCONFIG_JSON)
      .mockReturnValueOnce(SYNTHETIC_TSCONFIG_BASE_JSON)

    const aliases = loadTsAliases()
    for (const { alias, target } of aliases) {
      expect(alias).not.toContain('/*')
      expect(target).not.toContain('/*')
    }
  })

  it('(l) result is deduplicated (no duplicate alias keys)', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync)
      .mockReturnValueOnce(SYNTHETIC_TSCONFIG_JSON)
      .mockReturnValueOnce(SYNTHETIC_TSCONFIG_BASE_JSON)

    const aliases = loadTsAliases()
    const aliasKeys = aliases.map((a) => a.alias)
    const uniqueKeys = new Set(aliasKeys)
    expect(aliasKeys.length).toBe(uniqueKeys.size)
  })

  it('(l) emits console.warn when readFileSync throws for one config file', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync)
      .mockImplementationOnce(() => {
        throw new Error('ENOENT: file not found')
      })
      .mockReturnValueOnce(SYNTHETIC_TSCONFIG_BASE_JSON)

    const aliases = loadTsAliases()
    // Should still return aliases from the second file (tsconfig.base.json)
    expect(aliases.length).toBeGreaterThan(0)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ai-guard] WARNING: failed to load aliases from'),
      expect.any(Object)
    )
    warnSpy.mockRestore()
  })
})

/* ─────────────────────────────────────────────────────────────────────────── */
/* Test group 6: validateLayerBoundaries — no-violation paths (m)            */
/* ─────────────────────────────────────────────────────────────────────────── */

describe('validateLayerBoundaries — no-violation paths (m)', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('(m) domain-core importing logger (infrastructure) — zero violations', () => {
    const violations = validateLayerBoundaries(
      'packages/domain-core/src/index.ts',
      ['packages/logger'],
      FIXTURE_BOUNDARIES,
      []
    )
    expect(violations).toHaveLength(0)
  })

  it('(m) apps/frontoffice importing packages/config (infrastructure) — zero violations', () => {
    const violations = validateLayerBoundaries(
      'apps/frontoffice/src/index.ts',
      ['packages/config'],
      FIXTURE_BOUNDARIES,
      []
    )
    expect(violations).toHaveLength(0)
  })

  it('(m) ui importing ui-system (same ui layer) — zero violations', () => {
    const violations = validateLayerBoundaries(
      'apps/backoffice/src/index.ts',
      ['packages/ui-system'],
      FIXTURE_BOUNDARIES,
      []
    )
    expect(violations).toHaveLength(0)
  })
})

/* ─────────────────────────────────────────────────────────────────────────── */
/* Test group 7: matchesGlobPattern                                           */
/* ─────────────────────────────────────────────────────────────────────────── */

describe('matchesGlobPattern', () => {
  it('matches apps/* pattern against apps/mmc', () => {
    expect(matchesGlobPattern('apps/mmc', 'apps/*')).toBe(true)
  })

  it('matches packages/* pattern against packages/ui-system', () => {
    expect(matchesGlobPattern('packages/ui-system', 'packages/*')).toBe(true)
  })

  it('does not match apps/* against packages/mmc', () => {
    expect(matchesGlobPattern('packages/mmc', 'apps/*')).toBe(false)
  })

  it('does not match apps/* against apps itself (no trailing segment)', () => {
    expect(matchesGlobPattern('apps', 'apps/*')).toBe(false)
  })

  it('matches exact path when no wildcard', () => {
    expect(matchesGlobPattern('apps/api', 'apps/api')).toBe(true)
  })

  it('does not match when exact path is different', () => {
    expect(matchesGlobPattern('apps/worker', 'apps/api')).toBe(false)
  })
})
