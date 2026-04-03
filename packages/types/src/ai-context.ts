/**
 * AI Context Layer Type Definitions
 *
 * Defines TypeScript interfaces for all 7 AI-consumable architecture context artifacts.
 * These artifacts enable AI agents (Copilot, GitNexus, SpecKit, Claude) to understand
 * and validate Zidney's architecture automatically.
 *
 * Generated artifacts:
 * - docs/ai/context/ai-architecture-summary.md
 * - docs/ai/context/ai-module-map.json
 * - docs/ai/context/ai-layer-model.json
 * - docs/ai/context/ai-dependency-graph.json
 * - docs/ai/context/ai-runtime-map.json
 * - docs/ai/context/ai-architecture-brain.json
 * - docs/ai/context/ai-context-mini.json
 *
 * @module packages/types/src/ai-context
 * @version 1.0.0
 */

/**
 * Schema version following semantic versioning (ADR-0008)
 * Format: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking schema changes requiring migration
 * - MINOR: New optional fields or non-breaking additions
 * - PATCH: Documentation updates, value corrections
 */
export type SchemaVersion = string // e.g., "1.0.0"

/**
 * Timestamp in ISO 8601 format (ADR-0006 - Authoritative Time)
 */
export type Timestamp = string // e.g., "2026-03-09T10:30:00Z"

/**
 * Module layer identifier
 */
export type LayerType = 'ui' | 'runtime' | 'domain' | 'infrastructure'

/**
 * Module type classification
 */
export type ModuleType = 'application' | 'package'

/**
 * Dependency violation severity
 */
export type ViolationSeverity = 'error' | 'warning'

/**
 * Architectural summary structure reference
 *
 * The ai-architecture-summary.md artifact contains:
 * - System overview
 * - Layer descriptions
 * - Applications directory reference
 * - Packages directory reference
 * - Architectural principles
 * - Key constraints and rules
 * - Dependencies and assumptions
 *
 * This is a Markdown document, not JSON. The interface documents expected sections.
 *
 * @example
 * ```markdown
 * # Zidney Architecture Summary
 *
 * ## System Layers Overview
 * Zidney uses 4-layer architecture...
 *
 * ## Applications
 * - api: Backend HTTP server
 * - worker: Background job processor
 * ...
 * ```
 */
export interface ArchitectureSummaryStructure {
  /** Expected Markdown sections */
  sections: {
    systemLayersOverview: string
    applicationsDirectory: string
    packagesDirectory: string
    architecturePrinciples: string
    keyConstraintsAndRules: string
    dependenciesAndAssumptions: string
  }

  /** File format: Markdown (.md) */
  format: 'markdown'

  /** File path: docs/ai/context/ai-architecture-summary.md */
  path: string
}

/**
 * Module-to-layer mapping artifact
 *
 * Maps every module in the codebase to its architectural layer.
 * Used by AI tools for module placement suggestions and dependency validation.
 *
 * Schema version: 1.0.0
 *
 * @example
 * ```json
 * {
 *   "schema_version": "1.0.0",
 *   "generated_at": "2026-03-09T10:30:00Z",
 *   "source_metadata": {
 *     "module_boundaries_hash": "abc123...",
 *     "audit_timestamp": "2026-03-09T10:29:00Z"
 *   },
 *   "modules": {
 *     "apps/api": {
 *       "layer": "runtime",
 *       "type": "application",
 *       "description": "HTTP API server implementation",
 *       "path": "apps/api",
 *       "dependencies": ["packages/domain-core", "packages/types"]
 *     }
 *   }
 * }
 * ```
 */
export interface AIModuleMap {
  /** Schema versioning for compatibility tracking */
  schema_version: SchemaVersion

  /** ISO 8601 timestamp of generation */
  generated_at: Timestamp

  /** Source metadata for change detection and audit trail */
  source_metadata: {
    /** SHA256 hash of module-boundaries.json for change detection */
    module_boundaries_hash: string

    /** Timestamp when audit metadata was generated */
    audit_timestamp: Timestamp
  }

  /** Map of module path to module entry */
  modules: {
    [modulePath: string]: ModuleEntry
  }
}

/**
 * Entry for a single module in the module map
 */
export interface ModuleEntry {
  /** Architectural layer assignment */
  layer: LayerType

  /** Module type (application or package) */
  type: ModuleType

  /** Human-readable description of module purpose */
  description: string

  /** Filesystem path to module */
  path: string

