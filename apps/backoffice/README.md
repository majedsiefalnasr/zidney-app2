# @zidney/backoffice

## Purpose

Institution Control Panel — the administrative SPA for institution-level operators. Enables
institution admins to manage their workspace's exams, question banks, enrollments, reports, and
white-label configuration.

---

## Responsibilities

- Exam lifecycle management (create, publish, close, export)
- Question bank authoring and categorization
- Student and staff enrollment management
- Attempt monitoring and manual review dashboard
- Institution-scoped reporting and analytics
- White-label visual customization (logo, brand tokens, favicon)

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
bun run vitest run --project backoffice

# Unit tests (from this directory)
bun run test
bun run test:unit

# E2E smoke tests (requires dev server running on port 5174)
bun run dev &
bunx playwright test --config playwright.config.ts

# Or from repo root
bun run test:e2e:backoffice
```

---

## Environment Variables

| Variable              | Description                      | Required |
| --------------------- | -------------------------------- | -------- |
| `VITE_API_BASE_URL`   | Backend API base URL             | Yes      |
| `VITE_WORKSPACE_SLUG` | Institution workspace identifier | No       |
| `VITE_APP_ENV`        | `development` \| `production`    | No       |

> Vue/Vite apps only expose variables prefixed with `VITE_` to the browser bundle.

---

## Known Boundaries

- **No business logic** — all domain operations are delegated to the API
- **No DB imports** — does not access database schemas or backend logic
- **No environment variable access** outside of `import.meta.env.VITE_*`
- **White-label customization is visual only** — logo, brand tokens, favicon, email branding; no
  behavioral customization
- **Tenant-scoped** — all API calls include workspace slug; cross-tenant data access is forbidden
- **Import rule**: may import from `packages/*`, must not import from other `apps/*`
