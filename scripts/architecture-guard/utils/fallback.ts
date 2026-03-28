/** @library-module */
import type { FallbackReason } from '../types'

export interface FallbackInput {
  mapChanged?: boolean
  hasNewModule?: boolean
  graphMissing?: boolean
  graphStale?: boolean
  graphUnusable?: boolean
  fullScope?: boolean
}

export function resolveFallbackReason(input: FallbackInput): FallbackReason {
  if (input.mapChanged) return 'map_changed'
  if (input.hasNewModule) return 'new_module_detected'
  if (input.graphMissing) return 'graph_missing'
  if (input.graphStale) return 'graph_stale'
  if (input.graphUnusable) return 'graph_unusable'
  if (input.fullScope) return 'full_scope'
  return null
}
