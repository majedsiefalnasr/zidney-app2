#!/usr/bin/env bun
/**
 * @script arch:context:impact
 * @domain arch
 * @category governance
 * @description Synthesizes risk indicators from docs/ai/context/gitnexus-context.json,
 *   filtered by the staged changed files recorded in context-changed.json. A risk
 *   indicator is included when its `affectedBy` set intersects the staged changed
 *   files. Writes the result to docs/ai/context/context-impact.json.
 *
 *   If context-changed.json does not exist, falls back to the `changedFiles` array
 *   embedded in the main context artifact.
 *
 *   Output mode:
 *     (default)  one `indicator.module` per line, sorted alphabetically
 *     --json     full riskIndicators array as JSON on stdout
 *
 * @usage bun run arch:context:impact [-- --json]
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { GitNexusContext, RiskIndicator } from '../gitnexus-context.ts'
import { exit, flushAi, hasCiFlag, log } from '../utils/logger'

log.setScript('arch:context:impact')

const ARTIFACT_PATH = resolve('docs/ai/context/gitnexus-context.json')
const CHANGED_PATH = resolve('docs/ai/context/context-changed.json')
const OUTPUT_PATH = resolve('docs/ai/context/context-impact.json')

interface ContextChangedArtifact {
  generatedAt: string
  changedFiles: string[]
}

interface ContextImpactArtifact {
  generatedAt: string
  riskIndicators: RiskIndicator[]
}

function fail(message: string): never {
  log.error(`[context:impact] FAIL: ${message}`)
  log.result({ total: 0, passed: 0, failed: 1, message })
  exit(1)
}

function readJson<T>(filePath: string): T {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    fail(`failed to read ${filePath} — ${message}`)
  }
}

function writeArtifact(indicators: RiskIndicator[]): void {
  const artifact: ContextImpactArtifact = {
    generatedAt: new Date().toISOString(),
    riskIndicators: indicators,
  }
  const tmpPath = `${OUTPUT_PATH}.tmp`
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(tmpPath, JSON.stringify(artifact, null, 2), 'utf8')
  renameSync(tmpPath, OUTPUT_PATH)
}

function main(): void {
  log.header('CONTEXT IMPACT', 'Synthesizes risk indicators from gitnexus-context.json')
  const args = process.argv.slice(2)
  const isCi = hasCiFlag(args)
  if (isCi) {
    log.info('[context:impact] CI mode enabled')
  }
  if (!existsSync(ARTIFACT_PATH)) {
    fail(`artifact not found — run 'bun run arch:context:build' first (expected: ${ARTIFACT_PATH})`)
  }

  const context = readJson<GitNexusContext>(ARTIFACT_PATH)

  // Resolve staged changed files — prefer cached artifact, fall back to context embed
  let changedFiles: string[]
  if (existsSync(CHANGED_PATH)) {
    const changedArtifact = readJson<ContextChangedArtifact>(CHANGED_PATH)
    changedFiles = changedArtifact.changedFiles
  } else {
    changedFiles = context.changedFiles ?? []
  }

  const changedSet = new Set(changedFiles)

  // Filter risk indicators whose affectedBy intersects the changed file set
  const matched: RiskIndicator[] = (context.riskIndicators ?? []).filter((indicator) =>
    indicator.affectedBy.some((f) => changedSet.has(f))
  )

  // Sort by riskScore descending, then module name ascending for determinism
  matched.sort((a, b) => b.riskScore - a.riskScore || a.module.localeCompare(b.module))

  try {
    writeArtifact(matched)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    fail(`atomic write failed — ${message}`)
  }

  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(matched, null, 2)}\n`)
  } else {
    for (const indicator of matched.map((i) => i.module).sort((a, b) => a.localeCompare(b))) {
      process.stdout.write(`${indicator}\n`)
    }
  }

  log.success(`[context:impact] OK ${matched.length} risk indicators resolved`)
  log.result({ total: matched.length, passed: matched.length, failed: 0 })
  flushAi()
  exit(0)
}

main()
