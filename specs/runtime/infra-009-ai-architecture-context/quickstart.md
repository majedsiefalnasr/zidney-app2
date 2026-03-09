# Quickstart: AI Architecture Context for Developers

**Stage:** STAGE_INFRA_09_AI_ARCHITECTURE_CONTEXT  
**Audience:** Developers, architects, AI tool integrators  
**Purpose:** Quick reference for understanding and using AI context artifacts

---

## What Is AI Context?

AI context artifacts are **machine-readable metadata** about Zidney's architecture that enable:

- 🤖 AI tools (Copilot, Claude, GitNexus) to understand architecture
- 🛡️ Automated validation that generated code respects layer boundaries
- 📊 Impact analysis before making changes
- 🎯 Architecture-aware code suggestions

**Key insight:** AI tools can now say "that violates the domain layer constraint" without human intervention.

---

## 7 Artifacts at a Glance

| Artifact                   | Format   | Purpose                    | Size     | For Whom        |
| -------------------------- | -------- | -------------------------- | -------- | --------------- |
| ai-architecture-summary.md | Markdown | Overview of all systems    | 5-10 KB  | Everyone        |
| ai-module-map.json         | JSON     | Module → Layer mapping     | 5 KB     | Validators      |
| ai-layer-model.json        | JSON     | Layer rules & constraints  | 2-3 KB   | Validators      |
| ai-dependency-graph.json   | JSON     | Dependency relationships   | 8-10 KB  | Impact analysis |
| ai-runtime-map.json        | JSON     | Services → Modules         | 2-3 KB   | DevOps          |
| ai-architecture-brain.json | JSON     | Comprehensive intelligence | 12-15 KB | Governance      |
| ai-context-mini.json       | JSON     | Lightweight bootstrap      | < 1 KB   | Copilot         |

---

## Where Are They?

```
docs/ai/context/
├─ ai-architecture-summary.md
├─ ai-module-map.json
├─ ai-layer-model.json
├─ ai-dependency-graph.json
├─ ai-runtime-map.json
├─ ai-architecture-brain.json
├─ ai-context-mini.json
├─ schemas/
│  ├─ ai-module-map.schema.json
│  ├─ ai-layer-model.schema.json
│  └─ ... (JSON schemas for validation)
└─ README.md (documentation)
```

---

## Quick Understanding: The 4-Layer Model

```
┌─────────────────────────────────────────┐
│       UI LAYER (Vue 3)                  │
│  - apps/mmc, apps/backoffice, etc.     │
│  - shadcn-vue components               │
│  - NO business logic                    │
└──────────────────┬──────────────────────┘
                   │ (uses api-client)
┌──────────────────▼──────────────────────┐
│      RUNTIME LAYER (Bun)                │
│  - apps/api (Hono)                     │
│  - apps/worker (Queue processor)       │
│  - Central processing                   │
└──────────────────┬──────────────────────┘
                   │ (calls domain logic)
┌──────────────────▼──────────────────────┐
│      DOMAIN LAYER                       │
│  - packages/domain-core                │
│  - Pure business logic                 │
│  - Framework-independent               │
└──────────────────┬──────────────────────┘
                   │ (uses types & validation)
┌──────────────────▼──────────────────────┐
│    INFRASTRUCTURE LAYER                 │
│  - packages/logger                     │
│  - packages/redis-utils                │
│  - Database drivers                    │
└─────────────────────────────────────────┘
```

**Golden Rule:** Arrows flow DOWN only. No upward imports.

---

## Using the Artifacts

### 1. Reading ai-architecture-summary.md

```bash
# View in terminal
cat docs/ai/context/ai-architecture-summary.md

# View in VS Code
code docs/ai/context/ai-architecture-summary.md

# View rendered
# (if published to docs site)
open https://docs.zidney.local/architecture
```

**What it tells you:**

- System overview and all 4 layers
- What each app and package does
- Architecture principles
- Key constraints

**When to use:** Getting oriented, understanding system design, writing documentation.

---

### 2. Checking Layer Assignment

**Task:** "What layer is `packages/validation` in?"

```bash
# Option 1: Read ai-module-map.json
jq '.modules."packages/validation"' docs/ai/context/ai-module-map.json

# Output:
# {
#   "layer": "domain",
#   "type": "package",
#   "description": "Input validation libraries"
# }
```

**Answer:** Domain layer

---

### 3. Understanding Import Rules

**Task:** "Can UI import from domain-core?"

