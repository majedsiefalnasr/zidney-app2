# Contract: Artifact Consumer Interface

**Stage:** STAGE_INFRA_09_AI_ARCHITECTURE_CONTEXT  
**Type:** Integration Contract  
**Purpose:** Defines how AI tools and governance systems consume artifacts

---

## Overview

This contract specifies the interface that AI tools, governance systems, and developer tools must implement to safely and correctly consume AI context artifacts.

---

## Consumer Registration

All tools that consume artifacts must implement:

```typescript
interface ArtifactConsumer {
  name: string // Tool name (e.g., "ai-guard.ts")
  requiredArtifacts: string[] // Which artifacts this tool needs
  validate(): Promise<void> // Validate artifact availability/freshness
  load(): Promise<void> // Load and parse artifacts
  report(): ConsumerStatus // Report consumption status
}
```

**Registered Consumers:**

| Consumer       | Artifacts                                       | Purpose                    |
| -------------- | ----------------------------------------------- | -------------------------- |
| ai-guard.ts    | ai-architecture-brain.json                      | Pre-commit validation      |
| infra-audit.ts | ai-dependency-graph.json                        | Consistency checking       |
| GitNexus MCP   | ai-module-map.json, ai-dependency-graph.json    | Impact analysis            |
| Copilot        | ai-context-mini.json                            | Code generation context    |
| SpecKit        | ai-architecture-summary.md, ai-layer-model.json | Planning context           |
| Claude         | All artifacts                                   | Architecture understanding |

---

## Load Contract

### 1. Artifact Discovery

```typescript
async function discoverArtifacts(): Promise<ArtifactManifest> {
  // 1. Check if docs/ai/context/ exists
  // 2. List all artifacts
  // 3. Verify required artifacts present
  // 4. Return manifest with paths

  return {
    basePath: 'docs/ai/context/',
    artifacts: {
      moduleMap: 'docs/ai/context/ai-module-map.json',
      layerModel: 'docs/ai/context/ai-layer-model.json',
      // ... all 7 artifacts
    },
  }
}
```

**Error Handling:**

```typescript
// If docs/ai/context/ missing
throw new ArtifactNotFoundError('AI context directory not found. Run: bun run generate:ai-context')

// If required artifact missing
throw new ArtifactNotFoundError(`Missing required artifact: ${artifactName}`)
```

---

### 2. Artifact Validation

```typescript
async function validateArtifact<T>(path: string, schema: JSONSchema, type: T): Promise<T> {
  // 1. Read file
  const content = await fs.readFile(path, 'utf-8')

  // 2. Parse JSON
  let data
  try {
    data = JSON.parse(content)
  } catch (e) {
    throw new ArtifactParseError(`Invalid JSON: ${path}`)
  }

  // 3. Validate schema
  const validator = new Ajv()
  const valid = validator.validate(schema, data)
  if (!valid) {
    throw new ArtifactValidationError(
      `Schema validation failed: ${JSON.stringify(validator.errors)}`
    )
  }

  // 4. Check required fields
  if (!data.schema_version) {
    throw new ArtifactValidationError('Missing required field: schema_version')
  }

  if (!data.generated_at) {
    throw new ArtifactValidationError('Missing required field: generated_at')
  }

  // 5. Return typed data
  return data as T
}
```

**Validation Checklist:**

- ✅ File exists and readable
- ✅ JSON parses without error
- ✅ schema_version present and valid format
- ✅ generated_at present and valid ISO-8601 timestamp
- ✅ All required fields as per schema
- ✅ No unexpected fields (optional)

---

### 3. Freshness Validation

```typescript
async function validateFreshness(artifact: {
  schema_version: string
  generated_at: string
}): Promise<{fresh: boolean; warning?: string}> {
  const generatedTime = new Date(artifact.generated_at)
  const ageMs = Date.now() - generatedTime.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  if (ageDays > 30) {
    return {
      fresh: false,
      warning:
        `Artifacts are ${ageDays.toFixed(1)} days old. ` +
        `Regenerate with: bun run generate:ai-context`,
    }
  }

  if (ageDays > 7) {
    return {
      fresh: true,
      warning:
        `Artifacts are ${ageDays.toFixed(1)} days old. ` +
        `Consider regenerating: bun run generate:ai-context`,
    }
  }

  return {fresh: true}
}
```

**Freshness Rules:**

- < 7 days: ✅ Fresh (no warning)
- 7-30 days: ⚠️ Stale (warning, but usable)
- > 30 days: ❌ Very stale (error in CI, warning locally)

---

### 4. Type-Safe Loading

