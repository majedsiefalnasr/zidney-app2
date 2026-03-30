/** @library-module */
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// We test the real stale-check logic using actual temp directories.
// Since BRAIN_PATH and SOURCE_DIRS are hardcoded constants, we run
// the real function to verify its behavior descriptions for present/absent/stale.
// For absent and stale, we mock node:fs to control behavior.

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
  }
})

describe('checkBrainStatus', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'stale-check-test-'))
    vi.resetModules()
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('returns absent status when brain file does not exist', async () => {
    // Mock existsSync so brain path does not exist
    const fs = await import('node:fs')
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      const s = String(p)
      if (s.includes('ai-architecture-brain.json')) return false
      return true
    })
    vi.resetModules()

    const { checkBrainStatus } = await import('../stale-check')
    const result = checkBrainStatus()
    expect(result.status).toBe('absent')
    expect(result.detail).toContain('does not exist')
  })

  it('returns stale status when a .ts source file is newer than the brain', async () => {
    // Create a fake brain file and a newer source file
    const brainFile = join(tmpDir, 'brain.json')
    const srcFile = join(tmpDir, 'src.ts')

    // Write brain first, then source file (source is newer)
    writeFileSync(brainFile, '{}')
    writeFileSync(srcFile, 'export const x = 1;')

    // Set brain mtime to 1 second ago
    const oldTime = new Date(Date.now() - 2000)
    utimesSync(brainFile, oldTime, oldTime)

    const fs = await import('node:fs')
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      const s = String(p)
      if (s.includes('ai-architecture-brain.json')) return true
      if (s === 'packages' || s === 'apps') return true
      return fs.existsSync(s)
    })
    vi.spyOn(fs, 'statSync').mockImplementation((p) => {
      const s = String(p)
      if (s.includes('ai-architecture-brain.json')) {
        return { mtimeMs: oldTime.getTime() } as ReturnType<typeof fs.statSync>
      }
      // Return a recent mtime for the fake source file
      return { mtimeMs: Date.now() } as ReturnType<typeof fs.statSync>
    })
    vi.spyOn(fs, 'readdirSync').mockImplementation((p, _opts) => {
      // Return one .ts entry for source dirs
      const s = String(p)
      if (s === 'packages' || s === 'apps') {
        return [{ name: 'index.ts', isDirectory: () => false }] as unknown as ReturnType<
          typeof fs.readdirSync
        >
      }
      return []
    })

    vi.resetModules()
    const { checkBrainStatus } = await import('../stale-check')
    const result = checkBrainStatus()
    expect(result.status).toBe('stale')
    expect(result.detail).toContain('Run: bun run arch:audit')
  })

  it('returns present_fresh when brain is newer than all source files', async () => {
    const fs = await import('node:fs')

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      const s = String(p)
      if (s.includes('ai-architecture-brain.json')) return true
      if (s === 'packages' || s === 'apps') return true
      return true
    })

    const brainMtime = Date.now()
    vi.spyOn(fs, 'statSync').mockImplementation((p) => {
      const s = String(p)
      if (s.includes('ai-architecture-brain.json')) {
        return { mtimeMs: brainMtime } as ReturnType<typeof fs.statSync>
      }
      // Source files are older than brain
      return { mtimeMs: brainMtime - 5000 } as ReturnType<typeof fs.statSync>
    })
    vi.spyOn(fs, 'readdirSync').mockImplementation((p) => {
      const s = String(p)
      if (s === 'packages' || s === 'apps') {
        return [{ name: 'index.ts', isDirectory: () => false }] as unknown as ReturnType<
          typeof fs.readdirSync
        >
      }
      return []
    })

    vi.resetModules()
    const { checkBrainStatus } = await import('../stale-check')
    const result = checkBrainStatus()
    expect(result.status).toBe('present_fresh')
  })

  it('detail field contains actionable message on absent case', async () => {
    const fs = await import('node:fs')
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      const s = String(p)
      if (s.includes('ai-architecture-brain.json')) return false
      return true
    })
    vi.resetModules()
    const { checkBrainStatus } = await import('../stale-check')
    const result = checkBrainStatus()
    expect(result.status).toBe('absent')
    expect(result.detail).toBeTruthy()
    expect(result.detail).toContain('does not exist')
  })

  it('detail field contains actionable message on stale case', async () => {
    const fs = await import('node:fs')
    const oldTime = Date.now() - 5000

    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'statSync').mockImplementation((p) => {
      const s = String(p)
      if (s.includes('ai-architecture-brain.json')) {
        return { mtimeMs: oldTime } as ReturnType<typeof fs.statSync>
      }
      return { mtimeMs: Date.now() } as ReturnType<typeof fs.statSync>
    })
    vi.spyOn(fs, 'readdirSync').mockImplementation((p) => {
      const s = String(p)
      if (s === 'packages' || s === 'apps') {
        return [{ name: 'mod.ts', isDirectory: () => false }] as unknown as ReturnType<
          typeof fs.readdirSync
        >
      }
      return []
    })
    vi.resetModules()
    const { checkBrainStatus } = await import('../stale-check')
    const result = checkBrainStatus()
    expect(result.status).toBe('stale')
    expect(result.detail).toContain('Run: bun run arch:audit')
  })
})
