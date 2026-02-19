# ADR-0009: Rate Limiting Strategy & Implementation

**Status:** ACCEPTED  
**Date:** 2026-02-19  
**Decision Owner:** Platform Architecture Team  
**Affected Parties:** API Team, DevOps, Support

## 1. Summary

Zidney implements a **dual-algorithm rate limiting strategy** combining Sliding Window algorithms (for login/general endpoints) and Token Bucket algorithms (for real-time WebSocket messaging). Rate limits are enforced at middleware level using Redis atomic operations, with differentiated policies per endpoint category to balance security, usability, and performance.

## 2. Problem

### 2.1 Security Threats

**Brute Force Attacks:**

- Attackers attempt many login/password-reset combinations to compromise accounts
- Without rate limiting, 10,000 attempts/minute feasible on standard hardware
- Credential stuffing from public breaches

**Denial of Service (DoS):**

- Exam attempt submissions from single IP can exhaust database connections
- WebSocket message floods from single connection waste memory, CPU
- Cascading failures: one attacker affects all users in workspace

**Account Enumeration:**

- Mass password-reset attempts reveal valid email addresses
- Timing differences between valid/invalid users enable user discovery

### 2.2 User Experience Requirements

- Students must not be rate-limited during legitimate exam attempts
- Proctors need real-time monitoring (WebSocket) without throttling interference
- System admins must not hit limits while bulk-importing users

### 2.3 Platform Requirements

- Workspace-level isolation: one tenant's abuse cannot affect others
- Multi-instance consistency: rate limits enforced same way across API nodes
- Graceful degradation: Redis cache misses don't break authentication

## 3. Decision

### 3.1 Primary Algorithm: Sliding Window (Login & General Endpoints)

```
┌─────────────────────────────────────────┐
│ Sliding Window (60-second window)        │
├─────────────────────────────────────────┤
│ Time:    ↓────────────────────────↓     │
│ Reqs:    [1] [2] [3] [4] [5]           │
│ Now:                           └─ NEW   │
│ Count:   All requests within window     │
└─────────────────────────────────────────┘

Behavior:
- Adds request timestamp to Redis sorted set
- Removes expired timestamps (> 60s old)
- Returns current count in window
```

**Redis Implementation:**

```lua
-- File: packages/redis-utils/src/sliding-window.lua

local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local windowStart = now - window

-- Remove old entries outside window
redis.call('zremrangebyscore', key, 0, windowStart)

-- Get current count
local count = redis.call('zcard', key)

-- Check if limit exceeded
if count >= limit then
  return {0, tonumber(redis.call('zrange', key, 0, 0, 'withscores')[2]) or now}
end

-- Add new entry
redis.call('zadd', key, now, now .. '-' .. math.random())
redis.call('expire', key, window + 1)

return {1, now}
```

**Advantages:**

- Precise enforcement: exactly count requests in window
- No pre-expiring requests: accommodates burst behavior
- Redis atomic: multiple API instances see same count
- Easy visibility: inspect with `ZRANGE key 0 -1 WITHSCORES`

**Disadvantages:**

- Memory per-key: ~50 bytes per request stored in Redis
- At limit: 50 reqs/min × 50 bytes = 2.5KB per user minimum

### 3.2 Secondary Algorithm: Token Bucket (WebSocket Messages)

```
┌────────────────────────────────────────┐
│ Token Bucket (100 tokens, 1/sec refill)│
├────────────────────────────────────────┤
│ Initial:  [●●●●●●●●●●]               │
│ +1/sec:   [●●●●●●●●●●]               │
│ Message:  [●●●●●●●●●] ← consume 1     │
│ Burst:    [●●●●●●●●●●●●●●●●●●●●]    │
└────────────────────────────────────────┘

Behavior:
- Maintains token count per WebSocket
- Tokens refill at fixed rate (1/sec = 60/min)
- Allows burst (temporary spike to 100)
```

**Firebase Admin SDK-style Implementation:**