  /** Direct module dependencies (optional, can be derived from dependency graph) */
  dependencies?: string[]

  /** Maintainer or team (optional) */
  owner?: string

  /** Interface/exports documentation (optional) */
  exports?: string[]
}

/**
 * Layer model artifact
 *
 * Defines architectural layers and import rules for dependency validation.
 * Generated from module-boundaries.json.
 * Used by ai-guard.ts and AI tools for architecture validation.
 *
 * Schema version: 1.0.0
 *
 * @example
 * ```json
 * {
 *   "schema_version": "1.0.0",
 *   "generated_at": "2026-03-09T10:30:00Z",
 *   "source_metadata": {
 *     "module_boundaries_hash": "abc123..."
 *   },
 *   "layers": [
 *     {
 *       "name": "ui",
 *       "description": "User interface layer - Vue 3 components"
 *     },
 *     {
 *       "name": "runtime",
 *       "description": "Runtime services - API, Worker"
 *     },
 *     {
 *       "name": "domain",
 *       "description": "Domain logic - business rules, models"
 *     },
 *     {
 *       "name": "infrastructure",
 *       "description": "Infrastructure - database, caching, messaging"
 *     }
 *   ],
 *   "rules": {
 *     "ui": {
 *       "imports_allowed": ["packages/ui-system", "packages/types"],
 *       "imports_forbidden": ["packages/domain-core", "apps/api"]
 *     }
 *   }
 * }
 * ```
 */
export interface AILayerModel {
  /** Schema versioning for compatibility tracking */
  schema_version: SchemaVersion

  /** ISO 8601 timestamp of generation */
  generated_at: Timestamp

  /** Source metadata for audit trail */
  source_metadata: {
    /** SHA256 hash of module-boundaries.json for change detection */
    module_boundaries_hash: string
  }

  /** Layer definitions */
  layers: Array<{
    /** Layer identifier */
    name: LayerType

    /** Human-readable description of layer purpose */
    description: string

    /** Position in dependency hierarchy (lower = lower layer) */
    order?: number
  }>

  /** Import rules per layer */
  rules: {
    [layerName: string]: LayerRule
  }
}

/**
 * Import rules for a single layer
 */
export interface LayerRule {
  /** Modules that can be imported by this layer */
  imports_allowed: string[]

  /** Modules that cannot be imported by this layer */
  imports_forbidden: string[]

  /** Description of rule rationale (optional) */
  rationale?: string
}

/**
 * Dependency graph artifact
 *
 * Complete dependency relationships for all modules.
 * Generated from infra-audit.ts output.
 * Used by GitNexus MCP for impact analysis and blast radius calculation.
 *
 * Schema version: 1.0.0
 *
 * @example
 * ```json
 * {
 *   "schema_version": "1.0.0",
 *   "generated_at": "2026-03-09T10:30:00Z",
 *   "source_metadata": {
 *     "infra_audit_timestamp": "2026-03-09T10:29:00Z"
 *   },
 *   "modules": {
 *     "apps/api": {
 *       "dependencies": ["packages/domain-core", "packages/types"],
 *       "layer": "runtime",
 *       "type": "app"
 *     }
 *   },
 *   "reverse_dependencies": {
 *     "packages/types": ["apps/api", "apps/worker", "apps/frontoffice"]
 *   },
 *   "violations": [
 *     {
 *       "from": "packages/ui-system",
 *       "to": "packages/domain-core",
 *       "reason": "UI layer cannot import from domain layer",
 *       "severity": "error"
 *     }
 *   ]
 * }
 * ```
 */
export interface AIDependencyGraph {
  /** Schema versioning for compatibility tracking */
  schema_version: SchemaVersion

  /** ISO 8601 timestamp of generation */
  generated_at: Timestamp

  /** Source metadata for audit trail */
  source_metadata: {
    /** Timestamp of the infra-audit.ts execution */
    infra_audit_timestamp: Timestamp
  }

  /** Forward dependencies per module */
  modules: {
    [modulePath: string]: {
      /** Direct module dependencies */
      dependencies: string[]

      /** Layer assignment */
      layer: string

      /** Module type */
      type: 'app' | 'package'

      /** External npm dependencies (optional) */
      external_dependencies?: string[]
    }
  }

  /** Reverse dependency lookup for impact analysis */
  reverse_dependencies: {
    [modulePath: string]: string[]
  }

