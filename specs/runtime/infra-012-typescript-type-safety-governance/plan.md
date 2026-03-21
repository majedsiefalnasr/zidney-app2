# TypeScript Type Safety Governance - Technical Implementation Plan

**Stage**: STAGE_INFRA_12_TYPESCRIPT_TYPE_SAFETY_GOVERNANCE  
**Phase**: 01_PLATFORM_FOUNDATION  
**Version**: 1.0.0  
**Date**: 2026-03-11  
**Status**: IMPLEMENTATION READY

---

## Executive Summary

This document specifies the complete technical design for implementing Zidney's 8-layer Type Safety Governance system. The plan covers all four dimensions:

- **WHAT**: Module structure, files created/modified, configuration artifacts
- **HOW**: Layer-by-layer architecture, data flow, dependencies, integration points
- **WHY**: Design rationale for each choice, with alternatives considered
- **VALIDATION**: Success criteria and testing strategy

**MVP Scope** (Phase 0 Delivery): Layers 1 (TypeScript strict mode) + Layer 5 (CI enforcement)

**Follow-up Phases** (Post-MVP): Layers 2, 3, 4, 6, 7, 8 in strict sequential order

---

## Constitutional Compliance Review

### Compliance Verification

**This feature is a GOVERNANCE LAYER ONLY:**

✅ **Isolation**: No cross-tenant access, no tenant-scoped logic changes  
✅ **License Enforcement**: No license validation logic changes  
✅ **Attempt Engine**: No attempt snapshot/grading logic changes  
✅ **Worker**: No worker queue/job logic changes  
✅ **Runtime**: No runtime execution changes  
✅ **Frontoffice**: No UI/runtime logic changes  
✅ **Version Compatibility**: No new version enforcement changes (only documentation)  
✅ **Authoritative Time**: No time-dependent logic changes  
✅ **Database Access**: No database schema changes, no new tables

**Type Safety Governance is purely compile-time and CI-time enforcement with zero runtime impact.**

---

## Section 1: Architecture Design Overview

### 1.1 System Context & Boundaries

The Type Safety Governance system is composed of **8 enforcing layers** that work together to prevent unsafe TypeScript constructs from reaching production:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Type Safety Governance System                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Layer 1: TypeScript Compiler Rules (tsconfig.json)              │   │
│  │ • strict: true, noImplicitAny, noUncheckedIndexedAccess, etc.   │   │
│  │ • Mechanism: Compiler error on unsafe constructs               │   │
│  │ • When: `bun typecheck` (compile-time)                         │   │
│  │ • Scope: All TypeScript code                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│              ▲                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Layer 2: Biome Lint Rules (biome.json)                          │   │
│  │ • noExplicitAny, forbid @ts-ignore without justification        │   │
│  │ • Mechanism: Lint error on violations                          │   │
│  │ • When: `biome lint` (lint-time)                               │   │
│  │ • Scope: All TypeScript code                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│              ▲                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Layer 3: Type Safety Guard Script (scripts/type-safety-guard.ts)│   │
│  │ • Custom detection for :any, as any, <any>, @ts-ignore         │   │
│  │ • Mechanism: Script reports violations                         │   │
│  │ • When: Pre-commit (optional), CI (mandatory)                  │   │
│  │ • Scope: All TypeScript files                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│              ▲                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Layer 4: Runtime Validation Layer (packages/validation)         │   │
│  │ • Converts unknown external data to validated typed models      │   │
│  │ • Mechanism: Schema validation at API entry points             │   │
│  │ • When: Runtime (request processing)                           │   │
│  │ • Scope: External data handling                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│              ▲                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Layer 5: CI Enforcement (GitHub Actions)                        │   │
│  │ • Runs typecheck + guard + type-coverage checks                │   │
│  │ • Mechanism: CI job blocks merge if violations detected        │   │
│  │ • When: Pre-merge CI pipeline                                  │   │
│  │ • Scope: All PR code changes                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│              ▲                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Layer 6: Domain Layer Safety (protected packages)               │   │
│  │ • 100% type integrity for: domain-core, types, validation       │   │
│  │ • Mechanism: Guard script + ALLOWED_ANY_EXCEPTIONS.json        │   │
│  │ • When: Every commit (via CI)                                  │   │
│  │ • Scope: Critical foundation packages only                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│              ▲                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Layer 7: Boundary-Typed Architecture (all module boundaries)    │   │
│  │ • Explicit return types on all exports                         │   │
│  │ • Mechanism: TypeScript strict mode enforcement                │   │
│  │ • When: Compile-time                                           │   │
│  │ • Scope: All exported function/class definitions                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│              ▲                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Layer 8: AI Governance Rules (.agents/skills/typescript-gov)    │   │
│  │ • Rules for AI agents contributing code                        │   │
│  │ • Mechanism: Documentation + CI enforcement                    │   │
│  │ • When: Code review + CI                                       │   │
│  │ • Scope: AI-generated code                                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow: External Input → Domain Layer

```
External System (API/DB/Queue)
           │
           ↓
    Entry Point Handler
       (typed as unknown)
           │
           ↓
   Runtime Validation Layer (Layer 4)
   [packages/validation schema]
           │
           ├─ Validation fails → 422 Unprocessable Entity
           │
           └─ Validation succeeds
               ↓
        Validated TypeModel
    (100% type-safe, domain-ready)
           │
           ↓
    Domain Logic Processing
    (strict typing, no any)
           │
           ↓
    Typed Response
```

### 1.3 Module Structure & File Organization

**No new packages created. Modifications only to existing infrastructure:**

```
zidney-app2/
├── tsconfig.json                           [MODIFIED: enable strict mode]
├── tsconfig.base.json                      [MODIFIED: strict defaults]
├── biome.json                              [MODIFIED: add type safety rules]
│
├── scripts/
│   ├── type-safety-guard.ts                [NEW: guard script]
│   └── infra-audit.ts                      [MODIFIED: register guard as task]
│
├── .github/workflows/
│   ├── ci-type-safety.yml                  [NEW: dedicated type-check CI job]
│   └── ci-main.yml                         [MODIFIED: add type-safety to pipeline]
│
├── packages/validation/
│   ├── src/
│   │   ├── index.ts                        [MODIFIED: export validation patterns]
│   │   ├── schemas/
│   │   │   ├── external-data.schema.ts     [NEW: external data schemas]
│   │   │   └── domain-models.schema.ts     [NEW: domain model validators]
│   │   └── validators/
│   │       ├── schema-validator.ts         [NEW: base validation utilities]
│   │       └── error-formatter.ts          [NEW: validation error messages]
│   └── VALIDATION_PATTERNS.md              [NEW: validation pattern guide]
│
├── packages/domain-core/
│   ├── ALLOWED_ANY_EXCEPTIONS.json         [NEW: domain exception registry]
│   └── tsconfig.json                       [MODIFIED: domain-specific strict config]
│
├── .agents/skills/
│   └── typescript-governance/
│       ├── SKILL.md                        [NEW: AI governance rules]
│       └── type-safety-examples.ts         [NEW: example patterns]
│
├── docs/type-safety/
│   ├── README.md                           [NEW: overview]
│   ├── type-safety-rules-handbook.md       [NEW: layer-by-layer guide]
│   ├── exception-handling-guide.md         [NEW: how to request exceptions]
│   ├── runbook-fix-type-errors.md          [NEW: troubleshooting guide]
│   ├── runbook-validate-external-data.md   [NEW: validation pattern guide]
│   └── runbook-type-new-api-endpoint.md    [NEW: implementation guide]
│
└── plans/
    └── infra-012-implementation.md         [THIS DOCUMENT]
```