```typescript
interface TokenBucket {
  tokens: number // Current tokens available
  lastRefillAt: number // Timestamp of last refill
  capacity: number // Max tokens (100)
  refillRate: number // Tokens per second (1)
}

async function checkWebSocketLimit(
  connectionId: string,
  cost: number = 1
): Promise<boolean> {
  const bucket = await redis.json.get(`ws-bucket:${connectionId}`)

  if (!bucket) {
    // New connection - start at capacity
    await redis.json.set(`ws-bucket:${connectionId}`, '$', {
      tokens: 100,
      lastRefillAt: now(),
      capacity: 100,
      refillRate: 1,
    })
    return cost <= 100
  }

  // Refill based on elapsed time
  const elapsed = now() - bucket.lastRefillAt
  const tokensToAdd = Math.floor(elapsed * bucket.refillRate)
  bucket.tokens = Math.min(bucket.tokens + tokensToAdd, bucket.capacity)
  bucket.lastRefillAt = now()

  if (bucket.tokens < cost) {
    return false // Insufficient tokens
  }

  bucket.tokens -= cost
  await redis.json.set(`ws-bucket:${connectionId}`, '$', bucket)
  return true
}
```

**Advantages:**

- Handles bursts naturally: 100 tokens allow spike then steady state
- Fair allocation: per-connection isolation prevents one user hogging bandwidth
- Real-time adaptive: refill math adjusts for actual elapsed time

**Disadvantages:**

- Floating-point precision: refill calculations must be exact
- State management: token bucket state must persist per connection

### 3.3 Differentiated Policies

| Category              | Endpoint(s)               | Algorithm    | Limit                    | Window  |
| --------------------- | ------------------------- | ------------ | ------------------------ | ------- |
| **Login**             | POST /auth/login          | Sliding      | 5/min per IP             | 60s     |
|                       |                           | Sliding      | 5/min per user           | 60s     |
|                       |                           | Sliding      | 20/min per workspace     | 60s     |
| **Password Reset**    | POST /auth/password-reset | Sliding      | 1/min per user           | 60s     |
|                       |                           | Sliding      | 2/min per IP             | 60s     |
| **Attempt Submit**    | POST /attempt/{id}/submit | Counter      | 1 per attempt            | Forever |
| **General Endpoints** | GET /attempt/{id}, etc.   | Sliding      | 1000/min per workspace   | 60s     |
| **WebSocket**         | GET /ws/attempt/{id}      | Token Bucket | 100 tokens, 1/sec refill | N/A     |

## 4. Consequences

### 4.1 Benefits

1. **Attacks Mitigated:**
   - Brute force: 5 attempts/min means 7,200 attempts/day per user (from single IP)
   - Credential stuffing: Multi-layer (IP + user + workspace) prevents single IP grinding
   - WebSocket DoS: 100 msg/sec burst caps at 60 msg/min sustained

2. **User Experience:**
   - Normal login workflow: 1-2 requests unaffected
   - Normal exam: submit 1 answer per 5-10 seconds = unaffected
   - WebSocket: 1 msg per second = well within 100 msg/min capacity

3. **Operational:**
   - Redis-driven: horizontally scalable
   - Observable: every violation logged with correlationId, timestamp, endpoint
   - Debuggable: `ZRANGE rate-limit:user:user-123:login 0 -1 WITHSCORES` shows all requests

### 4.2 Costs

1. **Infrastructure:**
   - Redis memory: ~2-5 GB per 1M active users
   - Redis CPU: <5% at 10k req/sec across sliding + token bucket ops
   - Latency: +2-5ms per request (Redis ZREM + ZADD + EXPIRE round trips)

2. **Implementation Complexity:**
   - Middleware ordering critical: Rate limit must run AFTER tenant resolver (need workspace context)
   - Cache invalidation: connection drops must clean up token bucket state
   - Clock skew: relies on synchronized system time across API instances

3. **False Positives:**
   - Proxy chains: if users connect via same proxy IP, all hit same IP limit
   - Mitigation: Use `X-Forwarded-For` header (if behind reverse proxy)
   - Risk: Attackers can't spoof easily (header validated by middleware)

### 4.3 Migration Path

