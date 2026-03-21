# Specification: STAGE_INFRA_09_AI_ARCHITECTURE_CONTEXT

**Stage Name:** AI Architecture Context Layer  
**Phase:** PHASE_01_PLATFORM_FOUNDATION  
**Stage Number:** INFRA-009  
**Branch:** spec/infra-009-ai-architecture-context  
**Status:** Specification Ready for Planning  
**Last Updated:** 2026-03-09

---

## Feature Overview

### What Is Being Built

This stage establishes an **AI-consumable architecture context layer** for the Zidney monorepo.
Traditional documentation is written for human consumption. AI agents (Copilot, Claude, Cursor,
SpecKit, GitNexus MCP) require **structured, machine-readable metadata** that describes:

- Architectural layering rules
- Module boundaries and roles
- Dependency relationships
- Governance constraints
- System architecture overview
- Runtime service composition

### Core Objective

Transform authoritative architecture metadata into AI-optimized context artifacts that enable:

1. **Architecture-aware code generation** — AI can validate proposed changes against actual
   architecture rules
2. **Dependency impact analysis** — AI can trace blast radius before refactoring
3. **Module placement decisions** — AI can suggest correct package/layer for new code
4. **Governance compliance** — AI can automatically check ADR alignment
5. **Faster onboarding** — New AI assistants load machine-readable context instead of parsing docs

### Why This Matters

Without a structured AI context layer:

- AI agents must parse unstructured documentation (prone to misinterpretation)
- AI agents may generate code that violates architecture without realizing
- AI agents cannot reliably validate dependency boundaries
- Each AI tool needs custom parsing logic for architecture knowledge
- Architecture drift is harder to detect in AI-generated code

With this stage:

- AI agents load a single, authoritative context file
- Architecture rules are machine-readable and unambiguous
- AI tools can validate changes before they're proposed
- Architecture governance becomes verifiable and automated
- AI-assisted development becomes **architecture-safe by default**

### Which Zidney Systems Are Affected

- **Affected:** AI development workflows, architectural governance pipeline, AI-Guard system
- **Not affected:** Tenant isolation, license enforcement, attempt engine, runtime behavior
- This is a **governance infrastructure stage**, not a runtime feature

---

## Constitutional Compliance Declaration

### Compliance Checklist

Per Zidney Constitution v1.2.0:

- ✅ **No cross-tenant access** — This stage operates on shared architecture metadata, not tenant
  data
- ✅ **No middleware bypass** — Not applicable; this is a governance layer
- ✅ **No grading outside worker** — Not applicable; no grading involved
- ✅ **No direct DB instantiation** — Not applicable; no database access required
- ✅ **Snapshot integrity preserved** — Not applicable; no snapshot modifications
- ✅ **Transaction boundaries respected** — Not applicable; no transactions required
- ✅ **Version enforcement maintained** — Not applicable; pure metadata generation

### Constitutional Statement

**This stage is compliant with Zidney Constitution v1.2.0 — No violations detected.**

The AI context layer is a pure governance artifact. It does not interact with tenant databases,
license enforcement, attempt engines, or any runtime system. It operates entirely on static
architecture metadata and governance documents.

---

## Isolation Impact Analysis

### Database Access

**Scope:** None. This stage operates on architecture metadata only, not data.

**Tenant Resolution:** Not required. Context generation is stateless and tenant-agnostic.

**Connection Pool:** Not applicable. No database connections required.

**Resolver Middleware:** Not applicable. No HTTP routes involved.

### Data Isolation Confirmation

✅ **No shared tenant data accessed or generated.**  
✅ **No cross-tenant operations.**  
✅ **No data mutation.**

The AI context artifacts are **governance metadata only**. They describe the architecture statically
and do not access, modify, or leak any tenant data.

---

## License & Version Enforcement

### Requirements Analysis

**License Middleware Required:** No  
**Limit Enforcement Required:** No  
**Schema Version Check Required:** No  
**Product Version Check Required:** No

This is a **governance infrastructure stage**, not a runtime feature. It does not expose any
endpoints, enforce limits, or interact with the license system. The generated context artifacts are
read-only metadata.

