# Zidney – Root AI Behavioral Contract

This file defines non-negotiable architectural rules for all AI agents and contributors.

Zidney is a stability-first, exam-centric, white-label SaaS platform.

If any generated code conflicts with this file, this file wins.

---

## Platform Identity

Zidney consists of:

- MMC (Platform control layer)
- Backoffice (Institution control panel)
- Frontoffice (Student runtime)
- API (Bun + Hono backend)
- Worker (Background job processor)

Trust chain:

Isolation → License → Authentication → Attempt → Runtime → Frontoffice

Breaking this chain is a platform failure.

---

## Multi-Tenancy Model (Hard Rule)

- Database-per-tenant
- One PostgreSQL instance
- One connection pool per tenant (in-memory map)
- Tenant resolved via slug (subdomain AND path supported)
- License validation middleware mandatory

Not allowed:

- Row-based multi-tenancy
- Shared student tables
- Shared attempt tables
- Cross-tenant joins
- Global DB singleton
- Workspace override from request body

All DB access must originate from tenant resolver context.

---

## Import Boundary Rules (MANDATORY)

Allowed:

apps/_ → packages/_
packages/_ → packages/_

Not allowed:

apps/_ → other apps/_
packages/_ → apps/_
UI → database schemas
UI → backend logic

No cross-layer violations.

---

## Layering Model

UI Layer:

- Vue 3 + TypeScript
- shadcn-vue components
- Tailwind CSS v4 utilities
- No business logic
- No DB imports
- No environment variable access

API Layer:

- Handles routing
- Executes tenant resolver first
- Executes license middleware second
- Calls domain packages
- Never embeds business rules

Domain Packages:

- Contain business logic
- Pure functions
- No HTTP logic
- No framework dependencies

Worker:

- Executes background jobs
- Idempotent
- Uses retry strategy
- No direct UI communication

---

## UI System Rules

UI must use:

- shadcn-vue components first
- Tailwind v4 utilities for layout and spacing

Not allowed:

- Custom component system if shadcn equivalent exists
- Hardcoded brand colors
- Direct CSS overrides outside theme tokens

Theming model:

- Base theme = shadcn default
- Workspace overrides allowed only for:
  - Logo
  - Brand tokens
  - Favicon
  - Email branding
  - Certificate branding
  - SEO metadata

White-label is visual only.

---

## License Enforcement

License middleware must validate on every workspace request:

- Status
- Schema compatibility
- Product version compatibility

SOFT_LOCKED → 423
ARCHIVED → 403
NOT FOUND → 404

Limit enforcement must be transactional.

---

## Attempt Engine Integrity Rules

- Attempt must snapshot configuration at start
- Snapshot question list and order
- Snapshot grading configuration
- No live exam configuration references
- Submission must be idempotent
- Worker finalizes attempt
- Server time is authoritative

---

## Error Handling Standard

All API responses must follow:

{
success: boolean,
data: object | null,
error: {
code: string,
message: string
} | null
}

No unstructured error responses.

---

## Logging Rules

All services must use structured logging.

Required fields:

- timestamp
- level
- service
- workspace_slug
- workspace_id
- user_id (if available)
- correlation_id
- attempt_id (if applicable)

console.log is forbidden.

---

## Migration Rules

- One migration per feature
- Never modify old migration files
- Forward-only migrations
- Production upgrade requires snapshot backup
- Rollback = restore snapshot only

---

## Testing Requirements

Mandatory per feature:

- Unit tests (business logic)
- Integration tests (API flow)
- Snapshot tests (grading)

No merge without tests.

---

## Rate Limiting

- Login: 5 attempts/minute per IP
- Submission: idempotent, one per attempt
- WebSocket: 1 connection per user per attempt
- Public endpoints rate limited

---

## Secrets Management

- No secrets in code
- Production uses Docker secrets
- .env allowed locally only
- No secret exposed to frontend

---

---

## AI Behavioral Enforcement (Strict Contract)

This section defines mandatory behavioral constraints for all AI agents (Copilot, MCP-enabled agents, Claude, GLM, etc.) operating inside Zidney.

Violation of these rules is considered architectural failure.

### Architecture Authority

AI must treat:

- `docs/architecture/ADR-*` as binding architectural decisions.
- `specs/phases/` as the feature behavior authority.
- `docs/01_ENGINEERING_GOVERNANCE/` as enforcement authority.

Conflict resolution order:

ADR > Specs > This file > Implementation

AI must never invent or modify architecture without explicit approval.

---

