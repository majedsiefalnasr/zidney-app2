# seed-dashboard-test-data

## Command

```sh
bun run dev:seed:dashboard-test-data
```

## Purpose

Seeds realistic MMC dashboard test data into master_db for testing dashboard views, charts,
and analytics. Creates 1000 licenses across 3 statuses, 100 revenue records across 10 countries,
and 20 affiliates with 200 usage records.

## Why It Exists

MMC dashboard development and testing requires a rich dataset to exercise sorting, filtering,
pagination, and chart rendering. This script provides an idempotent, production-safe way to
inject realistic data into the test environment.

## When to Run

- After initializing a fresh development database
- Before running dashboard UI integration tests
- When resetting the test environment to a known-good state

## Execution Mode

`manual`

Infra-dependent: exits 0 with structured warn log if `DATABASE_URL` is not set.
Idempotent: detects existing test data and skips re-seeding if records already exist.
Production-safe: aborts immediately if `NODE_ENV=production`.

## Dependencies

- `pg` (PostgreSQL client)
- `DATABASE_URL` environment variable pointing to master_db (test environment only)
- Tables: `licenses`, `products`, `revenue_records`, `affiliates`, `affiliate_usages`

## Example Usage

```sh
# Seed with test database URL
DATABASE_URL=postgres://user:pass@localhost:5432/master_db bun run dev:seed:dashboard-test-data
```

Expected output:

```json
{
  "level": "info",
  "message": "SEEDING COMPLETE — Dashboard test data ready",
  "metadata": {
    "summary": { "products": 3, "licenses": 1000, "revenueRecords": 100, "affiliates": 20 }
  }
}
```

## Known Failure Modes

| Scenario                 | Exit Code | Behavior                            |
| ------------------------ | --------- | ----------------------------------- |
| `DATABASE_URL` not set   | 0         | Structured warn — infra-absent pass |
| `NODE_ENV=production`    | 1         | Safety abort with error log         |
| Test data already exists | 0         | Structured warn with skip message   |
| DB connection failure    | 1         | Structured error, error thrown      |
