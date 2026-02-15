# Implementation Plan: Monorepo Setup

**Branch**: `1-monorepo-setup` | **Date**: 2026-02-15 | **Spec**: [specs/runtime/1-monorepo-setup/spec.md](specs/runtime/1-monorepo-setup/spec.md)
**Input**: Feature specification from `/specs/runtime/1-monorepo-setup/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Establish a stable, scalable, AI-safe monorepo structure for Zidney, including repository structure, strict workspace boundaries, layering enforcement, Bun workspace configuration, TypeScript baseline, Docker infrastructure baseline, testing baseline, and linting discipline baseline. No business logic is implemented.

## Technical Context

**Language/Version**: TypeScript latest stable, Bun stable 1.x  
**Primary Dependencies**: Bun workspaces, TypeScript, Vitest, ESLint, Prettier  
**Storage**: N/A (infrastructure baseline only)  
**Testing**: Vitest with coverage  
**Target Platform**: macOS/Linux development environment, Docker for infrastructure services  
**Project Type**: Monorepo with 5 Vue apps, 1 API app, 1 worker app, 6 shared packages  
**Performance Goals**: N/A (setup phase)  
**Constraints**: Strict import boundaries (apps → packages only, packages → packages only), no business logic, no cross-layer violations  
**Scale/Scope**: 5 apps, 6 packages, single lockfile, shared dependency graph

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Database-Per-Tenant Isolation: N/A (no database logic yet)
- Authoritative License Enforcement: N/A (no license logic yet)
- Snapshot-Based Attempt Integrity: N/A (no attempt logic yet)
- Versioned Evolution: N/A (no schema yet)
- Runtime Authoritative Time: N/A (no timed operations yet)
- Deterministic Worker Execution: Baseline worker connects to Redis only
- Strict Separation of Layers: Enforced via import boundaries and folder structure
- Security Baseline: Structured logging required, no console.log
- AI Behavioral Contract: No violations in setup phase
- Change Governance: No architecture changes

## Project Structure

### Documentation (this feature)

```text
specs/runtime/1-monorepo-setup/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
zidney/
├── apps/
│ ├── api/ # Hono backend
│ ├── worker/ # Background job processor
│ ├── mmc/ # Platform dashboard (Vue)
│ ├── backoffice/ # Workspace dashboard (Vue)
│ └── frontoffice/ # Student portal (Vue)
│
├── packages/
│ ├── domain-core/ # Pure business logic (no DB)
│ ├── types/ # Shared TypeScript types
│ ├── validation/ # Zod schemas
│ ├── ui-system/ # Shared UI components
│ ├── redis-utils/ # Redis abstractions
│ └── config/ # Shared configuration utilities
│
├── docker/
├── specs/
├── docs/
├── AGENTS.md
├── tsconfig.base.json
├── bun.lockb
└── root configuration files
```

**Structure Decision**: Monorepo with strict layering - UI layer (Vue apps) calls API layer (apps/api) calls Domain layer (packages/domain-core) calls Infrastructure layer (DB/Redis). Import boundaries enforced: apps import from packages only, packages import from packages only.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None - all constitution checks pass.
