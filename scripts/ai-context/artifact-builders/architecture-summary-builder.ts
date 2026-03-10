/**
 * Architecture Summary Builder - Generate ai-architecture-summary.md
 * Task: T020
 * Path: scripts/ai-context/artifact-builders/architecture-summary-builder.ts
 */

import type { SourceMetadata } from '../source-loader'

export async function buildArchitectureSummary(metadata: SourceMetadata): Promise<string> {
  const timestamp = new Date().toISOString()

  let summary = `# Zidney Architecture Summary

Generated: ${timestamp}
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

`

  // Add applications from metadata
  for (const module of metadata.modules) {
    if (module.type === 'app') {
      summary += `### ${module.name}
- Path: ${module.path}
- Type: Application
\n`
    }
  }

  summary += `\n## Packages Overview

`

  // Add packages from metadata
  for (const module of metadata.modules) {
    if (module.type === 'package') {
      summary += `### ${module.name}
- Path: ${module.path}
- Type: Package
\n`
    }
  }

  summary += `\n## Architecture Principles

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

`

  for (const adr of metadata.adrFiles) {
    summary += `- ADR-${String(adr.number).padStart(4, '0')}: ${adr.title}\n`
  }

  return summary
}