### Impact on Existing Systems

None. This stage:

- Does not modify the license middleware
- Does not alter version enforcement logic
- Does not change schema version handling
- Does not affect product compatibility checks

---

## Data Model Analysis

### New Tables

**None.** This stage does not introduce database changes.

### Modified Tables

**None.** This stage does not alter schema.

### Migration Impact

**None.** No database migrations required.

### New Artifacts Generated (Governance Metadata)

The following **architecture context artifacts** are generated into `docs/ai/context/`:

#### 1. **ai-architecture-summary.md**

**Purpose:** Human + AI readable overview of system architecture  
**Format:** Markdown  
**Scope:** Condensed view of all systems  
**Consumers:** AI assistants, developers, documentation systems

**Content includes:**

- System layers overview (UI, Runtime, Domain, Infrastructure)
- Applications directory (apps/api, apps/worker, apps/mmc, apps/backoffice, apps/frontoffice)
- Packages directory (packages/domain-core, packages/ui-system, packages/api-client,
  packages/logger, etc.)
- Architecture principles summary
- Key constraints and rules

#### 2. **ai-module-map.json**

**Purpose:** Machine-readable mapping of every module to its layer

**Format:** JSON  
**Structure:**

```json
{
  "modules": {
    "apps/api": {
      "layer": "runtime",
      "type": "application",
      "description": "Main API service (Bun, Hono)"
    },
    "apps/worker": {
      "layer": "runtime",
      "type": "application",
      "description": "Background job processor"
    },
    "packages/domain-core": {
      "layer": "domain",
      "type": "package",
      "description": "Business logic and domain models"
    },
    "packages/ui-system": {
      "layer": "ui",
      "type": "package",
      "description": "Shared UI components (shadcn-vue)"
    }
  }
}
```

**Consumers:** AI-Guard, architecture validators, IDE tools

#### 3. **ai-layer-model.json**

**Purpose:** Architecture layer definitions and dependency rules

**Format:** JSON  
**Structure:**

```json
{
  "layers": ["ui", "runtime", "domain", "infrastructure"],
  "rules": {
    "ui": {
      "imports_allowed": [
        "packages/ui-system",
        "packages/api-client",
        "packages/types",
        "packages/config"
      ],
      "imports_forbidden": ["packages/domain-core", "apps/*"]
    },
    "runtime": {
      "imports_allowed": [
        "packages/domain-core",
        "packages/infrastructure",
        "packages/validation",
        "packages/logger"
      ],
      "imports_forbidden": ["packages/ui-system", "apps/*"]
    },
    "domain": {
      "imports_allowed": ["packages/validation", "packages/types"],
      "imports_forbidden": ["packages/ui-system", "packages/api-client", "apps/*"]
    },
    "infrastructure": {
      "imports_allowed": [],
      "imports_forbidden": [
        "packages/ui-system",
        "packages/api-client",
        "packages/domain-core",
        "apps/*"
      ]
    }
  }
}
```

**Consumers:** Architecture validators, linters, AI agents

#### 4. **ai-dependency-graph.json**

**Purpose:** Machine-readable system dependency graph

**Format:** JSON  
**Derived from:** `infra-dependency-graph.json` output from `scripts/infra-audit.ts`

**Structure:**

```json
{
  "modules": {
    "apps/api": {
      "dependencies": ["packages/domain-core", "packages/validation", "packages/logger"]
    },
    "apps/worker": {
      "dependencies": ["packages/domain-core", "packages/logger"]
    },
    "packages/domain-core": {
      "dependencies": ["packages/validation", "packages/types"]
    }
  },
  "reverse_dependencies": {
    "packages/types": ["packages/domain-core", "packages/ui-system", "apps/api", "apps/worker"]
  }
}
```

**Consumers:** Impact analysis tools, refactoring safety checks, AI agents

#### 5. **ai-runtime-map.json** (Reference)

**Purpose:** Maps deployed runtime services to their module origins

**Format:** JSON  
**Structure:**

