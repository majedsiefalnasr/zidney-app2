# @zidney/frontoffice

## Purpose

Student Runtime SPA — the exam-taking interface for enrolled students. Provides a secure, real-time
exam session with timer enforcement, question navigation, and submission flow. All answers and
timing are server-authoritative.

---

## Responsibilities

- Authenticate students for a specific workspace
- Load and display exam attempts (server-snapshotted question list)
- Real-time countdown driven by **server-authoritative time** (never client timer)
- Submit answers and navigate between questions
- Display results and attempt history
- Handle graceful reconnection if WebSocket is interrupted

---

## Dependencies

| Package              | Role                         |
| -------------------- | ---------------------------- |
| `vue` + `vue-router` | SPA framework and navigation |
| `pinia`              | State management             |
| `@zidney/ui-system`  | shadcn-vue component library |
| `@zidney/api-client` | HTTP client for API calls    |
| `@zidney/types`      | Shared TypeScript types      |
| `tailwindcss` v4     | Utility-first CSS            |

---

## How to Run Tests

```bash
# Unit tests (from repo root)
bun run test run --project frontoffice

# Unit tests (from this directory)
bun run test
bun run test:unit

# E2E smoke tests (requires dev server running on port 5175)
bun run dev &
bunx playwright test --config playwright.config.ts

# Or from repo root
bun run test:e2e:frontoffice
```

---

## Environment Variables

| Variable              | Description                   | Required |
| --------------------- | ----------------------------- | -------- |
| `VITE_API_BASE_URL`   | Backend API base URL          | Yes      |
| `VITE_WS_BASE_URL`    | WebSocket server URL          | Yes      |
| `VITE_WORKSPACE_SLUG` | Student workspace context     | No       |
| `VITE_APP_ENV`        | `development` \| `production` | No       |

> Vue/Vite apps only expose variables prefixed with `VITE_` to the browser bundle.

---

## Known Boundaries

- **Server time is authoritative** — never trust `Date.now()` for exam timing; always use
  server-issued timestamps
- **No client-side grading** — submission only; grading is finalized by the Worker
- **Attempt configuration is immutable** — question list and grading config are snapshotted at
  attempt start and cannot change
- **One WebSocket connection per user per attempt** — reconnects are handled gracefully but
  duplicate connections are rejected
- **No DB imports** — does not access database schemas
- **Import rule**: may import from `packages/*`, must not import from other `apps/*`
