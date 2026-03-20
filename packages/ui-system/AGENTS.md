# packages/ui-system — AI Behavioral Contract

## Identity

UI System is the **shared component library** for all Zidney frontend applications, built on shadcn-vue, Reka UI, and Tailwind CSS v4.

## Ownership

- shadcn-vue component wrappers and extensions
- Design tokens and theme configuration
- Layout primitives and patterns
- Form components with validation integration
- Shared composables for UI behavior

## Non-Negotiable Rules

- **shadcn-vue first** — use shadcn-vue components as the base for all UI elements
- **No custom component systems** — do not create components when shadcn-vue equivalents exist
- **Tailwind CSS v4 only** — no inline styles, no CSS modules, no styled-components
- **Theme tokens only** — no hardcoded colors, use CSS custom properties from the theme
- **No business logic** — UI components are presentation-only
- **No API calls** — components receive data via props, never fetch directly
- **No database imports** — UI layer must never touch persistence

## Import Rules

Allowed:

- `packages/types` — shared type definitions for props
- `packages/validation` — Zod schemas for form validation
- Vue 3 ecosystem packages (vue, @vueuse/core, etc.)
- Reka UI, shadcn-vue, Tailwind CSS

Forbidden:

- `apps/*` — never import from application layer
- `packages/domain-core` — UI does not contain business logic
- `packages/api-client` — components don't make HTTP calls
- `packages/logger`, `packages/redis-utils`, `packages/config`, `packages/job-queue`

## White-Label Rules

- Base theme = shadcn default
- Workspace overrides allowed ONLY for: logo, brand tokens, favicon, email branding, certificate branding, SEO metadata
- White-label is visual only — no behavioral customization

## Verdict

```
VERDICT: BLOCKED — if UI component contains business logic or hardcoded brand colors
```