```json
{
  "services": {
    "api": {
      "module": "apps/api",
      "runtime": "Bun",
      "framework": "Hono",
      "depends_on": ["postgres", "redis"]
    },
    "worker": {
      "module": "apps/worker",
      "runtime": "Bun",
      "job_processor": "Redis-based",
      "depends_on": ["postgres", "redis"]
    }
  }
}
```

**Consumers:** Deployment systems, infrastructure planning

#### 6. **ai-architecture-brain.json**

**Purpose:** Comprehensive architecture intelligence document

**Format:** JSON  
**Contains:**

- Module layer assignments
- Dependency graph
- Forbidden dependencies detected
- Architecture scoring/metrics
- Rule violations (if any)
- Hotspots and complexity analysis

**Generated by:** `scripts/infra-audit.ts --output ai-architecture-brain.json`

**Consumers:** Architecture governance system, AI-Guard, linters

#### 7. **ai-context-mini.json**

**Purpose:** Lightweight context for fast AI bootstrap

**Format:** JSON (minimal)  
**Content:**

- Layer definitions
- Module-to-layer mapping
- Key constraints
- Forbidden dependency rules

**Consumers:** Fast-path context loading in IDE tools, Copilot plugins

### Backward Compatibility

✅ **Fully backward compatible.** These artifacts are new and do not modify existing schemas or
tables.

### Versioning Impact

No schema version bump required. These are governance metadata, not data model changes.

---

## Observability & Governance

### Structured Logging

Artifact generation is logged using structured JSON logging:

**Log fields:**

```json
{
  "timestamp": "ISO-8601",
  "level": "info|warn|error",
  "service": "infra-audit",
  "event": "ai_context_generated",
  "artifacts_generated": [
    "ai-architecture-summary.md",
    "ai-module-map.json",
    "ai-layer-model.json",
    "ai-dependency-graph.json"
  ],
  "total_modules": 13,
  "layer_distribution": {
    "ui": 5,
    "runtime": 2,
    "domain": 2,
    "infrastructure": 4
  },
  "timestamp_generated": "2026-03-09T12:00:00Z",
  "duration_ms": 245
}
```

### Validation Metrics

The following metrics are collected during context generation:

- **module_count** — Total modules discovered
- **layer_violations** — Forbidden dependencies found
- **context_size_bytes** — Total size of generated artifacts
- **generation_duration_ms** — Time required to generate all artifacts
- **schema_freshness_days** — Days since last architecture audit

### Error Contract

