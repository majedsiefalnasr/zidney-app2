# AI Skills Contract — Zidney

This document defines mandatory behavioral constraints for all AI agents generating code, specs,
migrations, UI, or infrastructure changes in Zidney.

Violation of this contract is considered architectural failure.

---

## Core Principles

AI must protect:

- Tenant isolation
- Schema integrity
- Attempt snapshot immutability
- License lifecycle enforcement
- Version compatibility
- Observability discipline
- White-label constraints
- Institutional trust

---

## Architectural Boundary Enforcement

AI MUST:

- Respect monorepo import boundaries
- Never import across apps
- Only import shared logic via packages/
- Never instantiate DB connections directly
- Always use tenant resolver context
- Never introduce global mutable state

AI MUST NOT:

- Access tenant DB outside middleware context
- Bypass license middleware
- Introduce shared runtime state

---

## Tenant Isolation Discipline

AI MUST:

- Enforce workspace_slug resolution via middleware
- Never trust workspace_slug from request body
- Never allow cross-tenant queries
- Always log workspace_slug in tenant-scoped logs

Isolation violations are critical.

---

## Migration Discipline

AI MUST:

- Generate forward-only migrations
- Never modify historical migrations
- Increment schema_version correctly
- Respect semantic versioning (ADR-0008)
- Validate product_version compatibility

AI MUST NOT:

- Edit applied migration files
- Perform destructive changes without snapshot requirement
- Introduce schema drift

---

## 4. Version Compatibility Enforcement

AI MUST:

- Block runtime when schema_version incompatible
- Block runtime when product_version incompatible
- Require explicit upgrade for breaking changes

No implicit upgrade logic allowed.

---

## Attempt Snapshot Integrity

AI MUST:

- Snapshot exam configuration at attempt start
- Store question order and grading config in attempt
- Never reference live exam config during grading
- Ensure submission is idempotent
- Prevent grading mutation after submission

Runtime integrity is legally sensitive.

---

## License & Limit Enforcement

AI MUST:

- Enforce student_limit and staff_limit transactionally
- Block login when SOFT_LOCKED
- Block all access when ARCHIVED
- Validate soft_lock expiration in middleware

Limit checks must not rely on cached counts.

---

## Observability Discipline

AI MUST:

- Use structured logging
- Propagate request_id
- Attach workspace_slug to tenant logs
- Attach attempt_id for runtime flows
- Follow standardized error envelope

console.log is forbidden.

---

## Security Model

AI MUST:

- Enforce RBAC in backend
- Validate input with Zod
- Never expose sensitive fields
- Never trust client-side role checks
- Enforce rate limiting for public endpoints

---

## UI Discipline (shadcn-vue + Tailwind v4)

AI MUST:

- Use shadcn-vue components first
- Apply Tailwind v4 utilities second
- Use design tokens only
- Respect workspace theming constraints
- Avoid custom raw components if shadcn exists

AI MUST NOT:

- Hardcode theme colors
- Bypass theme system
- Introduce inconsistent design patterns

---

## Forbidden Behaviors

AI must never:

- Modify applied migrations
- Introduce row-based multi-tenancy
- Bypass tenant resolver
- Store attempt grading live from exam config
- Introduce breaking schema without version bump
- Hardcode DB credentials
- Skip snapshot requirement before destructive migration

---

## Enforcement Requirement

Before generating any code, AI must internally validate:

- Which phase?
- Which stage?
- Schema impact?
- Product version impact?
- Tenant isolation impact?
- Snapshot required?
- License enforcement affected?
- Observability impact?

If uncertain, AI must request clarification.

This contract governs all AI-generated output in Zidney.
