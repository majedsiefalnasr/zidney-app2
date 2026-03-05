# Zidney

A production-grade B2B2C white-label educational SaaS platform.

## Monorepo Setup

This repository uses Bun workspaces for managing multiple applications and packages.

### Prerequisites

- Bun stable 1.x
- Docker and docker-compose

### Installation

1. Clone the repository
2. Install dependencies: `bun install`
3. Start infrastructure: `docker-compose up -d`
4. Verify services are running

### Development

- API: `cd apps/api && bun run dev`
- Worker: `cd apps/worker && bun run dev`
- Frontend apps: `cd apps/<app> && bun run dev`

### Scripts

- `bun run lint`: Run ESLint
- `bun run type-check`: Run TypeScript type checking
- `bun run test`: Run tests with Vitest

## Architecture

- **Apps**: api, worker, mmc, backoffice, frontoffice
- **Packages**: domain-core, types, validation, ui-system, redis-utils, config

Import boundaries are strictly enforced: apps import from packages only.

## AI Development Context

This repository is optimized for **AI-assisted development**.  
Before generating or modifying code, AI agents must load the following files in order:

1. `docs/ai/AI_BOOTSTRAP.md`
2. `docs/ai/AI_CONTEXT_INDEX.md`
3. `docs/PROJECT_CONTEXT_PRIMER.md`
4. `docs/ai/AI_ENGINEERING_RULES.md`
5. `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json`
6. `docs/architecture/ADR/`

These documents define the architecture rules, governance pipeline, and reasoning model required for safe AI-driven development.

AI tools should never generate code without first understanding these files.

## Architecture Governance

Zidney uses a **multi-layer architecture governance system** to protect the integrity of the platform.

Architecture validation occurs at multiple stages:

1. **AI Bootstrap Context** – ensures AI agents understand the architecture.
2. **Pre‑commit Guard (`ai-guard.ts`)** – blocks commits that violate architecture rules.
3. **Infrastructure Audit (`infra-audit.ts`)** – analyzes repository structure and dependencies.
4. **Architecture Diff (`architecture-diff.ts`)** – detects architectural drift in pull requests.
5. **CI Governance Pipeline** – validates the repository in GitHub Actions.

These checks enforce rules such as:

- No cross‑app imports (`apps/* → apps/*`)
- Domain isolation (`domain-core` cannot depend on application code)
- Layered architecture boundaries
- No architecture leaks through relative imports

## GitNexus Knowledge Graph (Optional)

The repository can be indexed using **GitNexus** to provide AI agents with a semantic understanding of the codebase.

Example usage:

```
gitnexus analyze .
gitnexus query tenant
gitnexus context tenantResolver
gitnexus impact createTenant
```

GitNexus enables:

- repository knowledge graph
- execution flow discovery
- dependency impact analysis

This significantly improves AI reasoning when modifying large areas of the system.

## Environment

Copy `.env.example` to `.env` and configure as needed.