1. **Phase 1 (Day 1):** Deploy with limits in permissive mode (log violations, don't reject)
2. **Phase 2 (Day 2-3):** Monitor logs for false positives (support team on alert)
3. **Phase 3 (Day 4+):** Move to enforcement mode (return 429)

## 5. Alternatives Considered

### 5.1 Leaky Bucket ❌

```
Rejected because:
- Old entries expired immediately, not smoothly
- Burst behavior penalized legitimate spikes
- Not suitable for WebSocket use case
```

### 5.2 Fixed Window Counter ❌

```
Rejected because:
- "Window boundary" phenomenon: requests cluster at window edge
- Example: First 60s = 5 requests allowed, then window flips, 5 more allowed immediately
- Allows 10 requests in 61 seconds (bypasses 5/min intent)
```

### 5.3 Database-based Rate Limiting ❌

```
Rejected because:
- Database I/O slower: +50-100ms vs +2-5ms with Redis
- Schema requires per-IP/per-user/per-workspace rows
- Doesn't scale for WebSocket (one connection = many quick messages)
```

### 5.4 Fixed Token Bucket (App Memory) ❌

```
Rejected because:
- Loss on restart: users not rate-limited if API instance reboots
- No cross-instance consistency: IP limit on instance A ≠ instance B
- Causes "spillover" when requests shift between instances
```

## 6. Implementation Details

### 6.1 Middleware Stack Order

```
Request
  ↓
[1] Correlation ID (generate UUID)
  ↓
[2] Tenant Resolver (extract workspace context)
  ↓
[3] License Enforcement (check workspace status)
  ↓
[4] Schema Version (match 1.1.0+)
  ↓
[5] Rate Limiting ← ← ← THIS STAGE
  ↓
Business Logic (routing)
```

**Code Example:**

```typescript
// File: apps/api/src/middleware/index.ts

const rateLimitMiddleware = middleware.use(async (c, next) => {
  const clientIp = extractClientIP(c)
  const workspaceId = c.state.workspace_id
  const userId = c.state.user_id // May be undefined before login

  const endpoint = c.req.path
  const policy = getRateLimitPolicy(endpoint)

  for (const resource of ['ip', 'user', 'workspace']) {
    const key = buildRedisKey(
      resource,
      endpoint,
      resource === 'ip' ? clientIp : resource === 'user' ? userId : workspaceId
    )

    const allowed = await checkLimit(
      key,
      policy[resource].limit,
      policy[resource].window
    )

    if (!allowed) {
      logger.warn({
        correlation_id: c.state.correlation_id,
        event: 'rate_limit_exceeded',
        resource,
        endpoint,
        key,
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Rate limit exceeded',
            correlationId: c.state.correlation_id,
          },
        },
        429,
        {
          'Retry-After': policy[resource].window,
          'X-Rate-Limit-Limit': policy[resource].limit,
          'X-Rate-Limit-Remaining': 0,
        }
      )
    }
  }

  await next()
})
```

### 6.2 Error Response Format

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "correlationId": "req-123",
    "details": {
      "resource": "ip",
      "limit": 5,
      "window": 60,
      "resetAt": "2026-02-19T10:32:00Z"
    }
  }
}
```

### 6.3 Headers in 429 Response

| Header                 | Value      | Meaning                            |
| ---------------------- | ---------- | ---------------------------------- |
| Retry-After            | 60         | Seconds until rate limit resets    |
| X-Rate-Limit-Limit     | 5          | Max requests in window             |
| X-Rate-Limit-Remaining | 0          | Requests remaining in window       |
| X-Rate-Limit-Reset     | 1708363920 | Unix timestamp when window expires |

## 7. Monitoring & Alerts

### 7.1 Key Metrics

```
rate_limit.violations.total: Counter
  labels: [endpoint, resource, workspace_id]

rate_limit.check_duration_ms: Histogram
  labels: [endpoint]
  buckets: [1, 2, 5, 10, 50]

rate_limit.redis_errors: Counter
  labels: [operation]  // "zadd", "zrem", "expire"
```

### 7.2 Alert Thresholds

| Alert                       | Condition                                     | Action                                |
| --------------------------- | --------------------------------------------- | ------------------------------------- |
| **IP Brute Force**          | >10 violations/min from single IP             | Rate limit IP, notify security        |
| **User Account Attack**     | >10 violations/min for single user across IPs | Lock account 30 min, notify user      |
| **Workspace DoS**           | >50 violations/min workspace-wide             | Escalate to support, may soft-lock    |
| **Redis Connection Issues** | >5 rate limit check fails/min                 | Alert DevOps, fall back to permissive |

### 7.3 Dashboards

**Real-time Dashboard (Grafana):**

- Violations by endpoint (bar chart)
- Top 10 IPs triggering limits (table)
- Workspace rate limit health (green/yellow/red)
- Redis operation latency (percentiles)

## 8. Testing Strategy

### 8.1 Unit Tests (T073)

```typescript
// Test sliding window edge cases
it('should handle requests at window boundary', async () => {
  // Request at 0s, 30s, 60s, 60.1s
  // Verify old request at 0s drops out on 60.1s request
})

