# packages/logger — AI Behavioral Contract

## Identity

Logger provides **structured logging** (Pino-based) for all Zidney services with mandatory field enforcement.

## Ownership

- Pino logger configuration and factory
- Log level management
- Mandatory field enforcement (correlation_id, workspace_slug, service, etc.)
- Child logger creation for request scoping
- Log redaction rules (no secrets, no passwords, no tokens)

## Non-Negotiable Rules

- **Structured JSON only** — no `console.log`, no unstructured output
- **Mandatory fields on every log entry:**
  - `timestamp`, `level`, `service`
  - `workspace_slug` (if tenant-bound)
  - `workspace_id` (if tenant-bound)
  - `user_id` (if available)
  - `correlation_id`
  - `attempt_id` (if applicable)
- **No secrets in logs** — passwords, tokens, API keys must be redacted
- **No PII in debug logs** — student emails, names only at appropriate levels

## Import Rules

Allowed:

- `packages/types` — shared type definitions
- `packages/config` — log level configuration
- `pino` — logging library

Forbidden:

- `apps/*` — never import from application layer
- `packages/domain-core` — logger is infrastructure, not domain
- `packages/redis-utils`, `packages/job-queue`, `packages/api-client`

## Patterns

- Factory: `createLogger(service: string, context?: LogContext): Logger`
- Request-scoped: `logger.child({ correlation_id, workspace_slug })`
- Never log full request/response bodies in production

## Verdict

```
VERDICT: BLOCKED — if log output lacks mandatory fields or contains secrets
```