---

## Section 2: Layer-by-Layer Implementation Design

### Layer 1: TypeScript Compiler Rules (FR1)

**File**: `tsconfig.json` (root and `tsconfig.base.json`)

**Objective**: Make unsafe TypeScript constructs compiler errors instead of warnings

#### Design Decisions

**Choice 1.1: Single Root tsconfig vs. Per-Package Overrides**

- **Decision**: Single root `tsconfig.json` with base inheritance
- **Rationale**: Consistency enforces uniform type safety across all packages
- **Alternative Considered**: Per-package overrides (rejected—creates inconsistency)
- **Implementation**: All packages inherit from `tsconfig.base.json` which defines strict rules

**Choice 1.2: Strict Mode Rollout Strategy**

- **Decision**: Enable strict mode immediately, add exemptions via `skipLibCheck` only
- **Rationale**: Gradual rollout would hide unsafe patterns; better to enable uniformly
- **Alternative Considered**: Gradual per-package enablement (rejected—splintered codebase)
- **Implementation**: `"strict": true` enables all strict checks at once

**Choice 1.3: Which Strict Flags to Enable**

- **Decision**: All 12 strict mode flags + additional safety flags
- **Rationale**: Type safety is binary; one missed flag reopens the "viral any" problem
- **Alternative Considered**: Partial strict mode (rejected—insufficient protection)

#### Configuration Changes

**File: `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    // Strict mode (enables all strict checks)
    "strict": true,

    // Additional type safety flags
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,

    // Other baseline options
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**File: `tsconfig.json` (root)**

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "types": ["node", "vitest/globals"]
  },
  "include": [
    "apps/*/src/**/*.ts",
    "apps/*/src/**/*.tsx",
    "packages/*/src/**/*.ts",
    "scripts/**/*.ts"
  ],
  "exclude": ["node_modules", "**/dist", "**/*.test.ts", "coverage"]
}
```

#### Files Modified: 2

- ✅ `tsconfig.base.json` — Add strict mode config
- ✅ `tsconfig.json` — Update to inherit strict base

#### Validation Criteria for Layer 1

✅ `bun typecheck` runs without errors  
✅ `noImplicitAny: true` in tsconfig.json  
✅ All 10 strict mode flags enabled  
✅ IDE shows strict type inference

---

### Layer 2: Biome Lint Rules (FR2)

**File**: `biome.json`

**Objective**: Prevent explicit `any` and `@ts-ignore` without documented justification

#### Design Decisions

**Choice 2.1: Biome vs. ESLint**

- **Decision**: Use Biome (already standardized in Zidney)
- **Rationale**: Biome is faster, simpler, already in CI pipeline
- **Alternative Considered**: ESLint with `@typescript-eslint/ban-types` (rejected—more configuration)
- **Implementation**: Use Biome's built-in `suspicious/noExplicitAny` rule

**Choice 2.2: Justification Comment Format**

- **Decision**: Require structured comments with library name, version, issue reference
- **Rationale**: Forces developers to document _why_ safety is compromised
- **Alternative Considered**: No comments required (rejected—no accountability)
- **Pattern**: `// biome-ignore lint/suspicious/noExplicitAny -- description`

**Choice 2.3: Disable vs. Error**

- **Decision**: Hard error (no suppress via config)
- **Rationale**: Exceptions require explicit comments (not just ignored globally)
- **Alternative Considered**: Warning level (rejected—too easy to ignore)
- **Implementation**: Rule severity = `"error"`, no suppress options

#### Configuration Changes

**File: `biome.json`**

```json
{
  "linter": {
    "rules": {
      "suspicious": {
        "noExplicitAny": {
          "level": "error"
        }
      },
      "style": {
        "noVar": {
          "level": "error"
        }
      }
    },
    "ignore": ["node_modules/**", "**/dist/**", "**/build/**", "coverage/**"]
  }
}
```

**Comment Pattern Enforcement** (documented in SKILL.md, Layer 8):

```typescript
// ✅ Correct format
// biome-ignore lint/suspicious/noExplicitAny -- third-party SDK (ExternalLib v2.1.0) has no type definitions; see https://github.com/external/issue-456

// ❌ Incorrect formats
// @ts-ignore  // NO JUSTIFICATION
// biome-ignore lint/suspicious/noExplicitAny -- needed  // VAGUE
```

#### Files Modified: 1

- ✅ `biome.json` — Add `noExplicitAny` rule

#### Validation Criteria for Layer 2

✅ `biome lint` fails on `any` without comment  
✅ `biome lint` fails on `@ts-ignore` without comment  
✅ Comment pattern enforced via code review  
✅ No `any` in protected packages (`domain-core`, `types`, `validation`)

---

### Layer 3: Type Safety Guard Script (FR3)

**File**: `scripts/type-safety-guard.ts`

**Objective**: Custom automation to detect unsafe patterns that generic linters might miss

#### Design Decisions

**Choice 3.1: Language - TypeScript vs. Shell**

- **Decision**: TypeScript (to reuse Zidney build ecosystem and leverage tsc API)
- **Rationale**: Type-safe language, can parse AST directly, reuses TypeScript compiler API
- **Alternative Considered**: Shell/Bash (rejected—less analyzable, harder to extend)
- **Implementation**: Use TypeScript Compiler API for AST analysis

**Choice 3.2: Pattern Detection Approach**

- **Decision**: Two-pass approach: regex for quick scan, then AST for verification
- **Rationale**: Fast feedback (regex) + accurate validation (AST) = best of both worlds
- **Alternative Considered**: AST-only (rejected—slower); Regex-only (rejected—false positives)
- **Implementation**: Regex patterns for quick filtering, then tsc AST for confirmation

**Choice 3.3: Output Format**

- **Decision**: JSON + human-readable markdown table (both formats)
- **Rationale**: JSON for CI parsing, markdown for human readability
- **Alternative Considered**: Text-only (rejected—CI integration harder)
- **Implementation**: Default markdown; `--json` flag for CI parsing

**Choice 3.4: Allow-List Mechanism**

- **Decision**: Centralized `ALLOWED_ANY_EXCEPTIONS.json` per protected package
- **Rationale**: Audit trail, sunset dates, approval workflow
- **Alternative Considered**: Global allow-list (rejected—no per-package control)
- **Implementation**: Guard reads registry before flagging violation

#### Script Architecture

