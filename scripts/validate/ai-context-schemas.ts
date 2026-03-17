/**
 * @script validate:ai-context-schemas
 * @domain validate
 * @description Validate that all required AI context JSON artifacts exist and are valid JSON
 * @mode manual,ci
 * @dependencies node:fs,node:path,node:crypto
 */

import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '../core/logger-factory'

const correlationId = randomUUID()
const logger = createLogger('validate:ai-context-schemas')
logger.setContext({ correlationId })

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
  logger.info('Validating AI context schema artifacts', {
    dir: AI_CONTEXT_DIR,
    required: REQUIRED_ARTIFACTS.length,
  })

  const errors: Array<{ artifact: string; reason: string }> = []

  for (const artifact of REQUIRED_ARTIFACTS) {
    const fullPath = join(AI_CONTEXT_DIR, artifact)

    if (!existsSync(fullPath)) {
      errors.push({ artifact, reason: 'File not found' })
      logger.error('AI context artifact missing', { artifact, path: fullPath })
      continue
    }

    try {
      const content = readFileSync(fullPath, 'utf-8')
      JSON.parse(content)
      logger.info('AI context artifact valid', { artifact })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      errors.push({ artifact, reason })
      logger.error('AI context artifact invalid JSON', { artifact, path: fullPath, reason })
    }
  }

  if (errors.length > 0) {
    logger.error('AI context schema validation failed', {
      errors,
      total: REQUIRED_ARTIFACTS.length,
      failed: errors.length,
      hint: 'Run: bun run ai-context:generate to regenerate all artifacts',
    })
    process.exit(1)
  }

  logger.info('All AI context artifacts valid', {
    total: REQUIRED_ARTIFACTS.length,
    passed: REQUIRED_ARTIFACTS.length,
  })
  process.exit(0)
}

main()
