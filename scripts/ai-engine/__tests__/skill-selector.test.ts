import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock node:fs to control available skills directory
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}))

import { existsSync, readdirSync } from 'node:fs'

function makeDirEntry(name: string, isDir = true) {
  return { name, isDirectory: () => isDir }
}

const AVAILABLE_SKILLS = [
  'architecture-intelligence',
  'terminal-safety',
  'mcp-routing',
  'gitnexus-refactoring',
  'gitnexus-debugging',
  'gitnexus-impact-analysis',
  'gitnexus-exploring',
  'git-governance',
  'package-manager-governance',
  'precommit-diagnostics',
]

function setupAvailableSkills() {
  vi.mocked(existsSync).mockReturnValue(true)
  vi.mocked(readdirSync).mockReturnValue(
    AVAILABLE_SKILLS.map((name) => makeDirEntry(name)) as ReturnType<typeof readdirSync>
  )
}

describe('selectSkills', () => {
  beforeEach(() => {
    vi.resetModules()
    setupAvailableSkills()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('all three baseline skills always present regardless of task', async () => {
    const { selectSkills } = await import('../skill-selector')
    const skills = selectSkills('some unrelated task')
    expect(skills).toContain('architecture-intelligence')
    expect(skills).toContain('terminal-safety')
    expect(skills).toContain('mcp-routing')
  })

  it("adds gitnexus-refactoring for task containing 'refactor'", async () => {
    const { selectSkills } = await import('../skill-selector')
    const skills = selectSkills('refactor the auth module')
    expect(skills).toContain('gitnexus-refactoring')
  })

  it("adds gitnexus-debugging for task containing 'debug'", async () => {
    const { selectSkills } = await import('../skill-selector')
    const skills = selectSkills('debug the login flow')
    expect(skills).toContain('gitnexus-debugging')
  })

  it('is deterministic — same task string returns same sorted list on two consecutive calls', async () => {
    const { selectSkills } = await import('../skill-selector')
    const task = 'refactor and debug the auth module'
    const result1 = selectSkills(task)
    const result2 = selectSkills(task)
    expect(result1).toEqual(result2)
  })

  it('only returns skills that exist as directories in .agents/skills/', async () => {
    vi.mocked(readdirSync).mockReturnValue([
      makeDirEntry('architecture-intelligence'),
      makeDirEntry('terminal-safety'),
    ] as ReturnType<typeof readdirSync>)
    const { selectSkills } = await import('../skill-selector')
    const skills = selectSkills('refactor the module')
    // gitnexus-refactoring not in available list, so not returned
    expect(skills).not.toContain('gitnexus-refactoring')
    expect(skills).not.toContain('mcp-routing') // also not in trimmed list
  })

  it('output array is sorted alphabetically', async () => {
    const { selectSkills } = await import('../skill-selector')
    const skills = selectSkills('refactor and debug and git commit and install package')
    const sorted = [...skills].sort()
    expect(skills).toEqual(sorted)
  })
})