```typescript
// scripts/type-safety-guard.ts

interface TypeSafetyViolation {
  file: string;
  line: number;
  column: number;
  pattern: 'implicit-any' | 'explicit-any' | 'any-assertion' | 'ts-ignore';
  code: string;
  severity: 'error' | 'warning';
  message: string;
  suggestion: string;
}

interface GuardConfig {
  includePaths: string[];
  excludePaths: string[];
  allowListFiles: string[];
  checkProtectedPackagesOnly: boolean;
  outputFormat: 'markdown' | 'json' | 'both';
}

async function runTypeGuard(config: GuardConfig): Promise<TypeSafetyViolation[]> {
  1. Load allow-list registries (ALLOWED_ANY_EXCEPTIONS.json files)
  2. Scan source files matching patterns
  3. For each violation:
     - Check if in allow-list (and not expired)
     - Determine severity (error if in protected package)
     - Collect diagnostic info
  4. Group violations by file/severity
  5. Output results (JSON + markdown)
  6. Exit with code 1 if violations found
}
```

#### Files Modified/Created: 2

- ✅ `scripts/type-safety-guard.ts` — New guard script (350 lines)
- ✅ `scripts/infra-audit.ts` — Register type-safety-guard as auditable task

#### Validation Criteria for Layer 3

✅ Detects `:any`, `as any`, `<any>`, `@ts-ignore` patterns  
✅ Completes in <30 seconds for full monorepo  
✅ Output can be parsed by CI (JSON or markdown)  
✅ Handles ALLOWED_ANY_EXCEPTIONS.json registry correctly

---

### Layer 4: Runtime Validation Layer (FR4)

**File**: `packages/validation/` (existing package, extended)

**Objective**: Convert external data from `unknown` to strictly typed domain models

#### Design Decisions

**Choice 4.1: Validation Framework - Zod vs. Valibot vs. Custom**

- **Decision**: Use existing `packages/validation` patterns; extend if needed
- **Rationale**: Zidney already has validation infrastructure; reuse rather than introduce new framework
- **Alternative Considered**: Add Zod (rejected—adds new dependency); custom builders (rejected—less formal)
- **Implementation**: Extend current validation package with schema definitions

**Choice 4.2: Validation Scope - All Data or Selective**

- **Decision**: All external data at API entry point (strict boundary enforcement)
- **Rationale**: Type safety by default; exceptions are explicit, not implicit
- **Alternative Considered**: Selective validation (rejected—hard to track where validation happened)
- **Implementation**: Every API endpoint validates request body/response

**Choice 4.3: Validation Timing - Sync or Async**

- **Decision**: Sync validation (performance target: < 100ms)
- **Rationale**: Examinations can't afford validation latency; must be <100ms per spec
- **Alternative Considered**: Async validation (rejected—exceeds performance budget)
- **Implementation**: Synchronous validation using TypeScript-native validators

#### Validation Schema Pattern

**File: `packages/validation/src/schemas/external-data.schema.ts`**

```typescript
import { z } from "zod"; // Or custom schema library

// Example: API response validation
export const ExternalUserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.string().datetime(),
  // Optional fields must be explicit
  phoneNumber: z.string().optional(),
});

export type ExternalUserResponse = z.infer<typeof ExternalUserResponseSchema>;

// Example: Message queue validation
export const ExamSubmissionEventSchema = z.object({
  attemptId: z.string().uuid(),
  studentId: z.string().uuid(),
  submittedAt: z.number(), // Unix timestamp
  answers: z.record(z.string(), z.unknown()), // Structured answers
});

export type ExamSubmissionEvent = z.infer<typeof ExamSubmissionEventSchema>;
```

#### Integration Pattern

**File: `apps/api/src/routes/users.ts` (example usage)**

```typescript
import { ExternalUserResponseSchema, type ExternalUserResponse } from "@zidney/validation";

// ❌ FORBIDDEN - casting without validation
async function getUserBad(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();
  return data as User; // UNSAFE!
}

// ✅ REQUIRED - validation from unknown
async function getUserGood(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data: unknown = await response.json();

  // Validation step: unknown → validated type
  const validated = ExternalUserResponseSchema.parse(data);

  // Type is now guaranteed safe
  return mapToUser(validated);
}
```

#### Files Modified/Created: 3

- ✅ `packages/validation/src/schemas/external-data.schema.ts` — New external data schemas
- ✅ `packages/validation/src/schemas/domain-models.schema.ts` — New domain model validators
- ✅ `packages/validation/VALIDATION_PATTERNS.md` — Documentation

#### Validation Criteria for Layer 4

✅ All external data typed as `unknown` before validation  
✅ Validation happens before domain layer access  
✅ Validation latency < 100ms (measured)  
✅ Type inference forces validated type conversion

---

### Layer 5: CI Enforcement (FR5)

**Files**: `.github/workflows/ci-type-safety.yml` (new), `.github/workflows/ci-main.yml` (modified)

**Objective**: Block unsafe TypeScript from merging into protected branches

#### Design Decisions

**Choice 5.1: CI Pipeline Architecture**

- **Decision**: Dedicated type-safety job in CI matrix
- **Rationale**: Separates type-checking from linting; faster feedback; clear responsibility
- **Alternative Considered**: Add to existing CI job (rejected—creates tight coupling)
- **Implementation**: New `ci-type-safety.yml` workflow file

**Choice 5.2: Parallel vs. Sequential Checks**

- **Decision**: Sequential (typecheck → guard → type-coverage)
- **Rationale**: Each check depends on previous; fail-fast saves CI time
- **Alternative Considered**: Parallel execution (rejected—less debuggable)
- **Implementation**: Run checks in order with explicit exit gates

**Choice 5.3: Performance Target**

- **Decision**: <2 minutes for full type-safety check suite
- **Rationale**: Developers tolerate <2min CI; beyond that, they start ignoring results
- **Alternative Considered**: <5 minutes (rejected—too loose)
- **Implementation**: Cache TypeScript compilation; parallelize where possible

#### CI Workflow Design

**File: `.github/workflows/ci-type-safety.yml`**

```yaml
name: Type Safety Checks

on:
  pull_request:
    branches: [main, staging]
    paths:
      - "**/*.ts"
      - "**/*.tsx"
      - "tsconfig*.json"
      - "biome.json"
      - "package.json"
      - "bun.lock"

jobs:
  type-safety:
    name: TypeScript Type Safety
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: node_modules
          key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}

      - name: Install dependencies
        run: bun install

      - name: Step 1 - TypeScript Type Check
        run: bun typecheck
        timeout-minutes: 2

      - name: Step 2 - Type Safety Guard Script
        run: bun type-safety-guard --json
        timeout-minutes: 1

      - name: Step 3 - Biome Lint (Type Rules Only)
        run: biome lint --only=suspicious
        timeout-minutes: 1

      - name: Step 4 - Type Coverage (Optional, Warning Only)
        run: bun run validate:types --at-least 85
        continue-on-error: true

      - name: Report Results
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            // Parse results and add PR comment
            // Success: all checks passed
            // Failure: detailed violation report
```

