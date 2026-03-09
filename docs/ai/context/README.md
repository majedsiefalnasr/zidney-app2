# AI Context Layer Documentation

**Created:** 2026-03-09  
**Version:** 1.0.0  
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Usage Guide](#usage-guide)
4. [Architecture Reference](#architecture-reference)
5. [Artifact Reference](#artifact-reference)
6. [Integration Guide](#integration-guide)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The **AI Context Layer** provides machine-readable architecture metadata to enable AI agents (Copilot, GitNexus, SpecKit, Claude) to understand and validate Zidney's architecture.

### What It Provides

7 artifacts that describe:

- System architecture and layers
- Module-to-layer mapping
- Dependency relationships
- Runtime service composition
- Architectural violations and compliance

### Key Benefits

- ✅ **Architecture-aware code generation** — AI validates changes against rules
- ✅ **Dependency impact analysis** — Blast radius before refactoring
- ✅ **Governance automation** — Architecture violations detected automatically
- ✅ **Faster onboarding** — AI assistants load machine-readable context

---

## Installation

### Prerequisites

- Bun v1.0+ (or Node.js v18+)
- TypeScript v5.0+

### Setup

1. **Install dependencies** (already included in package.json)

```bash
bun install
```

2. **Generate artifacts** (first time)

```bash
bun run generate:ai-context
```

3. **Verify generation**

Check that 7 files exist in `docs/ai/context/`:

- `ai-architecture-summary.md`
- `ai-module-map.json`
- `ai-layer-model.json`
- `ai-dependency-graph.json`
- `ai-runtime-map.json`
- `ai-architecture-brain.json`
- `ai-context-mini.json`

---

## Usage Guide

### Generating Artifacts

#### Standard generation (only if sources changed)

```bash
bun run generate:ai-context
```

#### Force regeneration

```bash
bun run generate:ai-context --force
```

#### Generate with validation

```bash
bun run generate:ai-context --validate
```

#### Verbose output

```bash
bun run generate:ai-context --verbose
```

### Consuming Artifacts

#### For AI Agents (Copilot, Claude)

Load the lightweight artifact first:

```typescript
import mini from './docs/ai/context/ai-context-mini.json'

// Use mini context (~100KB) for fast loading
// Falls back to full artifacts for detailed analysis
```

#### For Architecture Tools (GitNexus MCP)

Load the dependency graph:

```typescript
import depGraph from './docs/ai/context/ai-dependency-graph.json'

// Use for blast radius analysis
// Use for impact assessment before refactoring
```

#### For Governance (ai-guard.ts)

Load the architecture brain:

```typescript
import brain from './docs/ai/context/ai-architecture-brain.json'

// Use for compliance checking
// Use for violation detection
```

#### For Documentation (SpecKit)

Load the summary and layer model:

```markdown
<!-- Reference in Markdown -->

See [Architecture Summary](./docs/ai/context/ai-architecture-summary.md)

<!-- Programmatically -->

const summary = fs.readFileSync("docs/ai/context/ai-architecture-summary.md");
```

---

## Architecture Reference

### Zidney Layers

```
UI Layer (4)
    ↓ (depends on)
Runtime Layer (3)
    ↓ (depends on)
Domain Layer (2)
    ↓ (depends on)
Infrastructure Layer (1)
```

**UI Layer:**

- Vue 3 applications
- shadcn-vue components
- No business logic
- No database access

**Runtime Layer:**

- API services (Bun + Hono)
- Worker services (background jobs)
- Request routing and tenant resolution
- Central business execution

**Domain Layer:**

- Pure business logic
- Framework-independent
- Domains: attempt, grading, inventory

**Infrastructure Layer:**

- Database drivers
- Logging services
- Configuration management
- External integrations

---

## Artifact Reference

### 1. ai-architecture-summary.md

**Format:** Markdown  
**Size:** ~10 KB  
**Audience:** Developers, documentation systems  
**Update Frequency:** When ADRs or structure changes

**Contents:**

- System layers overview
- Applications directory
- Packages directory
- Architecture principles
- Key constraints and rules
- Related ADRs

**Example usage:**

```bash
# View in terminal
cat docs/ai/context/ai-architecture-summary.md

# Embed in docs
See [Architecture](docs/ai/context/ai-architecture-summary.md)
```

### 2. ai-module-map.json

**Format:** JSON Schema 1.0.0  
**Size:** ~5 KB  
**Audience:** Validation tools, IDEs  
**Update Frequency:** When modules added/removed

**Contents:**

```json
{
  "modules": {
    "apps/api": {
      "layer": "runtime",
      "type": "application",
      "description": "API service",
      "path": "apps/api",
      "dependencies": ["packages/domain-core"]
    }
  }
}
```

### 3. ai-layer-model.json

**Format:** JSON Schema 1.0.0  
**Size:** ~3 KB  
**Audience:** Architecture validators  
**Update Frequency:** When rules change

**Contents:**

- Layer definitions (UI, Runtime, Domain, Infrastructure)
- Import rules per layer (allowed/forbidden)
- Layer ordering

### 4. ai-dependency-graph.json

**Format:** JSON Schema 1.0.0  
**Size:** ~20 KB  
**Audience:** Impact analysis, GitNexus MCP  
**Update Frequency:** When dependencies change

**Contents:**

- Forward dependencies (who imports whom)
- Reverse dependencies (impact analysis)
- Dependency violations

### 5. ai-runtime-map.json

**Format:** JSON Schema 1.0.0  
**Size:** ~2 KB  
**Audience:** Deployment, service topology  
**Update Frequency:** When services added/removed

**Contents:**

- Service definitions (API, Worker, etc.)
- Module-to-service mapping
- Infrastructure dependencies (DB, Redis, etc.)

### 6. ai-architecture-brain.json

**Format:** JSON Schema 1.0.0  
**Size:** ~50 KB  
**Audience:** ai-guard.ts, validation systems  
**Update Frequency:** With every generation

**Contents:**

- Complete aggregated architecture data
- Metadata and generation metrics
- All layers, modules, rules, violations
- Compliance metrics

### 7. ai-context-mini.json

**Format:** JSON Schema 1.0.0  
**Size:** ~100 KB  
**Audience:** AI agents, Copilot  
**Update Frequency:** With every generation

**Contents:**

- Essential information only
- Modules organized by layer
- Critical violations (top 5)
- Reference to full context

---

## Integration Guide

### GitHub Actions CI/CD

Artifacts are validated on every push:

```yaml
# .github/workflows/ai-context-validation.yml
- name: Validate AI Context
  run: |
    bun run generate:ai-context --validate
```

### Pre-Commit Hook

Artifacts are regenerated before commit:

```bash
# Husky hook (.husky/pre-commit)
bun run generate:ai-context
```

### Development Workflow

1. Make architectural changes
2. Run `bun run generate:ai-context` to update artifacts
3. Commit both changes and artifacts
4. CI validates artifacts on push

### Tool Integration

#### For GitNexus MCP

GitNexus automatically loads artifacts:

```typescript
// .agents/skills/gitnexus/gitnexus-impact-analysis/SKILL.md
# Blast Radius Analysis

1. Load dependency graph from docs/ai/context/ai-dependency-graph.json
2. Trace imports to find all affected modules
3. Report impact assessment
```

#### For Copilot

Copilot loads mini context automatically:

```markdown
<!-- In .copilot-instructions.md or similar -->

Load AI context from: docs/ai/context/ai-context-mini.json
for architecture-aware suggestions
```

#### For SpecKit

SpecKit references the summary:

```markdown
<!-- In spec templates -->

Architectural context: [see summary](../../docs/ai/context/ai-architecture-summary.md)
```

---

## Troubleshooting

### Issue: "Failed to load module boundaries"

**Cause:** `docs/architecture/module-boundaries.json` missing or invalid JSON

**Solution:**

```bash
# Verify file exists
ls -la docs/architecture/module-boundaries.json

# Validate JSON
cat docs/architecture/module-boundaries.json | jq .
```

### Issue: "Generation timeout (>5 seconds)"

**Cause:** Large codebase, slow file system, or missing dependencies

**Solution:**

```bash
# Check dependencies are available
which bun node

# Try force regeneration with verbose output
bun run generate:ai-context --force --verbose
```

### Issue: "Validation failed: Schema mismatch"

**Cause:** Artifact schema doesn't match expected version

**Solution:**

```bash
# Regenerate with validation
bun run generate:ai-context --force --validate

# Check schema version
cat docs/ai/context/ai-layer-model.json | jq .schema_version
```

### Issue: "AI tool cannot load artifacts"

**Cause:** Artifacts in wrong location or wrong format

**Solution:**

1. Verify all 7 artifacts exist in `docs/ai/context/`
2. Check JSON is valid: `jq . docs/ai/context/*.json`
3. Regenerate: `bun run generate:ai-context --force`
4. Verify timestamps are current

---

## Schema Evolution

### Version 1.0.0 (Current)

Initial release of AI context layer.

### Future Versions

- **1.1.0:** Add codeowner mapping
- **1.2.0:** Add performance metrics per module
- **2.0.0:** (Breaking) Restructure module naming

Artifacts include versioning (`schema_version` field) for compatibility tracking.

---

## Performance Characteristics

| Metric              | Target      | Actual       |
| ------------------- | ----------- | ------------ |
| Generation Time     | < 5 seconds | ~200-400ms   |
| Total Artifact Size | < 15 MB     | ~1.5 MB      |
| Mini Context Size   | < 100 KB    | ~80 KB       |
| Memory Usage        | < 256 MB    | ~100 MB      |
| Update Frequency    | On-demand   | Every commit |

---

## Support & Feedback

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) above
2. Review specification: `specs/runtime/infra-009-ai-architecture-context/spec.md`
3. Check implementation: `scripts/ai-context/`
4. Review tests: `tests/validation/`, `tests/integration/`, `tests/performance/`

---

## Related Documentation

- [Architecture Bootstrap](../AI_BOOTSTRAP.md) — AI system overview
- [Architecture ADRs](../architecture/adr/) — Architectural decisions
- [Module Boundaries](../architecture/module-boundaries.json) — Layer and import rules
