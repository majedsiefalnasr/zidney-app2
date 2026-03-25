# STAGE_INFRA_29_POLICY_ENGINE_AND_GOVERNANCE_RULES_LAYER

## Stage Metadata

- **Stage ID**: INFRA-29
- **Stage Name**: Policy Engine and Governance Rules Layer
- **Phase**: Platform Foundation
- **Type**: Infrastructure / Governance Core
- **Status**: DRAFT

---

## Stage Status

Status: DRAFT
Step: specify
Risk Level: UNKNOWN
Last Updated: 2026-03-25T00:05:00Z

Scope Defined:

- Policy engine runtime (`scripts/policy-engine/`)
- Rule system (PolicyRule, PolicyContext, PolicyResult types)
- Rule registry (central authority for all governance rules)
- GitNexus context integration with graceful degradation
- Adapter layer: architecture-guard, type-safety-guard, script-governance, Trivy
- CLI: `bun run policy:check --full / --changed`
- CI + orchestrator integration
- Script system unification (T010–T016)
- Husky optimization (<2s pre-commit)

Deferred Scope:

- Removing/deprecating legacy tools (adapter-first; removal is future stage)
- Web UI / dashboard for policy results
- External policy systems (OPA, etc.)
- Automatic violation remediation

Constitutional Compliance:

- Specification drafted — constitutional audit pending

Notes:
Specification complete. 43 FRs, 20 NFRs, 6 user stories, 8 success criteria. No clarifications required. Clarification step pending.

---

## Stage Context & Lineage

This stage is a direct continuation of:

- **INFRA-26** → Trivy Security Enforcement
- **INFRA-27** → Unified Governance Gate System
- **INFRA-28** → GitNexus Context-Aware Governance

### Why This Stage Exists

INFRA-16 failed to fully complete due to:

- Distributed governance logic
- Lack of a single rule authority
- Drift between CI, scripts, and orchestrator

INFRA-27 unified execution gates, but **not rule definition**.

👉 INFRA-29 introduces a **single source of truth for ALL rules**

---

## Objective

Establish a **Policy Engine** that:

- Centralizes ALL governance rules
- Executes rules deterministically
- Uses GitNexus for context-aware validation
- Becomes the ONLY authority for enforcement

---

## Core Transformation

From:

- `arch:guard`
- `type-safety-guard`
- `validate:*`
- CI scattered checks

To:

```
bun run policy:check
```

---

## Scope

### In Scope

- Policy engine runtime
- Rule system
- Rule registry
- GitNexus context integration
- Adapter layer for existing systems
- CI + orchestrator integration

### Out of Scope

- Removing legacy systems (adapter-first strategy)
- UI / dashboards

---

## Architecture

```
scripts/policy-engine/
├── engine.ts
├── registry.ts
├── types.ts
├── context/
│   └── loader.ts
├── rules/
│   ├── architecture/
│   ├── scripts/
│   ├── type-safety/
│   ├── ai/
│   └── security/
├── adapters/
│   ├── architecture-guard.adapter.ts
│   ├── type-safety.adapter.ts
│   ├── script-governance.adapter.ts
│   └── trivy.adapter.ts
└── reporters/
    ├── json.ts
    └── console.ts
```

---

## Policy Model

### Rule

```ts
type PolicyRule = {
  id: string;
  domain: "architecture" | "scripts" | "types" | "ai" | "security";
  description: string;
  severity: "error" | "warning";
  evaluate: (context: PolicyContext) => PolicyResult[];
};
```

---

### Context (GitNexus)

```ts
type PolicyContext = {
  changedFiles: string[];
  dependencyGraph: any;
  gitHistory?: any;
  scripts?: any;
  vulnerabilities?: any;
};
```

---

### Result

```ts
type PolicyResult = {
  ruleId: string;
  severity: "error" | "warning";
  message: string;
  file?: string;
  suggestion?: string;
};
```

---

## Execution Flow

1. Load GitNexus context
2. Load rule registry
3. Execute rules
4. Normalize results
5. Output to CLI / CI / orchestrator

---

## Key Capabilities

## Script System Governance (Extended)

This stage enforces full script system normalization:

### 1. No Duplicate Scripts

- Same purpose → single script
- Same name across domains → forbidden

### 2. Unified Naming

Format:

```
<domain>:<action>[:scope]
```

### 3. Script Authority Chain

Every script must:

- exist in `package.json`
- resolve to `/scripts/`
- be documented in `docs/scripts/`

### 4. Script Usage Mapping

Each script must declare:

- called by (CI / dev / orchestrator)
- origin spec
- execution frequency