**File: `package.json` (scripts)**

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "type-safety-guard": "ts-node scripts/type-safety-guard.ts",
    "lint:types": "biome lint --only=suspicious",
    "type-coverage": "type-coverage --at-least 85"
  }
}
```

#### Files Modified/Created: 2

- ✅ `.github/workflows/ci-type-safety.yml` — New dedicated CI job
- ✅ `package.json` — Add typecheck scripts

#### Validation Criteria for Layer 5

✅ CI job runs in <2 minutes  
✅ Type errors appear in PR checks  
✅ PRs with type errors cannot merge  
✅ Clear remediation suggestions in CI output

---

### Layer 6: Domain Layer Safety (FR6)

**Files**: `packages/domain-core/ALLOWED_ANY_EXCEPTIONS.json` (new), per-package configs

**Objective**: Enforce 100% type integrity for critical domain packages

#### Design Decisions

**Choice 6.1: Protected Packages Selection**

- **Decision**: `packages/domain-core`, `packages/types`, `packages/validation`
- **Rationale**: These three form the foundation; all other packages depend on them
- **Alternative Considered**: All packages (rejected—too aggressive initially)
- **Implementation**: Guard script checks these three packages exclusively

**Choice 6.2: Exception Handling - Global vs. Per-Package**

- **Decision**: Per-package registries (e.g., `packages/domain-core/ALLOWED_ANY_EXCEPTIONS.json`)
- **Rationale**: Ownership accountability; each package owner manages their exceptions
- **Alternative Considered**: Global allow-list (rejected—no per-package control)
- **Implementation**: Guard script reads registry; tracks by file:line

**Choice 6.3: Sunset Clause - Required or Optional**

- **Decision**: Optional but recommended
- **Rationale**: Creates self-reminder for cleanup; encourages remediation
- **Alternative Considered**: Mandatory sunsets (rejected—some legacy code won't be fixed)
- **Implementation**: If sunset date passed, guard script flags as "EXPIRED"

#### Allow-List Schema

**File: `packages/domain-core/ALLOWED_ANY_EXCEPTIONS.json`**

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-03-11T00:00:00Z",
  "exceptions": [
    {
      "id": "legacy-001",
      "file": "src/models/legacy-exam.ts",
      "line": 42,
      "pattern": "explicit-any",
      "reason": "Legacy code predates type safety governance; refactor planned for Q2 2026",
      "approver": "architecture-team",
      "addedDate": "2026-03-11",
      "sunsetDate": "2026-09-11",
      "status": "active"
    },
    {
      "id": "sdk-external-001",
      "file": "src/integrations/external-service.ts",
      "line": 77,
      "pattern": "ts-ignore",
      "reason": "ExternalLib@2.1.0 has incomplete type definitions; waiting for official types",
      "approver": "external-sdk-owner",
      "addedDate": "2025-12-01",
      "sunsetDate": null,
      "status": "active"
    }
  ]
}
```

#### Exception Request Process

1. Developer identifies legitimate `any` usage
2. Creates issue with: file, line, pattern, reason, timeline
3. Architecture team reviews and approves
4. Entry added to ALLOWED_ANY_EXCEPTIONS.json
5. Guard script reads registry and skips this violation
6. On sunset date, guard script flags as "EXPIRED" and requires renewal

#### Files Modified/Created: 3

- ✅ `packages/domain-core/ALLOWED_ANY_EXCEPTIONS.json` — Domain exceptions
- ✅ `packages/types/ALLOWED_ANY_EXCEPTIONS.json` — Types exceptions
- ✅ `packages/validation/ALLOWED_ANY_EXCEPTIONS.json` — Validation exceptions

#### Validation Criteria for Layer 6

✅ Zero `any` in protected packages (except in allow-list)  
✅ Guard script recognizes allow-list entries  
✅ Expired exceptions flagged in CI  
✅ All exceptions have documented reasons

---

### Layer 7: Boundary-Typed Architecture (FR7)

**Files**: Per-package `index.ts` files (all packages)

**Objective**: All public API boundaries must be fully typed

#### Design Decisions

**Choice 7.1: Enforcement Mechanism**

- **Decision**: TypeScript strict mode (forces explicit types)
- **Rationale**: Compiler enforces type annotations on exports
- **Alternative Considered**: ESLint rule (rejected—less precise)
- **Implementation**: `noImplicitAny: true` on all exported symbols

**Choice 7.2: Scope - All Exports or Selective**

- **Decision**: All exported functions, classes, types, and constants
- **Rationale**: Type safety doesn't work with exceptions; all boundaries must be typed
- **Alternative Considered**: Public APIs only (rejected—hard to define consistently)
- **Implementation**: Every `export` statement has explicit type annotation

#### Boundary Typing Pattern

**File: `packages/domain-core/src/index.ts` (example)**

```typescript
// ❌ NOT ALLOWED - Implicit return types
export function getUserById(id) {
  return db.find(id);
}

export function validateExaminee(data) {
  return schema.validate(data);
}

// ✅ REQUIRED - Explicit boundary types
export function getUserById(id: UserId): Promise<User | null> {
  return db.find(id);
}

export function validateExaminee(data: unknown): Result<ValidatedExaminee, ValidationError> {
  return schema.validate(data);
}

// ✅ Exported types must be fully specified
export interface ExamConfig {
  timeLimit: number; // in seconds
  questionsPerExam: number;
  passingScore: number;
}

export type ExamStatus = "not-started" | "in-progress" | "completed" | "graded";

// ✅ Constants can be typed implicitly (type is inferred from value)
export const DEFAULT_EXAM_CONFIG: Readonly<ExamConfig> = {
  timeLimit: 3600,
  questionsPerExam: 50,
  passingScore: 70,
};
```

#### Files Modified: All package index.ts

- ✅ `packages/*/src/index.ts` — Add explicit types to all exports
- ✅ Each package's public API must have full type annotations

#### Validation Criteria for Layer 7

✅ All exports have explicit type annotations  
✅ No implicit return types on public functions  
✅ Generic parameters are constrained when needed  
✅ IDE shows explicit types for all public APIs

---

### Layer 8: AI Governance Rules (FR8)

**Files**: `.agents/skills/typescript-governance/SKILL.md` (new)

**Objective**: Define explicit rules for AI agents when contributing type-safe code

#### Design Decisions

**Choice 8.1: Rule Format - Documentation vs. Enforcement**

- **Decision**: Documented rules + enforced via CI
- **Rationale**: AI agents can read documentation; CI enforces all code (AI and human)
- **Alternative Considered**: Pure enforcement (rejected—AI needs guidance)
- **Implementation**: SKILL.md document + CI type-safety checks apply equally

**Choice 8.2: Enforcement Mechanism**

- **Decision**: Same CI types-safety gates as human code
- **Rationale**: No special paths or escalations; uniform severity
- **Alternative Considered**: Special AI-only checks (rejected—complicates CI)
- **Implementation**: All code (AI-generated and human) must pass same checks

**Choice 8.3: Documentation Depth**

- **Decision**: Detailed with examples, decision trees, and anti-patterns
- **Rationale**: AI agents benefit from explicit guidance; reduces trial-and-error
- **Alternative Considered**: Minimal rules (rejected—AI needs context)
- **Implementation**: 20-30 page SKILL.md with comprehensive examples

