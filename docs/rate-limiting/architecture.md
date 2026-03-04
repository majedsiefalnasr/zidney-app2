# Rate Limiting Architecture

**STAGE 08 - Rate Limiting & Security Baseline**

## Overview

Zidney implements centralized, Redis-based rate limiting with multiple enforcement levels to prevent abuse while maintaining platform availability.

```
┌─────────────────────────────────────────────────┐
│          Incoming Request                       │
└────────────────┬────────────────────────────────┘
                 │
                 v
     ┌──────────────────────────┐
     │  Middleware Stack:       │
     │  1. Correlation ID       │
     │  2. Tenant Resolver      │
     │  3. License Enforcement  │
     │  4. Schema Version       │
     │  5. Rate Limiting        │ ◄─── THIS LAYER
     └──────────────┬───────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        v                       v
    Exchange Limit?         Application Logic
    (429 if exceeded)       (Normal Flow)
```

## Rate Limiting Strategies

### 1. Per-IP Rate Limiting (Sliding Window)

**Purpose:** Prevent brute-force attacks and IP-based abuse

**Limits:**

- Authentication attempts: 5 per IP per minute
- Password reset: 2 per IP per minute
- General API: 100 per IP per minute

**Implementation:**

```
Redis Key: rate:auth:ip:{ip_address}
Type: ZSET (sorted set of timestamps)
TTL: 61 seconds (window + 1s buffer)

Algorithm: Sliding window
- Add current timestamp to set
- Remove timestamps outside window (now - 60s)
- Check count of remaining entries
- If count >= limit → return 429
```

**Example Flow:**

```
Request 1 (10:00:00): count=0 → PASS, store timestamp
Request 2 (10:00:05): count=1 → PASS, store timestamp
Request 3 (10:00:10): count=2 → PASS, store timestamp
Request 4 (10:00:15): count=3 → PASS, store timestamp
Request 5 (10:00:20): count=4 → PASS, store timestamp
Request 6 (10:00:25): count=5 → REJECT, return 429
Retry-After: ~40 seconds (oldest entry expires at 10:01:00)
```

### 2. Per-User Rate Limiting (Sliding Window)

**Purpose:** Prevent individual users from monopolizing resources

**Limits:**

- Authentication attempts: 5 per user per minute
- Attempt submissions: 1 per attempt (absolute limit)
- Password reset: 1 per user per minute
- General API: 50 per user per minute

**Implementation:**

```
Redis Key: rate:auth:user:{user_id}:{workspace_slug}
Type: ZSET
TTL: 61 seconds

Note: User limits are workspace-scoped to allow same user
in multiple workspaces without interference
```

**Account Lockout:**

```
On 5 failed auth attempts:
- Lock key: lock:user:account:{user_id}:{workspace_id}
- TTL: 60 seconds (exponential backoff: 60s, 120s, 240s on repeat)
- Returns 423 LOCKED instead of 429 RATE_LIMIT_EXCEEDED
```

### 3. Per-Workspace Rate Limiting (Sliding Window)

**Purpose:** Protect platform from workspace-level abuse or load spikes

**Limits:**

- Attempts starting: 20 per workspace per minute
- Attempt submissions: 100 per workspace per minute
- General API: 1000 per workspace per minute
- WebSocket connections: 10 per workspace per second

**Implementation:**

```
Redis Key: rate:workspace:{workspace_slug}
Type: ZSET
TTL: 61 seconds
```

### 4. Per-Attempt Rate Limiting (Counter)

**Purpose:** Enforce one submission per attempt (prevent duplicate grading)

**Limits:**

- 1 submission per attempt (strict)

**Implementation:**

```
Redis Key: rate:attempt:submit:{attempt_id}
Type: String (counter)
TTL: 1 second (expires after submission)

On first submission: SET key "1" EX 1
On second submission within 1s: INCR fails → 429
```

### 5. Per-WebSocket Rate Limiting (Token Bucket)

**Purpose:** Prevent message flooding over WebSocket connections

**Limits:**

- 100 messages per minute (average)
- 10 messages per second burst (max)

**Implementation:**

```
Redis Key: rate:ws:msg:{user_id}:{attempt_id}
Type: String (JSON with tokens and last refill)
TTL: Sliding (updated on every message)

Algorithm: Token Bucket
Capacity: 100 tokens (reset every 60 seconds)
Refill rate: 100/60 = 1.67 tokens per second
Burst: 10 tokens available immediately

On each message:
1. Get current tokens
2. Add refilled tokens based on time elapsed
3. Cap at capacity
4. Check if 1 token available
5. If yes: consume 1 token, allow message
6. If no: close connection with 4029 status
```

