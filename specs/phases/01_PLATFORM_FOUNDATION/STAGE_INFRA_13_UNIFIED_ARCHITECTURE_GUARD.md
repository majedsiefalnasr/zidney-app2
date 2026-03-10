# STAGE_INFRA_13_UNIFIED_ARCHITECTURE_GUARD

Phase: 01_PLATFORM_FOUNDATION  
Type: Infrastructure Governance Stage  
Purpose: Implement a **Unified Architecture Guard Engine** that enforces Zidney's architectural
rules, type safety, dependency boundaries, and AI governance through a single modular enforcement
system.

---

# Objective

This stage introduces a **centralized architecture enforcement engine** that replaces fragmented
checks with a single extensible guard.

The guard ensures:

- Architecture boundaries cannot be violated
- Unsafe TypeScript constructs cannot enter the codebase
- Circular dependencies are prevented
- AI-generated code respects repository rules
- Architecture intelligence is automatically generated for AI tooling

This stage also introduces the **Architecture Brain**, an automated architecture intelligence layer
that keeps AI agents fully aware of system structure.

---

# Problem This Stage Solves

Before this stage, architecture enforcement may be scattered across multiple scripts such as:

- ai-guard.ts
- type-safety-guard.ts
- dependency scanners
- circular dependency tools

This fragmentation causes:

- duplicated logic
- slower CI execution
- inconsistent enforcement

This stage consolidates these mechanisms into a **single architecture enforcement system**.

---

# Unified Guard Architecture

All architecture checks will be executed through one entry point.

Primary script:

```
scripts/architecture-guard/architecture-guard.ts
```

Internal structure:

```
scripts/architecture-guard/

  architecture-guard.ts

  rules/
    dependency-boundaries.ts
    circular-dependencies.ts
    type-safety.ts
    ts-ignore-check.ts
    module-boundaries.ts
    ai-governance.ts

  utils/
    file-scanner.ts
    diff-scanner.ts
    rule-runner.ts
```

Each rule operates independently but is executed through the guard runner.

---

# Guard Execution Modes

## Development Mode

```
bun architecture-guard
```

Purpose:

Developer feedback.

Behavior:

- warnings only
- no blocking

---

## Pre-Push Mode

```
bun architecture-guard --changed
```

Behavior:

- scans only modified files
- fast incremental validation

Implementation concept:

```
git diff --name-only origin/main
```

This reduces scan time significantly.

---

## CI Mode

```
bun architecture-guard --ci
```

Behavior:

- strict enforcement
- violations fail CI

---

# Enforcement Layers

The unified guard enforces multiple architecture layers.

---

# Layer 1 — Dependency Boundary Enforcement

Uses:

```
ARCHITECTURE_MAP.json
```

Ensures modules only import allowed dependencies.

Example violation:

```
apps/mmc importing packages/domain-core
```

If the architecture map forbids this dependency, CI fails.

---

# Layer 2 — Circular Dependency Detection

The guard scans dependency graphs for cycles.

Example violation:

```
packages/domain-core -> packages/config -> packages/domain-core
```

Circular dependencies are blocked.

---

# Layer 3 — Type Safety Enforcement

Integrates TypeScript governance.

Detects:

```
:any
as any
<any>
@ts-ignore
```

Violations trigger architecture guard errors.

Allowed exceptions require explicit justification comments.

---

# Layer 4 — Module Boundary Rules

Example rules:

```
apps/* cannot import from apps/*
ui layer cannot import runtime layer
```

Module boundaries enforce proper architecture layering.

---

# Layer 5 — AI Governance Enforcement

The guard verifies compliance with AI governance rules defined in:

```
.agents/skills/
```

Example:

- TypeScript governance skill
- architecture-self-healing skill
- terminal-safety skill

This ensures AI-generated code follows project standards.

---

# Incremental Architecture Guard

To ensure performance in large repositories, the guard must support incremental scanning.

Implementation:

```
git diff --name-only origin/main
```

Only changed files are scanned.

Benefits:

- 10–50× faster execution
- suitable for large monorepos

---

# Architecture Brain

The Architecture Brain is an **AI intelligence layer** that automatically generates architecture
knowledge artifacts.

Generated files:

```
docs/ai/context/

  ai-dependency-graph.json
  ai-module-map.json
  ai-layer-map.json
```

These files provide structured architecture context to AI tools such as:

- GitNexus
- AI agents
- architecture analysis tools

---

# Architecture Brain Generator

Add generator script:

```
scripts/architecture-brain/generate-architecture-brain.ts
```

Responsibilities:

1. Scan repository modules
2. Analyze dependency graph
3. Map modules to architecture layers
4. Export AI-readable context files

---

# Generated Artifacts

## Dependency Graph

```
ai-dependency-graph.json
```

Contains:

- module nodes
- dependency edges

---

## Module Map

```
ai-module-map.json
```

Contains:

- module names
- module paths
- architecture layer

---

## Layer Map

```
ai-layer-map.json
```

Contains:

- layer definitions
- allowed dependency directions

---

# Integration with GitNexus

GitNexus can use these artifacts to provide:

- architecture-aware code search
- dependency impact analysis
- architectural reasoning for AI agents

---

# CI Integration

Add architecture guard to CI pipeline.

Example step:

```
bun scripts/architecture-guard/architecture-guard.ts --ci
```

CI fails when:

- architecture violations detected
- unsafe types detected
- circular dependencies detected

---

# Implementation Tasks

T001 — Create unified architecture guard engine

T002 — Implement modular rule system

T003 — Integrate dependency boundary validation

T004 — Implement circular dependency detection

T005 — Integrate TypeScript safety checks

T006 — Implement module boundary enforcement

T007 — Implement incremental scanning

T008 — Create Architecture Brain generator

T009 — Generate AI architecture context files

T010 — Integrate guard into CI pipeline

---

# Final Cleanup Phase

Once the unified guard is operational, perform a **repository cleanup step**.

Purpose:

Remove redundant, obsolete, or duplicated architecture enforcement mechanisms.

Cleanup targets:

- deprecated guard scripts
- duplicated dependency scanners
- obsolete documentation
- unused architecture scripts

Examples:

- remove old architecture validation scripts
- consolidate duplicated docs
- remove legacy tooling no longer required

This ensures the architecture governance system remains **minimal, maintainable, and
deterministic**.

---

# Success Criteria

The stage is complete when:

- Unified architecture guard implemented
- All rules executed through a single engine
- Incremental scanning enabled
- Architecture Brain generated successfully
- AI context artifacts generated
- CI enforcement active
- redundant scripts and docs removed

---

# Long-Term Impact

After this stage, Zidney becomes a **self-governing architecture system**.

Workflow:

```
AI writes code
↓
Architecture guard analyzes changes
↓
Violations blocked automatically
```

This ensures long-term maintainability even in AI-assisted development environments.

---

# Notes

A unified architecture guard dramatically simplifies governance and reduces enforcement complexity.

Combined with AI architecture context generation, this system enables reliable AI-assisted
development while preserving strict architectural integrity.
