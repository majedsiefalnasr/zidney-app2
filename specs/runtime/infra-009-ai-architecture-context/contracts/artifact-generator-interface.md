# Contract: Artifact Generation Interface

**Stage:** STAGE_INFRA_09_AI_ARCHITECTURE_CONTEXT  
**Type:** TypeScript Type Contract  
**Location:** packages/types/src/ai-context.ts

---

## Overview

This contract defines the TypeScript interfaces that serve as the single source of truth for all AI context artifacts. These types are the API surface between:

1. **Generation code** (scripts/ai-context/)
2. **Artifacts** (docs/ai/context/)
3. **Consumer code** (ai-guard.ts, infra-audit.ts, GitNexus, etc.)

---

## Core Types

### SchemaVersion

```typescript
/**
 * Semantic version of artifact schema (MAJOR.MINOR.PATCH)
 * Current version: 1.0.0
 * Used for compatibility checking by consumer tools
 */
type SchemaVersion = string
```

**Invariants:**

- Must match pattern: `^\d+\.\d+\.\d+$`
- Initial value: `"1.0.0"`
- Checked on artifact load by consumers

---

### SourceMetadata

```typescript
/**
 * Traceability information showing which sources were used to generate artifact
 * Enables debugging stale or inconsistent artifacts
 */
type SourceMetadata = {
  adr_directory_hash?: string // SHA256 of docs/architecture/adr/
  adr_directory_last_modified?: string // ISO-8601 timestamp
  module_boundaries_hash?: string // SHA256 of module-boundaries.json
  module_boundaries_modified?: string // ISO-8601 timestamp
  infra_audit_timestamp?: string // ISO-8601 of last audit run
  artifact_generated_timestamp?: string // ISO-8601 of generation
}
```

**Usage:**

- At least one source hash/timestamp per artifact
- Enables "change detection" (Q4 Clarification)
- Used to detect stale artifacts and trigger regeneration

---

### ArchitectureLayer

```typescript
type ArchitectureLayer = {
  name: 'ui' | 'runtime' | 'domain' | 'infrastructure'
  description: string
}
```

**Valid Layers:**

| Layer          | Purpose                                           |
| -------------- | ------------------------------------------------- |
| ui             | Vue 3 applications, components, no business logic |
| runtime        | Bun services, API, Worker, execution engine       |
| domain         | Pure business logic, framework-independent        |
| infrastructure | DB drivers, logging, external services            |

---

### LayerRule

```typescript
type LayerRule = {
  imports_allowed: string[] // Whitelist of allowed imports
  imports_forbidden: string[] // Blacklist of forbidden imports
}
```

**Usage:**

- Derived from module-boundaries.json
- Source of truth for architecture validation
- Used by ai-guard.ts and architecture validators

---

## Artifact Types

### AIArchitectureSummary

```typescript
/**
 * Markdown document with human-readable architecture overview
 * Format: Markdown (.md file)
 * Not a strict type; structure defined in data-model.md
 */
interface AIArchitectureSummary {
  // This is Markdown; no TypeScript type needed
  // Document structure defined in data-model.md
}
```

**Contract:**

- UTF-8 encoded Markdown
- Sections: Layers, Apps, Packages, Principles, Constraints, ADRs
- Updated when ADRs or structure changes
- Human-readable for developers and documentation

---

### AIModuleMap

```typescript
/**
 * Machine-readable mapping of modules to layers
 * Consumers: AI-Guard, IDEs, validation tools
 * Update Frequency: When modules added/removed or layers change
 */
interface AIModuleMap {
  schema_version: SchemaVersion
  generated_at: string // ISO-8601
  source_metadata: {
    module_boundaries_hash: string
    module_boundaries_modified?: string
    audit_timestamp?: string
  }
  modules: Record<string, ModuleEntry>
}

interface ModuleEntry {
  layer: 'ui' | 'runtime' | 'domain' | 'infrastructure'
  type: 'application' | 'package'
  description: string
  path: string
  dependencies?: string[]
}
```

**Invariants:**

- All modules from apps/ and packages/ must be present
- Each module assigned to exactly one layer
- Layer assignment must match module-boundaries.json
- Descriptions must be non-empty

**Consumers:**

- ai-guard.ts for layer validation
- GitNexus for dependency analysis
- Copilot for code suggestions

---

### AILayerModel