## Redis Key Structure

### Master Keys

```
rate:auth:ip:{ip}                              # Auth per IP
rate:auth:user:{user_id}:{workspace_slug}      # Auth per user
rate:auth:workspace:{workspace_slug}           # Auth per workspace
rate:attempt:start:{user_id}                   # Attempt start rate
rate:workspace:{workspace_slug}                # General workspace rate
```

### idempotency Keys

```
idempotent:attempt:{attempt_id}:{key}          # Cached result
cache:grading:{job_id}                          # Job result cache
```

### WebSocket Keys

```
rate:ws:{user_id}:{attempt_id}                 # Connection tracking
rate:ws:msg:{user_id}:{attempt_id}             # Message rate limiting
lock:ws:{user_id}:{attempt_id}                 # Connection mutex
```

### Account Lockout Keys

```
lock:user:account:{user_id}:{workspace_id}     # Account lock
```

## Rate Limit Headers

All rate-limited responses include:

```
HTTP/1.1 429 Too Many Requests

X-Rate-Limit-Limit: 5                   # Maximum requests in window
X-Rate-Limit-Remaining: 0               # Remaining requests
X-Rate-Limit-Reset: 1645000040         # Unix timestamp when limit resets
Retry-After: 40                         # Seconds to wait before retry

Content-Type: application/json
{
  "success": false,
  "data": null,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Rate limit exceeded",
    "correlationId": "req-123-auth-limit",
    "details": {
      "limit": 5,
      "window_seconds": 60,
      "current_count": 5,
      "retry_after_seconds": 40,
      "rate_limit_type": "per_ip"
    }
  }
}
```

## Multi-Instance Synchronization

### Challenge

Rate limiting state must be shared across multiple API instances:

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  API Inst 1 │         │  API Inst 2 │         │  API Inst 3 │
│             │         │             │         │             │
│ :3000       │         │ :3000       │         │ :3000       │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       └───────────┬───────────┴───────────┬───────────┘
                   │                       │
                   v                       v
            ┌──────────────────────────────────┐
            │     Redis (Centralized)          │
            │  - rate:auth:ip:1.2.3.4         │
            │  - rate:auth:user:user-1        │
            │  - rate:attempt:submit:att-1    │
            └──────────────────────────────────┘
```

### Solution

Redis acts as the single source of truth for rate limit state.

**Atomicity:** All rate limit checks are atomic Redis operations:

- `INCR key` returns new count atomically
- `ZCARD key` returns cardinality atomically
- No race conditions possible

**Example: Concurrent Requests**

```
User fires 3 identical requests simultaneously:

Inst 1 → INCR rate:auth:ip:1.2.3.4 → returns 1 ✓ PASS
Inst 2 → INCR rate:auth:ip:1.2.3.4 → returns 2 ✓ PASS
Inst 3 → INCR rate:auth:ip:1.2.3.4 → returns 3 ✓ PASS

All three see consistent, globally updated count.
```

## Configuration

### Environment Variables

```bash
# Rate Limiting Configuration
RATE_LIMIT_AUTH_PER_IP=5           # Failed attempts before lock
RATE_LIMIT_AUTH_PER_USER=5
RATE_LIMIT_AUTH_PER_WORKSPACE=20

RATE_LIMIT_API_PER_IP=100
RATE_LIMIT_API_PER_USER=50
RATE_LIMIT_API_PER_WORKSPACE=1000

RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_ACCOUNT_LOCK_DURATION=60

