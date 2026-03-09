# Technical Plan: STAGE_INFRA_09_AI_ARCHITECTURE_CONTEXT

**Stage Name:** AI Architecture Context Layer  
**Phase:** PHASE_01_PLATFORM_FOUNDATION  
**Stage Number:** INFRA-009  
**Branch:** spec/infra-009-ai-architecture-context  
**Plan Status:** Ready for Implementation  
**Last Updated:** 2026-03-09

---

## Executive Overview

This plan establishes the implementation roadmap for transforming Zidney's architecture governance metadata into **machine-readable artifacts optimized for AI consumption**.

The stage generates 7 JSON/Markdown artifacts into `docs/ai/context/` that enable AI agents (Copilot, GitNexus, SpecKit, Claude) to:

1. Understand architectural layering rules
2. Validate module boundary compliance
3. Analyze dependency impact before refactoring
4. Load architecture context automatically
5. Detect governance violations in generated code

**Scope:** Pure governance infrastructure — zero runtime impact, zero data model changes, zero tenant isolation modifications.

**Key Decision:** Artifacts are generated from source metadata + infra-audit output, validated by schema, and consumed by multiple AI tools through standard access patterns.

---

## Stage Alignment

### Phase Architecture

- **Phase:** PHASE_01_PLATFORM_FOUNDATION
- **Stage:** INFRA-009_AI_ARCHITECTURE_CONTEXT
- **Related Spec File:** specs/runtime/infra-009-ai-architecture-context/spec.md
- **Related ADRs:**
  - ADR-0006: Runtime Authoritative Time (for archive timestamps)
  - ADR-0008: Semantic Versioning (for artifact versioning scheme)
  - Not introducing ADR violations; metadata only

### Blocking Dependencies

- ✅ STAGE_INFRA_06_ARCHITECTURE_GUARD (ai-guard.ts must work with generated context)
- ✅ STAGE_INFRA_07_MODULE_BOUNDARIES (source of truth for rules)
- ✅ scripts/infra-audit.ts (generates dependency graph input)

### Blocking Successors

- ❌ None. This is a governance enhancement with no blocking impact on other stages.

---

## Architectural Scope Confirmation

### Constitutional Compliance Declaration

Per Zidney Constitution v1.2.0, this stage is **fully compliant with zero exceptions:**

✅ **No cross-tenant data access**

- Operates on shared architecture metadata only
- No tenant database access required
- No tenant slug references in artifact generation logic

✅ **No middleware bypass**

- Not a runtime feature; no endpoints involved
- Tenant resolver not applicable

✅ **No direct DB instantiation**

- Reads from static files only (ADRs, module-boundaries.json, audit reports)
- No live database connections

✅ **No grading logic outside Worker**

- Not applicable; this is governance infrastructure

✅ **Snapshot integrity preserved**

- Not applicable; no snapshot modifications

✅ **Transaction boundaries respected**

- Not applicable; artifact generation is stateless

✅ **Version enforcement maintained**

- Not applicable to this stage
- Artifact schema versioning is metadata only, not runtime enforcement

### Layer Boundary Validation

**Artifacts are generated in:** Infrastructure governance layer (non-runtime)

**Consumed by:**

- AI-Guard (infra discipline)
- CI/CD validation (infra discipline)
- Developer tools (education layer)
- AI agents (external)

**Import boundary:** No violations introduced.

---

## Design Architecture

### Phase 0: Research & Investigation (Week 0-1)

#### 0.1 Source System Analysis

**Task:** Identify all source metadata for context generation.

**Sources to discover:**