If artifact generation fails:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ARTIFACT_GENERATION_FAILED",
    "message": "Failed to generate ai-dependency-graph.json: invalid input from infra-audit",
    "details": {
      "artifact": "ai-dependency-graph.json",
      "reason": "infra-audit-report.json malformed"
    }
  }
}
```

---

## Failure Modes & Recovery

### Failure Mode 1: Stale Architecture Metadata

**Scenario:** Infra-audit has not been run recently; module list is stale

**Detection:** Version timestamp in artifacts is older than source code by >7 days

**Recovery:**

1. Run `bun scripts/infra-audit.ts` to regenerate artifacts
2. Commit new artifacts to repository
3. Notify developers that architecture context has been updated

**Mitigation:** CI pipeline runs infra-audit on every commit; PR validation checks artifact
freshness

### Failure Mode 2: Architecture Violation Undetected

**Scenario:** New forbidden import exists in code, but isn't reflected in dependency graph

**Detection:** AI-Guard or CI linting detects violation not found in dependency graph

**Recovery:**

1. Rerun `bun scripts/infra-audit.ts --verbose` to regenerate with detailed output
2. Update module-boundaries.json if new constraint is legitimate
3. Regenerate context artifacts

**Mitigation:** AI-Guard and infra-audit both validate independently; violations trigger warnings

### Failure Mode 3: Conflicting Architecture Context

**Scenario:** ai-layer-model.json and module-boundaries.json define conflicting rules

**Detection:** Architecture validator reports inconsistency

**Recovery:**

1. Review both files for conflicts
2. Assert authority (module-boundaries.json is source of truth)
3. Regenerate ai-layer-model.json to match
4. Update any documentation that's out of sync

**Mitigation:** Governance tooling validates consistency on every artifact generation

### Failure Mode 4: AI Tool Cannot Parse Context Artifact

**Scenario:** AI tool (Copilot, Claude) receives ai-dependency-graph.json but can't parse it

**Detection:** AI tool reports JSON schema error

**Recovery:**

1. Verify JSON validity with `jq . < ai-dependency-graph.json`
2. Check against documented schema in this specification
3. Regenerate artifact with detailed error logging
4. Report issue to AI tool maintainer if schema mismatch exists

**Mitigation:** Schema is validated during generation; malformed JSON is rejected before commit

### Failure Mode 5: Artifact Directory Missing

**Scenario:** `docs/ai/context/` directory deleted or missing

**Detection:** Artifact generation script fails with "directory not found"

**Recovery:**

1. Create directory: `mkdir -p docs/ai/context/`
2. Rerun infra-audit: `bun scripts/infra-audit.ts`
3. Commit new artifacts

**Mitigation:** CI ensures directory exists before artifact generation

---

## Success Criteria

### Functional Success Criteria

1. **Artifact Generation** ✓
   - All 7 AI context artifacts successfully generated
   - artifacts placed in `docs/ai/context/` directory
   - File formats are correct (Markdown, JSON)
   - File sizes within reasonable bounds (no >10MB artifacts)

2. **Schema Validity** ✓
   - JSON artifacts conform to documented schemas
   - Markdown artifacts render without errors
   - All cross-references between artifacts are valid

3. **Accuracy** ✓
   - ai-module-map.json lists all 13 modules with correct layers
   - ai-layer-model.json rules match documented governance constraints
   - ai-dependency-graph.json matches output from infra-audit
   - ai-architecture-brain.json generates without warnings

4. **Governance Integration** ✓
   - AI-Guard can load and use ai-layer-model.json for validation
   - Infra-audit successfully reads ai-architecture-brain.json
   - No circular dependency in ruleset
   - All forbidden dependencies are documented

5. **AI Tool Compatibility** ✓
   - GitHub Copilot can ingest and use ai-context-mini.json
   - GitNexus MCP can load ai-dependency-graph.json
   - Claude and other AI tools can parse all artifacts
   - No encoding errors in any artifact

### Performance Criteria

- Artifact generation completes in <5 seconds
- Total artifact size does not exceed 15MB
- AI tools can load and parse context in <1 second
- No performance regression in CI/CD pipelines

### Observability Criteria

- All artifact generation events logged with structured JSON
- Generation metrics recorded (module count, layer distribution, duration)
- Failures produce actionable error messages
- Audit trail shows when artifacts were last regenerated

### Governance Criteria

- AI-Guard can validate code against generated constraints
- No conflicts between artifact rules and documented rules
- Artifact freshness reported to developers
- Architecture violations detected by generated ruleset

---

## Acceptance Conditions

The stage is accepted when:

1. ✅ All 7 AI context artifacts are generated and valid
2. ✅ Artifacts are placed in `docs/ai/context/` with correct names
3. ✅ JSON artifacts pass `jq .` validation
4. ✅ ai-module-map.json correctly lists all modules with layers
5. ✅ ai-layer-model.json accurately reflects governance rules
6. ✅ ai-dependency-graph.json matches infra-audit.ts output
7. ✅ AI-Guard can successfully load and use artifacts
8. ✅ GitNexus MCP integration tested and working
9. ✅ Copilot/Claude context loading tested successfully
10. ✅ All artifacts regenerate correctly on source change
11. ✅ No breaking changes to existing architecture systems
12. ✅ Documentation updated to reference new artifacts
13. ✅ CI pipeline validates artifact freshness
14. ✅ Specification matches implementation exactly

---

## Assumptions & Dependencies

### Assumptions

1. **Existing Infrastructure**
   - `docs/architecture/adr/` directory with current ADRs exists
   - `docs/architecture/module-boundaries.json` is up-to-date
   - `scripts/infra-audit.ts` is functional and produces valid output
   - `docs/ai/AI_BOOTSTRAP.md` is current
   - `docs/ai/AI_CONTEXT_INDEX.md` is current

2. **Process Assumptions**
   - Repository structure will not fundamentally change
   - Module counts will grow but layer model remains 4-layer architecture
   - Governance rules are stable (no massive refactoring during this stage)
   - AI tools (Copilot, Claude, GitNexus) will actively support context loading

3. **Technical Assumptions**
   - JSON parsing is standard across all AI tools
   - Markdown rendering is consistent across platforms
   - File system can reliably store 15MB+ of metadata
   - No breaking changes to TypeScript or build tooling during this stage

### Dependencies

**Hard Dependencies:**

- ✅ STAGE_INFRA_06_ARCHITECTURE_GUARD (must exist; guards depend on this context)
- ✅ STAGE_INFRA_07_MODULE_BOUNDARIES (source of truth for rules)
- ✅ STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION (some content overlaps)
- ✅ scripts/infra-audit.ts (generates dependency graph used by context)
- ✅ docs/architecture/ADR/ (referenced in context)

**Soft Dependencies:**

- GitHub Copilot integration (enhances but not required)
- GitNexus MCP (enhances but not required)
- Claude/Cursor AI tools (enhances but not required)

### Integration Points

1. **With AI-Guard System** (STAGE_INFRA_06)
   - ai-layer-model.json loaded by ai-guard.ts
   - Forbidden dependency rules enforced
   - Violations blocked before commit

2. **With Infra-Audit** (scripts/infra-audit.ts)
   - Input: infra-dependency-graph.json, infra-audit-report.json
   - Output: ai-architecture-brain.json, ai-dependency-graph.json
   - Bidirectional validation

3. **With CI Pipeline**
   - Artifact freshness checked on every branch
   - Artifacts regenerated on architecture changes
   - Validation prevents stale artifacts in production

4. **With Developer Workflow**
   - Developers run `infra-audit.ts` locally before commit
   - CI validates artifact consistency
   - PRs checked for architecture violations

---

## Risk Assessment

### Risk 1: AI Context Becomes Stale (Medium Probability, High Impact)

**Scenario:** Architecture changes (new modules, moved files) but AI context not regenerated

**Impact:**

- AI agents use outdated module-to-layer mapping
- AI-generated code violates current architecture
- Architecture drift undetected

**Mitigation:**

- CI pipeline auto-regenerates artifacts on source change
- PR validation checks artifact freshness
- Developers notified if artifacts are >7 days old
- Scheduled job regenerates artifacts daily

**Owner:** DevOps (CI/CD pipeline maintenance)

### Risk 2: Conflicting Rules Between Sources (Medium Probability, Medium Impact)

**Scenario:** module-boundaries.json and ai-layer-model.json define different rules

**Impact:**

- AI tools receive conflicting guidance
- Architecture enforcement is inconsistent
- Governance authority unclear

**Mitigation:**

- Single source of truth: module-boundaries.json
- Governance tooling validates consistency on generation
- Architectural review process prevents conflicting changes
- Conflict detection automated in CI

**Owner:** Architecture team (review & approval)

### Risk 3: AI Tools Don't Support Context Format (Low Probability, High Impact)

**Scenario:** Copilot, Claude, or other AI tool can't parse JSON context artifacts

**Impact:**

- AI tools unable to use architecture context
- Context layer becomes useless
- Significant effort wasted on implementation

**Mitigation:**

- Schema designed for universal compatibility
- Testing done with actual AI tools before deployment
- Lightweight variant (ai-context-mini.json) for fallback
- Documentation provided to AI tool vendors

**Owner:** Architecture team (tool integration)

### Risk 4: Performance Degradation in CI (Low Probability, Medium Impact)

**Scenario:** Artifact generation becomes slow as codebase grows

**Impact:**

- CI pipeline slows down
- Developer feedback loops increase in latency
- Adoption friction for developers

**Mitigation:**

- Performance target: <5 seconds for full regeneration
- Incremental generation once codebase is large
- Caching of intermediate results
- Monitoring of artifact generation performance

**Owner:** DevOps (build performance)

### Risk 5: Incomplete Migration from Old Tooling (Low Probability, Low Impact)

**Scenario:** Some places still reference old architecture documentation instead of new context

**Impact:**

- Inconsistency in tooling
- Confusion about which source is authoritative
- Slower AI adoption

**Mitigation:**

- Strong documentation of new context system
- Links from old docs to new artifacts
- Deprecation notices on old docs
- Training for developers on new system

**Owner:** Documentation team + Architecture lead

---

## Phase Operations & Next Steps

### Schedule Impact

This stage introduces **zero runtime or data model changes**. It is a pure governance infrastructure
addition.

**Expected Duration:** 1-2 weeks (specification + implementation + testing)

**Blocking predecessors:**

- STAGE_INFRA_06_ARCHITECTURE_GUARD (must be complete)
- STAGE_INFRA_07_MODULE_BOUNDARIES (must be complete)

**Blocking successors:** None (non-blocking for all other stages)

### Implementation Readiness

Once this spec is approved:

1. **Planning Phase** (Week 1)
   - Detailed artifact schema design
   - AI tool compatibility testing plan
   - CI integration plan

2. **Implementation Phase** (Week 1-2)
   - Artifact generation code written
   - Integration with infra-audit.ts
   - CI/CD pipeline updates
   - Testing of AI tool compatibility

3. **Validation Phase** (Week 2)
   - Manual testing with Copilot, Claude, GitNexus
   - Performance benchmarking
   - Artifact correctness validation
   - Documentation complete

4. **Production Readiness**
   - All acceptance conditions met
   - PR approved by architecture lead
   - Artifacts committed to main branch
   - AI tool integrations activated

---

## Testing Requirements

### Unit Testing

1. **Artifact Schema Validation**
   - Test that generated JSON conforms to schema
   - Test that required fields are present
   - Test that no extra fields break parsers

2. **Module Mapping Logic**
   - Test that all modules are assigned to layers
   - Test that no module is assigned to multiple layers
   - Test layer assignment matches documentation

3. **Dependency Graph Construction**
   - Test that dependencies are correctly identified
   - Test that reverse dependencies are accurate
   - Test cycle detection (should find circular deps)

4. **Rule Extraction**
   - Test that forbidden imports are correctly identified
   - Test that allowed imports are correctly whitelisted
   - Test that rules match module-boundaries.json

### Integration Testing

1. **AI-Guard Integration**
   - Test that AI-Guard can load ai-layer-model.json
   - Test that violations are correctly detected
   - Test that false positives don't occur

2. **Infra-Audit Integration**
   - Test that artifacts match infra-audit output
   - Test consistency between sources
   - Test regeneration workflow

3. **CI Pipeline Integration**
   - Test artifact freshness detection
   - Test regeneration on source change
   - Test PR validation with stale artifacts

4. **AI Tool Integration** (Manual + Automated)
   - Test context loading in Copilot
   - Test context loading in Claude Code
   - Test context loading in GitNexus MCP
   - Test context loading in Cursor

### Snapshot Testing

Generate baseline snapshots of:

- ai-architecture-summary.md
- ai-module-map.json (complete)
- ai-layer-model.json (complete rules)

Verify snapshots match actual generated artifacts exactly.

### Validation Testing

1. **All Artifacts Exist**
   - All 7 required files present
   - Files in correct directory
   - File sizes reasonable

2. **No Corruption**
   - JSON artifacts parse without error
   - Markdown renders without issues
   - No truncation or incomplete data

3. **Backward Compatibility**
   - Existing architecture systems still work
   - AI-Guard continues to function
   - No breaking changes to other stages

---

## Documentation & Knowledge Transfer

### Documentation to Create

1. **Architecture Context User Guide**
   - How AI tools load context
   - How to interpret artifacts
   - Troubleshooting guide
   - Examples of context in use

2. **Artifact Schema Reference**
   - Complete JSON schema for each artifact
   - Field definitions and constraints
   - Example payloads

3. **Artifact Freshness Guide**
   - How to regenerate artifacts locally
   - How to interpret freshness warnings
   - What to do if artifacts are stale

4. **Integration Guides** (per AI tool)
   - GitHub Copilot integration
   - Claude Code integration
   - GitNexus MCP integration
   - Cursor integration

### Documentation to Update

- docs/ai/AI_CONTEXT_INDEX.md (add reference to new artifacts)
- docs/ai/AI_BOOTSTRAP.md (add loading instructions)
- docs/architecture/ZIDNEY_ARCHITECTURE_SYSTEM.md (document context layer)
- STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION.md (note integration with this stage)

---

## Non-Goals

This stage **explicitly does NOT**:

1. ❌ Modify the runtime behavior of any service
2. ❌ Change how tenants are isolated or provisioned
3. ❌ Alter license enforcement or version checking
4. ❌ Modify database schemas or migrations
5. ❌ Change how attempts are graded
6. ❌ Affect worker job processing
7. ❌ Impact end-user features
8. ❌ Create new API endpoints
9. ❌ Require new CI secrets or environment variables
10. ❌ Change deployment procedures

This is **purely a governance infrastructure stage** focused on making AI-assisted development safer
and more informed.

---

## Conclusion

The AI Architecture Context Layer transforms Zidney's architecture governance into
**machine-readable metadata** that enables AI agents to understand, respect, and enforce
architectural constraints automatically.

By establishing a structured context layer, we:

- Make AI-assisted development architecture-aware by default
- Enable automation of architecture validation
- Provide AI tools with authoritative guidance
- Reduce architectural drift in AI-generated code
- Speed onboarding of new AI assistants

This stage is foundational for enabling **safe, architecture-compliant AI-assisted development** in
subsequent phases.

---

**Specification Status:** ✅ **READY FOR PLANNING**

**Compliance Check:** ✅ **Compliant with Zidney Constitution v1.2.0 — No violations detected.**

All requirements are clearly defined, acceptance conditions are measurable, assumed dependencies are
documented, and risk mitigation strategies are in place. The specification is ready to proceed to
the Planning phase.

---

## Clarifications

### Session 2026-03-09

This section captures clarification questions raised during the Clarify phase and their approved
resolutions.

#### Q1: Artifact Regeneration Automation Strategy

**Question:** Should artifact regeneration be fully automated in CI on every commit, or should
developers regenerate locally before each commit?

**Ambiguity Identified:** Spec mentions both local regeneration and CI automation without clarity on
which is primary or if both are required.

**Approved Answer:** **Option C — Both (Local + CI Validation)**

Developers must regenerate artifacts locally before commit to catch stale or incorrect artifacts
early. CI performs a safety validation check to ensure artifacts are fresh and correct before main
merge.

**Implementation Implication:**

- Add `bun run ai:context:generate` to pre-commit hooks (developers run locally)
- CI job validates that artifacts match current source state (safety net)
- Prevents stale artifacts from being committed to main

**Affected Tasks:**

- Task 1: Implement artifact generation script (`generate:ai-context`)
- Task 3: Integrate into pre-commit hooks
- Task 5: CI validation job

---

#### Q2: JSON Schema Formality Level

**Question:** What level of schema formality and rigor is required for the 7 artifacts to ensure AI
tool compatibility?

**Ambiguity Identified:** Spec provides examples but lacks formal JSON schema definitions, creating
risk of drift between generated artifacts and consumer expectations.

**Approved Answer:** **TypeScript Interfaces + JSON Schema Files**

1. Define TypeScript types for all 7 artifacts in `packages/types/src/ai-context.ts`
2. Generate JSON schemas from TypeScript types using `typescript-json-schema`
3. Validate generated artifacts against schemas in CI before accepting them
4. Store JSON schemas in `docs/ai/context/schemas/` for reference
5. Document schema version in each artifact for compatibility tracking

**Implementation Implication:**

- Create type definitions covering all artifact structures
- Generate schemas automatically from types (single source of truth)
- Add validation step in artifact generation pipeline
- AI tools can validate compatibility before loading

**Affected Tasks:**

- Task 2: Define TypeScript types for all artifacts
- Task 4: Implement schema validation
- Task 5: CI integration of schema validation

---

#### Q3: Artifact Versioning Strategy

**Question:** Should AI context artifacts include version metadata to handle breaking changes to
schemas over time?

**Ambiguity Identified:** No strategy documented for managing schema evolution or backward
compatibility as Zidney architecture evolves.

**Approved Answer:** **Yes — Semantic Versioning in Artifact Metadata**

1. Add `"schema_version": "1.0.0"` to root of each artifact JSON file
2. Use semantic versioning: MAJOR.MINOR.PATCH
   - MAJOR: Breaking changes to schema structure
   - MINOR: New optional fields added
   - PATCH: Documentation or value updates
3. AI tools can validate schema_version before loading artifact
4. Maintain migration guide if MAJOR version changes

**Implementation Implication:**

- Include schema_version in TypeScript type definitions
- Validate schema_version in artifact loading code
- Document version compatibility in AI tool integration guides

**Affected Tasks:**

- Task 2: Include schema_version in all artifact type definitions
- Task 6: Document versioning strategy for consumers

---

#### Q4: Change-Triggered Artifact Regeneration

**Question:** Should artifact generation be triggered only when governance sources (ADRs,
module-boundaries.json, infra-audit outputs) actually change, or always run as part of the build?

**Ambiguity Identified:** Spec lacks guidance on optimization to avoid unnecessary regenerations and
CI overhead.

**Approved Answer:** **Intelligent Change Detection with Traceability**

1. Monitor changes to source files:
   - `docs/architecture/adr/**/*.md`
   - `docs/architecture/module-boundaries.json`
   - `infra-audit-report.json` (if present)
2. Only regenerate artifacts if source files changed
3. Include source metadata in each artifact:
   - `"sources": { "adr_timestamp": "...", "module_boundaries_hash": "...", "audit_timestamp": "..." }`
   - Helps developers understand artifact freshness

4. CI job:
   - Detect source changes
   - Skip regeneration if no changes
   - Validate artifact timestamps match source files

**Implementation Implication:**

- Add change detection logic to generate script
- Include source hashes/timestamps in artifacts
- Reduces CI time and unnecessary commits
- Improves visibility into artifact freshness

**Affected Tasks:**

- Task 1: Implement change detection in generation script
- Task 5: CI job enhancement for change-based triggering

---

#### Q5: AI Tool Integration Points and Access Patterns

**Question:** Which AI tools should consume these artifacts, and through what mechanisms do they
access them? How do we integrate with existing governance automation?

**Ambiguity Identified:** Spec mentions AI tools but lacks specific integration patterns and access
mechanisms.

**Approved Answer:** **Multi-Tool Ecosystem with Standard Access Patterns**

**Consumer Tools:**

1. **Copilot (via ai-guard.ts)**
   - Loads `ai-architecture-brain.json` for validation
   - Checks proposed changes against architectural rules
   - Blocks violations before code generation

2. **GitNexus MCP**
   - Loads `ai-module-map.json` and `ai-dependency-graph.json`
   - Performs impact analysis and blast radius calculations
   - Supports architecture-aware refactoring

3. **SpecKit Agents**
   - Load `ai-architecture-summary.md` and `ai-layer-model.json` during planning
   - Understand architectural constraints before task generation
   - Validate plan compliance with existing architecture

4. **Claude/Custom AI Assistants**
   - Artifacts can be pasted into context window
   - Enables architecture-aware assistance on demand
   - Especially useful for architecture questions

**Access Method:**

- Direct file read from `docs/ai/context/` directory
- Can be loaded via MCP (GitHub file API, filesystem)
- Can be included in LLM context as markdown/JSON

**Integration with Governance:**

- ai-guard.ts: Loads `ai-architecture-brain.json` automatically
- infra-audit.ts: Reads and updates artifact freshness metadata
- CI pipeline: Validates artifacts before merge

**Implementation Implication:**

- Document artifact loading in each consumer tool's integration guide
- Ensure artifacts are valid, parseable JSON/markdown
- Test artifact loading with actual consumer tools
- Create usage examples for manual context inclusion

**Affected Tasks:**

- Task 3: Document artifact loading patterns
- Task 6: Create AI tool integration guides
- Task 5: Validate with actual consumer tools

---

**Clarification Status:** ✅ **All ambiguities resolved. Specification is now ready for planning.**

**Updated:** 2026-03-09
