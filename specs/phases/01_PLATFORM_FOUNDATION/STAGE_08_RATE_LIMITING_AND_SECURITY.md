# STAGE 08 – Rate Limiting & Security Baseline

Phase: 1 – Platform Foundation  
Status: Critical  
Scope: Abuse prevention, security hardening, and operational safeguards

---

## Objective

Establish enforceable security and abuse-prevention mechanisms for:

- Authentication endpoints
- Exam attempt lifecycle endpoints
- WebSocket connections
- Public APIs
- Worker processing
- Sensitive administrative actions

This stage protects availability, integrity, and tenant isolation.

---

## Security Principles

1. Server is authoritative.
2. Workspace isolation is absolute.
3. Idempotency is mandatory for state changes.
4. Rate limiting protects platform availability.
5. Client input is never trusted.
6. All actions must be auditable.
7. Secrets must never leak.

---

## Rate Limiting Architecture

Rate limiting must use Redis (centralized) and support:

- Per-IP limits
- Per-user limits
- Per-workspace limits
- Per-attempt limits
- Global protection limits

Algorithm:

- Sliding window OR token bucket (Redis-based)
- Must support burst + sustained protection

All rate limit violations must return:

- HTTP 429
- Retry-After header
- Structured error body
- request_id in response

Rate limiting must never rely on in-memory counters.

---

## Authentication Protection

Login endpoint:

- Max 5 attempts per minute per IP
- Max 5 attempts per minute per user
- Max 10 attempts per minute per workspace

After repeated failures:

- Apply exponential backoff lock (temporary user lock)
- Lock duration increases per failure window

Error responses must not reveal:

- Whether user exists
- Whether password incorrect

Password reset:

- Rate limited
- Single-use token
- Time-bound token
- Token stored hashed

---

## Attempt Lifecycle Protection

Attempt start endpoint:

- Rate limit per user
- Rate limit per workspace
- Prevent rapid restart spam

Submission endpoint:

- Fully idempotent
- One submission per attempt
- Duplicate submission returns stored result
- Must use DB transaction with FOR UPDATE lock
- Rate limited per attempt_id

Scheduled exam start:

- Validate server time only
- Reject early access
- Reject late access (respect tolerance window)
- Enforce reconnect timeout (30 seconds)

---

## WebSocket Security

Each WebSocket connection must:

- Authenticate via JWT during handshake
- Validate workspace_id against resolver
- Validate attempt ownership
- Allow only one active connection per attempt

Security rules:

- Message rate throttling per connection
- Heartbeat enforcement
- Automatic disconnect on token expiration
- Revalidation on reconnect

No anonymous WebSocket connection allowed.

---

## Cross-Workspace Protection

For every authenticated request:

- Extract workspace_id from JWT
- Compare with resolved tenant
- Reject if mismatch (403)

Workspace identity must never be accepted from request body.

---

## JWT Security Requirements

Tokens must:

- Be signed securely
- Include workspace_id
- Include token_version
- Include issued_at
- Include expiration

Token must be rejected if:

- Expired
- Signature invalid
- Workspace mismatch
- token_version mismatch

Short-lived access tokens required.
Refresh token rotation recommended.

---

## HTTP Security Headers

API must enforce:

- Strict-Transport-Security
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy
- Content-Security-Policy (frontend)

CORS must:

- Restrict origins
- Disallow wildcard in production

---

## CSRF Protection

Required for:

- MMC
- Backoffice

Must use:

- SameSite cookies
- CSRF token validation for state-changing requests

Not required for pure JWT Bearer APIs without cookies.

---

## Payload & Resource Protection

Must enforce:

- Request body size limits
- File upload size limits
- JSON depth limits
- Query complexity limits

Prevent resource exhaustion via:

- Global concurrency cap
- Per-workspace concurrency cap

---

## Idempotency Enforcement

Required for:

- Attempt submission
- License state transitions
- Tenant provisioning
- Certificate generation

Implementation:

- Unique operation keys
- Database constraint enforcement
- Worker job deduplication
- Safe retry design

---

## Worker Failure & Dead Letter Policy

Worker jobs:

- Retry maximum 3 times
- Exponential backoff
- Move to dead_letter queue on failure
- Preserve metadata
- Log correlation_id and workspace_slug

No silent job failure allowed.

---

## Audit & Abuse Monitoring

System must log:

- Failed login attempts
- Rate limit violations
- Token validation failures
- Attempt submission anomalies
- Cross-tenant mismatch attempts

Repeated abuse may trigger:

- Temporary IP ban
- Temporary account lock

All bans must be time-bound and auditable.

---

## Secret Management

Development:

- .env allowed
- .env.example required

Production:

- Docker secrets required
- No secret in git
- No secret in logs
- No secret returned in API response

JWT secrets must never appear in frontend bundle.

---

## Validation Criteria

Stage is complete when:

- Login brute force blocked
- Duplicate submission rejected safely
- Attempt restart spam blocked
- WebSocket authenticated and throttled
- Cross-workspace request rejected
- Soft lock enforced at middleware
- Rate limiter tested under load
- Dead-letter queue tested
- No secret visible in logs

---

## Forbidden

- Client-side grading authority
- Trusting client timestamps
- Submission without idempotency
- Token without workspace_id
- Missing rate limit on login
- Logging secrets
- Long-lived JWT without expiration
- In-memory-only rate limiting

---

## Stability Principle

Security failures immediately break institutional trust.

Rate limiting and baseline security must be validated before Phase 2 (MMC) proceeds.

Zidney must be safe before it scales.
