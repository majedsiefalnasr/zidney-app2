# Zidney MMC – Platform Control Panel Contract

Stack:

- Vue 3
- TypeScript
- Pinia
- Tailwind v4
- shadcn-vue

MMC = Platform-level control plane.
MMC operates on master_db only.
MMC never accesses tenant databases directly.

---

## Architectural Position

MMC belongs to:

Platform Layer
(Not workspace layer)

Trust chain position:

Isolation → License → Provisioning → MMC

MMC controls:

- Products
- Licenses
- License lifecycle
- Provisioning trigger
- Affiliates
- Platform members

MMC does NOT control:

- Student runtime
- Exam attempts
- Tenant content
- Grading logic

---

## Non-Negotiable Rules

MMC MUST:

- Use master-scoped APIs only
- Never resolve tenant DB directly
- Never embed business logic in UI
- Reflect license state exactly as returned by API
- Respect provisioning states (PROVISIONING, ACTIVE, etc.)
- Treat all lifecycle states as authoritative from backend
- Remain stateless regarding license transitions

MMC MUST NOT:

- Modify tenant DB directly
- Bypass provisioning queue
- Change workspace_slug after creation
- Perform destructive deletion without explicit confirmation flow
- Store secrets locally
- Derive business decisions from UI state
- Simulate license state transitions on client side

All lifecycle, provisioning, and versioning logic lives exclusively in API.
MMC is a visual control layer only.

---

## License Awareness

MMC UI must correctly display:

- ACTIVE
- SOFT_LOCKED
- ARCHIVED
- DELETED
- PROVISIONING
- PROVISIONING_FAILED

UI must treat these as read-only states.

State transitions triggered only via API endpoints.

---

## Provisioning Behavior

When creating a License: 1. License created in PROVISIONING state 2. Provisioning job queued 3. MMC shows pending status 4. Poll or subscribe to status updates 5. Only ACTIVE allows access link

MMC must never assume DB exists until ACTIVE confirmed.

---

## Product Management Rules

Product defines:

- Enabled modules
- Base configuration
- Default language
- Commercial entity

MMC must:

- Allow product creation
- Allow version updates
- Not auto-upgrade licenses
- Mark update availability only

Upgrade is explicit per license.

---

## Affiliates & Commercial Layer

MMC handles:

- B2B affiliate tracking
- Promo code generation
- Commission percentage

MMC does NOT:

- Handle B2C student payments
- Access workspace subscriptions

Workspace billing remains tenant-scoped.

---

## 7. UI Enforcement

MMC must use:

- packages/ui-system
- shadcn-vue components
- Tailwind v4 utility classes

Strict rules:

- No raw HTML components when equivalent shadcn component exists
- No duplicated UI patterns across apps
- No inline CSS
- No ad-hoc component styling
- No direct Tailwind config mutation
- No theme overrides outside token system
- No cross-app UI imports

MMC uses platform theme only.
White-label theming does NOT apply to MMC.
All layout primitives must come from shared ui-system package.

---

## Error Handling

All API errors must follow platform standard:

```
{
  success: false,
  error: {
    code: "ERROR_CODE",
    message: "Human readable message"
  },
  request_id: "uuid"
}
```

MMC must:

- Display meaningful error
- Log request_id for debugging
- Never swallow errors silently

---

## Logging & Observability

MMC frontend must:

- Propagate correlation ID
- Log structured client errors
- Never log sensitive data
- Never log tokens

---

## AI Enforcement Contract (Local Scope)

AI generating MMC code MUST:

- Import only from:
  - packages/\*
  - local mmc modules
- Never import from other apps/\*
- Never access tenant-level APIs
- Never reference tenant DB logic
- Never construct license state locally
- Never bypass API contract
- Never embed lifecycle logic
- Never simulate provisioning completion
- Never hardcode version numbers

AI MUST:

- Follow shadcn-vue component structure
- Use Tailwind v4 utility classes only
- Respect strict TypeScript mode
- Respect import boundaries
- Keep MMC as pure control plane

If AI output violates isolation, lifecycle authority,
or UI system contract — it must be rejected.

---

## References

See:

- specs/phases/01_PLATFORM_FOUNDATION/
- specs/phases/02_PLATFORM_MMC/
- docs/01_ENGINEERING_GOVERNANCE/
- docs/architecture/