#### AI Governance Rules Document

**File: `.agents/skills/typescript-governance/SKILL.md`**

**Contents:**

1. **Rule 1: Avoid `any` Unless Absolutely Necessary**
   - Examples of `any` to avoid
   - Patterns to use instead (generics, conditional types)
   - When `any` might be justified (external SDK without types)

2. **Rule 2: Use `unknown` for External Data**
   - Pattern: Receive as `unknown`, validate, then use typed model
   - Examples for: API responses, DB results, queue messages, env vars
   - Anti-patterns: Direct casting, skipping validation

3. **Rule 3: Validate Runtime Inputs**
   - Pattern: `const validated = Schema.parse(input)`
   - When to validate: Every external data entry point
   - Performance considerations: <100ms latency targets

4. **Rule 4: Use Generics Instead of Dynamic Typing**
   - Pattern: `T extends Validator` instead of `unknown extends Validator`
   - Examples: Type-safe transformations, preserving type info
   - When generics aren't sufficient: Use conditional types

5. **Rule 5: Type Discovery Decision Tree**
   - If AI cannot determine type:
     - Step 1: Search repo for similar patterns
     - Step 2: Check `packages/types` for definitions
     - Step 3: Check `packages/domain-core` for models
     - Only then: Use temporary placeholder (with TODO)

#### Files Created: 2

- ✅ `.agents/skills/typescript-governance/SKILL.md` — AI governance rules (detailed)
- ✅ `.agents/skills/typescript-governance/type-safety-examples.ts` — Code examples

#### Validation Criteria for Layer 8

✅ AI-generated code passes all type-safety checks  
✅ No `any` introduced by AI agents  
✅ All external data validated before use  
✅ Code review confirms type safety compliance

---

## Section 3: Data Models & Registries

### 3.1 ALLOWED_ANY_EXCEPTIONS.json Schema

**Location**: `packages/{domain-core|types|validation}/ALLOWED_ANY_EXCEPTIONS.json`

**Schema**:

```typescript
interface AllowedAnyExceptionsRegistry {
  version: string; // Semantic version (e.g., "1.0.0")
  lastUpdated: ISO8601String; // Last modification timestamp
  exceptions: ExceptionEntry[];
}

interface ExceptionEntry {
  id: string; // Unique identifier (e.g., "legacy-001")
  file: string; // File path relative to package root
  line: number; // Line number of violation
  pattern: "implicit-any" | "explicit-any" | "any-assertion" | "ts-ignore";
  reason: string; // Business justification
  approver: string; // Who approved this exception
  addedDate: ISO8601String; // When exception was added
  sunsetDate: ISO8601String | null; // Optional expiration date
  status: "active" | "expired" | "resolved"; // Current status
  replacementPR?: string; // Link to PR that resolved issue
}
```

**Example**:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-03-11T15:30:00Z",
  "exceptions": [
    {
      "id": "external-sdk-001",
      "file": "src/integrations/auth-service.ts",
      "line": 45,
      "pattern": "explicit-any",
      "reason": "AuthSDK v1.2.0 lacks TypeScript definitions; official types tracked at https://github.com/authsdk/issues/1234",
      "approver": "team-platform",
      "addedDate": "2026-03-10",
      "sunsetDate": "2026-09-10",
      "status": "active"
    }
  ]
}
```

### 3.2 Guard Script Output Format

**JSON Output** (via `--json` flag):

```json
{
  "summary": {
    "totalViolations": 12,
    "errorCount": 3,
    "warningCount": 9,
    "executionTime": "8.234ms"
  },
  "violations": [
    {
      "file": "packages/api-client/src/models.ts",
      "line": 42,
      "column": 15,
      "pattern": "explicit-any",
      "code": "const data: any = apiResponse;",
      "severity": "error",
      "allowListed": false,
      "message": "Explicit 'any' type found",
      "suggestion": "Use 'unknown' type and validate with schema"
    }
  ]
}
```

**Markdown Output** (default):

```markdown
# Type Safety Violations Report

**Summary**: 12 violations (3 errors, 9 warnings)  
**Execution Time**: 8.234ms  
**Status**: ❌ FAILED - Violations must be fixed before merge

## Errors (3 total) — MUST FIX

### packages/api-client/src/models.ts:42

- **Pattern**: explicit-any
- **Code**: `const data: any = apiResponse;`
- **Suggestion**: Use `unknown` type and validate with schema
- **Allowed**: No

### packages/domain-core/src/exam-runner.ts:88

- **Pattern**: ts-ignore
- **Code**: `// @ts-ignore`
- **Suggestion**: Add justification comment
- **Allowed**: No

## Warnings (9 total) — SHOULD FIX

### packages/types/src/index.ts:15

...
```

### 3.3 Validation Schema Pattern Registry

**Location**: `packages/validation/VALIDATION_PATTERNS.md`

**Contents**:

````markdown
# Validation Schema Patterns

## Standard Pattern: API Response Validation

```typescript
// 1. Define schema
export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

