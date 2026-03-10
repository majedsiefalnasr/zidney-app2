# Rate Limiting Configuration - Licenses Management API

## Overview

Rate limiting is enforced per MMC admin and per license to prevent abuse, ensure fair resource
allocation, and protect infrastructure.

**Implementation:** Token bucket algorithm (sliding window)  
**Storage:** Redis with atomic increments  
**Default Strategy:** Per-IP + per-user combination

---

## Rate Limit Tiers

### Tier 1: Creation & Editing (Most Expensive Operations)

**Limit:** 10 requests per 60 seconds per MMC admin  
**Endpoint:** `POST /v1/mmc/licenses`, `PATCH /v1/mmc/licenses/:id`

**Rationale:** License creation triggers:

- Database write
- Unique constraint check
- Job queue insertion
- Audit log entry

**Enforcement:**

```
If requests in last 60s >= 10:
  → Return 429 Too Many Requests
  → Body: { error: "RATE_LIMIT_EXCEEDED", retry_after: 60 }
```

**Example:**

```bash
# Request 1-10: ✅ Allowed
for i in {1..10}; do
  curl -X POST /v1/mmc/licenses -H "Authorization: Bearer $TOKEN" \
    -d "{\"workspace_slug\":\"ws-$i\"}"
done

# Request 11: 429 Limit Exceeded
curl -X POST /v1/mmc/licenses \
  → 429 Too Many Requests
  → Retry-After: 60 seconds
```

---

### Tier 2: Listing (Read-Heavy)

**Limit:** 30 requests per 60 seconds per MMC admin  
**Endpoint:** `GET /v1/mmc/licenses?...`

**Rationale:** List queries can filter/paginate without state change. Relaxed limit.

**Enforcement:**

```
If requests in last 60s >= 30:
  → Return 429 Too Many Requests
```

**Use Case:** Dashboards, periodic syncs allowed; bulk scraping blocked.

---

### Tier 3: Detail Fetches (Cheapest Reads)

**Limit:** 60 requests per 60 seconds per MMC admin  
**Endpoint:** `GET /v1/mmc/licenses/:id`

**Rationale:** Single-record fetch from primary key lookup; most efficient.

**Enforcement:**

```
If requests in last 60s >= 60:
  → Return 429 Too Many Requests
```

**Use Case:** Real-time dashboards, polling applications.

---

### Tier 4: Status Transitions (Per-License)

**Limit:** 5 requests per 60 seconds per license  
**Endpoints:**

- `POST /v1/mmc/licenses/:id/soft-lock`
- `POST /v1/mmc/licenses/:id/unlock`
- `POST /v1/mmc/licenses/:id/archive`
- `POST /v1/mmc/licenses/:id/restore`

**Rationale:** Prevent state machine thrashing (rapid transitions).

**Enforcement:**

```
Per license_id (not per user):
  If status_transitions in last 60s >= 5:
    → Return 429 Too Many Requests
```

**Example:**

```bash
# License can transition 5 times per minute
license_id="lic-abc123"

# Transitions 1-5: ✅
curl -X POST /v1/mmc/licenses/$license_id/soft-lock  # ✅ 1/5
curl -X POST /v1/mmc/licenses/$license_id/unlock     # ✅ 2/5
curl -X POST /v1/mmc/licenses/$license_id/soft-lock  # ✅ 3/5
curl -X POST /v1/mmc/licenses/$license_id/unlock     # ✅ 4/5
curl -X POST /v1/mmc/licenses/$license_id/soft-lock  # ✅ 5/5

# Transition 6: 429
curl -X POST /v1/mmc/licenses/$license_id/unlock     # ❌ RATE_LIMIT_EXCEEDED
```

---

### Tier 5: Provisioning Retry (Per-License)

**Limit:** 3 requests per 60 seconds per license  
**Endpoint:** `POST /v1/mmc/licenses/:id/retry-provisioning`

**Rationale:** Prevent retry storms; exponential backoff in job handler.

**Enforcement:**

```
Per license_id:
  If retries in last 60s >= 3:
    → Return 429 Too Many Requests
    → Reason: Job already queued
```

---

### Tier 6: Deletion (Per-License + User)

**Limit:** 1 request per 300 seconds (5 minutes) per user per license  
**Endpoint:** `DELETE /v1/mmc/licenses/:id?confirm=true`

**Rationale:** Destructive operation; require confirmation + rate limit.

**Enforcement:**

```
Composite key: user_id + license_id + action=delete
If deletions in last 300s >= 1:
  → Return 429 Too Many Requests
  → Reason: License can only be deleted once per 5 minutes
```

---

## Implementation

### Redis Key Schema

```
# Tier 1: Create/Edit
mmc-rate-limit:{user_id}:create_edit → Counter (60s TTL)

# Tier 2: List
mmc-rate-limit:{user_id}:list → Counter (60s TTL)

# Tier 3: Detail
mmc-rate-limit:{user_id}:detail → Counter (60s TTL)

# Tier 4: Transitions
mmc-rate-limit:{license_id}:transitions → Counter (60s TTL)

# Tier 5: Retries
mmc-rate-limit:{license_id}:retries → Counter (60s TTL)

# Tier 6: Deletions
mmc-rate-limit:{user_id}:{license_id}:delete → Counter (300s TTL)
```

