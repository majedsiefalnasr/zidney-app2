# packages/config — AI Behavioral Contract

## Identity

Config provides **shared configuration loading** for all Zidney services, managing environment variables and runtime settings.

## Ownership

- Environment variable loading and validation
- Configuration schema definitions
- Service-specific config factories
- Default values and fallbacks
- Config type exports

## Non-Negotiable Rules

- **No secrets in code** — all secrets via environment variables or Docker secrets
- **Validate at startup** — invalid config must crash the service at boot, not at runtime
- **Type-safe config** — all config values must be typed, no raw `string` env access
- **No .env in production** — `.env` files are for local development only
- **No frontend exposure** — server config must never leak to client bundles

## Import Rules

Allowed:

- `packages/types` — shared type definitions
- `zod` — config validation schemas

Forbidden:

- `apps/*` — never import from application layer
- `packages/domain-core`, `packages/logger`, `packages/redis-utils` (circular)
- `packages/api-client`, `packages/job-queue`

## Patterns

- Export typed config objects: `export const dbConfig: DbConfig = validateConfig(schema)`
- Use Zod for config schema validation at startup
- Separate server config from client config explicitly

## Verdict

```
VERDICT: BLOCKED — if config exposes secrets to frontend or lacks validation
```
