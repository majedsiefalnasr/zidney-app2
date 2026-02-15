# ADR-0005 – Product Upgrade is Opt-In

## Status

Accepted

## Context

Workspaces require stability.

Automatic upgrades risk:

- Breaking institutional workflows
- Migration errors
- Operational downtime

---

## Decision

When product version updates:

- Workspace is notified
- Workspace chooses to upgrade
- Migration executed per tenant

---

## Consequences

Pros:

- Institutional trust
- Controlled rollout
- Safer upgrades

Cons:

- Multiple versions active simultaneously
- Migration complexity