### Middleware Implementation

```typescript
async function rateLimitMiddleware(c: Context, next: () => Promise<void>) {
  const userId = c.get("user").id;
  const correlationId = c.get("correlation_id");

  const endpoint = c.req.path;
  const method = c.req.method;

  // Determine rate limit tier & key
  let key: string;
  let limit: number;
  let ttl: number = 60;

  if (method === "POST" && endpoint.includes("/licenses?$")) {
    key = `mmc-rate-limit:${userId}:create_edit`;
    limit = 10;
  } else if (method === "GET" && endpoint.includes("/licenses?$")) {
    key = `mmc-rate-limit:${userId}:list`;
    limit = 30;
  } else if (method === "GET" && endpoint.match(/\/licenses\/[^/]+$/)) {
    key = `mmc-rate-limit:${userId}:detail`;
    limit = 60;
  } else if (
    method === "POST" &&
    endpoint.match(/\/licenses\/[^/]+\/(soft-lock|unlock|archive|restore)/)
  ) {
    const licenseId = extractLicenseId(endpoint);
    key = `mmc-rate-limit:${licenseId}:transitions`;
    limit = 5;
  } else if (method === "POST" && endpoint.match(/\/licenses\/[^/]+\/retry-provisioning/)) {
    const licenseId = extractLicenseId(endpoint);
    key = `mmc-rate-limit:${licenseId}:retries`;
    limit = 3;
  } else if (method === "DELETE" && endpoint.match(/\/licenses\/[^/]+$/)) {
    const licenseId = extractLicenseId(endpoint);
    key = `mmc-rate-limit:${userId}:${licenseId}:delete`;
    limit = 1;
    ttl = 300; // 5 minutes
  }

  // Check rate limit
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttl);
  }

  if (count > limit) {
    const retryAfter = await redis.ttl(key);
    c.res.headers.set("Retry-After", String(retryAfter));

    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: `${limit} requests per ${ttl} seconds allowed`,
          details: {
            limit,
            current: count,
            retry_after: retryAfter,
            correlation_id: correlationId,
          },
        },
      },
      { status: 429 },
    );
  }

  // Attach rate limit info to response
  c.res.headers.set("X-RateLimit-Limit", String(limit));
  c.res.headers.set("X-RateLimit-Remaining", String(Math.max(0, limit - count)));
  c.res.headers.set("X-RateLimit-Reset", String(Math.ceil(Date.now() / 1000) + ttl));

  await next();
}
```

---

## Response Headers

All rate-limited endpoints return:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1645457400
```

On limit exceeded:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1645457400

{
  "success": false,
  "data": null,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "10 requests per 60 seconds allowed",
    "details": {
      "limit": 10,
      "current": 11,
      "retry_after": 45,
      "correlation_id": "corr-abc123"
    }
  }
}
```

---

## Monitoring & Adjustment

### Metrics to Track

```sql
-- Rate limit hit frequency
SELECT
  endpoint,
  COUNT(*) as hits,
  AVG(count) as avg_requests_per_window,
  MAX(count) as peak_requests
FROM rate_limit_events
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY endpoint
ORDER BY hits DESC;
```

### When to Adjust Limits

| Signal                   | Action                                  |
| ------------------------ | --------------------------------------- |
| 429 errors increasing    | Increase limit or investigate spike     |
| Legitimate users blocked | Whitelist IP or increase per-user limit |
| Abuse patterns detected  | Decrease limit or add IP-based blocking |
| Infrastructure straining | Implement stricter rate limiting        |

### Emergency Bypass (SRE Only)

```bash
# Temporarily disable rate limiting for admin troubleshooting
redis-cli SET mmc-rate-limit-disabled:true 1 EX 300  # 5 minute bypass

# Or whitelist specific IPs
redis-cli SADD mmc-rate-limit-whitelist 192.168.1.100
```

---

## Testing Rate Limits

### Load Test Script

```bash
#!/bin/bash
# Test Tier 1 (10 req/min limit)

echo "Testing create/edit rate limit (10 req/min)..."

for i in {1..12}; do
  response=$(curl -s -w "\n%{http_code}" -X POST $API_URL/v1/mmc/licenses \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"product_id\":\"prod-001\",\"workspace_slug\":\"test-$i\"}")

  status=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -1)

  if [ "$i" -le "10" ]; then
    echo "✅ Request $i: $status (expected 201)"
  else
    if [ "$status" = "429" ]; then
      echo "✅ Request $i: $status (expected 429 - rate limited)"
    else
      echo "❌ Request $i: $status (expected 429, got $status)"
    fi
  fi

  sleep 0.5
done
```

---

## FAQ

**Q: Why per-license rate limiting for transitions?**  
A: Prevent state machine thrashing (rapid lock/unlock cycles) without impacting other licenses.

**Q: Can I batch operations to avoid rate limits?**  
A: No. Batch operations are treated as individual requests. Design to respect limits.

**Q: What if I need higher limits?**  
A: Contact platform team. We can provision higher limits for specific use cases.

**Q: Does rate limiting log who's abusing?**  
A: Yes. All 429 responses logged with correlation_id for audit trail.

---

**Version:** 1.0.0  
**Last Updated:** 2026-02-22  
**Maintained By:** Platform Operations
