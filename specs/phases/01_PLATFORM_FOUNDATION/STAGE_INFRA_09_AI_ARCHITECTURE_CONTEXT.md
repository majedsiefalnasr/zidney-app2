# STAGE_INFRA_09_AI_ARCHITECTURE_CONTEXT

## Purpose

Establish an **AI-consumable architecture context layer** for the Zidney monorepo. This stage converts architectural metadata, ADR decisions, module boundaries, and dependency graphs into structured context that AI development tools can reliably consume.

The goal is to make AI-assisted development **architecture-aware by default**, ensuring generated code respects Zidney’s architectural rules.

---

## Stage Status

Status: DRAFT
Step: plan
Risk Level: LOW
Last Updated: 2026-03-09T00:00:00Z
Branch: spec/infra-009-ai-architecture-context

Scope Planned:

- Complete implementation roadmap (5 phases, 35 tasks, 190 hours)
- 7 AI context artifacts specified with JSON schemas
- All integration points documented (ai-guard.ts, infra-audit.ts, GitNexus, 4 consumer tools)
- Change detection mechanism designed (intelligent hash-based)
- 40+ success criteria aligned with specification

Deferred Scope:

- None — full scope captured in plan

Constitutional Compliance:

- ✅ Plan compliant with Zidney Constitution v1.2.0
- ✅ Guardian validation PASSED (Architecture + API Design)
- ✅ Task generation authorized

Notes:
Comprehensive technical plan complete and validated. Ready for task breakdown and implementation.

---

# Core Idea

Traditional documentation is written for humans.

AI agents require **structured, machine-readable architecture context**.

This stage introduces a standardized architecture context layer built from:

- ADR documents
- module boundary map
- dependency graph
- governance rules
- infra audit outputs

These inputs are transformed into AI-readable artifacts.

---

# Source Architecture Inputs

The architecture context is derived from the following sources:

```
docs/architecture/adr/
docs/architecture/module-boundaries.json
infra-audit-report.json
infra-dependency-graph.json
docs/ai/AI_BOOTSTRAP.md
```

These represent the authoritative architecture model.

---

# Generated AI Context Artifacts

AI architecture context should be generated into:

```
docs/ai/context/
```

Artifacts may include:

```
ai-architecture-summary.md
ai-module-map.json
ai-layer-model.json
ai-dependency-graph.json
```

These files provide a condensed representation of the system architecture for AI tools.

---

# AI Architecture Summary

The summary provides a human and AI readable overview of the system.

Example structure:

```
System Layers

UI
Runtime
Domain
Infrastructure

Applications

apps/api
apps/worker
apps/mmc
apps/backoffice
apps/frontoffice

Key Packages

packages/domain-core
packages/ui-system
packages/api-client
packages/logger
```

This helps AI agents understand the overall structure quickly.

---

# Layer Model

The layer model describes architectural layering rules.

Example JSON structure:

```
{
  "layers": [
    "ui",
    "runtime",
    "domain",
    "infrastructure"
  ],

  "rules": {
    "ui": ["packages/ui-system", "packages/api-client"],
    "runtime": ["domain", "infrastructure"],
    "domain": ["infrastructure"],
    "infrastructure": []
  }
}
```

AI tools can validate generated code against this model.

---

# Module Map

The module map lists every application and package with its assigned layer.

Example:

```
{
  "apps/api": "runtime",
  "apps/worker": "runtime",
  "apps/mmc": "ui",
  "apps/backoffice": "ui",
  "apps/frontoffice": "ui",

  "packages/domain-core": "domain",
  "packages/validation": "domain",

  "packages/logger": "infrastructure",
  "packages/config": "infrastructure"
}
```

This allows AI tools to reason about module roles.

---

# Dependency Graph Export

The dependency graph should be exported for AI consumption.

Source:

```
infra-dependency-graph.json
```

This graph enables AI agents to perform:

```
impact analysis
architecture reasoning
dependency tracing
```

---

# AI Tool Integration

AI context should be loaded automatically by AI tooling.

Example sources:

```
GitNexus MCP
Cursor
Copilot
Claude Code
```

Recommended context files:

```
docs/ai/AI_BOOTSTRAP.md
docs/ai/context/ai-architecture-summary.md
```

These provide architecture-aware prompts for AI agents.

---

# GitNexus Integration

GitNexus can use architecture context to improve repository reasoning.

Example workflow:

```
gitnexus analyze .
gitnexus query "tenant architecture"
```

AI agents can reference architecture context to avoid invalid changes.

---

# AI Development Benefits

This stage provides several benefits:

```
better AI reasoning
fewer architecture violations
faster onboarding
clear system understanding
```

AI agents gain awareness of:

- system layers
- module boundaries
- architecture decisions

---

# CI Integration

Architecture context generation should run after infra audit.

Example pipeline:

```
pnpm run infra-audit
pnpm run architecture:visualize
pnpm run ai-context:generate
```

Generated artifacts should remain synchronized with the repository.

---

# Developer Workflow

Developers normally do not interact with this layer directly.

However, when architecture changes occur they must:

```
update ADR
update module-boundaries.json
run infra-audit
regenerate AI context
```

This keeps AI context accurate.

---

# Success Criteria

This stage is considered complete when:

- AI architecture context artifacts generated
- module map exported
- layer model documented
- dependency graph available for AI tools

---

# Dependencies

This stage depends on:

```
STAGE_INFRA_06_ARCHITECTURE_GUARD
STAGE_INFRA_07_MODULE_BOUNDARIES
STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION
```

These stages provide the architecture metadata required.

---

# Result

After this stage:

- AI tools understand Zidney architecture
- generated code respects architecture layers
- architecture context becomes machine-readable
- AI-assisted development becomes safer

This stage completes the **AI architecture awareness layer** of the Zidney platform.