---

### 1. Single Governance Entry Point

```
bun run policy:check
```

---

### 2. Context-Aware Rules

Uses:

- changed files
- dependency graph
- git history

---

### 3. Adapter-Based Migration

| System                   | Strategy |
| ------------------------ | -------- |
| architecture-guard       | adapter  |
| type-safety-guard        | adapter  |
| script-system-governance | adapter  |
| Trivy                    | adapter  |

---

### 4. Deterministic Outputs

- JSON standardized
- CI-safe
- reproducible

---

## Integration

---

### CI (INFRA-27)

```
bun run policy:check --full
```

Fail on errors.

---

### Pre-Commit (Husky)

```
bun run policy:check --changed
```

---

### Orchestrator

Delegation model:

```
policyEngine.check(context)
```

Used in:

- precommit-diagnostics
- closure gate

---

### Skill Integration

- `script-system-governance` → rule provider

---

## Tasks

### T001 – Engine Core

### T002 – Rule Registry

### T003 – GitNexus Context Loader

### T004 – Adapter Layer

### T005 – CLI Interface

### T006 – CI Integration

### T007 – Orchestrator Integration

### T008 – Reporting

### T009 – Documentation

### T010 – Script System Unification

- Detect duplicate scripts (name, purpose, usage)
- Merge into single authoritative scripts
- Enforce naming convention `<domain>:<action>[:scope]`
- Remove dead or orphan scripts

### T011 – package.json Hygiene

- Normalize all script names
- Remove unused scripts and dependencies
- Ensure every script resolves to a valid file
- Add inline documentation comments (where applicable)

### T012 – Script Documentation System

- Ensure every script has:
  - Purpose
  - Usage
  - Source (spec/runtime)
  - Invocation layer (CI / dev / orchestrator)
- Sync with `docs/scripts/`

### T013 – GitHub Workflows Alignment

- Replace direct script calls with `policy:check` where possible
- Remove duplicate CI checks
- Ensure workflows reference valid scripts only
- Validate workflow YAML integrity

### T014 – Husky Optimization

- Refactor `pre-commit`:
  - fast checks only
  - scoped (`--changed`)
- Refactor `pre-push`:
  - deeper checks
  - optional full validation
- Remove redundant executions

### T015 – Generated Artifacts Policy

- Classify generated outputs:
  - MUST commit (e.g. architecture brain)
  - MUST NOT commit (e.g. temp files)
- Enforce via:
  - `.gitignore`
  - policy rules
- Prevent accidental commits of volatile artifacts

### T016 – Script Performance Optimization

- Ensure scripts are:
  - fast (<2s for pre-commit)
  - scoped (changed files only)
  - parallelized when safe
- Eliminate unnecessary full-repo scans

---

---

## Hard Mode Integration

### Workflow Alignment

This stage MUST follow:

- SpecKit Hard Mode Workflow
- Stage lifecycle policy

### Required Enforcement

- No direct script execution in orchestrator
- All validation MUST go through policy engine
- No standalone validation logic allowed

---

## Validation Gates

### Gate 1 – Parity

All existing guards replicated

### Gate 2 – Determinism

Stable outputs

### Gate 3 – Coverage

All domains enforced

### Gate 4 – Orchestrator Dependency

Orchestrator uses ONLY policy engine

---

## Critical Rule (Prevents INFRA-16 Failure)

### 🚨 No Unregistered Enforcement

ALL governance must:

- be a policy rule
- be registered in engine
- NOT exist elsewhere

---

## Generated Files & Commit Policy

### Classification

| Type                    | Action |
| ----------------------- | ------ |
| Deterministic artifacts | commit |
| Temporary outputs       | ignore |
| Cache / runtime files   | ignore |

### Enforcement

- `.gitignore` must be authoritative
- Policy engine must detect violations

---

## Performance Constraints

### Pre-Commit

- Must complete < 2s
- Only changed files

### Pre-Push

- Incremental checks
- Optional full validation

### CI

- Full validation allowed

---

## Workflow & Hook Consistency

All layers must be aligned:

| Layer        | Uses                     |
| ------------ | ------------------------ |
| CI           | `policy:check --full`    |
| pre-commit   | `policy:check --changed` |
| pre-push     | extended checks          |
| orchestrator | policy engine API        |

No layer may implement independent logic.

---

## Success Criteria

- Single governance system
- No duplicate rules
- Full CI + orchestrator alignment
- Context-aware validation
- Extensible architecture

---

## Next Stage Dependency

Feeds into:

- Policy-driven automation
- AI decision systems
- Advanced governance dashboards
