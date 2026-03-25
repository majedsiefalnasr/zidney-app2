#!/usr/bin/env bun
/**
 * @script context:build
 * @domain context
 * @category governance
 * @description Generates docs/ai/context/gitnexus-context.json via assembleContext().
 *   Uses atomic write (write to .tmp then renameSync) to prevent partial artifact state.
 *   Supports --dry-run (print to stdout only), --all (full workspace), --force (skip
 *   freshness check and always regenerate).
 *
 * @usage bun run context:build [-- --dry-run] [-- --all] [-- --force]
 */

import { existsSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AssembleOptions } from '../gitnexus-context.ts'
import { assembleContext } from '../gitnexus-context.ts'

const OUTPUT_PATH = resolve('docs/ai/context/gitnexus-context.json')
const TMP_PATH = `${OUTPUT_PATH}.tmp`
const MAX_AGE_HOURS = 24

function fail(message: string): never {
  console.error(`[context:build] FAIL: ${message}`)
  process.exit(1)
}

function isStale(): boolean {
  if (!existsSync(OUTPUT_PATH)) return true
  const { mtimeMs } = Bun.file(OUTPUT_PATH)
  const ageMs = Date.now() - mtimeMs
  return ageMs / (1000 * 60 * 60) >= MAX_AGE_HOURS
}

function main(): void {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const all = args.includes('--all')
  const force = args.includes('--force')

  // Skip rebuild if artifact is fresh and --force not given
  if (!dryRun && !force && !isStale()) {
    console.log('[context:build] OK artifact is fresh — skipping rebuild (use --force to override)')
    process.exit(0)
  }

  const options: AssembleOptions = {
    changedFilesOnly: !all,
    dryRun,
    output: OUTPUT_PATH,
    all,
    baseRef: 'HEAD',
  }

  let context: ReturnType<typeof assembleContext>
  try {
    context = assembleContext(options)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    fail(`assembleContext failed — ${message}`)
  }

  const json = JSON.stringify(context, null, 2)

  if (dryRun) {
    process.stdout.write(`${json}\n`)
    process.exit(0)
  }

  try {
    writeFileSync(TMP_PATH, json, 'utf8')
    renameSync(TMP_PATH, OUTPUT_PATH)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    fail(`atomic write failed — ${message}`)
  }

  console.log(`[context:build] OK Written: ${OUTPUT_PATH}`)
  process.exit(0)
}

main()
