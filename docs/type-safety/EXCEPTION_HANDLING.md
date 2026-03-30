# Exception Handling & Sunset Management

Guide for managing type safety exceptions and tracking approval/expiration.

## Overview

The Type Safety Governance system allows controlled exceptions to the no-`any` rule when justified. Every exception has:

- **Reason**: Why the exception is necessary
- **Approval**: Who approved it and when
- **Sunset Date**: When it must be fixed (max 90 days)
- **Status**: Active, expired, or revoked

## Exception Workflow

### 1. Request Approval

When you need to use `any`:

```typescript
// (In code)
// TODO: Request type safety exception for @any
// GitHub Issue: https://github.com/zidney/zidney-app2/issues/12345
// Reason: Legacy API response type signature unknown
const data = response as any;
```

Create a GitHub issue requesting the exception:

```markdown
## Type Safety Exception Request

**File**: `apps/api/src/deprecated/legacy-handler.ts`
**Pattern**: `explicit-any`
**Reason**: Legacy 3rd-party API (deprecated) returns untyped response. No TypeScript definitions available. Deprecation target: Q3 2026.

**Mitigation**:

- Migration plan to replace with typed alternative
- Temporary runtime validation wrapper
- Sunset date: 2026-06-30

**Requested by**: @developer-name
**Approval**: @architecture-team
```

### 2. Architecture Team Review

The architecture team reviews and approves/rejects:

Approval criteria:

- ✅ Legitimate blocking issue (no easy fix)
- ✅ Reasonable sunset date (≤90 days)
- ✅ Clear migration plan documented
- ✅ Minimal scope (only what's necessary)

### 3. Register Exception

Once approved, add to `ALLOWED_ANY_EXCEPTIONS.json`:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-03-11T17:15:00Z",
  "exceptions": [
    {
      "file": "apps/api/src/deprecated/legacy-handler.ts",
      "pattern": "explicit-any",
      "reason": "Legacy API response untyped. No TypeScript definitions available.",
      "approvedBy": "architecture-team",
      "approvedDate": "2026-03-11",
      "sunsetDate": "2026-06-30",
      "status": "active"
    }
  ]
}
```

**Exception format**:

| Field          | Type     | Required | Notes                                       |
| -------------- | -------- | -------- | ------------------------------------------- |
| `file`         | string   | Yes      | Relative path from repo root                |
| `pattern`      | enum     | Yes      | `implicit-any`, `explicit-any`, `ts-ignore` |
| `reason`       | string   | Yes      | 1-2 sentence justification                  |
| `approvedBy`   | string   | Yes      | GitHub handle or team name                  |
| `approvedDate` | ISO date | Yes      | When approved (YYYY-MM-DD)                  |
| `sunsetDate`   | ISO date | Yes      | When it must be fixed (YYYY-MM-DD)          |
| `status`       | enum     | Yes      | `active`, `expired`, `revoked`              |

### 4. Implement Code

Add justification comment in your code:

```typescript
// Type safety exception (approved 2026-03-11, sunset 2026-06-30)
// Reason: Legacy API response untyped. No TypeScript definitions available.
// GitHub: https://github.com/zidney/zidney-app2/issues/12345
const data = response as any;
```

### 5. Update Exception on Sunset

**Before sunset date**: Either fix the code or request extension

**If fixing**:

1. Remove exception from `ALLOWED_ANY_EXCEPTIONS.json`
2. Fix the code to be properly typed
3. Remove justification comment
4. Commit: "fix: resolve type safety exception #12345"

**If extending** (only if blocked by external factors):

1. Create GitHub issue requesting extension
2. Update `sunsetDate` in registry
3. Update `approvedDate`
4. Commit: "docs: extend exception sunset to 2026-09-30"

**If expired** (not fixed before deadline):

1. CI will fail with: `❌ EXPIRED: file.ts (expired YYYY-MM-DD)`
2. Code does not compile
3. Must fix immediately or request formal extension

## Protected Packages

These packages have **zero tolerance** for undeclared `any`:

- `packages/domain-core/` — Core business logic
- `packages/types/` — Type definitions
- `packages/validation/` — Validation schemas

Exceptions in protected packages require:

- ✅ Architecture team approval
- ✅ Written business case
- ✅ Mandatory sunset date (≤30 days)

## Exception Hygiene

### Monthly Review

Every month, check for expiring exceptions:

Run the repository's current monthly exception review workflow.

Reports:

- Exceptions expiring in next 30 days
- Already-expired exceptions
- Active exceptions per package

### Quarterly Cleanup

Q1, Q2, Q3, Q4: Review and close resolved exceptions

Use the current quarterly exception cleanup workflow for the repository.

Actions:

- Mark `expired` (if deadline passed without fix)
- Remove (if code fixed)
- Extend (if still needed, with approval)

## Common Scenarios

### Scenario 1: Third-Party Library Untyped Response

**Problem**: A library you depend on returns untyped data

**Solution**:

```typescript
// Type safety exception (approved 2026-03-11, sunset 2026-06-30)
// Reason: axios@1.6.2 response types incomplete
// GitHub: https://github.com/axios/axios/issues/5000
import { AxiosResponse } from 'axios';
const response: AxiosResponse<any> = await client.get(...);

// Then immediately validate/convert:
const validated = userSchema.parse(response.data);
```

Exception registry entry:

```json
{
  "file": "apps/api/src/external/axios-client.ts",
  "pattern": "explicit-any",
  "reason": "axios response types incomplete in v1.6.2. Mitigated by validation wrapper.",
  "approvedBy": "architecture-team",
  "approvedDate": "2026-03-11",
  "sunsetDate": "2026-06-30",
  "status": "active"
}
```

### Scenario 2: Legacy Code Requiring Gradual Migration

**Problem**: Old code uses `any` extensively, must be refactored gradually

**Solution**: Create exception per file with 30-day deadline

```json
{
  "file": "apps/api/src/deprecated/legacy-auth.ts",
  "pattern": "explicit-any",
  "reason": "Legacy authentication module. Refactoring in progress. Target completion: 2026-04-15",
  "approvedBy": "architecture-team",
  "approvedDate": "2026-03-11",
  "sunsetDate": "2026-04-15",
  "status": "active"
}
```

Track progress:

- Break legacy file into smaller typed modules
- Replace `any` imports step-by-step
- Remove exception when legacy code fully replaced

### Scenario 3: Unknown External Data (Correct Pattern)

**Problem**: Need to receive untyped data from external API

**Solution**: Use `unknown`, validate immediately, NO exception needed

```typescript
// ✅ CORRECT - No exception needed
async function handleWebhook(body: unknown) {
  const validated = webhookSchema.parse(body); // Throws if invalid
  return processWebhook(validated); // Now strictly typed
}
```

No exception entry needed when using `unknown` + validation!

## Monitoring & Reporting

### View all exceptions

```bash
bun run arch:type-safety-guard --list-exceptions
```

### Export exception report

```bash
bun run arch:type-safety-guard --export-exceptions > exceptions-report.json
```

### Check exception status

```bash
bun run arch:type-safety-guard --validate-exceptions
```

Shows:

- ✅ Active exceptions with time remaining
- ⚠️ Expiring soon (≤14 days)
- ❌ Expired (need immediate action)

---

See also: [Guard Script Usage](./GUARD_SCRIPT.md)