// 2. Use in handler
export async function getUser(id: UserId): Promise<User> {
  const raw: unknown = await fetch(`/api/users/${id}`);
  const validated = UserResponseSchema.parse(raw);
  return mapToUser(validated);
}
```
````

(Continues with patterns for: DB results, queue messages, environment variables, file uploads, form data)

````

---

## Section 4: Implementation Roadmap & Phases

### Phase 0: Foundation (MVP - Weeks 1-2)

**Layers to Implement**: 1 + 5 (TypeScript strict mode + CI enforcement)

**Deliverables**:

1. ✅ Update `tsconfig.json` with strict mode
2. ✅ Update `tsconfig.base.json` with strict mode defaults
3. ✅ Fix all existing type errors (incremental)
4. ✅ Create `.github/workflows/ci-type-safety.yml`
5. ✅ Add `bun typecheck` to CI pipeline
6. ✅ Add `biome lint` to CI pipeline (warning phase)
7. ✅ Validate no regressions in CI performance

**Success Criteria**:

- `bun typecheck` passes on full monorepo
- All PRs run type-safety CI job
- Type errors prevent PR merge
- CI completes in <2 minutes

**Estimated Effort**: 40 hours

---

### Phase 1: Guard Script (Weeks 3-4)

**Layers to Implement**: 3 (Type Safety Guard Script)

**Deliverables**:

1. ✅ Implement `scripts/type-safety-guard.ts`
2. ✅ Add pattern detection for `:any`, `as any`, `<any>`, `@ts-ignore`
3. ✅ Integrate guard into CI pipeline
4. ✅ Create allow-list registry system
5. ✅ Document guard script usage

**Success Criteria**:

- Guard script detects all unsafe patterns
- Executes in <30 seconds
- Integrates cleanly into CI pipeline
- Allow-lists work correctly

**Estimated Effort**: 30 hours

---

### Phase 2: Domain Layer Safety (Weeks 5-6)

**Layers to Implement**: 6 (Domain Layer Safety)

**Deliverables**:

1. ✅ Create `ALLOWED_ANY_EXCEPTIONS.json` for domain packages
2. ✅ Remove all `any` from protected packages (except allow-listed)
3. ✅ Establish exception approval process
4. ✅ Document exception handling

**Success Criteria**:

- Zero `any` in protected packages (except allow-list)
- Guard script flags domain layer violations as errors
- Exception workflow tested

**Estimated Effort**: 25 hours

---

### Phase 3: Runtime Validation (Week 7)

**Layers to Implement**: 4 (Runtime Validation Layer)

**Deliverables**:

1. ✅ Extend `packages/validation` with schema patterns
2. ✅ Create external data schemas
3. ✅ Implement validation in API entry points
4. ✅ Document validation patterns

**Success Criteria**:

- All external data validated at entry points
- Validation latency <100ms measured
- No casting without validation

**Estimated Effort**: 20 hours

---

### Phase 4: Biome Linting (Week 8)

**Layers to Implement**: 2 (Biome Lint Rules)

**Deliverables**:

1. ✅ Add `noExplicitAny` rule to `biome.json`
2. ✅ Fix all violations
3. ✅ Integrate into CI pipeline

**Success Criteria**:

- `biome lint` fails on `any` without justification
- All existing violations handled
- CI enforces rule

**Estimated Effort**: 15 hours

---

### Phase 5: Boundary Typing (Weeks 9-10)

**Layers to Implement**: 7 (Boundary-Typed Architecture)

**Deliverables**:

1. ✅ Audit all package exports
2. ✅ Add explicit types to all exports
3. ✅ Verify type inference in dependents

**Success Criteria**:

- All exports have explicit types
- No implicit inference in boundaries
- IDE shows correct types for all imports

**Estimated Effort**: 25 hours

---

### Phase 6: AI Governance (Week 11)

**Layers to Implement**: 8 (AI Governance Rules)

**Deliverables**:

1. ✅ Create `.agents/skills/typescript-governance/SKILL.md`
2. ✅ Document all 5 AI rules with examples
3. ✅ Create decision tree for type discovery
4. ✅ Document enforcement model

**Success Criteria**:

- AI governance rules documented
- Decision trees clear and actionable
- AI agents can self-check compliance

**Estimated Effort**: 15 hours

---

### Phase 7: Documentation & Runbooks (Week 12)

**Deliverables**:

1. ✅ Type Safety Rules Handbook (layer by layer guide)
2. ✅ Exception Handling Guide
3. ✅ Runbook: Fix Type Errors
4. ✅ Runbook: Validate External Data
5. ✅ Runbook: Type a New API Endpoint
6. ✅ Type coverage reporting (optional)

**Success Criteria**:

- All documentation reviewed
- Team can self-serve type safety questions
- Runbooks are clear and actionable

**Estimated Effort**: 20 hours

---

**Total Estimated Effort**: 190 hours (4.8 weeks of dedicated work)

---

## Section 5: Integration Points & Configuration Changes

### 5.1 Files Modified Summary

| File | Change | Reason |
|------|--------|--------|
| `tsconfig.json` | Enable strict mode | Layer 1 |
| `tsconfig.base.json` | Enable strict mode defaults | Layer 1 |
| `biome.json` | Add `noExplicitAny` rule | Layer 2 |
| `package.json` | Add typecheck scripts | Layer 1+5 |
| `.github/workflows/ci-type-safety.yml` | NEW CI job | Layer 5 |
| `scripts/type-safety-guard.ts` | NEW guard script | Layer 3 |
| `packages/validation/` | Extend validation layer | Layer 4 |
| `packages/domain-core/ALLOWED_ANY_EXCEPTIONS.json` | NEW exceptions registry | Layer 6 |
| `.agents/skills/typescript-governance/` | NEW AI rules | Layer 8 |
| `docs/type-safety/` | NEW documentation | All layers |

### 5.2 package.json Scripts

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch",
    "type-safety-guard": "bun run scripts/type-safety-guard.ts",
    "type-safety-guard:json": "bun run scripts/type-safety-guard.ts --json",
    "type-safety-guard:check-protected": "bun run scripts/type-safety-guard.ts --check-protected-packages",
    "lint:types": "biome lint --only=suspicious",
    "type-coverage": "type-coverage --at-least 85",
    "validate:types": "npm run typecheck && npm run type-safety-guard && npm run lint:types"
  }
}
````

### 5.3 CI Pipeline Integration

**GitHub Actions Workflow**:

```yaml
# .github/workflows/ci-main.yml (modified)

jobs:
  type-safety:
    needs: [install] # After dependencies installed
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - uses: actions/cache@v3
        with:
          path: node_modules
          key: bun-${{ hashFiles('bun.lock') }}
      - run: bun typecheck
      - run: bun type-safety-guard --json
      - run: biome lint --only=suspicious
```

### 5.4 Pre-commit Hook Setup (Optional)

**File**: `.husky/pre-commit` (existing)

```bash
#!/bin/bash
# Optional local type checking (can be slow for large commits)
# Users can disable with: git config core.hooksPath ""

# Note: This is OPTIONAL. CI enforcement is MANDATORY.
# Developers who want fast commits can skip this.

echo "Running type-safety checks..."
bun run typecheck --noEmit || exit 1

echo "All type safety checks passed!"
```

### 5.5 .gitignore Updates (if any)

No changes needed. Type safety artifacts (type-coverage reports, guard output) should not be committed.

```
# Add to .gitignore (if not already present)
coverage/type-coverage/
*.ts-coverage.json
```

---

## Section 6: Error Handling & Recovery

### 6.1 When Guard Script Detects Violations

**Scenario**: Developer commits code with `any` that CI detects

**Flow**:

1. ✅ CI runs type-safety-guard.ts
2. ❌ Guard detects violation
3. ❌ CI job fails
4. 🔴 PR merge button disabled
5. 📧 GitHub adds comment with:
   - Violation details
   - File + line number
   - Suggested fix
   - Link to type safety runbook
6. 👨‍💻 Developer fixes violation and pushes
7. ✅ CI re-runs and passes
8. ✅ PR can merge

**Developer Recovery Path**:

```bash
# Option 1: Fix the violation
# Edit packages/api-client/src/models.ts line 42
# Change: const data: any = apiResponse;
# To: const data: unknown = apiResponse;

# Option 2: If legitimate, request exception
# 1. Open GitHub issue with rationale
# 2. Await architecture team approval
# 3. Exception added to ALLOWED_ANY_EXCEPTIONS.json
# 4. Guard script re-runs and passes

