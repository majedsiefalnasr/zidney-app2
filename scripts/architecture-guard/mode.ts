/** @library-module */
import type { ValidationMode } from './types'

export interface ModeResolution {
  mode: ValidationMode
  outputJson: boolean
  checkOnly: boolean
  modules?: string[]
}

export function resolveMode(argv: string[]): ModeResolution {
  const hasCi = argv.includes('--ci')
  const hasChanged = argv.includes('--changed')
  const checkOnly = argv.includes('--check-only')

  let mode: ValidationMode = 'development'
  if (hasCi) {
    mode = 'strict'
  } else if (hasChanged) {
    mode = 'changed'
  }

  const outputJson = argv.includes('--output') && argv[argv.indexOf('--output') + 1] === 'json'
  const modulesIndex = argv.indexOf('--modules')
  const modulesArg = modulesIndex >= 0 ? argv[modulesIndex + 1] : undefined
  const modules = modulesArg
    ? modulesArg
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined

  return {
    mode,
    outputJson,
    checkOnly,
    modules,
  }
}