1. **docs/architecture/adr/**
   - Action: Enumerate all ADR files
   - Extract: ADR number, title, status, key decisions
   - Purpose: Feed architectural decision context into ai-architecture-summary.md

2. **docs/architecture/module-boundaries.json**
   - Action: Read and validate schema
   - Extract: Layer definitions, allowed imports, forbidden imports
   - Purpose: Generate ai-layer-model.json with authoritative rules
   - Assumption: File is current; validation required

3. **scripts/infra-audit.ts output** (infra-audit-report.json)
   - Action: Run infra-audit to generate current dependency graph
   - Extract: Module list, actual dependencies, violations
   - Purpose: Generate ai-dependency-graph.json
   - Assumption: Audit script produces consistent output

4. **Directory structure analysis**
   - Action: Scan apps/ and packages/ directories
   - Extract: Module names, paths, type (app vs package)
   - Purpose: Validate ai-module-map.json completeness

5. **docs/ai/AI_BOOTSTRAP.md and AI_CONTEXT_INDEX.md**
   - Action: Review existing AI context strategy
   - Extract: Interface contracts, consumer patterns
   - Purpose: Align new artifacts with existing AI guidance system

**Expected Deliverable:** research.md documenting:

- Sources identified and validation status
- Data flow from sources to artifacts
- Assumptions validated or flagged
- Tooling requirements established

---

#### 0.2 Artifact Generation Pipeline Design

**Task:** Design the pipeline that transforms sources → artifacts.

**Pipeline stages:**

```
1. Source Validation
   ├─ Read ADR directory
   ├─ Read module-boundaries.json
   ├─ Read package.json files
   └─ Validate formats

2. Metadata Extraction
   ├─ Extract layer assignments from module-boundaries.json
   ├─ Extract layer definitions from ADRs
   ├─ Build module→layer mapping
   └─ Extract allowed/forbidden import rules

3. Dependency Analysis
   ├─ Run infra-audit to get current dependency graph
   ├─ Extract actual module dependencies
   ├─ Compare against rules
   └─ Identify violations

4. Artifact Generation
   ├─ Generate ai-architecture-summary.md
   ├─ Generate ai-module-map.json
   ├─ Generate ai-layer-model.json
   ├─ Generate ai-dependency-graph.json
   ├─ Generate ai-runtime-map.json (reference)
   ├─ Generate ai-architecture-brain.json
   └─ Generate ai-context-mini.json

5. Schema Validation
   ├─ Validate JSON against TypeScript schemas
   ├─ Validate markdown format
   └─ Verify all required fields present

6. Output & Commit
   ├─ Write artifacts to docs/ai/context/
   └─ Log generation metrics
```

**Key Design Pattern:** **Single source of truth for each artifact**

- ai-layer-model.json: Source = module-boundaries.json
- ai-dependency-graph.json: Source = infra-audit.ts output
- ai-module-map.json: Source = directory scan + module-boundaries.json
- ai-architecture-summary.md: Source = ADR/ + infra-audit output

**Expected Deliverable:** Detailed pipeline architecture diagram and process specification.

---

#### 0.3 Data Flow Mapping

**Task:** Map complete data flow from sources to artifacts to consumers.

```
Source Layer:
  ├─ docs/architecture/adr/
  ├─ docs/architecture/module-boundaries.json
  ├─ infra-audit-report.json
  └─ Directory structure

  ↓

Transformation Layer:
  ├─ Metadata extraction handlers
  ├─ Schema builders
  ├─ Dependency analyzers
  └─ Markdown generators

  ↓

Artifact Layer:
  ├─ ai-architecture-summary.md
  ├─ ai-module-map.json
  ├─ ai-layer-model.json
  ├─ ai-dependency-graph.json
  ├─ ai-runtime-map.json
  ├─ ai-architecture-brain.json
  └─ ai-context-mini.json

  ↓

Consumer Layer:
  ├─ ai-guard.ts (ai-architecture-brain.json)
  ├─ infra-audit.ts (ai-dependency-graph.json)
  ├─ Copilot (ai-context-mini.json)
  ├─ GitNexus MCP (ai-dependency-graph.json)
  ├─ SpecKit (ai-architecture-summary.md)
  └─ Developers (markdown artifacts)
```

**Expected Deliverable:** Data flow diagram with traceability matrix.

---

#### 0.4 Tooling Requirements

**Task:** Identify required development tools and dependencies.

**Tools Needed:**

1. **TypeScript Compiler & Types**
   - TypeScript v5.0+ for type definitions
   - typescript-json-schema for schema generation
   - zod for runtime schema validation (if needed)

2. **File System Tools**
   - Node.js file system APIs
   - Path normalization utilities

3. **JSON Processing**
   - JSON.stringify/parse (built-in)
   - Markdown-to-JSON conversion if needed

4. **Script Execution**
   - Must integrate with infra-audit.ts
   - Must be callable from:
     - Local development (npm script)
     - Pre-commit hooks (Husky)
     - CI pipeline (GitHub Actions)

5. **Testing Tools**
   - Vitest for unit tests
   - JSON Schema validators for snapshot tests
   - Markdown validators

**Expected Deliverable:** Tooling dependency list with installation instructions.

---

### Phase 1: Design & Contracts (Week 1-2)

#### 1.1 TypeScript Type Definitions

**Task:** Define authoritative TypeScript interfaces for all 7 artifacts.

**Location:** `packages/types/src/ai-context.ts`

**Design Specifications:**

```typescript
// Semantic versioning for artifact schema compatibility
type SchemaVersion = string // "1.0.0"

// 1. ai-architecture-summary.md
// No strict type; Markdown is human-readable
// But document structure:
interface ArchitectureSummaryStructure {
  sections: {
    systemLayersOverview: string
    applicationsDirectory: string
    packagesDirectory: string
    architecturePrinciples: string
    keyConstraintsAndRules: string
  }
}

// 2. ai-module-map.json
interface AIModuleMap {
  schema_version: SchemaVersion
  generated_at: string // ISO 8601
  source_metadata: {
    module_boundaries_hash: string
    audit_timestamp: string
  }
  modules: {
    [modulePath: string]: ModuleEntry
  }
}

interface ModuleEntry {
  layer: 'ui' | 'runtime' | 'domain' | 'infrastructure'
  type: 'application' | 'package'
  description: string
  path: string
  dependencies?: string[]
}

// 3. ai-layer-model.json
interface AILayerModel {
  schema_version: SchemaVersion
  generated_at: string
  source_metadata: {
    module_boundaries_hash: string
  }
  layers: Array<{
    name: 'ui' | 'runtime' | 'domain' | 'infrastructure'
    description: string
  }>
  rules: {
    [layerName: string]: LayerRule
  }
}

interface LayerRule {
  imports_allowed: string[]
  imports_forbidden: string[]
}

// 4. ai-dependency-graph.json
interface AIDependencyGraph {
  schema_version: SchemaVersion
  generated_at: string
  source_metadata: {
    infra_audit_timestamp: string
  }
  modules: {
    [modulePath: string]: {
      dependencies: string[]
      layer: string
      type: 'app' | 'package'
    }
  }
  reverse_dependencies: {
    [modulePath: string]: string[]
  }
  violations?: DependencyViolation[]
}

interface DependencyViolation {
  from: string
  to: string
  reason: string
  severity: 'error' | 'warning'
}

// 5. ai-runtime-map.json
interface AIRuntimeMap {
  schema_version: SchemaVersion
  generated_at: string
  services: {
    [serviceName: string]: ServiceDefinition
  }
}

interface ServiceDefinition {
  module: string
  runtime: string
  framework: string
  depends_on: string[]
  environment?: {
    [key: string]: string
  }
}

// 6. ai-architecture-brain.json
interface AIArchitectureBrain {
  schema_version: SchemaVersion
  generated_at: string
  metadata: {
    total_modules: number
    layer_distribution: {
      [layer: string]: number
    }
    total_dependencies: number
    violations_found: number
  }
  module_assignments: {
    [modulePath: string]: {
      layer: string
      type: string
      risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
    }
  }
  dependency_graph: AIDependencyGraph
  rules_active: AILayerModel['rules']
  violations: DependencyViolation[]
  architecture_score: number // 0-100
}

// 7. ai-context-mini.json
interface AIContextMini {
  schema_version: SchemaVersion
  generated_at: string
  layers: Array<{
    name: string
    description: string
  }>
  module_to_layer: {
    [modulePath: string]: string
  }
  key_constraints: string[]
  forbidden_dependencies: Array<{
    from: string
    to: string
  }>
}
```

**Constraints & Validation:**

- All artifacts must include `schema_version` at root level
- All artifacts must include `generated_at` timestamp
- All `schema_version` fields must match current schema version (1.0.0)
- Source metadata hashes must be present for traceability

**Expected Deliverable:** Complete TypeScript definitions in packages/types with JSDoc comments.

---

#### 1.2 JSON Schema Generation

**Task:** Generate formal JSON schemas from TypeScript types.

**Approach:**

1. Use `typescript-json-schema` package
2. Generate schemas from TypeScript interfaces
3. Store schemas in `docs/ai/context/schemas/`
4. Use schemas for runtime validation during artifact generation

**Schema Files to Generate:**

```
docs/ai/context/schemas/
├── ai-module-map.schema.json
├── ai-layer-model.schema.json
├── ai-dependency-graph.schema.json
├── ai-runtime-map.schema.json
├── ai-architecture-brain.schema.json
└── ai-context-mini.schema.json
```

**Validation Strategy:**

- During generation: Validate each artifact against schema
- On load: Validate artifact against schema before consuming
- In CI: Schema validation as part of artifact freshness check
- For AI tools: Schemas available for tool-side validation

**Expected Deliverable:** Generated JSON schema files + validation integration code.

---

#### 1.3 Artifact Generation Script Design

**Task:** Design the main generation script.

**Location:** `scripts/generate-ai-context.ts`

**Responsibilities:**

1. **Source Discovery & Validation**

   ```typescript
   async function discoverSources(): Promise<SourceMetadata> {
     // 1. Find and validate docs/architecture/adr/
     // 2. Load docs/architecture/module-boundaries.json
     // 3. Run infra-audit.ts if needed
     // 4. Scan apps/ and packages/ structure
     // 5. Return combined metadata
   }
   ```

2. **Change Detection** (Q4 Clarification)

   ```typescript
   async function detectSourceChanges(): Promise<boolean> {
     // 1. Check if adr/ directory has changes
     // 2. Check if module-boundaries.json hash changed
     // 3. Check if infra-audit timestamp is fresh
     // 4. Return: true if regeneration needed
   }
   ```

3. **Metadata Transformation**

   ```typescript
   async function transformToArtifacts(sources: SourceMetadata): Promise<Artifacts> {
     // 1. Extract layer assignments
     // 2. Build module→layer map
     // 3. Extract allowed/forbidden rules
     // 4. Analyze actual dependencies
     // 5. Generate all 7 artifacts
     // 6. Return artifact objects
   }
   ```

4. **Schema Validation**

   ```typescript
   async function validateArtifacts(artifacts: Artifacts): Promise<ValidationResult> {
     // 1. Validate each artifact against schema
     // 2. Check for required fields
     // 3. Verify cross-artifact consistency
     // 4. Return: valid or error details
   }
   ```

5. **File Output**

   ```typescript
   async function writeArtifacts(artifacts: Artifacts, outputDir: string): Promise<void> {
     // 1. Create docs/ai/context/ if missing
     // 2. Write each artifact to file
     // 3. Update generation timestamps
     // 4. Log success metrics
   }
   ```

6. **Logging & Observability**
   ```typescript
   type GenerationMetrics = {
     total_modules: number
     layer_distribution: {[key: string]: number}
     artifact_sizes: {[key: string]: number}
     generation_duration_ms: number
     violations_found: number
   }
   ```

**Execution Flow:**

```
generate-ai-context.ts
├─ Parse CLI flags (--force, --verbose, --output-dir)
├─ Validate write permissions
├─ Detect source changes
│  └─ Exit if no changes (unless --force)
├─ Discover and validate sources
│  ├─ Load ADRs
│  ├─ Load module-boundaries.json
│  ├─ Run infra-audit or load cached output
│  └─ Scan directory structure
├─ Transform sources to artifacts
│  ├─ Generate ai-module-map.json
│  ├─ Generate ai-layer-model.json
│  ├─ Generate ai-dependency-graph.json
│  ├─ Generate ai-architecture-summary.md
│  ├─ Generate ai-runtime-map.json
│  ├─ Generate ai-architecture-brain.json
│  └─ Generate ai-context-mini.json
├─ Validate all artifacts against schemas
├─ Write artifacts to docs/ai/context/
├─ Log generation metrics (structured JSON)
└─ Exit with status code 0 (success) or 1+ (error)
```

**Expected Deliverable:** Complete TypeScript implementation of generation script with error handling.

---

#### 1.4 Change Detection Mechanism

**Task:** Design intelligent change detection to avoid unnecessary regenerations (Q4 Clarification).

**Approach:**

1. **Source Hashing**
   - Compute hash of ADR directory contents
   - Compute hash of module-boundaries.json
   - Store hashes in generated artifacts

2. **Timestamp Comparison**
   - Compare infra-audit.ts execution timestamp with artifact generation timestamp
   - If audit is newer, regeneration needed

3. **Directory Change Detection**
   - Monitor apps/ and packages/ directory structure
   - If new modules appear, regeneration needed

4. **Traceability Metadata**

   ```json
   {
     "source_metadata": {
       "adr_directory_hash": "sha256:...",
       "adr_directory_last_modified": "2026-03-09T12:00:00Z",
       "module_boundaries_hash": "sha256:...",
       "module_boundaries_modified": "2026-03-09T12:00:00Z",
       "infra_audit_timestamp": "2026-03-09T11:55:00Z",
       "artifact_generated_timestamp": "2026-03-09T12:00:00Z"
     }
   }
   ```

5. **Freshness Threshold**
   - If artifacts older than 7 days, warn developer
   - If artifacts older than 30 days, error on CI

**Expected Deliverable:** Change detection utility + source metadata tracking.

---

#### 1.5 Design: AI Tool Integration Contracts

**Task:** Define how AI tools load and consume artifacts (Q5 Clarification).

**Integration Pattern 1: Copilot + ai-guard.ts**

```typescript
// In ai-guard.ts pre-commit hook
async function validateArchitecture() {
  // 1. Load ai-architecture-brain.json
  const brain = await loadArtifact<AIArchitectureBrain>(
    'docs/ai/context/ai-architecture-brain.json'
  )

  // 2. Get staged files
  const stagedFiles = await getGitStagedFiles()

  // 3. For each file, validate against rules
  for (const file of stagedFiles) {
    const violations = validateImports(file, brain.rules_active)
    if (violations.length > 0) {
      // Report and block commit
      throw new ArchitectureViolationError(violations)
    }
  }
}
```

**Integration Pattern 2: GitNexus MCP**

```typescript
// In GitNexus MCP handler
function handleImpactAnalysisQuery(module: string): ImpactAnalysis {
  // 1. Load ai-dependency-graph.json
  const graph = await loadArtifact<AIDependencyGraph>('docs/ai/context/ai-dependency-graph.json')

  // 2. Find reverse dependencies
  const dependents = graph.reverse_dependencies[module] || []

  // 3. Trace transitive dependencies
  const blastRadius = transitiveDependents(module, graph)

  // 4. Return impact analysis
  return {
    module,
    direct_dependents: dependents,
    transitive_dependents: blastRadius,
    risk_level: calculateRisk(blastRadius),
  }
}
```

**Integration Pattern 3: SpecKit Agent**

```typescript
// In SpecKit planning phase
async function validatePlanArchitecture(plan: ImplementationPlan) {
  // 1. Load ai-architecture-summary.md and ai-layer-model.json
  const summary = await loadMarkdown('docs/ai/context/ai-architecture-summary.md')
  const layers = await loadArtifact<AILayerModel>('docs/ai/context/ai-layer-model.json')

  // 2. For each task in plan, validate layer assignment
  for (const task of plan.tasks) {
    const module = task.target_module
    const assignedLayer = findLayerForModule(module, layers)

    // 3. Verify task is appropriate for layer
    const isValid = validateTaskForLayer(task, assignedLayer)
    if (!isValid) {
      // Warn that task may violate architecture
      console.warn(`Task ${task.id} may violate layer rules for ${module}`)
    }
  }
}
```

**Integration Pattern 4: Claude/Custom Assistants (Manual)**

```
Instruction to include in Claude context:
"Use the following architecture context to understand the codebase structure.
Load from docs/ai/context/:

- ai-architecture-summary.md: System overview
- ai-layer-model.json: Layer definitions and rules
- ai-module-map.json: Module-to-layer assignments
- ai-dependency-graph.json: Dependency relationships

When proposing changes, verify they respect these constraints."
```

**Access Methods:**

1. **File System** (all tools)
   - Direct read from docs/ai/context/ directory

2. **MCP File API** (GitNexus, etc.)
   - Load via GitHub file API or MCP filesystem operations

3. **Context Injection** (Claude)
   - Paste artifact content into context window

4. **API Endpoint** (future, not in scope)
   - Could expose as endpoint if needed for cloud deployments

**Expected Deliverable:** Integration documentation with examples for each tool.

---

#### 1.6 CI/CD Integration Design

**Task:** Design how CI validates and regenerates artifacts.

**CI Job: `validate-ai-context`**

```yaml
# .github/workflows/validate-ai-context.yml
name: Validate AI Context

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Step 1: Detect source changes
      - name: Detect source changes
        id: changed
        run: |
          if git diff HEAD~1 -- docs/architecture/adr docs/architecture/module-boundaries.json | grep -q .; then
            echo "sources_changed=true" >> $GITHUB_OUTPUT
          else
            echo "sources_changed=false" >> $GITHUB_OUTPUT
          fi

      # Step 2: Regenerate artifacts if sources changed
      - name: Regenerate AI context artifacts
        if: steps.changed.outputs.sources_changed == 'true'
        run: bun run generate:ai-context --verbose

      # Step 3: Validate freshness
      - name: Validate artifact freshness
        run: bun run validate:ai-context-fresh

      # Step 4: Schema validation
      - name: Validate artifact schemas
        run: bun run validate:ai-context-schemas

      # Step 5: Check for uncommitted changes
      - name: Check artifacts committed
        if: steps.changed.outputs.sources_changed == 'true'
        run: |
          if ! git diff-index --quiet HEAD -- docs/ai/context/; then
            echo "Artifacts were regenerated but not committed"
            echo "Run: bun run generate:ai-context"
            echo "Then commit the results"
            exit 1
          fi
```

**NPM Scripts to Add:**

```json
{
  "scripts": {
    "generate:ai-context": "tsx scripts/generate-ai-context.ts",
    "generate:ai-context:force": "tsx scripts/generate-ai-context.ts --force",
    "validate:ai-context-fresh": "tsx scripts/validate-ai-context-fresh.ts",
    "validate:ai-context-schemas": "tsx scripts/validate-ai-context-schemas.ts"
  }
}
```

**Pre-commit Hook Integration:**

```bash
# In .husky/pre-commit
# Generate AI context if ADRs or module-boundaries changed
if git diff-index --cached HEAD -- docs/architecture/adr docs/architecture/module-boundaries.json | grep -q .; then
  echo "Architecture sources changed; regenerating AI context..."
  bun run generate:ai-context
  if [ $? -ne 0 ]; then
    echo "Failed to generate AI context artifacts"
    exit 1
  fi
  # Stage the generated artifacts
  git add docs/ai/context/
fi
```

**Expected Deliverable:** Complete CI workflow configuration + pre-commit hook scripts.

---

### Phase 2: Implementation Strategy (Week 2-3)

#### 2.1 Code Organization

**Directory Structure:**

```
scripts/
├─ generate-ai-context.ts (entry point)
├─ ai-context/
│  ├─ artifact-generator.ts (orchestrator)
│  ├─ source-loader.ts (loads ADRs, module-boundaries.json)
│  ├─ dependency-analyzer.ts (integrates with infra-audit output)
│  ├─ artifact-builders/
│  │  ├─ architecture-summary-builder.ts
│  │  ├─ module-map-builder.ts
│  │  ├─ layer-model-builder.ts
│  │  ├─ dependency-graph-builder.ts
│  │  ├─ runtime-map-builder.ts
│  │  ├─ architecture-brain-builder.ts
│  │  └─ context-mini-builder.ts
│  ├─ schema-validator.ts (validates artifacts)
│  ├─ change-detector.ts (detects source changes)
│  └─ logging.ts (structured logging)

test/validation/
├─ ai-context-generation.test.ts
├─ artifact-schema-validation.test.ts
├─ integration/
│  ├─ ai-guard-integration.test.ts
│  └─ infra-audit-integration.test.ts
└─ fixtures/
   ├─ sample-module-boundaries.json
   ├─ sample-infra-audit-output.json
   └─ expected-artifacts/
```

**Expected Deliverable:** Directory structure + module layout specification.

---

#### 2.2 Implementation Phases

**Phase 2.1: Core Infrastructure (Days 1-2)**

1. Load TypeScript types into packages/types/src/ai-context.ts
2. Implement source-loader.ts to parse ADRs and module-boundaries.json
3. Implement schema-validator.ts for runtime validation
4. Create docs/ai/context/schemas/ directory

**Phase 2.2: Artifact Builders (Days 2-4)**

1. Implement module-map-builder.ts
   - Uses directory scan + module-boundaries.json
   - Assigns all modules to layers

2. Implement layer-model-builder.ts
   - Extracts from module-boundaries.json
   - Generates rule matrix

3. Implement dependency-graph-builder.ts
   - Integrates with infra-audit.ts output
   - Builds reverse dependency map

4. Implement architecture-summary-builder.ts
   - Reads ADRs
   - Generates markdown overview

5. Implement runtime-map-builder.ts
   - References docker-compose.yml, deployment config
   - Maps services to modules

6. Implement architecture-brain-builder.ts
   - Aggregates all data
   - Calculates architecture score

7. Implement context-mini-builder.ts
   - Lightweight version for fast loading

**Phase 2.3: Orchestration & Validation (Days 4-5)**

1. Implement artifact-generator.ts
   - Orchestrates all builders
   - Handles concurrency

2. Implement change-detector.ts
   - Hashing logic
   - Freshness validation

3. Implement generate-ai-context.ts entry point
   - CLI argument parsing
   - Error handling
   - Logging

**Phase 2.4: Integration & CI/CD (Days 5-6)**

1. Update .husky/pre-commit for artifact generation
2. Create GitHub Actions workflow
3. Add NPM scripts
4. Integration with ai-guard.ts
5. Integration with infra-audit.ts

**Phase 2.5: Testing (Days 6-7)**

1. Unit tests for each builder
2. Integration tests with real sources
3. Schema validation tests
4. Snapshot tests for expected artifacts
5. AI tool integration tests (manual)

**Expected Deliverable:** Phased implementation roadmap with time estimates.

---

#### 2.3 Key Implementation Decisions

**Decision 1: Source of Truth Hierarchy**

```
Priority 1: module-boundaries.json (canonical for rules)
Priority 2: infra-audit.ts output (canonical for dependencies)
Priority 3: ADRs (canonical for decisions)
Priority 4: Directory scan (canonical for module discovery)
```

**Decision 2: Artifact Generation Triggers**

- Source changes detected → automatic regeneration in pre-commit
- CI validates freshness on every branch
- Manual override with `--force` flag available
- Scheduled daily regeneration in CI

**Decision 3: Schema Versioning**

- schema_version = "1.0.0" for initial release
- Semantic versioning: MAJOR.MINOR.PATCH
- Breaking changes require migration guide
- AI tools can validate compatibility before loading

**Decision 4: Dependency Analysis Scope**

- Include only local modules (apps/ and packages/)
- Exclude node_modules and external dependencies
- Violations flagged but not blocking (warning level)
- Errors only for schema/validation failures

**Decision 5: Artifact Output Format**

- JSON artifacts: Gzipped in git (reduce size)
- Markdown artifacts: Plain text (for readability)
- All files: < 15MB total size
- Generation: < 5 seconds with cold start

**Expected Deliverable:** Design decision log with rationale.

---

### Phase 3: Integration & Testing (Week 3-4)

#### 3.1 Integration with ai-guard.ts

**Current State:**

ai-guard.ts (STAGE_INFRA_06) validates architecture in pre-commit.

**Integration Points:**

```typescript
// In ai-guard.ts
import {AIArchitectureBrain} from 'packages/types/src/ai-context'

async function validateArchitectureViaAIContext() {
  // 1. Load generated ai-architecture-brain.json
  const brain = await loadArtifact<AIArchitectureBrain>(
    'docs/ai/context/ai-architecture-brain.json'
  )

  // 2. Use brain.rules_active instead of parsing module-boundaries manually
  const rules = brain.rules_active

  // 3. Validate staged files against rules
  const violations = checkViolations(stagedFiles, rules)

  // 4. Freshen brain if stale (> 7 days)
  if (isStale(brain.generated_at)) {
    console.warn('AI context is stale; regenerate with: bun run generate:ai-context')
  }

  return violations
}
```

**Outcome:**

- ai-guard.ts now loads structured context instead of parsing files
- Faster validation (uses precomputed data)
- More robust (validated schema)

**Expected Deliverable:** Integration code + updated ai-guard.ts.

---

#### 3.2 Integration with infra-audit.ts

**Current State:**

infra-audit.ts generates infra-audit-report.json with dependency graph.

**Integration Points:**

```typescript
// In infra-audit.ts
// After generating infra-audit-report.json:

// 1. Trigger ai-context generation
const {execSync} = require('child_process')
try {
  execSync('bun run generate:ai-context --force', {stdio: 'inherit'})
} catch (error) {
  console.warn('AI context generation failed; continuing audit')
}

// 2. Load ai-dependency-graph.json to verify consistency
const aiGraph = await loadArtifact<AIDependencyGraph>('docs/ai/context/ai-dependency-graph.json')

// 3. Compare against own output
const auditGraph = generateDependencyGraph()
const inconsistencies = compareGraphs(auditGraph, aiGraph)

if (inconsistencies.length > 0) {
  console.error('Dependency graph mismatch:')
  inconsistencies.forEach(i => console.error(`  ${i}`))
  process.exit(1)
}
```

**Outcome:**

- infra-audit.ts triggers ai-context regeneration
- Bidirectional validation ensures consistency
- AI context is always in sync with actual dependencies

**Expected Deliverable:** Integration code in infra-audit.ts.

---

#### 3.3 Testing Strategy

**Unit Tests:**

```typescript
// test/validation/ai-context-generation.test.ts

describe('AI Context Generation', () => {
  describe('Module Map Builder', () => {
    test('assigns all modules to correct layer', () => {
      // Load test module-boundaries.json
      // Run builder
      // Verify every module from apps/ and packages/ is mapped
      // Verify layer assignments match boundaries
    })

    test('includes required metadata fields', () => {
      // Build artifact
      // Verify schema_version present
      // Verify generated_at is valid ISO 8601
      // Verify source_metadata present
    })
  })

  describe('Layer Model Builder', () => {
    test('extracts all allowed/forbidden rules', () => {
      // Load test module-boundaries.json with rules
      // Build artifact
      // Verify all rules extracted
      // Verify correct format
    })

    test('detects conflicting rules', () => {
      // Load module-boundaries with conflicting rules
      // Verify builder detects and reports conflict
    })
  })

  describe('Schema Validation', () => {
    test('rejects artifacts with missing required fields', () => {
      // Create artifact with missing schema_version
      // Run validator
      // Expect error
    })

    test('validates nested structures', () => {
      // Create valid artifact
      // Run validator
      // Expect success
    })
  })

  describe('Change Detection', () => {
    test('detects when ADR directory changes', () => {
      // Create initial hashes
      // Modify ADR file
      // Detect change
      // Expect change flag = true
    })

    test('skips regeneration if no sources changed', () => {
      // Run generation twice
      // Expect flag = skipped on second run
    })
  })
})
```

**Integration Tests:**

```typescript
// test/integration/ai-context-generation-integration.test.ts

describe('AI Context Integration', () => {
  test('ai-guard can load and validate with ai-context', async () => {
    // Generate full artifacts
    // Load ai-architecture-brain.json
    // Run ai-guard validation
    // Verify no errors
  })

  test('infra-audit output matches ai-dependency-graph', async () => {
    // Run infra-audit
    // Load ai-dependency-graph.json
    // Compare outputs
    // Expect graphs are equivalent
  })

  test('GitNexus can use ai-dependency-graph for impact analysis', async () => {
    // Load ai-dependency-graph.json
    // Query for dependencies of known module
    // Verify results are correct
  })
})
```

**Schema Validation Tests:**

```typescript
// test/validation/artifact-schema-validation.test.ts

describe('Artifact Schema Validation', () => {
  const schemas = loadAllSchemas()
  const fixtures = loadAllFixtures()

  Object.entries(fixtures).forEach(([artifactName, expectedArtifact]) => {
    test(`${artifactName} validates against schema`, () => {
      const schema = schemas[artifactName]
      const result = validateAgainstSchema(expectedArtifact, schema)
      expect(result.valid).toBe(true)
    })
  })
})
```

**Manual AI Tool Testing:**

1. **Copilot Integration Test**
   - Load ai-context-mini.json in Copilot context
   - Ask Copilot to analyze module dependencies
   - Verify responses respect layer constraints

2. **GitNexus Integration Test**
   - Load ai-dependency-graph.json
   - Run impact analysis query
   - Verify blast radius calculation is correct

3. **SpecKit Integration Test**
   - Load artifacts in SpecKit context
   - Generate plan for new feature
   - Verify plan respects architecture constraints

**Expected Deliverable:** Complete test suite + manual testing checklist.

---

#### 3.4 Performance Validation

**Success Criterion:** Artifacts generated in < 5 seconds, total size < 15MB.

**Benchmarking Tests:**

```typescript
test('artifact generation completes in < 5 seconds', async () => {
  const start = performance.now()
  await generateAllArtifacts()
  const duration = performance.now() - start
  expect(duration).toBeLessThan(5000) // 5 seconds
})

test('total artifact size is < 15MB', async () => {
  const artifacts = await generateAllArtifacts()
  let totalSize = 0
  for (const artifact of artifacts) {
    totalSize += Buffer.byteLength(JSON.stringify(artifact))
  }
  expect(totalSize).toBeLessThan(15 * 1024 * 1024) // 15MB
})

test('ai-context-mini is < 1MB for fast loading', async () => {
  const mini = await generateContextMini()
  const size = Buffer.byteLength(JSON.stringify(mini))
  expect(size).toBeLessThan(1024 * 1024) // 1MB
})
```

**Expected Deliverable:** Performance benchmarking suite.

---

### Phase 4: Deployment & Documentation (Week 4)

#### 4.1 Documentation Structure

**Location:** docs/ai/context/

```
docs/ai/context/
├─ README.md (main documentation)
├─ USER_GUIDE.md (how to use artifacts)
├─ ARTIFACT_REFERENCE.md (detailed artifact specs)
├─ INTEGRATION_GUIDE.md (per-tool integration)
├─ REFRESH_GUIDE.md (how to regenerate)
├─ TROUBLESHOOTING.md (diagnostics)
├─ schemas/
│  ├─ README.md (schema overview)
│  └─ *.schema.json (generated schemas)
├─ examples/
│  ├─ ai-architecture-summary.example.md
│  ├─ ai-module-map.example.json
│  └─ ...
└─ (artifacts themselves)
   ├─ ai-architecture-summary.md
   ├─ ai-module-map.json
   ├─ ai-layer-model.json
   ├─ ai-dependency-graph.json
   ├─ ai-runtime-map.json
   ├─ ai-architecture-brain.json
   └─ ai-context-mini.json
```

**4.1.1 docs/ai/context/README.md**

Overview of AI context system, what each artifact is for, how to use.

**4.1.2 docs/ai/context/USER_GUIDE.md**

Step-by-step guide for:

- Loading context locally
- Interpreting artifacts
- Understanding layer rules
- Running validation

**4.1.3 ARTIFACT_REFERENCE.md**

Detailed specification for each of 7 artifacts:

- Purpose
- Schema overview
- Field definitions
- Examples
- Update frequency

**4.1.4 INTEGRATION_GUIDE.md**

For each consumer (Copilot, GitNexus, SpecKit, Claude):

- How to load artifact
- What to do with it
- Example code snippets
- Troubleshooting per-tool

**4.1.5 REFRESH_GUIDE.md**

- When to regenerate (sources changed, >7 days old)
- How to regenerate locally
- How to verify freshness
- What to do if generation fails

**4.1.6 TROUBLESHOOTING.md**

Common issues:

- Artifact parsing fails → check schema
- Stale artifacts → run regeneration
- Inconsistent rules → resolve conflicts
- AI tool can't load → verify format

**Expected Deliverable:** Complete documentation suite.

---

#### 4.2 AI Tool Integration Guides

**For Each Tool (Copilot, GitNexus, SpecKit, Claude):**

**Guide Structure:**

1. **Overview**
   - What context is available
   - Which artifacts matter for this tool

2. **Setup Instructions**
   - How to load context
   - Validation steps

3. **Example Usage**
   - Sample queries
   - Expected responses

4. **Troubleshooting**
   - Common failures
   - Verification steps

**Expected Deliverable:** Integration guides for all 4+ consumer tools.

---

#### 4.3 Deployment Checklist

**Pre-deployment Validation:**

- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ Schema validation tests pass
- ✅ Performance benchmarks pass (< 5s, < 15MB)
- ✅ Manual AI tool testing complete
- ✅ Pre-commit hook functioning
- ✅ CI workflow validated
- ✅ Documentation complete and reviewed
- ✅ No breaking changes to existing systems
- ✅ Artifacts generated and committed

**Deployment Steps:**

1. Merge to develop branch
2. Artifacts in docs/ai/context/ committed
3. CI validates artifact freshness
4. Production deployment updates pre-commit hooks
5. Team notified of new AI context system
6. AI tools enabled to use artifacts

**Expected Deliverable:** Deployment checklist + runbook.

---

## Data Model & Artifact Schemas

### Artifact 1: ai-architecture-summary.md

**Format:** Markdown  
**Consumers:** Developers, documentation systems, SpecKit  
**Purpose:** Human-readable overview of architecture

**Structure:**

```markdown
# Zidney Architecture Summary

## System Layers

[Overview of 4-layer architecture]

## Applications Directory

### apps/api

- Bun + Hono runtime
- Central API service

### apps/worker

- Background job processor

[... other apps ...]

## Packages Directory

### packages/domain-core

- Business logic

[... other packages ...]

## Architecture Principles

1. Database per tenant
2. Isolation over convenience
3. Determinism over magic

## Key Constraints

- No row-based multi-tenancy
- No cross-tenant joins
- No global DB singleton
```

**Update Frequency:** On ADR changes, structural changes  
**Size:** ~5-10 KB

---

### Artifact 2: ai-module-map.json

**Format:** JSON  
**Consumers:** AI-Guard, IDEs, validation tools  
**Purpose:** Machine-readable module-to-layer mapping

**Schema:**

```typescript
{
  "schema_version": "1.0.0",
  "generated_at": "ISO-8601 timestamp",
  "source_metadata": {
    "module_boundaries_hash": "sha256:...",
    "audit_timestamp": "..."
  },
  "modules": {
    "apps/api": {
      "layer": "runtime",
      "type": "application",
      "description": "Main API service (Bun, Hono)",
      "path": "apps/api",
      "dependencies": ["packages/domain-core", "packages/validation"]
    },
    // ... 11 more modules
  }
}
```

**Update Frequency:** When modules added/removed or layers change  
**Size:** ~5 KB

---

### Artifact 3: ai-layer-model.json

**Format:** JSON  
**Consumers:** Architecture validators, AI tools  
**Purpose:** Authority on layer rules and constraints

**Schema:**

```typescript
{
  "schema_version": "1.0.0",
  "generated_at": "ISO-8601 timestamp",
  "source_metadata": {
    "module_boundaries_hash": "sha256:..."
  },
  "layers": [
    {
      "name": "ui",
      "description": "User interface layer (Vue 3, shadcn-vue)"
    },
    // ... other layers
  ],
  "rules": {
    "ui": {
      "imports_allowed": [
        "packages/ui-system",
        "packages/api-client",
        "packages/types",
        "packages/config"
      ],
      "imports_forbidden": [
        "packages/domain-core",
        "packages/logger",
        "apps/*"
      ]
    },
    // ... rules for other layers
  }
}
```

**Update Frequency:** When layer rules change in module-boundaries.json  
**Size:** ~2-3 KB

---

### Artifact 4: ai-dependency-graph.json

**Format:** JSON  
**Consumers:** Impact analysis tools, GitNexus, ai-guard.ts  
**Purpose:** Dependency relationship map

**Schema:**

```typescript
{
  "schema_version": "1.0.0",
  "generated_at": "ISO-8601 timestamp",
  "source_metadata": {
    "infra_audit_timestamp": "..."
  },
  "modules": {
    "apps/api": {
      "dependencies": [
        "packages/domain-core",
        "packages/validation",
        "packages/logger"
      ],
      "layer": "runtime",
      "type": "app"
    },
    // ... all modules
  },
  "reverse_dependencies": {
    "packages/types": [
      "packages/domain-core",
      "packages/ui-system",
      "apps/api",
      "apps/worker"
    ]
    // ... other modules
  },
  "violations": [
    {
      "from": "packages/ui-system",
      "to": "packages/domain-core",
      "reason": "UI must not import domain logic",
      "severity": "error"
    }
  ]
}
```

**Update Frequency:** When actual code dependencies change  
**Size:** ~8-10 KB

---

### Artifact 5: ai-runtime-map.json

**Format:** JSON  
**Consumers:** DevOps, deployment systems, documentation  
**Purpose:** Mapping of runtime services to modules

**Schema:**

```typescript
{
  "schema_version": "1.0.0",
  "generated_at": "ISO-8601 timestamp",
  "services": {
    "api": {
      "module": "apps/api",
      "runtime": "Bun",
      "framework": "Hono",
      "depends_on": ["postgres", "redis"],
      "port": 3000,
      "environment": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    },
    "worker": {
      "module": "apps/worker",
      "runtime": "Bun",
      "job_processor": "Redis-based",
      "depends_on": ["postgres", "redis"]
    },
    // ... other services
  }
}
```

**Update Frequency:** When services added/removed or configuration changes  
**Size:** ~2-3 KB

---

### Artifact 6: ai-architecture-brain.json

**Format:** JSON  
**Consumers:** infra-audit.ts, ai-guard.ts, governance systems  
**Purpose:** Comprehensive architecture intelligence

**Schema:**

```typescript
{
  "schema_version": "1.0.0",
  "generated_at": "ISO-8601 timestamp",
  "metadata": {
    "total_modules": 13,
    "layer_distribution": {
      "ui": 5,
      "runtime": 2,
      "domain": 2,
      "infrastructure": 4
    },
    "total_dependencies": 28,
    "violations_found": 1
  },
  "module_assignments": {
    "apps/api": {
      "layer": "runtime",
      "type": "application",
      "risk_level": "LOW"
    },
    // ... all modules
  },
  "dependency_graph": { /* same as ai-dependency-graph.json */ },
  "rules_active": { /* same as ai-layer-model.json */ },
  "violations": [ /* list of violations */ ],
  "architecture_score": 98  // 0-100
}
```

**Update Frequency:** When anything changes (comprehensive)  
**Size:** ~12-15 KB

---

### Artifact 7: ai-context-mini.json

**Format:** JSON (minimal size)  
**Consumers:** Copilot, fast-path context loading  
**Purpose:** Lightweight context for quick bootstrap

**Schema:**

```typescript
{
  "schema_version": "1.0.0",
  "generated_at": "ISO-8601 timestamp",
  "layers": [
    {
      "name": "ui",
      "description": "Vue 3 UI components"
    },
    // ... other layers (brief)
  ],
  "module_to_layer": {
    "apps/api": "runtime",
    "apps/worker": "runtime",
    // ... all modules (compact)
  },
  "key_constraints": [
    "No row-based multi-tenancy",
    "No cross-tenant joins",
    "No global DB singleton",
    "Apps cannot import other apps",
    "Packages cannot import apps"
  ],
  "forbidden_dependencies": [
    {
      "from": "packages/ui-system",
      "to": "packages/domain-core"
    },
    // ... key forbidden imports
  ]
}
```

**Update Frequency:** Same as ai-layer-model.json  
**Size:** < 1 KB (fast loading)

---

## Implementation Tasks

### Task Index

**Phase 1: Design (Week 1)**

1. ✅ Read spec and clarifications
2. ✅ Design TypeScript types (1.1)
3. ✅ Design JSON schemas (1.2)
4. ✅ Design generation script architecture (1.3)
5. ✅ Design change detection (1.4)
6. ✅ Design AI tool integration (1.5)
7. ✅ Design CI/CD integration (1.6)

**Phase 2: Implementation (Weeks 2-3)**

8. Implement packages/types/src/ai-context.ts with all 7 artifact types
9. Implement scripts/ai-context/source-loader.ts
10. Implement scripts/ai-context/schema-validator.ts
11. Generate docs/ai/context/schemas/ from TypeScript types
12. Implement artifact builders (7 total):
    - module-map-builder.ts
    - layer-model-builder.ts
    - dependency-graph-builder.ts
    - architecture-summary-builder.ts
    - runtime-map-builder.ts
    - architecture-brain-builder.ts
    - context-mini-builder.ts
13. Implement scripts/ai-context/change-detector.ts
14. Implement scripts/ai-context/artifact-generator.ts (orchestrator)
15. Implement scripts/generate-ai-context.ts (CLI entry point)
16. Add NPM scripts for generation and validation
17. Update .husky/pre-commit for artifact generation
18. Create GitHub Actions workflow for CI validation
19. Integrate with ai-guard.ts
20. Integrate with infra-audit.ts

**Phase 3: Testing (Week 3-4)**

21. Implement unit tests for all builders
22. Implement integration tests
23. Implement schema validation tests
24. Implement snapshot tests
25. Run manual AI tool integration tests:
    - Test with Copilot
    - Test with GitNexus
    - Test with SpecKit
    - Test with Claude
26. Run performance benchmarks

**Phase 4: Documentation & Deployment (Week 4)**

27. Create docs/ai/context/README.md
28. Create USER_GUIDE.md
29. Create ARTIFACT_REFERENCE.md
30. Create INTEGRATION_GUIDE.md
31. Create REFRESH_GUIDE.md
32. Create TROUBLESHOOTING.md
33. Create schema documentation
34. Generate artifacts and commit to repository
35. Verify CI validation passes
36. Deploy pre-commit and CI changes to all environments

---

## Risk Management

### Risk 1: Artifacts Become Stale (Medium Probability, High Impact)

**Scenario:** Architecture changes but artifacts not regenerated; AI tools use outdated rules.

**Mitigation:**

1. Pre-commit hook regenerates artifacts automatically
2. CI job validates freshness on every push
3. Artifacts include generation timestamp
4. Stale warning if > 7 days old
5. Scheduled daily regeneration in CI

**Owner:** DevOps + Architecture

---

### Risk 2: Conflicting Rules (Low Probability, Medium Impact)

**Scenario:** module-boundaries.json and ai-layer-model.json define different rules.

**Mitigation:**

1. Single source of truth: module-boundaries.json
2. Artifact generation derives from module-boundaries.json
3. Governance tooling validates consistency
4. Automated conflict detection in CI
5. ADR authority process prevents conflicting changes

**Owner:** Architecture team

---

### Risk 3: AI Tool Incompatibility (Low Probability, High Impact)

**Scenario:** Copilot, Claude, or GitNexus can't parse JSON artifacts.

**Mitigation:**

1. Schema designed for universal JSON compatibility
2. Testing done with actual AI tools before deployment
3. Lightweight variant (ai-context-mini.json) for fallback
4. Markdown summaries for human fallback
5. Integration guides for each tool
6. Vendor support for schema issues

**Owner:** Architecture + AI Integration team

---

### Risk 4: Performance Degradation (Low Probability, Medium Impact)

**Scenario:** Generation becomes slow as codebase grows; CI pipeline slows.

**Mitigation:**

1. Performance target: < 5 seconds
2. Incremental generation once established
3. Caching of intermediate results
4. Change detection skips unnecessary regenerations
5. Performance benchmarking in CI
6. Optimization as needed

**Owner:** DevOps

---

### Risk 5: Integration Complexity (Low Probability, Low Impact)

**Scenario:** Multiple AI tools have different expectations for context format.

**Mitigation:**

1. Unified artifact format for all tools
2. Per-tool integration documentation
3. Example code for each tool
4. Lightweight variant for basic access
5. API endpoint option in future if needed

**Owner:** Architecture + Integration team

---

## Success Acceptance Criteria

### Functional

✅ All 7 artifacts generated and valid  
✅ Artifacts in docs/ai/context/ with correct names  
✅ JSON artifacts pass `jq .` validation  
✅ Markdown articles render without errors  
✅ ai-module-map.json lists all 13+ modules with correct layers  
✅ ai-layer-model.json matches module-boundaries.json rules  
✅ ai-dependency-graph.json matches infra-audit.ts output  
✅ ai-architecture-brain.json generates without warnings  
✅ Schema validation passes for all artifacts

### Governance

✅ AI-Guard successfully loads ai-architecture-brain.json  
✅ AI-Guard validates imports against rules from artifact  
✅ Infra-audit triggers artifact regeneration  
✅ No conflicts between artifact rules and documented rules  
✅ Pre-commit hook regenerates artifacts on source changes  
✅ CI validates artifact freshness on every push

### AI Tool Integration

✅ Copilot can load and use ai-context-mini.json  
✅ GitNexus can load ai-dependency-graph.json for impact analysis  
✅ SpecKit can load ai-architecture-summary.md + ai-layer-model.json  
✅ Claude can parse artifacts in context  
✅ Manual testing completed for all tools

### Performance

✅ Artifact generation < 5 seconds  
✅ Total artifact size < 15MB  
✅ ai-context-mini < 1MB  
✅ No regression in CI/CD performance  
✅ Benchmarks pass on every generation

### Quality

✅ 95%+ code coverage for generation logic  
✅ All unit tests pass  
✅ All integration tests pass  
✅ All snapshot tests match expectations  
✅ Documentation complete and reviewed  
✅ No breaking changes to existing systems

### Deployment

✅ Artifacts committed to repository  
✅ CI validation passing on main branch  
✅ Pre-commit hooks deployed to all environments  
✅ Team trained on artifact usage  
✅ Troubleshooting guide complete  
✅ Runbook for artifact regeneration documented

---

## Timeline & Effort Estimates

| Phase          | Week        | Tasks                   | Est. Hours     | Role                   |
| -------------- | ----------- | ----------------------- | -------------- | ---------------------- |
| Design         | 1           | 1.1-1.6                 | 40             | Architect + Senior Eng |
| Implementation | 2           | 2.1-2.5                 | 80             | 2× Senior Engineers    |
| Testing        | 3-4         | 3.1-3.4                 | 40             | QA + Integration       |
| Documentation  | 4           | 4.1-4.3                 | 20             | Tech Writer + Arch     |
| Deployment     | 4           | Pre-commit, CI, Release | 10             | DevOps                 |
| **Total**      | **1 month** | **35 tasks**            | **~190 hours** | **3-4 engineers**      |

---

## Non-Goals

This stage explicitly does **NOT**:

❌ Modify the runtime behavior of any service  
❌ Change how tenants are isolated or provisioned  
❌ Alter license enforcement or version checking  
❌ Modify database schemas or migrations  
❌ Change how attempts are graded  
❌ Affect worker job processing  
❌ Impact end-user facing features  
❌ Create new API endpoints  
❌ Require new CI secrets or environment variables  
❌ Replace existing architecture documentation  
❌ Require developer manual updates to artifacts  
❌ Create runtime dependencies on artifact format

---

## Rollback Strategy

**If artifacts become corrupted:**

1. Delete docs/ai/context/ directory
2. Run `bun run generate:ai-context`
3. Verify artifacts recreated successfully
4. Commit changes

**If generation script has bugs:**

1. Fix bugs in scripts/ai-context/
2. Revert to previous working version if needed
3. Regenerate artifacts
4. No data loss; state is reconstruction only

**If AI tools report incompatibility:**

1. Review error in AI tool logs
2. Check artifact schema validity
3. Regenerate with `--verbose` for debugging
4. File issue with AI tool vendor if needed
5. Can disable artifact usage without affecting runtime

---

## Final Compliance Statement

**Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.**

This plan:

✅ Does not access tenant data  
✅ Does not bypass middleware  
✅ Does not instantiate DB connections  
✅ Does not embed runtime dependencies  
✅ Does not affect grading, isolation, or versioning systems  
✅ Respects all architectural layer boundaries  
✅ Follows all ADR decisions  
✅ Maintains backward compatibility

The AI Architecture Context Layer is a **pure governance infrastructure enhancement** that enables AI-assisted development without compromising platform stability or security.

---

**Plan Status:** ✅ **READY FOR IMPLEMENTATION**

**Approved By:** [Architecture Lead]  
**Date:** 2026-03-09  
**Branch:** spec/infra-009-ai-architecture-context  
**Next Step:** Begin Phase 2 implementation
