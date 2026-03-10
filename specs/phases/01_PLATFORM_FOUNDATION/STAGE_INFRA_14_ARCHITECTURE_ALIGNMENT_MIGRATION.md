# STAGE_INFRA_14_ARCHITECTURE_ALIGNMENT_MIGRATION

Phase: 01_PLATFORM_FOUNDATION  
Type: Infrastructure Alignment / Migration Stage  
Purpose: Refactor and align the existing Zidney codebase so it fully complies with the new **Unified
Architecture Guard**, **TypeScript Governance**, and **Architecture Brain** standards.

---

# Objective

This stage performs a **repository-wide alignment** to ensure that all existing code complies with
the architecture governance system introduced in previous stages.

The goal is to migrate legacy or pre-governance code so it satisfies:

- Unified Architecture Guard rules
- TypeScript Type Safety Governance
- Module boundary enforcement
- Dependency boundary enforcement
- Architecture Brain structure
- AI-safe development standards

Without this stage, existing code may trigger architecture violations even though the architecture
system itself is correct.

---

# Migration Strategy

The migration must be performed **systematically and safely** in the following order:

1. Detect violations
2. Categorize issues
3. Refactor code
4. Validate architecture
5. Regenerate architecture intelligence

The repository must end this stage with **zero architecture guard violations**.

---

# Step 1 — Run Architecture Guard Baseline

Run the architecture guard across the entire repository:

```
bun scripts/architecture-guard/architecture-guard.ts
```

This produces a baseline list of violations.

Typical findings may include:

- unsafe TypeScript types
- forbidden dependencies
- module boundary violations
- circular dependencies

Document the findings before starting migration.

---

# Step 2 — Remove Unsafe TypeScript Constructs

Replace unsafe constructs that bypass the type system.

Forbidden constructs:

```
any
as any
<any>
@ts-ignore
```

Preferred replacements:

| Unsafe     | Replacement                                       |
| ---------- | ------------------------------------------------- |
| any        | unknown                                           |
| as any     | proper domain type                                |
| @ts-ignore | fix type or use @ts-expect-error with explanation |

Example migration:

Before:

```
const data: any = response
```

After:

```
const data: unknown = response
```

Then validate the structure using the validation layer.

---

# Step 3 — Introduce Runtime Validation

External data must be validated before entering the domain layer.

External sources include:

- API responses
- database queries
- environment variables
- third-party services

Correct pattern:

```
const data: unknown = response
const validated = Schema.parse(data)
```

Validation utilities should live in:

```
packages/validation
```

---

# Step 4 — Fix Dependency Boundary Violations

Using:

```
ARCHITECTURE_MAP.json
```

Refactor imports that violate allowed dependencies.

Example violation:

```
apps/mmc importing packages/domain-core
```

Correct pattern:

```
apps/mmc -> packages/api-client -> API -> domain-core
```

The UI layer should never directly depend on domain implementation modules.

---

# Step 5 — Resolve Circular Dependencies

Detect cycles such as:

```
packages/domain-core -> packages/config -> packages/domain-core
```

Resolution strategy:

1. Extract interfaces
2. Move shared contracts to `packages/types`
3. Separate implementation from domain contracts

Goal:

Domain packages remain dependency-safe.

---

# Step 6 — Enforce Module Boundary Rules

Validate module boundaries defined by the architecture model.

Examples of forbidden patterns:

```
apps/* importing apps/*
ui layer importing runtime layer
runtime importing ui layer
```

Allowed structure:

```
apps -> api-client -> runtime -> domain
```

---

# Step 7 — Enforce Explicit Type Boundaries

All exported APIs must declare explicit types.

Example:

Before:

```
export function getUser(id) {
```

After:

```
export function getUser(id: UserId): Promise<User>
```

This prevents implicit `any` propagation.

---

# Step 8 — Update Legacy Scripts

Identify legacy scripts that duplicate functionality provided by the new governance system.

Examples of candidates for removal:

- old dependency scanners
- deprecated architecture check scripts
- experimental validation tools

Replace them with:

```
scripts/architecture-guard
scripts/architecture-brain
```

---

# Step 9 — Regenerate Architecture Brain

Run the architecture brain generator:

```
bun scripts/architecture-brain/generate-architecture-brain.ts
```

This regenerates:

```
docs/ai/context/

  ai-dependency-graph.json
  ai-module-map.json
  ai-layer-map.json
```

These files must reflect the updated repository structure.

---

# Step 10 — Final Architecture Guard Verification

Run strict validation:

```
bun scripts/architecture-guard/architecture-guard.ts --ci
```

Expected result:

```
0 architecture violations
```

If violations remain, they must be resolved before completing the stage.

---

# Repository Cleanup Phase

Perform a final repository cleanup to remove artifacts that no longer serve the architecture system.

Targets:

- unused scripts
- obsolete documentation
- duplicate architecture validation tools
- temporary migration utilities

The final repository should contain **only the canonical governance tools**.

---

# Success Criteria

This stage is complete when:

- all architecture violations are resolved
- unsafe TypeScript usage removed
- dependency boundaries enforced
- circular dependencies eliminated
- module boundaries respected
- architecture brain regenerated
- architecture guard reports zero violations

---

# Long-Term Impact

After this stage, the Zidney repository becomes fully aligned with its architecture governance
system.

Workflow becomes:

```
AI writes code
↓
Architecture Guard validates
↓
Architecture Brain updated
↓
CI enforces safety
```

This ensures the repository remains **stable, deterministic, and safe for AI-assisted development**.