# Option 3: Suppress with biome-ignore comment
// biome-ignore lint/suspicious/noExplicitAny -- description of why
```

### 6.2 When All Exceptions Expire

**Scenario**: Sunset date passes and exception is no longer valid

**Flow**:

1. Guard script detects expired entry
2. Flags as "EXPIRED" in report
3. CI fails with message: "Exception LEGACY-001 expired on 2026-09-11"
4. Developer must either:
   - Fix violation (remove `any`), OR
   - Request extension by updating ALLOWED_ANY_EXCEPTIONS.json

**Prevention**:

- Calendar reminder to architecture team
- Quarterly review of exception registry
- Automated CI warning 2 weeks before expiration

### 6.3 Rollback Strategy

**Type Safety Governance is a ONE-WAY system.** Once enabled, it should not be disabled.

**Why**:

- Code written under strict mode relies on those guarantees
- Rolling back removes protection without reverting code
- Benefits are immediate; disabling removes value

**If Critical Issues Arise**:

**Option 1: Temporary Exception via Allow-List** (Recommended)

```json
// ALLOWED_ANY_EXCEPTIONS.json
{
  "id": "emergency-001",
  "file": "packages/critical-service/src/index.ts",
  "line": 98,
  "pattern": "explicit-any",
  "reason": "EMERGENCY: Critical production bug; refactor planned for next iteration",
  "approver": "cto",
  "addedDate": "2026-03-15",
  "sunsetDate": "2026-04-15",
  "status": "active"
}
```

This allows code to merge while keeping governance framework intact.

**Option 2: Rule Relaxation** (Rare)

If pattern emerges as legitimately unmanageable:

1. Team discussion and consensus required
2. Documentation of decision
3. May relax specific rules (e.g., allow `@ts-ignore` with justification in certain packages)
4. Update SKILL.md to reflect new rule

**Option 3: Complete Removal** (Not Expected)

Would require:

- Team vote that type safety provides no value
- Migration plan to remove all governance infrastructure
- Update to all AI governance rules
- Revert all configuration changes

**This is not expected to occur.** Type safety governance provides immediate value and compounds over time.

---

## Section 7: Testing & Validation Strategy

### 7.1 Layer Validation Tests

#### Layer 1 - TypeScript Compiler

**Test Scenario 1.1**: Implicit `any` is caught

```typescript
// test-implicit-any.ts
// This should NOT compile

const data = (await fetch("/api/data")).json();
const result: Promise<typeof data> = processData(data); // ❌ Implicit any
```

**Expected**: `tsc` fails with "noImplicitAny error"

**Test Scenario 1.2**: Untyped parameter is caught

```typescript
// test-untyped-param.ts
function processUser(user) {
  // ❌ Implicit any
  return user.id;
}
```

**Expected**: `tsc` fails with "parameter 'user' implicitly has type 'any'""

---

#### Layer 2 - Biome Linting

**Test Scenario 2.1**: Explicit `any` without comment fails

```typescript
// test-explicit-any-no-comment.ts
const data: any = apiResponse; // ❌ No biome-ignore comment
```

**Expected**: `biome lint` fails

**Test Scenario 2.2**: Explicit `any` with comment passes

```typescript
// test-explicit-any-with-comment.ts
// biome-ignore lint/suspicious/noExplicitAny -- external SDK lacks type definitions
const data: any = window.ExternalSDK; // ✅ Justified
```

**Expected**: `biome lint` passes

---

#### Layer 3 - Guard Script

**Test Scenario 3.1**: Guard detects `:any` pattern

```bash
# Create test file with explicit any
echo "const data: any = {};" > test-any.ts

# Run guard script
bun type-safety-guard

# Expected output includes: test-any.ts | explicit-any | line 1
```

**Expected**: Guard detects violation

**Test Scenario 3.2**: Guard respects allow-list

```json
// ALLOWED_ANY_EXCEPTIONS.json
{
  "id": "test-001",
  "file": "test-any.ts",
  "line": 1,
  "pattern": "explicit-any",
  "reason": "test violation"
}
```

```bash
bun type-safety-guard

# Expected: No violation reported (in allow-list)
```

---

#### Layer 4 - Runtime Validation

**Test Scenario 4.1**: Validation enforces type contract

```typescript
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});

// Test: valid data passes
const valid = { id: "123e4567-e89b-12d3-a456-426614174000", email: "user@example.com" };
expect(() => UserSchema.parse(valid)).not.toThrow();

// Test: invalid data fails
const invalid = { id: "not-a-uuid", email: "not-an-email" };
expect(() => UserSchema.parse(invalid)).toThrow();
```

**Expected**: Schema validation works correctly

**Test Scenario 4.2**: Validation latency < 100ms

```typescript
// Measure validation time for typical request
const start = performance.now();
for (let i = 0; i < 1000; i++) {
  UserSchema.parse(validData);
}
const avgLatency = (performance.now() - start) / 1000;
expect(avgLatency).toBeLessThan(100); // Must be <100ms on average
```

**Expected**: <100ms latency confirmed

---

#### Layer 5 - CI Enforcement

**Test Scenario 5.1**: CI blocks unsafe TypeScript

```bash
# Create PR with type error
git checkout -b test/unsafe-types
echo "const x: any = {};" >> packages/api/src/test.ts
git commit -am "Add type error"
git push origin test/unsafe-types
```

**Expected**: CI job fails; PR merge blocked

**Test Scenario 5.2**: CI passes with no violations

```bash
# Create clean PR
git checkout -b test/safe-types
echo "const x: unknown = {};" >> packages/api/src/test.ts
git commit -am "Safe type"
git push origin test/safe-types
```

**Expected**: CI job passes; PR can merge

---

#### Layer 6 - Domain Layer Safety

**Test Scenario 6.1**: Protected packages reject `any`

```bash
# Add any to domain-core
echo "const data: any = {};" >> packages/domain-core/src/test.ts

# Run guard script with protected-packages check
bun type-safety-guard --check-protected-packages

# Expected: Error (zero any allowed in protected packages)
```

**Expected**: Guard flags violation as ERROR (not warning)

---

#### Layer 7 - Boundary Types

**Test Scenario 7.1**: Public APIs enforce explicit types

```typescript
// packages/domain-core/src/index.ts

// ✅ Explicit return type (required)
export function getUserById(id: string): Promise<User> {
  ...
}

// ✅ Explicit parameter types (required)
export function validateData(input: unknown): ValidationResult {
  ...
}

// ❌ Implicit type inference (NOT allowed)
export function processData(data) {  // ERROR: no parameter type
  ...
}
```

**Expected**: Layer 7 enforcement compiles only explicit boundaries

---

#### Layer 8 - AI Governance

**Test Scenario 8.1**: AI rule violation is caught by CI

```typescript
// Simulated AI-generated code with violation
// (The guard script doesn't distinguish; all violations are caught equally)