### Tenant Isolation Protection (Critical)

AI must not:

- Implement row-based multi-tenancy.
- Share tenant tables.
- Instantiate database connections outside tenant resolver.
- Hardcode workspace identifiers.
- Allow tenant override from request body.
- Create cross-tenant joins.

All tenant database access must originate from resolver context.

No global database singleton allowed.

---

### Migration Discipline

AI must not:

- Execute schema-altering SQL directly via MCP.
- Modify schema outside migration files.
- Alter existing migration files retroactively.

All schema changes must be implemented through:

apps/api/src/db/master/migrations  
apps/api/src/db/tenant/migrations

Each migration must:

- Be forward-only.
- Increment schema_version.
- Be reversible only via snapshot restore.
- Align with semantic versioning (ADR-0008).

---

### License & Version Enforcement

AI must not:

- Access tenant DB before license middleware.
- Ignore schema_version compatibility.
- Ignore product_version compatibility.
- Skip soft-lock validation.

License validation middleware is mandatory for all workspace-bound routes.

---

### Attempt Engine Protection

AI must:

- Snapshot configuration at attempt start.
- Snapshot question list and order.
- Snapshot grading configuration.
- Use server-authoritative time (ADR-0006).
- Ensure submission is idempotent.
- Finalize attempts via Worker.

AI must not:

- Trust client timers.
- Trust client grading.
- Reference live exam configuration during grading.

---

### Runtime Safety Rules

AI must not:

- Disable rate limiting.
- Remove correlation ID propagation.
- Log sensitive data.
- Expose secrets.
- Log passwords or tokens.

All logs must be structured and include:

- correlation_id
- workspace_slug (if tenant-bound)
- service name

---

### Import Boundary Enforcement

apps/_ may import from packages/_  
packages/_ may import from packages/_

apps/_ may not import from other apps/_  
packages/_ may not import from apps/_

UI must not access database schemas or backend logic.

---

### UI System Enforcement

AI must:

- Use shadcn-vue components first.
- Use Tailwind v4 utilities for layout.
- Use theme tokens only.
- Respect white-label visual constraints.

AI must not:

- Introduce a new component system.
- Hardcode brand colors.
- Override theme structure outside allowed tokens.

White-label customization is visual only.

---

### MCP Usage Restrictions

AI may use MCP for:

- Schema inspection.
- Query validation.
- Debugging.

AI must not:

- Execute destructive SQL.
- Modify production databases.
- Bypass migration system.
- Apply ad-hoc schema patches.

MCP is read-first, controlled-write only in development.

---

### Testing Requirement

No feature is complete unless:

- Unit tests added.
- Integration tests added (if API).
- Migration validated.
- Lint passes.
- Type check passes.

AI must not generate production code without tests.

---

### Escalation Rule

If AI detects:

- Ambiguous specification.
- Conflicting ADR.
- Migration risk.
- Tenant isolation risk.
- Version compatibility uncertainty.

AI must stop and request clarification.

Guessing is forbidden.

---

## SpecKit Execution Contract

All feature development must follow the Hard Mode SpecKit workflow defined in:

docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md

This document defines:

- Mandatory execution order
- Enforcement templates
- Architecture drift detection
- Safety gates before implementation
- Spec-to-code alignment rules

AI agents must not begin implementation without passing:

1. Constitution alignment
2. Specification validation
3. Architecture consistency analysis
4. Safety gate confirmation

SpecKit workflow is mandatory for all new feature development.

---

## SpecKit Directory Structure (Locked)

SpecKit must operate strictly within the following directory structure:

specs/
├── phases/
│ ├── 01_platform_foundation/
│ ├── 02_mmc/
│ ├── 03_backoffice/
│ ├── 04_runtime/
│ └── 05_frontoffice/
│
├── templates/
│ ├── specify_template.md
│ ├── plan_template.md
│ ├── tasks_template.md
│ ├── analyze_template.md
│ └── implement_gate_template.md
│
└── constitution.md

Hard Rules:

- SpecKit must not generate flat spec files in specs root.
- All new features must be created inside specs/runtime/<phase_name>/.
- No stage renumbering without architectural review.
- No moving phases between directories.
- No overwriting manually curated spec files.
- SpecKit must not auto-generate architecture changes.
- All generated files must align with ADR decisions.

If SpecKit generates content outside this structure, it must be rejected.

Spec directory structure is part of architectural governance.

---

## Source of Truth Priority

ADR (docs/architecture) > Specs > This file > Code

This contract is authoritative.
