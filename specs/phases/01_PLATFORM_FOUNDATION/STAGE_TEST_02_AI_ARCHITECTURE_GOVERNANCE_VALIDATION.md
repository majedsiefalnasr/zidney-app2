# STAGE_TEST_02_AI_ARCHITECTURE_GOVERNANCE_VALIDATION

Phase: 01_PLATFORM_FOUNDATION  
Type: System Validation Stage  
Purpose: Validate the complete **AI‑safe architecture governance stack** implemented in previous
infrastructure stages.

---

## Stage Status

Status: DRAFT

---

# Objective

This stage verifies that Zidney’s architecture governance system correctly protects the repository
against architectural violations, unsafe TypeScript usage, dependency misuse, and AI‑generated code
risks.

The validation ensures the following governance layers work together correctly:

- TypeScript Governance
- Biome lint enforcement
- Unified Architecture Guard
- Incremental Architecture Guard
- Architecture Brain generator
- AI skills governance
- Orchestrator enforcement
- Git hooks (pre‑commit / pre‑push)
- CI architecture validation

---

# Systems Under Test

The following systems must be validated.

### Type Safety Governance

Ensures that:

- `any` usage is detected
- `as any` is blocked
- `@ts-ignore` is blocked
- implicit `any` is prevented

---

### Unified Architecture Guard

Ensures enforcement of:

- dependency boundaries
- module layer rules
- circular dependency detection
- architecture rule violations

---

### Incremental Guard

Ensures the guard only scans changed files when using:

```
bun architecture-guard --changed
```

Expected result:

- fast execution
- correct detection of violations in modified files

---

### Architecture Brain

Validates automatic generation of architecture intelligence files:

```
docs/ai/context/

  ai-dependency-graph.json
  ai-module-map.json
  ai-layer-map.json
```

These files must correctly reflect repository structure.

---

### AI Governance Rules

Ensures AI-generated code respects rules defined in:

```
.agents/skills/
```

Examples:

- typescript-governance
- architecture-self-healing
- terminal-safety

---

### Git Hook Enforcement

Validates:

```
.husky/pre-commit
.husky/pre-push
```

Hooks must correctly trigger:

- formatting
- lint
- architecture guard

---

### CI Governance

Ensures CI pipeline blocks architecture violations.

Expected CI commands:

```
bun typecheck
bun scripts/architecture-guard/architecture-guard.ts --ci
```

---

# Test Categories

This stage includes the following categories of tests.

---

# Category 1 — Type Safety Tests

### Test TS‑01 — Explicit any

Introduce code:

```
const value: any = "test"
```

Expected result:

- guard failure
- CI blocked

---

### Test TS‑02 — Unsafe cast

```
const user = data as any
```

Expected result:

- violation detected

---

### Test TS‑03 — ts-ignore

```
// @ts-ignore
```

Expected result:

- violation detected

---

# Category 2 — Architecture Boundary Tests

### Test ARCH‑01 — Forbidden dependency

Example:

```
apps/mmc importing packages/domain-core
```

If forbidden in architecture map:

Expected result:

- architecture violation

---

### Test ARCH‑02 — Module boundary violation

Example:

```
apps/backoffice importing apps/frontoffice
```

Expected result:

- architecture guard error

---

### Test ARCH‑03 — Circular dependency

Create cycle:

```
packages/domain-core -> packages/config -> packages/domain-core
```

Expected result:

- circular dependency detected

---

# Category 3 — Architecture Brain Validation

### Test BRAIN‑01 — Dependency graph generation

Run generator:

```
bun scripts/architecture-brain/generate-architecture-brain.ts
```

Expected output:

```
docs/ai/context/ai-dependency-graph.json
```

File must contain:

- module nodes
- dependency edges

---

### Test BRAIN‑02 — Module map generation

Expected output:

```
ai-module-map.json
```

Contains:

- module names
- module paths
- architecture layers

---

### Test BRAIN‑03 — Layer map generation

Expected output:

```
ai-layer-map.json
```

Contains:

- architecture layers
- allowed dependency directions

---

# Category 4 — Incremental Guard Tests

### Test INC‑01 — Changed file scan

Modify a single file.

Run:

```
bun architecture-guard --changed
```

Expected result:

- only changed files scanned

---

### Test INC‑02 — Performance validation

Compare execution time between:

```
bun architecture-guard
bun architecture-guard --changed
```

Expected result:

- incremental mode significantly faster

---

# Category 5 — Git Hook Validation

### Test HOOK‑01 — Pre‑commit validation

Attempt commit with:

```
any usage
```

Expected result:

- commit blocked

---

### Test HOOK‑02 — Pre‑push validation

Attempt push with architecture violation.

Expected result:

- push rejected

---

# Category 6 — CI Enforcement

### Test CI‑01 — CI type failure

Introduce TypeScript error.

Expected result:

- CI fails

---

### Test CI‑02 — Architecture violation

Introduce dependency violation.

Expected result:

- CI fails

---

# Governance Stack Validation Matrix

| System                 | Validation  |
| ---------------------- | ----------- |
| TypeScript strict mode | TS tests    |
| Biome lint rules       | TS tests    |
| Architecture Guard     | ARCH tests  |
| Incremental Guard      | INC tests   |
| Architecture Brain     | BRAIN tests |
| Git hooks              | HOOK tests  |
| CI enforcement         | CI tests    |

---

# Final Repository Sanity Check

Perform final repository inspection.

Goals:

Remove unnecessary or redundant governance artifacts.

Targets:

- obsolete architecture scripts
- duplicated enforcement tools
- unused governance documentation
- legacy experimental tools

Expected result:

The architecture governance system becomes:

- minimal
- deterministic
- maintainable

---

# Success Criteria

This stage is complete when:

- All governance systems pass validation
- Architecture violations are reliably detected
- Type safety violations are blocked
- Incremental guard works correctly
- Architecture Brain artifacts are generated correctly
- Git hooks enforce local governance
- CI blocks unsafe changes

---

# Long‑Term Impact

After this stage, Zidney achieves a **fully validated AI‑safe architecture governance system**.

Workflow:

```
AI writes code
↓
Architecture guard analyzes change
↓
Governance violations detected
↓
Commit / push / CI blocked
```

This ensures the repository remains structurally safe even in heavily AI‑assisted development
environments.
