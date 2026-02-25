# Metrics Middleware Guide

**For:** API developers implementing metrics collection  
**Version:** 1.0  
**Updated:** 2026-02-25

---

## Overview

Metrics middleware collects performance and business data from all API endpoints. Metrics are emitted to Prometheus via `/metrics` endpoint.

---

## Installing Metrics Middleware

```typescript
// apps/api/src/index.ts
import { Hono } from 'hono'
import { metricsMiddleware } from './middleware/metrics.middleware'

const app = new Hono()

// Add metrics middleware early in the chain
app.use(metricsMiddleware)

// All routes will now emit metrics
app.get('/mmc/members', handleGetMembers)
```

---

## Available Metrics

### Request Counters

| Metric                         | Type    | Labels                       | Example                                                                         |
| ------------------------------ | ------- | ---------------------------- | ------------------------------------------------------------------------------- |
| `http_requests_total`          | Counter | method, path, status         | `http_requests_total{method="GET", path="/mmc/members", status="200"} 145`      |
| `mmc_members_created_total`    | Counter | role_id                      | `mmc_members_created_total{role_id="admin"} 23`                                 |
| `mmc_login_attempts_total`     | Counter | success (true/false)         | `mmc_login_attempts_total{success="true"} 450`                                  |
| `mmc_permission_checks_total`  | Counter | domain, allowed (true/false) | `mmc_permission_checks_total{domain="MEMBERS_MANAGEMENT", allowed="true"} 1200` |
| `mmc_permission_denials_total` | Counter | domain                       | `mmc_permission_denials_total{domain="MEMBERS_MANAGEMENT"} 12`                  |

### Request Latency (Histograms)

| Metric                             | Type      | Labels       | Buckets                                   |
| ---------------------------------- | --------- | ------------ | ----------------------------------------- |
| `http_request_duration_ms`         | Histogram | method, path | [10, 50, 100, 250, 500, 1000, 2500, 5000] |
| `mmc_member_creation_duration_ms`  | Histogram | —            | [50, 100, 200, 500, 1000]                 |
| `mmc_permission_check_duration_ms` | Histogram | —            | [5, 10, 25, 50, 100]                      |

### Error Counters

| Metric                        | Type    | Labels       | Example                                                        |
| ----------------------------- | ------- | ------------ | -------------------------------------------------------------- |
| `http_errors_total`           | Counter | status, path | `http_errors_total{status="401", path="/mmc/members"} 8`       |
| `mmc_validation_errors_total` | Counter | error_type   | `mmc_validation_errors_total{error_type="invalid_password"} 3` |

---

## Implementation Example

```typescript
// apps/api/src/middleware/metrics.middleware.ts
import { Context } from 'hono'
import { Registry, Counter, Histogram } from 'prom-client'

const register = new Registry()

// Define metrics
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
})

const httpRequestDurationMs = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'path'],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
})

const mmcPermissionChecksTotal = new Counter({
  name: 'mmc_permission_checks_total',
  help: 'Total permission checks',
  labelNames: ['domain', 'allowed'],
  registers: [register],
})

export const metricsMiddleware = async (
  c: Context,
  next: () => Promise<void>
) => {
  const startTime = Date.now()
  const method = c.req.method
  const path = c.req.path

  try {
    await next()

    const duration = Date.now() - startTime
    const status = c.res.status

    // Emit metrics
    httpRequestsTotal.inc({
      method,
      path,
      status: String(status),
    })

    httpRequestDurationMs.observe({ method, path }, duration)
  } catch (error) {
    const duration = Date.now() - startTime

    httpRequestsTotal.inc({
      method,
      path,
      status: '500',
    })

    httpRequestDurationMs.observe({ method, path }, duration)
    throw error
  }
}

// Expose metrics on /metrics endpoint
export const metricsRoute = (app) => {
  app.get('/metrics', async (c) => {
    c.header('Content-Type', register.contentType)
    return c.text(await register.metrics())
  })
}
```

---

## Using Metrics in Business Logic

### Permission Check Metrics

```typescript
// In permission.service.ts
async checkPermission(userId: UUID, domain: string, action: string): Promise<boolean> {
  const startTime = Date.now();

  const allowed = await this.resolvePermissions(userId, domain, action);

  const duration = Date.now() - startTime;

  // Emit metrics
  mmcPermissionChecksTotal.inc({
    domain,
    allowed: String(allowed),
  });

  mmcPermissionCheckDurationMs.observe({}, duration);

  return allowed;
}
```

### Member Creation Metrics

```typescript
// In member.service.ts
async createMember(data: CreateMemberRequest): Promise<Member> {
  const startTime = Date.now();

  const member = await this.db.members.create(data);

  const duration = Date.now() - startTime;

  // Emit metrics
  mmcMembersCreatedTotal.inc({
    role_id: member.role_id,
  });

  mmcMemberCreationDurationMs.observe({}, duration);

  return member;
}
```

### Login Metrics

```typescript
// In auth.service.ts
async login(username: string, password: string): Promise<JWT> {
  try {
    const member = await this.validateCredentials(username, password);
    const token = this.issueJWT(member);

    mmcLoginAttemptsTotal.inc({ success: 'true' });

    return token;
  } catch (error) {
    mmcLoginAttemptsTotal.inc({ success: 'false' });
    throw error;
  }
}
```

---

## Querying Metrics

### Prometheus Query Examples

```promql
# Average request duration per endpoint
rate(http_request_duration_ms_sum[5m]) / rate(http_request_duration_ms_count[5m])

# 95th percentile request duration
histogram_quantile(0.95, http_request_duration_ms)

# Members created per minute
rate(mmc_members_created_total[1m])

# Permission denial rate
rate(mmc_permission_denials_total[5m]) / rate(mmc_permission_checks_total[5m])

# Login success rate
rate(mmc_login_attempts_total{success="true"}[5m]) / rate(mmc_login_attempts_total[5m])
```

---

## Grafana Dashboard Example

```json
{
  "dashboard": {
    "title": "MMC Metrics",
    "panels": [
      {
        "title": "Request Duration (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, http_request_duration_ms)"
          }
        ]
      },
      {
        "title": "Permission Checks per Second",
        "targets": [
          {
            "expr": "rate(mmc_permission_checks_total[1m])"
          }
        ]
      },
      {
        "title": "Login Success Rate",
        "targets": [
          {
            "expr": "rate(mmc_login_attempts_total{success=\"true\"}[5m]) / rate(mmc_login_attempts_total[5m])"
          }
        ]
      }
    ]
  }
}
```

---

## Testing Metrics

Verify metrics are emitted:

```typescript
it('should emit member_created metric', async () => {
  const counterSpy = jest.spyOn(mmcMembersCreatedTotal, 'inc')

  await memberService.createMember(data)

  expect(counterSpy).toHaveBeenCalledWith({
    role_id: expect.any(String),
  })
})
```

---

## Best Practices

✅ **DO:**

- Emit metrics for all critical operations
- Use histogram for latency measurements
- Include relevant labels for filtering
- Keep metric names descriptive and consistent

❌ **DON'T:**

- Include user PII in metric labels
- Create unbounded label cardinality (e.g., user_id as label)
- Emit metrics in error paths without context
- Use generic names like `counter1`, `duration_ms`

---

## Troubleshooting

**Metrics not showing up?**

- Check `/metrics` endpoint is registered
- Verify middleware is added early in request chain
- Check Prometheus scrape configuration

**High cardinality warnings?**

- Avoid using user_id or email as labels
- Use role_id or domain instead (bounded values)
- Group by function/operation type
