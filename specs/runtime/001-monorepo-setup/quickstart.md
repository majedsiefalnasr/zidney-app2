# Quickstart: Monorepo Setup

**Date**: 2026-02-15
**Feature**: Monorepo Setup

## Prerequisites

- Bun stable 1.x installed
- Docker and docker-compose installed
- Node.js (for compatibility, though Bun is primary)

## Setup Steps

1. **Clone repository**

   ```bash
   git clone <repository-url>
   cd zidney
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Start infrastructure**

   ```bash
   docker-compose up -d
   ```

4. **Verify services**
   - Postgres: `docker-compose exec postgres psql -U postgres`
   - Redis: `docker-compose exec redis redis-cli`

5. **Run baseline checks**

   ```bash
   bun run type-check
   bun run lint
   bun run test
   ```

6. **Start development**
   - API: `cd apps/api && bun run dev`
   - Worker: `cd apps/worker && bun run dev`
   - Frontend apps: `cd apps/<app> && bun run dev`

## Environment Variables

Copy `.env.example` to `.env` and fill required values:

- Database connection strings
- Redis URLs
- Development secrets (never commit)

## Troubleshooting

- If Bun workspaces fail: Delete bun.lockb and run `bun install` again
- If Docker ports conflict: Modify docker-compose.yml ports
- If TypeScript errors: Check tsconfig.base.json path aliases
