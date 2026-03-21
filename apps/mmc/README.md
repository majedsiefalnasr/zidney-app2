# @zidney/mmc

## Purpose

Platform Control Panel — the administrative SPA for Zidney's Master Management Console (MMC).
Provides internal operators with tools to manage workspaces, licenses, products, and global platform
configuration.

---

## Responsibilities

- Workspace lifecycle management (create, soft-lock, archive, restore)
- License creation and limit adjustment
- Product catalog management
- Global platform monitoring and DLQ review
- Operator authentication (MMC admin role only)

---

## Dependencies

| Package              | Role                         |
| -------------------- | ---------------------------- |
| `vue` + `vue-router` | SPA framework and navigation |
| `pinia`              | State management             |
| `@zidney/ui-system`  | shadcn-vue component library |
| `@zidney/api-client` | HTTP client for API calls    |
| `@zidney/types`      | Shared TypeScript types      |
| `@zidney/validation` | Client-side form validation  |
| `tailwindcss` v4     | Utility-first CSS            |

---

## How to Run Tests

```bash
# Unit tests (from repo root)
bun run test run --project mmc

# Unit tests (from this directory)
bun run test
bun run test:unit

# E2E smoke tests (requires dev server running on port 5173)
bun run dev &
bunx playwright test --config playwright.config.ts

# Or from repo root
bun run test:e2e:mmc
```

---

## Environment Variables

| Variable            | Description                   | Required |
| ------------------- | ----------------------------- | -------- |
| `VITE_API_BASE_URL` | Backend API base URL          | Yes      |
| `VITE_APP_ENV`      | `development` \| `production` | No       |

> Vue/Vite apps only expose variables prefixed with `VITE_` to the browser bundle.

---

## Known Boundaries

- **No business logic** — all domain operations are delegated to the API
- **No DB imports** — does not access database schemas or backend logic
- **No environment variable access** outside of `import.meta.env.VITE_*`
- **White-label is visual only** — logos, brand tokens, and favicons only; no behavioral overrides
- **Import rule**: may import from `packages/*`, must not import from other `apps/*`
