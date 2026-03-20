# packages/api-client — AI Behavioral Contract

## Identity

API Client provides **typed HTTP client** wrappers for frontend applications to communicate with the Zidney API.

## Ownership

- Typed API endpoint definitions
- Request/response type mappings
- HTTP client configuration (base URL, headers, interceptors)
- Authentication token management
- Error response parsing

## Non-Negotiable Rules

- **Frontend-safe only** — no server-side imports, no Node/Bun APIs
- **No business logic** — this is a transport layer, not a domain layer
- **No direct database access** — client talks to API, never to DB
- **Type-safe requests** — every endpoint must have typed request and response
- **Tenant-aware** — all requests must include workspace context (slug/subdomain)

## Import Rules

Allowed:

- `packages/types` — shared type definitions
- `packages/validation` — request/response schemas

Forbidden:

- `apps/*` — never import from application layer
- `packages/domain-core` — client does not contain business logic
- `packages/logger` — frontend logging is separate
- `packages/redis-utils`, `packages/job-queue`, `packages/config`

## Patterns

- Use `fetch` or an isomorphic HTTP client
- All API methods must return `Promise<ApiResponse<T>>` with typed success/error
- Error responses must follow `{ success: false, error: { code, message } }` format
- Include `correlation_id` header in all requests

## Verdict

```
VERDICT: BLOCKED — if api-client imports server-side modules or database schemas
```