```typescript
async function loadArtifact<T extends {schema_version: string}>(
  artifactName: string,
  schema: JSONSchema
): Promise<T> {
  // 1. Discover
  const manifest = await discoverArtifacts()
  const artifactPath = manifest.artifacts[artifactName]

  if (!artifactPath) {
    throw new ArtifactNotFoundError(`Unknown artifact: ${artifactName}`)
  }

  // 2. Validate
  const artifact = await validateArtifact<T>(artifactPath, schema, {} as T)

  // 3. Check freshness
  const freshness = await validateFreshness(artifact)
  if (!freshness.fresh) {
    throw new ArtifactStaleError(freshness.warning)
  }

  if (freshness.warning) {
    console.warn(freshness.warning)
  }

  // 4. Return typed
  return artifact
}

// Usage:
const brain = await loadArtifact<AIArchitectureBrain>(
  'ai-architecture-brain',
  aiArchitectureBrainSchema
)
```

---

## Query Contract

### For ai-guard.ts

```typescript
interface ArchitectureValidator {
  getRulesForLayer(layer: string): LayerRule
  getLayerForModule(module: string): string
  validateImport(from: string, to: string): {valid: boolean; reason?: string}
}

// Implementation
class ArchitectureValidatorImpl implements ArchitectureValidator {
  constructor(private brain: AIArchitectureBrain) {}

  getRulesForLayer(layer: string): LayerRule {
    return this.brain.rules_active[layer]
  }

  getLayerForModule(module: string): string {
    return this.brain.module_assignments[module]?.layer
  }

  validateImport(from: string, to: string): {valid: boolean; reason?: string} {
    const fromLayer = this.getLayerForModule(from)
    const rules = this.getRulesForLayer(fromLayer)

    if (!rules) {
      return {valid: false, reason: `Unknown layer: ${fromLayer}`}
    }

    if (rules.imports_forbidden.includes(to)) {
      return {
        valid: false,
        reason: `Layer ${fromLayer} cannot import ${to}`,
      }
    }

    return {valid: true}
  }
}
```

---

### For Impact Analysis (GitNexus)

```typescript
interface ImpactAnalyzer {
  getDirectDependents(module: string): string[]
  getTransitiveDependents(module: string): string[]
  getBlastRadius(module: string): BlastRadius
  isValid(module: string): boolean
}

// Implementation
class ImpactAnalyzerImpl implements ImpactAnalyzer {
  constructor(private graph: AIDependencyGraph) {}

  getDirectDependents(module: string): string[] {
    return this.graph.reverse_dependencies[module] || []
  }

  getTransitiveDependents(module: string): string[] {
    const visited = new Set<string>()
    const queue = [module]

    while (queue.length > 0) {
      const current = queue.shift()!
      const dependents = this.getDirectDependents(current)

      for (const dep of dependents) {
        if (!visited.has(dep)) {
          visited.add(dep)
          queue.push(dep)
        }
      }
    }

    visited.delete(module) // Remove self
    return Array.from(visited)
  }

  getBlastRadius(module: string): BlastRadius {
    const transitive = this.getTransitiveDependents(module)
    return {
      directCount: this.getDirectDependents(module).length,
      transitiveCount: transitive.length,
      modules: transitive,
      score: calculateRisk(transitive.length),
    }
  }

  isValid(module: string): boolean {
    return module in this.graph.modules
  }
}
```

---

### For SpecKit Planning

```typescript
interface ArchitecturePlanner {
  suggestLayerForModule(purpose: string): string
  validateTaskForLayer(task: Task, layer: string): boolean
  getPrinciplesSummary(): string
}

// Implementation
class ArchitecturePlannerImpl implements ArchitecturePlanner {
  constructor(
    private summary: string, // ai-architecture-summary.md
    private layerModel: AILayerModel
  ) {}

  suggestLayerForModule(purpose: string): string {
    // Analyze purpose and suggest layer
    // Uses heuristics: "UI" → ui, "database" → infrastructure, etc.
    // Could use LLM for better suggestions
  }

  validateTaskForLayer(task: Task, layer: string): boolean {
    // Check if task dependencies are appropriate for layer
    const layerRules = this.layerModel.rules[layer]

    for (const dep of task.dependencies) {
      if (layerRules.imports_forbidden.some(f => f === dep)) {
        return false
      }
    }

    return true
  }

  getPrinciplesSummary(): string {
    // Extract principles section from summary
    return this.summary.split('## Architecture Principles')[1]
  }
}
```

---

## Error Handling Contract

### Error Types

