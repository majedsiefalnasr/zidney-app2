/**
 * Shared types for AI context generation pipeline
 * Path: scripts/ai-context/types.ts
 
 * @library-module
*/

export interface GenerationError {
  code: string
  message: string
  context?: Record<string, unknown>
  severity: 'error' | 'warning'
  path?: string
}

export interface GenerationMetrics {
  total_modules: number
  total_violations: number
  generation_time_ms: number
  source_hash: string
  source_timestamp: string
  generator_version: string
}

export interface GenerationProgress {
  phase: 'loading' | 'validating' | 'generating' | 'writing'
  current: number
  total: number
  message: string
  errors: GenerationError[]
}

export interface GenerationResult {
  success: boolean
  artifacts_generated: string[]
  metrics: GenerationMetrics
  errors: GenerationError[]
  warnings: GenerationError[]
  duration_ms: number
}

export interface GenerationError {
  code: string
  message: string
  context?: Record<string, unknown>
  severity: 'error' | 'warning'
  path?: string
}

export interface GenerationMetrics {
  total_modules: number
  total_violations: number
  generation_time_ms: number
  source_hash: string
  source_timestamp: string
  generator_version: string
}

export interface GenerationProgress {
  phase: 'loading' | 'validating' | 'generating' | 'writing'
  current: number
  total: number
  message: string
  errors: GenerationError[]
}

export interface GenerationResult {
  success: boolean
  artifacts_generated: string[]
  metrics: GenerationMetrics
  errors: GenerationError[]
  warnings: GenerationError[]
  duration_ms: number
}
