import { describe, expect, it, vi } from 'vitest'
import { LicenseResolver } from '../resolver'

// Minimal logger stub
const logger = { debug: () => {}, warn: () => {}, error: () => {} }

describe('LicenseResolver (unit)', () => {
  it('parseSemVer and compareVersions behave correctly', () => {
    const resolver = new LicenseResolver({} as any, {} as any, logger as any)
    const parsed = (resolver as any).parseSemVer('1.2.3')
    expect(parsed).toEqual({ major: 1, minor: 2, patch: 3 })

    const a = { major: 1, minor: 2, patch: 3 }
    const b = { major: 1, minor: 2, patch: 2 }
    expect((resolver as any).compareVersions(a, b)).toBe(1)
    expect((resolver as any).compareVersions(b, a)).toBe(-1)
    expect((resolver as any).compareVersions(a, a)).toBe(0)
  })

  it('validateVersions returns false when license missing', async () => {
    const resolver = new LicenseResolver({} as any, {} as any, logger as any)
    ;(resolver as any).getLicenseBySlug = vi.fn().mockResolvedValue(null)
    const ok = await resolver.validateVersions('nope', '1.0.0')
    expect(ok).toBe(false)
  })

  it('validateVersions returns true when tenant >= license expected', async () => {
    const resolver = new LicenseResolver({} as any, {} as any, logger as any)
    const license = { expected_schema_version: '1.2.0' }
    ;(resolver as any).getLicenseBySlug = vi.fn().mockResolvedValue(license)
    const ok = await resolver.validateVersions('ws', '1.3.0')
    expect(ok).toBe(true)
  })

  it('validateVersions returns false on invalid semver strings', async () => {
    const resolver = new LicenseResolver({} as any, {} as any, logger as any)
    const license = { expected_schema_version: 'not-a-version' }
    ;(resolver as any).getLicenseBySlug = vi.fn().mockResolvedValue(license)
    const ok = await resolver.validateVersions('ws', 'also-bad')
    expect(ok).toBe(false)
  })
})
