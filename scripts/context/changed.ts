#!/usr/bin/env bun
/**
 * @script context:changed
 * @domain context
 * @category governance
 * @description Resolves staged changed files via `git diff --cached` and writes the
 *   result to docs/ai/context/context-changed.json with a 5-minute freshness cache.
 *   Subsequent reads within the cache window skip the git invocation. A clean staging
 *   area (no changed files) is a valid state — the artifact is written with an empty
 *   changedFiles array rather than exiting non-zero.
 *
 * @usage bun run context:changed
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const OUTPUT_PATH = resolve('docs/ai/context/context-changed.json')
const CACHE_MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes

interface ContextChangedArtifact {
  generatedAt: string
  changedFiles: string[]
}

function fail(message: string): never {
  console.error(`[context:changed] FAIL: ${message}`)
  process.exit(1)
}

function isFresh(): { fresh: boolean; artifact?: ContextChangedArtifact } {
  if (!existsSync(OUTPUT_PATH)) return { fresh: false }

  try {
    const raw = Bun.file(OUTPUT_PATH)
    const ageMs = Date.now() - raw.mtimeMs
    if (ageMs >= CACHE_MAX_AGE_MS) return { fresh: false }

    const text = require('node:fs').readFileSync(OUTPUT_PATH, 'utf8') as string
    const artifact = JSON.parse(text) as ContextChangedArtifact
    return { fresh: true, artifact }
  } catch {
    return { fresh: false }
  }
}

function writeArtifact(changedFiles: string[]): void {
  const artifact: ContextChangedArtifact = {
    generatedAt: new Date().toISOString(),
    changedFiles,
  }
  const json = JSON.stringify(artifact, null, 2)
  const tmpPath = `${OUTPUT_PATH}.tmp`
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(tmpPath, json, 'utf8')
  renameSync(tmpPath, OUTPUT_PATH)
}

function main(): void {
  const { fresh, artifact } = isFresh()

  if (fresh && artifact) {
    const n = artifact.changedFiles.length
    const ageS = Math.floor((Date.now() - new Date(artifact.generatedAt).getTime()) / 1000)
    console.log(`[context:changed] OK cached (${n} staged files, age=${ageS}s)`)
    process.exit(0)
  }

  let raw: string
  try {
    raw = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
      encoding: 'utf8',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    fail(`git is unavailable — ${message}`)
  }

  const changedFiles = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .sort()

  try {
    writeArtifact(changedFiles)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    fail(`atomic write failed — ${message}`)
  }

  console.log(`[context:changed] OK ${changedFiles.length} staged files resolved and cached`)
  process.exit(0)
}

main()
