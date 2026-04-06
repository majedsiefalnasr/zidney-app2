# Zidney Architecture Summary

Generated: 2026-04-06T10:09:05.264Z
Schema Version: 1.0.0

## System Layers Overview

### UI Layer

- Vue 3 + TypeScript framework
- shadcn-vue component system
- Tailwind CSS v4 for styling
- No business logic, no direct DB access

### Runtime Layer

- Bun runtime environment
- Hono HTTP framework (API services)
- Background job processor (Worker)
- Central business logic execution

### Domain Layer

- Pure business logic implementation
- Framework-independent code
- packages/domain-core
- Attempt processing, grading logic

### Infrastructure Layer

- Database drivers and connection pooling
- Logging and monitoring
- External service integrations
- Configuration management

## Applications Overview

### mmc

- Path: apps/mmc
- Type: Application

### frontoffice

- Path: apps/frontoffice
- Type: Application

### backoffice

- Path: apps/backoffice
- Type: Application

### api

- Path: apps/api
- Type: Application

### worker

- Path: apps/worker
- Type: Application

## Packages Overview

### job-queue

- Path: packages/job-queue
- Type: Package

### types

- Path: packages/types
- Type: Package

### logger

- Path: packages/logger
- Type: Package

### config

- Path: packages/config
- Type: Package

### redis-utils

- Path: packages/redis-utils
- Type: Package

### ui-system

- Path: packages/ui-system
- Type: Package

### api-client

- Path: packages/api-client
- Type: Package

### domain-core

- Path: packages/domain-core
- Type: Package

### validation

- Path: packages/validation
- Type: Package

## Architecture Principles

### 1. Database-per-Tenant Isolation

Essential to Zidney's multi-tenancy model. No cross-tenant data access.

### 2. Strict Layer Boundaries

- UI → Domain: Forbidden
- Domain → UI: Forbidden
- Apps → Apps: Forbidden (use packages)
- Packages → Apps: Forbidden

### 3. White-Label Visual Only

Theme customization allowed, structural changes not permitted.

### 4. Determinism Over Magic

Explicit state management, no implicit behavior.

### 5. Runtime Authoritative Time

Server-generated timestamps are canonical, client timers not trusted.

## Key Constraints

### Isolation Constraints

- No row-based multi-tenancy
- No shared student tables
- No cross-tenant joins
- Tenant resolution mandatory

### Runtime Constraints

- Server time is authoritative
- Attempt configuration snapshotted at start
- Submission is idempotent
- Worker finalizes attempts

### Import Constraints (Enforced by ai-guard)

- Forbidden: ui-system → domain-core
- Forbidden: apps/X → apps/Y
- Forbidden: packages/X → apps/Y
- Allowed: apps/X → packages/Y
- Allowed: packages/X → packages/Y

## Related ADRs