  /** Canonical dependency edges for guard and cycle analysis */
  edges: Array<{
    from: string
    to: string
  }>

  /** Detected dependency violations */
  violations?: DependencyViolation[]
}

/**
 * Dependency violation report
 */
export interface DependencyViolation {
  /** Module from which the illegal import originates */
  from: string

  /** Module being illegally imported */
  to: string

  /** Explanation of why this is a violation */
  reason: string

  /** Severity level (error requires fix, warning suggests attention) */
  severity: ViolationSeverity

  /** Rule that was violated (optional) */
  rule?: string
}

/**
 * Runtime service mapping artifact
 *
 * Maps services to their module implementations and dependencies.
 * Used for understanding service composition and deployment topology.
 * Source: docker-compose.yml, package.json, and directory analysis.
 *
 * Schema version: 1.0.0
 *
 * @example
 * ```json
 * {
 *   "schema_version": "1.0.0",
 *   "generated_at": "2026-03-09T10:30:00Z",
 *   "services": {
 *     "api": {
 *       "module": "apps/api",
 *       "runtime": "Bun",
 *       "framework": "Hono",
 *       "depends_on": ["postgres", "redis"],
 *       "environment": {
 *         "NODE_ENV": "production",
 *         "LOG_LEVEL": "info"
 *       },
 *       "port": 3000
 *     }
 *   }
 * }
 * ```
 */
export interface AIRuntimeMap {
  /** Schema versioning for compatibility tracking */
  schema_version: SchemaVersion

  /** ISO 8601 timestamp of generation */
  generated_at: Timestamp

  /** Service definitions */
  services: {
    [serviceName: string]: ServiceDefinition
  }

  /** Infrastructure dependencies (databases, caches, etc.) */
  infrastructure?: {
    [serviceName: string]: InfrastructureService
  }
}

/**
 * Service definition in runtime map
 */
export interface ServiceDefinition {
  /** Module path implementing this service */
  module: string

  /** Runtime environment (Bun, Node.js, etc.) */
  runtime: string

  /** Framework or runtime tool */
  framework: string

  /** Service dependencies */
  depends_on: string[]

  /** Environment variables (optional, non-sensitive only) */
  environment?: {
    [key: string]: string
  }

  /** Port number (optional) */
  port?: number

  /** Protocol (optional) */
  protocol?: string

  /** Health check endpoint (optional) */
  health_check?: string
}

/**
 * Infrastructure service definition
 */
export interface InfrastructureService {
  /** Service type (postgres, redis, etc.) */
  type: string

  /** Version (optional) */
  version?: string

  /** Port number (optional) */
  port?: number

  /** Configuration details (optional) */
  config?: {
    [key: string]: unknown
  }
}

/**
 * Comprehensive architecture brain artifact
 *
 * Aggregates all architectural information optimized for AI consumption.
 * Used by ai-guard.ts for architecture validation.
 * Contains dependency graph, layer rules, metadata, and validation context.
 *
 * Schema version: 1.0.0
 *
 * @example
 * ```json
 * {
 *   "schema_version": "1.0.0",
 *   "generated_at": "2026-03-09T10:30:00Z",
 *   "metadata": {
 *     "total_modules": 18,
 *     "total_violations": 2,
 *     "generation_time_ms": 234,
 *     "source_hash": "abc123..."
 *   },
 *   "layers": [...],
 *   "modules": {...},
 *   "rules": {...},
 *   "violations": [...]
 * }
 * ```
 */
export interface AIArchitectureBrain {
  /** Schema versioning for compatibility tracking */
  schema_version: SchemaVersion

  /** ISO 8601 timestamp of generation */
  generated_at: Timestamp

  /** Generation metadata and statistics */
  metadata: {
    /** Total number of modules discovered */
    total_modules: number

    /** Number of dependency violations found */
    total_violations: number

    /** Time taken to generate artifacts (milliseconds) */
    generation_time_ms: number

    /** Combined hash of all source inputs for change detection */
    source_hash: string

    /** Timestamp when source data was captured */
    source_timestamp: Timestamp

    /** Version of the generation script that created this */
    generator_version: string
  }

  /** Complete layer definitions */
  layers: Array<{
    name: LayerType
    description: string
    order?: number
  }>

  /** Complete module map */
  modules: {
    [modulePath: string]: ModuleEntry
  }

  /** Complete import rules */
  rules: {
    [layerName: string]: LayerRule
  }