// Test token bucket refill
it('should refill tokens at correct rate', async () => {
  // Start with 100 tokens
  // Use 50 tokens
  // Wait 30 seconds
  // Verify 30 tokens available (not 50, due to limit test ordering)
})
```

### 8.2 Integration Tests (T084)

```typescript
// Rate limiting enforcement
it('should reject 6th login within 60s window', async () => {
  const responses = []
  for (let i = 0; i < 6; i++) {
    responses.push(await login(testUser))
  }

  expect(responses[0].status).toBe(200)
  expect(responses[5].status).toBe(429)
  expect(responses[5].json().error.code).toBe('TOO_MANY_REQUESTS')
})
```

### 8.3 Load Tests (T089-T092)

```typescript
// Concurrent login from 100 IPs
it('should handle 100 concurrent logins from different IPs', async () => {
  const ips = Array.from({ length: 100 }, (_, i) => `192.168.1.${i}`)
  const promises = ips.map((ip) =>
    login(testUser, { headers: { 'X-Forwarded-For': ip } })
  )

  const results = await Promise.all(promises)
  expect(results.filter((r) => r.status === 200).length).toBe(100)
})
```

## 9. Operational Runbooks

### 9.1 Increasing Rate Limits

**Scenario:** High-volume password reset event (forgot password link sent to all users)

**Steps:**

1. Identify affected endpoint: `POST /auth/password-reset`
2. Check current limit: `RATE_LIMIT_PASSWORD_RESET_PER_USER: 1/min`
3. Update environment:
   ```bash
   RATE_LIMIT_PASSWORD_RESET_PER_USER=5
   RATE_LIMIT_PASSWORD_RESET_PER_IP=10
   ```
4. Redeploy API instances (or use hot-reload if supported)
5. Monitor violations dashboard (should drop)
6. Revert limits after completion

### 9.2 Unblocking IP/User

**Scenario:** Legitimate user hit rate limit, requests to support

**Steps:**

1. Identify Redis key: `rate-limit:user:{user_id}:login`
2. Delete key manually:
   ```bash
   redis-cli DEL "rate-limit:user:user-123:login"
   ```
3. Verify key gone:
   ```bash
   redis-cli EXISTS "rate-limit:user:user-123:login"
   ```
4. User can now retry immediately
5. Log action: Who unblocked, timestamp, reason

### 9.3 Redis Degradation

**Scenario:** Redis connection times out, rate limiting unavailable

**Fallback Mode:**

- Rate limit checks return `true` (allow all requests)
- Log warnings: count of skipped checks
- Alert DevOps for investigation
- Fall back to permissive until Redis restored

## 10. References

- [RFC 6585 - HTTP Status Code 429](https://tools.ietf.org/html/rfc6585)
- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Protecting_Sensitive_Data_Cheat_Sheet.html)
- [Redis Sorted Sets](https://redis.io/commands#sorted-set)
- [Cloudflare Rate Limiting](https://blog.cloudflare.com/counting-things-a-lot-of-things/)

## 11. Approval & Sign-Off

| Role              | Name  | Date       | Status      |
| ----------------- | ----- | ---------- | ----------- |
| Architecture Lead | [TBD] | 2026-02-19 | ✅ Accepted |
| API Team Lead     | [TBD] | 2026-02-19 | ✅ Accepted |
| DevOps Lead       | [TBD] | 2026-02-19 | ✅ Accepted |
| Security Lead     | [TBD] | 2026-02-19 | ✅ Accepted |

---

**Related Documents:**

- [Rate Limiting Architecture Guide](/docs/rate-limiting/architecture.md)
- [RBAC Matrix](/docs/security/rbac-matrix.md)
- [Error Handling Standard](/docs/01_ENGINEERING_GOVERNANCE/09_ERROR_HANDLING_STANDARD.md)
