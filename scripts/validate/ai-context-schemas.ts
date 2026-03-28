/**
 * @script validate:ai-context-schemas
 * @domain validate
 * @category validation
 * @description Validate that all required AI context JSON artifacts exist and are valid JSON
 * @usage bun run validate:ai-context-schemas
 */

import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger, exit, hasCiFlag, log } from '../utils/logger'

const correlationId = randomUUID()
const args = process.argv.slice(2)
const isCi = hasCiFlag(args)
const isAiMode = process.argv.includes('--ai')
const logger = createLogger('validate:ai-context-schemas', isAiMode)
logger.setContext({ correlationId, ci: isCi })

const REPO_ROOT = process.cwd()
const AI_CONTEXT_DIR = join(REPO_ROOT, 'docs/ai/context')

const REQUIRED_ARTIFACTS = [
  'ai-layer-model.json',
  'ai-module-map.json',
  'ai-dependency-graph.json',
  'ai-context-mini.json',
  'ai-architecture-brain.json',
] as const

function main(): void {
  log.header(
    'Validate AI context schemas',
    'Validate that required AI context JSON artifacts exist and are valid JSON'
  )
  log.section('Validation')
  log.step('Checking required AI context artifacts')

  const perfResults = [{ DIR: AI_CONTEXT_DIR, Required: REQUIRED_ARTIFACTS.length }]
  log.table(perfResults, {
    colors: true,
    borderless: true,
  })

  const errors: Array<{ artifact: string; reason: string }> = []
  const validationResults: Array<{ artifact: string; status: string; details: string }> = []

  for (const artifact of REQUIRED_ARTIFACTS) {
    const fullPath = join(AI_CONTEXT_DIR, artifact)

    if (!existsSync(fullPath)) {
      errors.push({ artifact, reason: 'File not found' })
      validationResults.push({ artifact, status: '✖ FAIL', details: 'File not found' })
      logger.error('AI context artifact missing', { artifact, path: fullPath })
      continue
    }

    try {
      const content = readFileSync(fullPath, 'utf-8')
      JSON.parse(content)
      validationResults.push({ artifact, status: '✓ PASS', details: 'Valid JSON' })
      // logger.info('AI context artifact valid', { artifact })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      errors.push({ artifact, reason })
      validationResults.push({ artifact, status: '✖ FAIL', details: reason })
      logger.error('AI context artifact invalid JSON', { artifact, path: fullPath, reason })
    }
  }

  // Display validation results in a table
  log.table(validationResults, { title: 'AI Context Schema Validation Results', colors: true })

  if (errors.length > 0) {
    logger.error('AI context schema validation failed', {
      errors,
      total: REQUIRED_ARTIFACTS.length,
      failed: errors.length,
      hint: 'Run: bun run ai:context:generate to regenerate all artifacts',
    })
    log.result({
      total: REQUIRED_ARTIFACTS.length,
      passed: REQUIRED_ARTIFACTS.length - errors.length,
      failed: errors.length,
      message: 'AI context schema validation failed',
    })
    exit(1)
  }

  logger.info('All AI context artifacts valid', {
    total: REQUIRED_ARTIFACTS.length,
    validated: validationResults.length,
  })
  log.result({
    total: REQUIRED_ARTIFACTS.length,
    passed: REQUIRED_ARTIFACTS.length,
    failed: 0,
    message: 'All AI context artifacts valid',
  })
  exit(0)
}

main()