```typescript
/**
 * Authoritative definition of architectural layers and import rules
 * Source: module-boundaries.json
 * Consumers: Architecture validators, AI agents
 */
interface AILayerModel {
  schema_version: SchemaVersion
  generated_at: string // ISO-8601
  source_metadata: {
    module_boundaries_hash: string
  }
  layers: ArchitectureLayer[]
  rules: Record<string, LayerRule>
}
```

**Invariants:**

- Must include all 4 layers: ui, runtime, domain, infrastructure
- Rules keys must match layer names
- All forbidden imports must be explicitly listed
- Source of truth for layer definitions

**Consumers:**

- Architecture validators
- AI-Guard for import validation
- Documentation systems

---

### DependencyViolation

```typescript
type DependencyViolation = {
  from: string // Source module path
  to: string // Target module path
  reason: string // Why this is a violation
  severity: 'error' | 'warning' // Blocking or warning-only
}
```

**Usage:**

- Listed in ai-dependency-graph.json and ai-architecture-brain.json
- Violations flagged but not always blocking
- Severity determines CI behavior

---

### AIDependencyGraph

```typescript
/**
 * Complete dependency graph with forward and reverse relationships
 * Source: infra-audit.ts output
 * Consumers: Impact analysis, refactoring tools, GitNexus
 */
interface AIDependencyGraph {
  schema_version: SchemaVersion
  generated_at: string // ISO-8601
  source_metadata: {
    infra_audit_timestamp: string
  }
  modules: Record<
    string,
    {
      dependencies: string[]
      layer: string
      type: 'app' | 'package'
    }
  >
  reverse_dependencies: Record<string, string[]>
  violations?: DependencyViolation[]
}
```

**Invariants:**

- All modules from ai-module-map must be present
- Dependencies must be valid module paths
- Reverse dependencies must be consistent forward dependencies
- Violations must reference only valid modules

**Consumers:**

- GitNexus for impact analysis
- Refactoring tools for blast-radius checking
- AI agents for dependency understanding

---

### ServiceDefinition

```typescript
type ServiceDefinition = {
  module: string // Source module (e.g., "apps/api")
  runtime: string // Runtime env (e.g., "Bun")
  framework: string // Framework (e.g., "Hono")
  depends_on: string[] // External deps (e.g., ["postgres", "redis"])
  port?: number
  environment?: Record<string, string>
}
```

**Usage:**

- Part of ai-runtime-map.json
- Maps runtime services to module origins
- Used for deployment and infrastructure planning

---

### AIRuntimeMap

```typescript
/**
 * Mapping of deployed runtime services to module origins
 * Consumers: DevOps, deployment systems
 * Purpose: Service → Module traceability
 */
interface AIRuntimeMap {
  schema_version: SchemaVersion
  generated_at: string // ISO-8601
  services: Record<string, ServiceDefinition>
}
```

**Invariants:**

- All services must reference valid modules from ai-module-map
- Service names should correspond to Docker service names

**Consumers:**

- DevOps tooling
- Deployment systems
- Documentation

---

### ArchitectureMetadata

```typescript
type ArchitectureMetadata = {
  total_modules: number
  layer_distribution: Record<string, number>
  total_dependencies: number
  violations_found: number
}
```

**Usage:**

- Part of ai-architecture-brain.json
- Provides high-level architecture statistics
- Used for governance reporting

---

### AIArchitectureBrain

```typescript
/**
 * Comprehensive architecture intelligence document
 * Aggregates: Module map, layer model, dependencies, violations, metadata
 * Consumers: Governance systems, ai-guard.ts, infra-audit.ts
 * Purpose: Single source for complete architecture context
 */
interface AIArchitectureBrain {
  schema_version: SchemaVersion
  generated_at: string // ISO-8601
  metadata: ArchitectureMetadata
  module_assignments: Record<
    string,
    {
      layer: string
      type: string
      risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
    }
  >
  dependency_graph: AIDependencyGraph
  rules_active: Record<string, LayerRule>
  violations: DependencyViolation[]
  architecture_score: number // 0-100
}
```

**Invariants:**

- Must include complete dependency graph
- Rules must be consistent with ai-layer-model.json
- All referenced modules must exist
- Architecture score: 100 = no violations, <100 = violations present

**Consumers:**

- ai-guard.ts for validation
- infra-audit.ts for consistency checking
- Governance dashboards

---

### AIContextMini

