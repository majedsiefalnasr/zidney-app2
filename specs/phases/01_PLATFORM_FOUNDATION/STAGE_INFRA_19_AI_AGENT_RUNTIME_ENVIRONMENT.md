# STAGE_INFRA_19_AI_AGENT_RUNTIME_ENVIRONMENT

## Stage Status

Status: DRAFT
Step: plan
Risk Level: LOW
Last Updated: 2026-03-15T00:03:00.000Z

Scope Planned:

- `scripts/ai-runtime/runtime-status.ts` implements 9 diagnostic checks across 5 runtime layers
- 3 `package.json` script entries: `ai-runtime:status`, `ai-runtime:refresh`, `ai-runtime:validate`
- CI step added to `arch-guard` job in `.github/workflows/ci.yml`
- Unit tests: `tests/unit/ai-runtime/runtime-status.test.ts`
- Integration tests: `tests/integration/ai-runtime/runtime-status.integration.test.ts`

Deferred Scope:

- Changes to existing skill files (already complete)
- New packages or apps under packages/ or apps/
- MCP server configuration changes

Constitutional Compliance:

- Technical plan compliant — task generation authorized
- Architecture Checker: PASS (all 6 checks clean)
- Developer tooling only — no tenant/DB/attempt interaction

Notes:
Technical plan complete. Task breakdown in progress.

---

## Purpose

This stage introduces a **dedicated runtime environment for AI agents** operating inside the Zidney monorepo.

The goal is to make AI execution:

- deterministic
- architecture-aware
- token-efficient
- safe against hallucination paths

This runtime layer standardizes how AI agents:

- load architecture context
- activate skills
- execute terminal commands
- interact with MCP tools
- run orchestrated tasks

The result is a **stable AI execution environment aligned with Zidney governance systems**.

---

# Runtime Architecture

The AI runtime environment consists of five layers:

```
AI Agent Runtime
├── Context Loader
├── Skill Loader
├── Architecture Intelligence Layer
├── MCP Routing Layer
└── Deterministic Execution Layer
```

These layers ensure AI agents operate with **structured knowledge instead of raw repository scanning**.

---

# Phase 1 — Context Loader

AI agents must bootstrap from the repository AI context layer.

Primary bootstrap file:

```
docs/ai/AI_BOOTSTRAP.md
```

Secondary context files:

```
docs/ai/AI_CONTEXT_INDEX.md
docs/PROJECT_CONTEXT_PRIMER.md
```

Generated machine-readable artifacts:

```
docs/ai/context/
  ai-architecture-brain.json
  ai-module-map.json
  ai-layer-map.json
  ai-runtime-map.json
  ai-dependency-graph.json
  ai-context-mini.json
```

AI agents must **always load the mini context first** to minimize token usage.

---

# Phase 2 — Skill Loader

Skills are located in:

```
.agents/skills/
```

Each skill directory contains a:

```
SKILL.md
```

Skill activation rules:

- load only relevant skills
- avoid loading unrelated skills
- prioritize core governance skills

Core runtime skills:

```
architecture-intelligence
architecture-self-healing
analysis-retry-engine
subagent-parallelization
terminal-safety
rtk-execution-layer
mcp-routing
```

This prevents unnecessary context inflation.

---

# Phase 3 — Architecture Intelligence Layer

AI agents must never infer architecture from raw directory structure.

Instead they must rely on:

```
docs/architecture/module-boundaries.json
docs/architecture/intelligence/
docs/ai/context/
```

Architecture governance tools:

```
scripts/ai-guard.ts
scripts/infra-audit.ts
scripts/type-safety-guard.ts
```

These tools provide authoritative architecture signals.

---

# Phase 4 — MCP Routing Layer

AI tools must route specialized tasks to the correct MCP provider.

Examples:

```
GitNexus → code intelligence
filesystem MCP → repository operations
GitHub MCP → CI and PR analysis
terminal → command execution
```

Routing policy is defined in:

```
docs/ai/MCP_ACTIVATION_MATRIX.md
```

This prevents incorrect tool usage.

---

# Phase 5 — Deterministic Execution Mode

AI execution must follow a deterministic workflow:

1. Load architecture context
2. Load required skills
3. Inspect repository state
4. Execute minimal changes
5. Validate architecture rules

AI agents must avoid:

- speculative refactoring
- blind repository scanning
- large unscoped modifications

This dramatically reduces hallucination risk.

---

# Phase 6 — Token Optimization Layer

AI runtime must use RTK for token-efficient terminal operations.

Preferred commands:

```
rtk cat
rtk head
rtk grep
rtk tree
```

These commands reduce token consumption when inspecting large files.

---

# Phase 7 — AI Runtime Diagnostics

Introduce a runtime diagnostics command:

```
bun ai-runtime:status
```

This command verifies:

- AI context freshness
- architecture brain integrity
- skill directory integrity
- runtime dependency health

Example output:

```
AI Runtime Status
-----------------
Context Layer: OK
Skills Layer: OK
Architecture Intelligence: OK
MCP Routing: OK
```

---

# Phase 8 — Runtime Scripts

Add the following scripts to `package.json`:

```
"ai-runtime:status": "bun scripts/ai-runtime/runtime-status.ts",
"ai-runtime:refresh": "bun ai-context:refresh",
"ai-runtime:validate": "bun arch:validate-brain"
```

Scripts live under:

```
scripts/ai-runtime/
  runtime-status.ts
```

---

# Phase 9 — CI Integration

AI runtime validation must run in CI.

Example workflow step:

```
- name: AI Runtime Validation
  run: bun ai-runtime:status
```

This ensures AI tooling remains functional.

---

# Validation

After implementing this stage run:

```
bun ai-runtime:status
bun arch:guard
bun type-safety-guard
```

All commands must succeed.

---

# Expected Result

After this stage:

- AI agents run in a controlled runtime environment
- architecture context loads automatically
- skills activate predictably
- token usage remains optimized

The Zidney repository becomes **AI-native and deterministic**.

---

# Completion Criteria

The stage is complete when:

- AI runtime diagnostics command works
- architecture validation passes
- AI context loads successfully
- CI runtime validation succeeds
