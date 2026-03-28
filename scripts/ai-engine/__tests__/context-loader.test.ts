/** @library-module */
import { describe, expect, it, vi } from 'vitest'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

vi.mock('@zidney/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { existsSync, readFileSync } from 'node:fs'

describe('loadAiContextMini', () => {
  it('returns parsed JSON object when ai-context-mini.json is present', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ version: '1.0.0', modules: [], layer_model: {} })
    )
    vi.resetModules()
    const { loadAiContextMini } = await import('../context-loader')
    const result = loadAiContextMini()
    expect(result).toMatchObject({ version: '1.0.0', modules: [], layer_model: {} })
  })

  it('throws Error with CONTEXT_PATH in message when file is absent', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    vi.resetModules()
    const { loadAiContextMini } = await import('../context-loader')
    expect(() => loadAiContextMini()).toThrow('docs/ai/context/ai-context-mini.json')
  })

  it('thrown error message contains bun ai-context:generate command', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    vi.resetModules()
    const { loadAiContextMini } = await import('../context-loader')
    expect(() => loadAiContextMini()).toThrow('bun ai-context:generate')
  })

  it('thrown error message is actionable (contains full path)', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    vi.resetModules()
    const { loadAiContextMini } = await import('../context-loader')
    let errMsg = ''
    try {
      loadAiContextMini()
    } catch (e) {
      errMsg = (e as Error).message
    }
    expect(errMsg).toContain('docs/ai/context/ai-context-mini.json')
    expect(errMsg.length).toBeGreaterThan(20)
  })
})
