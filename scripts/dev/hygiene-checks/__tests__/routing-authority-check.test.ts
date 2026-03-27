/** @library-module */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * T012 — Unit tests for routing-authority-check.ts
 * Mocks node:fs to control file system state.
 */

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}))

import { existsSync, readFileSync } from 'node:fs'

const MINIMAL_REGISTRY = `
## Agents
- Routing Category: \`agents\`
- Authoritative Root: \`.agents/agents/\`
- Legacy Compatibility Surfaces: \`.github/agents/\`

## Prompts
- Routing Category: \`prompts\`
- Authoritative Root: \`.agents/prompts/\`
- Legacy Compatibility Surfaces: \`.github/prompts/\`

## Templates
- Routing Category: \`templates\`
- Authoritative Root: \`specs/templates/\`
- Legacy Compatibility Surfaces: \`.specify/templates/\`
`

describe('runRoutingAuthorityCheck', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns PASS when registry exists and all authoritative roots exist on disk', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(MINIMAL_REGISTRY)

    const { runRoutingAuthorityCheck } = await import('../routing-authority-check.ts')
    const result = await runRoutingAuthorityCheck()

    expect(result.status).toBe('PASS')
    expect(result.findings).toHaveLength(0)
  })

  it('returns FLAG when registry file is missing', async () => {
    vi.mocked(existsSync).mockReturnValue(false)

    const { runRoutingAuthorityCheck } = await import('../routing-authority-check.ts')
    const result = await runRoutingAuthorityCheck()

    expect(result.status).toBe('FLAG')
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.findings[0]?.note).toMatch(/missing|not found/i)
  })

  it('returns FLAG when an authoritative root directory does not exist', async () => {
    // Registry exists but only the registry file itself — auth dirs missing
    vi.mocked(existsSync).mockImplementation((p) => {
      if (typeof p === 'string' && p.endsWith('ROUTING_AUTHORITY_REGISTRY.md')) return true
      return false
    })
    vi.mocked(readFileSync).mockReturnValue(MINIMAL_REGISTRY)

    const { runRoutingAuthorityCheck } = await import('../routing-authority-check.ts')
    const result = await runRoutingAuthorityCheck()

    expect(result.status).toBe('FLAG')
    expect(result.findings.some((f) => /authoritative root/i.test(f.note))).toBe(true)
  })

  it('returns FLAG when no "Authoritative Root:" entry is found in the registry', async () => {
    const malformedRegistry = '## Agents\n- Routing Category: `agents`\n'
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(malformedRegistry)

    const { runRoutingAuthorityCheck } = await import('../routing-authority-check.ts')
    const result = await runRoutingAuthorityCheck()

    expect(result.status).toBe('FLAG')
  })
})
