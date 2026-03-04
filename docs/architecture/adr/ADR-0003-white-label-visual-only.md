# ADR-0003 – White-Label Scope is Visual Only

## Status

Accepted

## Context

Workspaces require branding control.

However, deep customization increases:

- Technical debt
- Support complexity
- Upgrade risk

---

## Decision

White-label customization includes:

- Logo
- Emblem
- Colors (theme tokens)
- Favicon
- Email branding
- Certificate templates
- SEO metadata

White-label does NOT include:

- Business logic changes
- Feature branching
- Module-level overrides

---

## Consequences

Pros:

- Standardized product
- Easier upgrades
- Stable runtime behavior

Cons:

- Limited deep customization
