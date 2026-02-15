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

## Environment

Copy `.env.example` to `.env` and configure as needed.
