/** @library-module */
import type { ScopeMetrics } from '../types'

export function buildScopeMetrics(
  allModules: string[],
  scopeModules: Set<string>,
  skippedUnmappedFiles: string[]
): ScopeMetrics {
  return {
    modules_validated: scopeModules.size,
    modules_skipped: Math.max(allModules.length - scopeModules.size, 0),
    skipped_unmapped_files: [...skippedUnmappedFiles].sort((a, b) => a.localeCompare(b)),
  }
}
