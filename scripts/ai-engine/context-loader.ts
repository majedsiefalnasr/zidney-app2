/** @library-module */

import { existsSync, readFileSync } from 'node:fs'
import { createLogger } from '../utils/logger'

const CONTEXT_PATH = 'docs/ai/context/ai-context-mini.json'

const logger = createLogger('ai-engine')

export interface AiContextMini {
  version: string
  modules: unknown[]
  layer_model: unknown
  [key: string]: unknown
}

/**
 * Load ai-context-mini.json.
 * Throws if absent — the caller must catch and call process.exit(3) directly inside the try block.
 * This function does NOT call process.exit itself.
 */
export function loadAiContextMini(): AiContextMini {
  if (!existsSync(CONTEXT_PATH)) {
    throw new Error(
      `AI context artifact not found: ${CONTEXT_PATH}. Run: bun run ai:context:generate`
    )
  }
  logger.debug('Loaded AI context mini artifact', { path: CONTEXT_PATH })
  return JSON.parse(readFileSync(CONTEXT_PATH, 'utf8')) as AiContextMini
}
