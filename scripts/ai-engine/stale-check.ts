/** @library-module */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { BrainStatus } from './types'

const BRAIN_PATH = 'docs/ai/context/ai-architecture-brain.json'
const SOURCE_DIRS = ['packages', 'apps']

/** Returns the mtime (ms) of the most recently modified .ts/.tsx file under SOURCE_DIRS. */
function getMostRecentTsMtime(): number {
  let latest = 0

  function walk(dir: string): void {
    let entries: ReturnType<typeof readdirSync>
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return // skip unreadable directories
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue // never traverse installed deps
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        const mtime = statSync(full).mtimeMs
        if (mtime > latest) latest = mtime
      }
    }
  }

  for (const d of SOURCE_DIRS) {
    if (existsSync(d)) walk(d)
  }
  return latest
}

/** Check brain artifact status. Returns 'absent', 'stale', or 'present_fresh'. */
export function checkBrainStatus(): { status: BrainStatus; brainPath: string; detail?: string } {
  if (!existsSync(BRAIN_PATH)) {
    return {
      status: 'absent',
      brainPath: BRAIN_PATH,
      detail: `Brain artifact does not exist at ${BRAIN_PATH}. Run: bun arch:audit`,
    }
  }
  const brainMtime = statSync(BRAIN_PATH).mtimeMs
  const latestSrc = getMostRecentTsMtime()
  if (latestSrc > brainMtime) {
    const delta = latestSrc - brainMtime
    return {
      status: 'stale',
      brainPath: BRAIN_PATH,
      detail: `Source files newer than brain artifact by ${delta}ms. Run: bun arch:audit`,
    }
  }
  return { status: 'present_fresh', brainPath: BRAIN_PATH }
}