```typescript
/**
 * Lightweight artifact for fast AI bootstrap
 * Subset of ai-layer-model.json and ai-dependency-graph.json
 * Consumers: Copilot, fast-path context loading
 * Purpose: <1KB context for quick initial load
 */
interface AIContextMini {
  schema_version: SchemaVersion
  generated_at: string // ISO-8601
  layers: Array<{
    name: string
    description: string
  }>
  module_to_layer: Record<string, string>
  key_constraints: string[]
  forbidden_dependencies: Array<{
    from: string
    to: string
  }>
}
```

**Invariants:**

- Must be < 1MB for fast loading
- module_to_layer subset of full ai-module-map
- key_constraints should highlight critical rules
- forbidden_dependencies should include most important violations

**Consumers:**

- Copilot for initial context
- Fast-path AI tool initialization

---

## Contract Enforcement Points

### 1. Generation (scripts/ai-context/)

```typescript
// Type all artifact builders
class ModuleMapBuilder {
  build(sources: SourceMetadata): AIModuleMap {
    // Validate: returns valid AIModuleMap or throws
  }
}
```

**Enforcement:**

- Validate generated artifact against TypeScript type
- Schema validation against generated JSON schema
- All required fields must be present

---

### 2. Storage (docs/ai/context/)

```typescript
// Write artifacts with full type safety
async function writeArtifacts(artifacts: {
  moduleMap: AIModuleMap
  layerModel: AILayerModel
  dependencyGraph: AIDependencyGraph
  // ... all 7 artifacts
}): Promise<void> {
  // Write JSON with indentation for readability
  // Write Markdown as-is
}
```

**Enforcement:**

- Files must parse as valid JSON (except Markdown)
- Files must be deserializable back to TypeScript types

---

### 3. Loading (ai-guard.ts, etc.)

```typescript
// Load with validation
async function loadArtifact<T>(path: string, schema: JSONSchema): Promise<T> {
  const content = await fs.readFile(path, 'utf-8')
  const json = JSON.parse(content)

  // Validate against schema
  const valid = validate(json, schema)
  if (!valid) throw new SchemaError()

  // Return as typed
  return json as T
}
```

**Enforcement:**

- Schema validation before consumption
- Type checking at development time
- Runtime validation at tool startup

---

## Integration Contract

### With ai-guard.ts

```typescript
// ai-guard.ts loads and uses artifact
async function validateImports() {
  const brain = await loadArtifact<AIArchitectureBrain>(
    'docs/ai/context/ai-architecture-brain.json'
  )

  // Use rules from artifact
  const rules = brain.rules_active // Type: Record<string, LayerRule>

  // Validate staged files
}
```

**Contract:**

- ai-architecture-brain.json must be valid AIArchitectureBrain
- rules_active must be usable for import validation
- Violations must be reportable to pre-commit hook

---

### With infra-audit.ts

```typescript
// infra-audit.ts generates and validates consistency
async function audit() {
  // Generate infra-audit-report
  const report = generateAudit()

  // Trigger artifact generation
  execSync('bun run generate:ai-context')

  // Load generated artifact
  const graph = await loadArtifact<AIDependencyGraph>('docs/ai/context/ai-dependency-graph.json')

  // Validate consistency
  compareGraphs(report.dependencies, graph)
}
```

**Contract:**

- ai-dependency-graph.json must match infra-audit output
- Schema versions must be consistent
- Timestamps must show synchronization

---

### With GitNexus

```typescript
// GitNexus loads artifact for impact analysis
async function analyzeImpact(module: string): Promise<BlastRadius> {
  const graph = await loadArtifact<AIDependencyGraph>('docs/ai/context/ai-dependency-graph.json')

  // Query reverse dependencies
  const dependents = graph.reverse_dependencies[module]

  // Return impact
}
```

**Contract:**

- ai-dependency-graph.json must be valid AIDependencyGraph
- reverse_dependencies must be complete and accurate
- All referenced modules must exist in module_assignments

---

## Changelog

### Version 1.0.0 (Initial Release)

- ✅ All 7 artifact types defined
- ✅ Source metadata traceability
- ✅ Semantic versioning scheme
- ✅ Schema validation requirements
- ✅ Consumer integration contracts

---

**Contract Status:** ✅ **FINALIZED**

**TypeScript Implementation:** To be completed in packages/types/src/ai-context.ts