```typescript
class ArtifactError extends Error {
  code: string
  recoveryAction?: string
}

class ArtifactNotFoundError extends ArtifactError {
  code = 'ARTIFACT_NOT_FOUND'
  recoveryAction = 'Run: bun run generate:ai-context'
}

class ArtifactParseError extends ArtifactError {
  code = 'ARTIFACT_PARSE_ERROR'
  recoveryAction = 'Check JSON validity with: jq . < [file]'
}

class ArtifactValidationError extends ArtifactError {
  code = 'ARTIFACT_VALIDATION_ERROR'
  recoveryAction = 'Regenerate artifacts: bun run generate:ai-context'
}

class ArtifactStaleError extends ArtifactError {
  code = 'ARTIFACT_STALE'
  recoveryAction = 'Regenerate artifacts: bun run generate:ai-context'
}

class SchemaVersionError extends ArtifactError {
  code = 'SCHEMA_VERSION_MISMATCH'
  recoveryAction = 'Check tool compatibility with artifact version'
}
```

### Error Handling Pattern

```typescript
async function safeLoadArtifact<T>(
  artifactName: string,
  options?: {skipFreshnessCheck?: boolean; allowStale?: boolean}
): Promise<Result<T, ArtifactError>> {
  try {
    const artifact = await loadArtifact<T>(artifactName, getSchema(artifactName))
    return {success: true, data: artifact}
  } catch (error) {
    if (error instanceof ArtifactError) {
      return {
        success: false,
        error,
        suggestion: error.recoveryAction,
      }
    }
    throw error
  }
}

// Usage:
const result = await safeLoadArtifact<AIArchitectureBrain>('ai-architecture-brain')

if (!result.success) {
  console.error(`Failed to load artifact: ${result.error.message}`)
  console.error(`Recovery action: ${result.suggestion}`)
  process.exit(1)
}

const brain = result.data
```

---

## Caching Contract (Optional)

```typescript
interface ArtifactCache {
  getMetadata(artifactName: string): CacheMetadata | null
  getArtifact<T>(artifactName: string): T | null
  setArtifact<T>(artifactName: string, artifact: T): void
  invalidate(artifactName: string): void
  invalidateAll(): void
  isFresh(artifactName: string, maxAgeDays?: number): boolean
}

// Optional in-memory cache for perf-sensitive operations
const cache: Map<string, {data: unknown; timestamp: number}> = new Map()

class ArtifactCache implements ArtifactCache {
  getArtifact<T>(artifactName: string): T | null {
    const cached = cache.get(artifactName)
    if (!cached) return null
    // Check freshness
    if (!this.isFresh(artifactName)) {
      cache.delete(artifactName)
      return null
    }
    return cached.data as T
  }

  setArtifact<T>(artifactName: string, artifact: T): void {
    cache.set(artifactName, {
      data: artifact,
      timestamp: Date.now(),
    })
  }

  isFresh(artifactName: string, maxAgeDays = 1): boolean {
    const cached = cache.get(artifactName)
    if (!cached) return false
    const ageMs = Date.now() - cached.timestamp
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    return ageDays < maxAgeDays
  }
}
```

---

## Resilience Contract

### Graceful Degradation

If artifact loading fails, tools should gracefully degrade:

```typescript
async function validateWithFallback(stagedFiles: string[]) {
  // Try to load ai-context
  const result = await safeLoadArtifact<AIArchitectureBrain>(
    'ai-architecture-brain',
    {allowStale: true} // Use stale artifacts if fresh not available
  )

  if (result.success) {
    // Use ai-context for validation
    return validateImportsViaContext(stagedFiles, result.data)
  } else {
    // Fallback: parse module-boundaries.json directly
    console.warn('AI context unavailable; using fallback validation')
    return validateImportsFallback(stagedFiles)
  }
}
```

### Backward Compatibility

Tools should handle schema version mismatches:

```typescript
async function loadWithVersionCheck<T>(
  artifactName: string,
  supportedVersions: string[]
): Promise<T> {
  const artifact = await loadArtifact<T>(artifactName, getSchema(artifactName))

  if (!supportedVersions.includes(artifact.schema_version)) {
    console.warn(
      `Schema version ${artifact.schema_version} may not be fully supported. ` +
        `Tool supports versions: ${supportedVersions.join(', ')}`
    )
  }

  return artifact
}
```

---

## Testing Contract

All consumer implementations must test:

1. **Happy Path**
   - Load valid artifact
   - Query data
   - Verify results

2. **Error Cases**
   - Handle missing artifacts
   - Handle invalid JSON
   - Handle stale artifacts
   - Handle schema violations

3. **Integration**
   - Test with generated artifacts
   - Test with snapshot artifacts
   - Test with various module configurations

---

## Status

**Contract Status:** ✅ **FINALIZED**

**Compliance Required:** All artifact consumers must implement this interface.
