# Guard Script Usage Guide

The Type Safety Guard Script (`scripts/type-safety-guard.ts`) detects unsafe TypeScript patterns across the monorepo.

## Quick Start

### Run the guard script locally

```bash
bun type-safety-guard
```

Output shows all violations with file:line:column information.

### Get JSON output

```bash
bun type-safety-guard --json
```

Output: structured JSON suitable for CI integration

### Get markdown report

```bash
bun type-safety-guard --markdown
```

Output: formatted markdown report grouped by violation type

## What It Detects

### 1. Explicit `any` Patterns

Detects all variations of explicit `any` usage:

```typescript
// ❌ Detected: `: any`
function process(data: any) {}

// ❌ Detected: `as any`
const value = data as any;

// ❌ Detected: `<any>`
const typed = <any>data;
```

### 2. @ts-ignore Without Justification

```typescript
// ❌ Detected: @ts-ignore without explanation
// @ts-ignore
const value = someValue;

// ✅ Allowed: @ts-ignore with justification
// @ts-ignore - zod v3.21: https://github.com/colinhacks/zod/issues/1821
const value = someValue;
```

### 3. Patterns Not Yet Detected (Future)

- Implicit `any` in function returns
- Dynamic `any` in object properties
- Spread operator with `any` type

## Exception Handling

### Viewing Exceptions

All exceptions are tracked in `ALLOWED_ANY_EXCEPTIONS.json`:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-03-11T17:15:00Z",
  "exceptions": [
    {
      "file": "apps/api/src/legacy/compat.ts",
      "pattern": "explicit-any",
      "reason": "Legacy compatibility layer required for backward compatibility",
      "approvedBy": "architecture-team",
      "approvedDate": "2026-03-01",
      "sunsetDate": "2026-06-01",
      "status": "active"
    }
  ]
}
```

### Adding an Exception

1. Request approval from architecture team
2. Add entry to `ALLOWED_ANY_EXCEPTIONS.json`
3. Include sunset date (max 90 days)
4. Update lastUpdated timestamp
5. Commit with exception approval

### Expired Exceptions

The guard script flags exceptions past their sunset date:

```bash
❌ EXPIRED: apps/api/src/legacy/compat.ts (expired 2026-06-15)
```

Action required: Fix the code or request extension by that date.

## CI Integration

The guard script runs automatically in CI:

```yaml
name: Type Safety Check
on: [push, pull_request]

jobs:
  type-safety:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun typecheck
      - run: bun type-safety-guard --json
```

If violations detected: CI job fails → PR merge blocked

## Common Workflows

### Find all any in a package

```bash
bun type-safety-guard -- packages/domain-core
```

### Check specific files

```bash
bun type-safety-guard -- apps/api/src/routes/*.ts
```

### Get summary only

```bash
bun type-safety-guard --summary
```

### Validate an exception

```bash
bun type-safety-guard --validate-exceptions
```

## Troubleshooting

### "Permission denied" when running script

```bash
chmod +x scripts/type-safety-guard.ts
bun type-safety-guard
```

### Script found no violations (but you know they exist)

The script uses glob patterns. Check that:

1. Files are `.ts` or `.tsx` extension
2. No `node_modules/` or `.next/` directories
3. File content actually has the pattern

Try explicitly:

```bash
bun type-safety-guard -- apps/api/src/file.ts
```

### Exception not being recognized

Check that:

1. JSON is valid: `bun run -e "console.log(require('./ALLOWED_ANY_EXCEPTIONS.json'))"`
2. Sunset date is in future: `new Date("2026-06-01") > Date.now()`
3. Status is "active": `status: "active"` not `status: "approved"`

## Advanced Usage

### Generate exception template

```bash
bun type-safety-guard --generate-exception-template > /tmp/exception.json
```

### Batch add exceptions

```bash
bun type-safety-guard --json | bun run scripts/bulk-add-exceptions.ts
```

### Pre-commit hook integration

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
bun type-safety-guard --no-exit-error || echo "⚠️  Type safety warnings (non-blocking)"
```

---

See also: [Type Safety Handbook](./TYPE_SAFETY_HANDBOOK.md) for full layer details