```bash
# Read ai-layer-model.json
jq '.rules.ui.imports_forbidden' docs/ai/context/ai-layer-model.json

# Output:
# [
#   "packages/domain-core",
#   "packages/logger",
#   "apps/*"
# ]
```

**Answer:** NO – it's in the forbidden list. That would violate architecture.

---

### 4. Checking What Depends On a Module

**Task:** "What will break if I change `packages/types`?"

```bash
# Query ai-dependency-graph.json
jq '.reverse_dependencies."packages/types"' \
  docs/ai/context/ai-dependency-graph.json

# Output:
# [
#   "packages/domain-core",
#   "packages/ui-system",
#   "apps/api",
#   "apps/worker"
# ]
```

**Answer:** 4 modules depend on packages/types. Refactor carefully!

---

### 5. Understanding Architecture Health

**Task:** "How healthy is the architecture?"

```bash
# Query ai-architecture-brain.json
jq '.architecture_score' docs/ai/context/ai-architecture-brain.json

# Output: 98

jq '.violations' docs/ai/context/ai-architecture-brain.json

# Output: [] (empty = no violations)
```

**Answer:** Excellent health, no violations detected.

---

## For AI Tool Integration

### Using ai-context in Copilot

```markdown
# Include in Copilot system prompt:

Here is the architecture context for the Zidney codebase:

## Layers

- UI: Vue 3 (apps/mmc, apps/backoffice, apps/frontoffice)
- Runtime: Bun + Hono (apps/api, apps/worker)
- Domain: Pure business logic (packages/domain-core)
- Infrastructure: Services, logging (packages/logger, etc.)

## Import Rules

- UI CANNOT import from: domain-core, logger, redis-utils, apps/\*
- Domain CANNOT import from: ui-system, api-client, logger, apps/\*

## Critical Modules

- packages/domain-core: Attempt logic, grading (DO NOT modify lightly)
- packages/types: Shared interfaces (changes affect everything)

Before proposing changes, verify:

1. Module assignment matches layer rules
2. New imports don't violate layer constraints
3. Changes to packages/types have minimal blast radius
```

---

### Using ai-context in GitNexus

```typescript
// GitNexus can analyze impact using ai-dependency-graph.json

const graph = loadArtifact('ai-dependency-graph.json')

function getBlastRadius(module) {
  const directDeps = graph.reverse_dependencies[module] || []
  const transitiveDeps = transitiveDependents(module, graph)

  return {
    direct: directDeps.length,
    transitive: transitiveDeps.length,
    risk: transitiveDeps.length > 5 ? 'HIGH' : 'MEDIUM',
  }
}

// Usage:
const impact = getBlastRadius('packages/types')
// Output: {direct: 3, transitive: 8, risk: 'HIGH'}
// → Refactoring packages/types is risky!
```

---

### Using ai-context in SpecKit

```markdown
# In SpecKit planning phase:

Load architecture summary to understand constraints:

- Feature must be in runtime layer (api or worker)
- Cannot import from UI components
- Domain layer changes must be carefully gated
- Snapshot integrity must be preserved

Validate plan against layer model:
For each task in plan {

- Check module target is valid
- Verify task doesn't add upward dependencies
- Flag if modifying high-risk modules (packages/types, domain-core)
  }
```

---

## Keeping Artifacts Fresh

### Check Freshness

```bash
# View generation timestamp
jq '.generated_at' docs/ai/context/ai-architecture-summary.md.json

# Calculate age
GENERATED=$(jq -r '.generated_at' docs/ai/context/ai-module-map.json)
NOW=$(date -u +%s)
GENERATED_SECS=$(date -f "%Y-%m-%dT%H:%M:%SZ" "$GENERATED" +%s)
AGE_SECS=$((NOW - GENERATED_SECS))
AGE_DAYS=$((AGE_SECS / 86400))

echo "Artifacts are $AGE_DAYS days old"

# If > 7 days: consider regenerating
# If > 30 days: MUST regenerate
```

### Regenerate Artifacts

```bash
# Automatic (on every commit)
# - Pre-commit hook runs: bun run generate:ai-context
# - Staged artifacts committed automatically

# Manual regeneration
bun run generate:ai-context

# Forced regeneration (ignore timestamps)
bun run generate:ai-context --force

# Verbose output (debugging)
bun run generate:ai-context --verbose
```

**When to regenerate:**