RATE_LIMIT_WS_PER_SECOND=10        # Burst
RATE_LIMIT_WS_PER_MINUTE=100       # Sustained
```

### Per-Endpoint Configuration

```typescript
const rateLimitConfig = {
  'POST /auth/login': {
    per_ip: { limit: 5, window: 60 },
    per_user: { limit: 5, window: 60 },
    per_workspace: { limit: 20, window: 60 },
  },
  'POST /attempt/{id}/submit': {
    per_attempt: { limit: 1, window: -1 }, // -1 = unlimited window
    per_user: { limit: 0 }, // No per-user limit (per-attempt sufficient)
  },
  'GET /ws/attempt/{id}': {
    message_rate: { limit: 100, window: 60 },
    burst: 10,
  },
}
```

## Monitoring & Alerts

### Rate Limit Audit Trail

All rate limit violations logged:

```json
{
  "timestamp": "2026-02-19T10:30:45Z",
  "level": "warn",
  "service": "api",
  "event": "rate_limit_violation",
  "correlation_id": "req-123-limit",
  "workspace_slug": "acme-university",
  "user_id": "user-123",
  "endpoint": "POST /auth/login",
  "rate_limit_type": "per_ip",
  "identifier": "192.168.1.1",
  "limit": 5,
  "window_seconds": 60,
  "current_count": 5,
  "additional_fields": {
    "http_status": 429,
    "retry_after": 40
  }
}
```

### Alert Thresholds

- **Warning:** 10 violations per minute for any single identifier
- **Critical:** 50 violations per minute (likely attack)
- **DDoS:** 1000 violations per minute from unique IPs

### Dashboard Metrics

```
Rate Limit Violations by Type (last 24h)
├── per_ip: 234 violations
├── per_user: 89 violations
├── per_workspace: 12 violations
└── per_attempt: 5 violations

Top Rate Limited IPs:
1. 203.0.113.1: 156 violations (login attempts)
2. 198.51.100.5: 45 violations (API probing)

Top Rate Limited Users:
1. user-456: 34 violations (failed login)
2. user-789: 12 violations (excessive attempts)
```

## Troubleshooting

### "Too Many Requests" - What to do?

1. **Check Retry-After header:**

   ```bash
   curl -v https://api.zidney.example.com/auth/login
   # Look for: Retry-After: 40
   ```

2. **Wait the specified duration** (not just 1 second)

3. **Check for excessive requests:**

   ```bash
   # Review your application logs for patterns
   grep "429 Too Many Requests" /var/log/app.log | wc -l
   ```

4. **If legitimate user locked out:**
   - Wait 60 seconds for account lock to expire
   - Or contact support for manual unlock

### Cache Coherence Issues

**Problem:** Rate limit state seems inconsistent across instances

**Diagnosis:**

1. Check Redis connectivity: `redis-cli ping`
2. Verify all instances connect to same Redis: `redis-cli CLIENT LIST`
3. Check for Redis connection timeouts in logs

**Resolution:**

```bash
# Review Redis metrics
redis-cli INFO STATS

# Check for eviction (hitting max memory)
redis-cli CONFIG GET maxmemory-policy
```

### Redis Connection Failures

**Behavior:** All requests return 503 SERVICE_UNAVAILABLE

**Cause:** Redis health check at /health/live fails

**Recovery:**

```bash
# Restart Redis
systemctl restart redis

# Monitor recovery
redis-cli MONITOR
```

## Performance Characteristics

### Latency

- **Per-IP check:** < 1ms (INCR on ZSET)
- **Per-user check:** < 1ms (INCR on ZSET)
- **Per-workspace check:** < 1ms (INCR on ZSET)
- **p99 latency:** < 5ms (including Redis network latency)

### Memory Usage

- **Per active IP:** ~200 bytes (ZSET entry)
- **Per active user:** ~250 bytes (ZSET entry)
- **Per attempt:** ~150 bytes (counter)
- **Estimated for 10,000 concurrent users:** ~5MB

### Throughput

- **Single Redis instance:** 50,000 rate limit checks/second
- **Target typical load:** 5,000 checks/second (10x headroom)

## Alternatives Considered

### 1. In-Memory Rate Limiting

❌ **Rejected** - No distributed state across instances

- Would require synchronization between instances
- Inconsistent limits across API pods

### 2. Token-based Rate Limiting

⚠️ **Rejected for now** - Higher complexity

- More granular but harder to configure
- Can revisit in future ADR

### 3. Machine Learning Detection

⏳ **Future enhancement** - Out of scope for Stage 08

- Would provide behavior-based anomaly detection
- Requires historical data collection first

## Related ADRs

- [ADR-0001: Database-per-Tenant](../architecture/adr/adr-0001-database-per-tenant.md)
- [ADR-0006: Runtime Authoritative Time](../architecture/adr/adr-0006-runtime-authoritative-time.md)

## References

- Rate Limiting Best Practices: https://cloud.google.com/architecture/rate-limiting-strategies-techniques
- Redis ZSET Documentation: https://redis.io/commands/zadd
- Sliding Window Algorithm: https://en.wikipedia.org/wiki/Sliding_window_protocol