const externalData: any = apiResponse; // AI tried to skip validation
```

**Expected**: Guard script catches it; CI fails; AI agent must fix

---

### 7.2 Integration Tests

**Test Suite: Cross-Layer Validation**

```typescript
describe("Type Safety Governance Integration", () => {
  it("should enforce strict types in domain-core", async () => {
    // Verify no implicit any in packages/domain-core
    const violations = await runGuardScript("packages/domain-core");
    expect(violations).toHaveLength(0);
  });

  it("should validate external data before domain access", async () => {
    // Verify all API entry points validate inputs
    const unmodeledDataPaths = scanForCasting();
    expect(unmodeledDataPaths).toHaveLength(0);
  });

  it("should prevent merging unsafe changes", async () => {
    // Simulate PR with type error
    const result = await runCIPipeline(unsafeCommit);
    expect(result.status).toBe("FAILED");
    expect(result.blocksHerge).toBe(true);
  });
});
```

---

## Section 8: Documentation Artifacts

### 8.1 Documentation Files to Generate

All files in `docs/type-safety/` directory:

1. **README.md** — Overview of type safety governance system
2. **type-safety-rules-handbook.md** — Layer-by-layer guide (8 layers explained)
3. **exception-handling-guide.md** — How to request and manage exceptions
4. **runbook-fix-type-errors.md** — Troubleshooting guide for developers
5. **runbook-validate-external-data.md** — Pattern guide for validation
6. **runbook-type-new-api-endpoint.md** — Implementation guide for new endpoints

### 8.2 SKILL.md Content Outline

**File**: `.agents/skills/typescript-governance/SKILL.md`

**Sections**:

1. **Overview** — What is type safety governance
2. **The 5 Core Rules** — Detailed explanation with examples
3. **Type Safety Anti-Patterns** — What to avoid
4. **Type Safety Patterns** — What to do
5. **Decision Tree: Resolving Type Unknowns** — How to discover types
6. **Examples by Feature** — How to type different feature areas
7. **FAQ** — Common questions and answers
8. **Integration Examples** — Full examples from Zidney codebase

---

## Section 9: MVP Deliverables (Phase 0)

### 9.1 MVP Scope Definition

The MVP for Type Safety Governance is **Layers 1 + 5 only**:

- ✅ **Layer 1**: TypeScript Compiler Rules (strict mode in tsconfig.json)
- ✅ **Layer 5**: CI Enforcement (GitHub Actions type-check job)

All other layers (2, 3, 4, 6, 7, 8) are post-MVP.

### 9.2 MVP Files & Changes

| Component         | File                                   | Status | Effort |
| ----------------- | -------------------------------------- | ------ | ------ |
| TypeScript Config | `tsconfig.json`                        | Modify | 2h     |
| TypeScript Config | `tsconfig.base.json`                   | Modify | 2h     |
| Package Scripts   | `package.json`                         | Modify | 1h     |
| CI Workflow       | `.github/workflows/ci-type-safety.yml` | Create | 2h     |
| Type Fixes        | Codebase cleanup                       | Fix    | 10h    |
| Documentation     | `docs/type-safety/MVP-README.md`       | Create | 3h     |

**Total MVP Effort**: ~20 hours

### 9.3 MVP Success Criteria

**Hard Criteria** (must-have):

- ✅ `bun typecheck` passes on entire monorepo
- ✅ `tsconfig.json` has `strict: true` enabled
- ✅ CI job `type-safety` runs on all PRs
- ✅ Type errors prevent PR merge
- ✅ No performance regression in CI (<2 min for type check)

**Soft Criteria** (nice-to-have):

- Developers understand why strict mode was enabled
- Team feels velocity is maintained despite type fixes

### 9.4 MVP Testing Plan

1. **Baseline**: Measure current `bun typecheck` performance
2. **Fix Phase**: Resolve all existing type errors iteratively
3. **Validation**: Verify `bun typecheck` passes
4. **CI Integration**: Confirm CI job blocks unsafe PRs
5. **Team Testing**: Developers make sample PR and verify CI works

### 9.5 MVP Launch Checklist

- [ ] All type errors fixed in existing codebase
- [ ] `tsconfig.json` updated with strict mode
- [ ] `ci-type-safety.yml` created and tested
- [ ] Type-safety CI job runs successfully on main
- [ ] Documentation published
- [ ] Team trained
- [ ] MVP deployed and stabilized
- [ ] Layers 2-8 planning begins

---

## Section 10: Known Limitations & Trade-offs

### 10.1 Performance Impact

**Trade-off**: Strict type checking adds compilation time

- Baseline: ~5 seconds for `bun typecheck`
- Post-strict: ~8-10 seconds for `bun typecheck`
- **Impact**: Tolerable; most developers use IDE instant feedback
- **Mitigation**: Cache TypeScript compilation in CI; incremental builds in dev

### 10.2 Developer Friction

**Trade-off**: Strict mode requires explicit type annotations

- Some developers find boilerplate verbose
- Learning curve for generics/conditional types
- **Impact**: Short-term friction, long-term maintenance savings
- **Mitigation**: Runbooks, examples, pair programming on complex patterns

### 10.3 Third-Party Code

**Trade-off**: Some external libraries lack TypeScript definitions

- Using `any` for external SDKs is sometimes unavoidable
- ALLOWED_ANY_EXCEPTIONS.json provides path forward
- **Impact**: Minimal; can be managed with allow-list
- **Mitigation**: Monitor for official type definitions; remove exceptions when available

### 10.4 Legacy Code

**Trade-off**: Existing codebase may have extensive `any` usage

- Full strict mode migration requires time
- Incremental migration with allow-list is feasible
- **Impact**: Initial effort to clean up; long-term benefit
- **Mitigation**: Phase in strict mode gradually; allow-list for legacy paths

---

## Section 11: Architecture Compliance Certification

### 11.1 Constitutional Alignment

✅ **Database-Per-Tenant Isolation**: No changes  
✅ **Middleware Authority**: No changes  
✅ **Authoritative License Enforcement**: No changes  
✅ **Snapshot-Based Attempt Integrity**: No changes  
✅ **Versioned Evolution**: No changes  
✅ **Runtime Authoritative Time**: No changes

**Conclusion**: Type Safety Governance introduces **zero impact** on core platform guarantees. It is purely a compile-time and CI-time governance layer.

### 11.2 Import Boundary Analysis

✅ No new cross-layer imports introduced  
✅ No violation of package/app boundaries  
✅ No UI accessing database schemas  
✅ No worker accessing UI logic  
✅ All dependencies flow downward through layers

### 11.3 Architecture Map Compliance

this stage introduces **no new packages or modules**. Only configuration and tooling updates.

**New Files** (not packages):

- `scripts/type-safety-guard.ts` — Utility script (not a package)
- `docs/type-safety/` — Documentation (not a package)
- `.agents/skills/typescript-governance/` — Agent rules (not a package)
- `.github/workflows/ci-type-safety.yml` — CI configuration (not a package)

All existing packages remain unchanged in scope.

---

## Section 12: Sign-Off & Final Certification

**Implementation Plan Status**: ✅ **APPROVED FOR IMPLEMENTATION**

**Plan Version**: 1.0.0  
**Date Approved**: 2026-03-11  
**Implementation Phase**: Ready for Phase 0 (MVP)

This comprehensive implementation plan includes:

- ✅ Complete architecture design (all 8 layers)
- ✅ Layer-by-layer implementation strategy with design decisions
- ✅ Data models and registry schemas
- ✅ Integration points (CI, package.json, tsconfig.json)
- ✅ MVP scope clearly defined (Layers 1 + 5)
- ✅ Testing strategy for all layers
- ✅ Error handling and recovery paths
- ✅ Complete documentation artifacts list
- ✅ Constitutional compliance verification
- ✅ Sequential implementation roadmap

**Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.**