- ✅ Before committing ADR changes
- ✅ Before committing module-boundaries.json changes
- ✅ If artifacts are > 7 days old
- ✅ If AI-Guard reports stale context errors
- ✅ If dependency graph seems inconsistent

---

## Troubleshooting

### "Artifacts not found"

```bash
# Artifacts don't exist
Error: docs/ai/context/ not found

# Solution:
bun run generate:ai-context
```

---

### "Schema validation error"

```bash
# Artifact has invalid JSON
Error: Schema validation failed

# Debug with:
jq . < docs/ai/context/ai-module-map.json

# If invalid JSON, regenerate:
bun run generate:ai-context
```

---

### "Artifact is stale"

```bash
# Artifacts > 30 days old
Warning: AI context is 45 days old. Regenerate?

# Solution:
bun run generate:ai-context
git add docs/ai/context/
git commit -m "chore: regenerate AI context"
```

---

### "Version mismatch"

```bash
# Artifact schema version doesn't match
Error: Expected schema_version 1.0.0, got 2.0.0

# Solution:
# Your tool may need updating, or artifacts are from future version
# Check tool documentation for compatibility
```

---

### "Import violation not detected"

```bash
# You added a forbidden import, but validation didn't catch it

# Regenerate artifacts (might be stale):
bun run generate:ai-context

# Check freshness:
jq '.generated_at' docs/ai/context/ai-architecture-brain.json

# If still failing, check ai-guard manually:
bun run validate:architecture
```

---

## Key Concepts

### What is schema_version?

Version number for artifact structure (e.g., "1.0.0").

- MAJOR bump: Breaking changes (field removed or renamed)
- MINOR bump: New optional fields
- PATCH bump: Documentation updates

Tools check schema_version to ensure compatibility.

**Current:** 1.0.0

---

### What is generated_at?

ISO-8601 timestamp of when artifacts were generated.

Example: `2026-03-09T12:00:00Z`

Used to track freshness. Artifacts > 7 days old warrant regeneration.

---

### What is source_metadata?

Traceability information showing which source files generated each artifact.

```json
"source_metadata": {
  "module_boundaries_hash": "sha256:abc123...",
  "infra_audit_timestamp": "2026-03-09T11:55:00Z"
}
```

Enables intelligent change detection: regenerate only if sources changed.

---

### What are rules_active?

Import rules defining what each layer can and cannot import.

Example:

```json
"rules.ui.imports_forbidden": [
  "packages/domain-core",
  "apps/*"
]
```

Used by ai-guard.ts and other validators to enforce architecture.

---

### What is architecture_score?

0-100 score indicating architecture health.

- 100: Perfect (no violations)
- < 100: Violations exist

Calculated from number of violations detected.

---

## Common Questions

**Q: Do I need to manually edit these artifacts?**

A: No. Artifacts are **generated automatically** from source metadata. Edit source files instead:

- ADRs → affects ai-architecture-summary.md
- module-boundaries.json → affects ai-layer-model.json, etc.

**Q: What if I find an error in an artifact?**

A: Check the source:

- Artifact error? → Check generation logic
- Layer rule wrong? → Fix module-boundaries.json
- Dependencies wrong? → Run infra-audit to scan code

**Q: How often should I regenerate?**

A: Automatically on every commit (pre-commit hook). Manual regeneration needed only if pre-commit fails or sources change outside commits.

**Q: Which artifact should I read first?**

A: Start with ai-architecture-summary.md (human-readable overview), then dive into specific artifacts as needed.

**Q: Can I use artifacts in my CI/CD pipeline?**

A: Yes! Load artifacts to validate architecture before merging. Example: GitNexus uses ai-dependency-graph.json for impact analysis.

---

## Resources

- 📖 [data-model.md](./data-model.md) — Detailed schema specs for all artifacts
- 🏗️ [plan.md](./plan.md) — Implementation roadmap
- 📝 [research.md](./research.md) — Investigation findings
- 📋 [contracts/](./contracts/) — Interface specifications
- 🔍 [docs/ai/context/README.md](../../ai/context/README.md) — Full documentation

---

## Next Steps

1. ✅ Read this quickstart
2. ✅ Review ai-architecture-summary.md
3. ✅ Explore ai-layer-model.json to understand rules
4. ✅ Run `bun run generate:ai-context` to populate artifacts
5. ✅ Share artifacts with your AI assistant for better suggestions

---

**Quickstart Version:** 1.0.0  
**Last Updated:** 2026-03-09  
**Status:** Ready to use