  /** Dependency relationships */
  dependencies: {
    [modulePath: string]: {
      imports: string[]
      imported_by: string[]
      violations: DependencyViolation[]
    }
  }

  /** Canonical dependency edges for downstream validators */
  edges: Array<{
    from: string
    to: string
  }>

  /** All detected violations */
  violations: DependencyViolation[]

  /** Quality metrics */
  metrics?: {
    /** Highest violation severity (error > warning > none) */
    max_severity: ViolationSeverity | 'none'

    /** Percentage of modules following rules */
    compliance_percentage: number

    /** Modules with violations */
    violating_modules: string[]

    /** Most problematic dependencies */
    hotspots?: {
      module: string
      hotspot_score: number
    }[]
  }
}

/**
 * Lightweight context artifact
 *
 * Minimal subset of architecture context for fast loading by AI tools.
 * Optimized for file size and parse speed (must be < 100KB total).
 * Used by Copilot and other tools with strict context limits.
 *
 * Contains essential information only:
 * - Layer definitions
 * - Module-to-layer mapping
 * - Key rules
 * - Critical violations
 *
 * Schema version: 1.0.0
 *
 * @example
 * ```json
 * {
 *   "schema_version": "1.0.0",
 *   "generated_at": "2026-03-09T10:30:00Z",
 *   "layers": [...],
 *   "modules_by_layer": {
 *     "ui": ["apps/frontoffice", "apps/backoffice", "packages/ui-system"],
 *     "runtime": ["apps/api", "apps/worker"],
 *     "domain": ["packages/domain-core"],
 *     "infrastructure": ["packages/logger", "packages/redis-utils"]
 *   },
 *   "rules": {...},
 *   "critical_violations": [...]
 * }
 * ```
 */
export interface AIContextMini {
  /** Schema versioning for compatibility tracking */
  schema_version: SchemaVersion

  /** ISO 8601 timestamp of generation */
  generated_at: Timestamp

  /** Layer definitions (compact) */
  layers: Array<{
    name: LayerType
    description: string
  }>

  /** Modules organized by layer */
  modules_by_layer: {
    [layerName: string]: string[]
  }

  /** Import rules */
  rules: {
    [layerName: string]: {
      forbidden: string[]
    }
  }

  /** Most critical violations only (top 5) */
  critical_violations?: DependencyViolation[]

  /** Reference to full artifact location */
  full_context_url: string

  /** Estimated size of full context in bytes */
  full_context_size_bytes: number
}

/**
 * Complete AI context bundle
 *
 * Represents all 7 artifacts as a unified type.
 * Used for batch operations and validation.
 */
export interface AIContextBundle {
  architecture_summary?: ArchitectureSummaryStructure
  module_map: AIModuleMap
  layer_model: AILayerModel
  dependency_graph: AIDependencyGraph
  runtime_map: AIRuntimeMap
  architecture_brain: AIArchitectureBrain
  context_mini: AIContextMini

  /** Validation status across all artifacts */
  validation_status: {
    [artifactName: string]: {
      valid: boolean
      errors?: string[]
    }
  }
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  /** Whether the artifact validates against schema */
  valid: boolean

  /** Validation errors if any */
  errors?: Array<{
    path: string
    message: string
    severity: 'error' | 'warning'
  }>

  /** Artifacts that were validated */
  checked_artifacts: string[]

  /** Overall validation time in milliseconds */
  validation_time_ms: number
}

/**
 * Change detection result
 */
export interface ChangeDetectionResult {
  /** Whether any sources have changed since last generation */
  changed: boolean

  /** Which source files changed */
  changed_sources: {
    [sourceName: string]: {
      previous_hash: string
      current_hash: string
    }
  }

  /** Timestamp of last successful generation */
  last_generated_at: Timestamp

  /** Time since last generation in seconds */
  time_since_generation_seconds: number

  /** Recommendation for regeneration */
  should_regenerate: boolean
}

/**
 * Artifact generation options
 */
export interface GenerationOptions {
  /** Whether to force regeneration even if sources unchanged */
  force?: boolean

  /** Whether to validate schemas during generation */
  validate?: boolean

  /** Whether to include detailed metrics in output */
  include_metrics?: boolean

  /** Output directory (default: docs/ai/context/) */
  output_dir?: string

  /** Whether to fail on any validation errors */
  strict?: boolean

  /** Filter to specific artifacts (default: all) */
  artifacts?: string[]
}
