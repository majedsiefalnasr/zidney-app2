#!/usr/bin/env bun
/**
 * @script arch:context:build
 * @domain arch
 * @category governance
 * @description Generates docs/ai/context/gitnexus-context.json via assembleContext().
 *   Uses atomic write (write to .tmp then renameSync) to prevent partial artifact state.
 *   Supports --dry-run (print to stdout only), --all (full workspace), --force (skip
 *   freshness check and always regenerate).
 *
 * @usage bun run arch:context:build [-- --dry-run] [-- --all] [-- --force]
 */

import { existsSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assembleContext } from '../gitnexus-context'
import type { AssembleOptions } from '../gitnexus-context.ts'
import { exit, flushAi, log } from '../utils/logger'

log.setScript('arch:context:build')

const OUTPUT_PATH = resolve('docs/ai/context/gitnexus-context.json')
const TMP_PATH = `${OUTPUT_PATH}.tmp`
const MAX_AGE_HOURS = 24

function fail(message: string): never {
  log.error(`[context:build] FAIL: ${message}`)
  log.result({ total: 1, passed: 0, failed: 1, message })
  exit(1)
}

function isStale(): boolean {
  if (!existsSync(OUTPUT_PATH)) return true
  const { mtimeMs } = Bun.file(OUTPUT_PATH)
  const ageMs = Date.now() - mtimeMs
  return ageMs / (1000 * 60 * 60) >= MAX_AGE_HOURS
}

function main(): void {
  log.header('CONTEXT BUILD', 'Generates gitnexus-context.json artifact')
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const all = args.includes('--all')
  const force = args.includes('--force')

  // Skip rebuild if artifact is fresh and --force not given
  if (!dryRun && !force && !isStale()) {
    log.info('[context:build] OK artifact is fresh — skipping rebuild (use --force to override)')
    log.result({ total: 1, passed: 1, failed: 0, message: 'artifact is fresh' })
    flushAi()
    exit(0)
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
    exit(0)
  }

  try {
    writeFileSync(TMP_PATH, json, 'utf8')
    renameSync(TMP_PATH, OUTPUT_PATH)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    fail(`atomic write failed — ${message}`)
  }

  log.success(`[context:build] OK Written: ${OUTPUT_PATH}`)
  log.result({ total: 1, passed: 1, failed: 0 })
  flushAi()
  exit(0)
}

main()
