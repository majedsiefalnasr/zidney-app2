# TypeScript Type Safety Governance - Quick Start Guide

**Purpose**: Get developers up to speed with type safety governance in 15 minutes.

**Date**: 2026-03-11  
**Version**: 1.0.0

**Audience**: All developers, AI agents, and engineers contributing to Zidney

---

## What Just Changed?

Zidney has enabled **TypeScript Type Safety Governance**—a system of 8 layers that work together to prevent unsafe types from reaching production.

**In short**: Code with unsafe types (like `any`) will not be able to merge.

**Why?**: This protects Zidney from runtime errors that TypeScript should have caught at compile time.

---

## The 30-Second Version

### ✅ DO

```typescript
// Type external data as unknown, then validate
const raw: unknown = await fetch('/api/user').then(r => r.json());
const user = UserSchema.parse(raw);

// Always type function parameters and returns
function processUser(user: User): ProcessedUser {
  ...
}

// Use strict types everywhere
const count: number = 0;
const name: string | undefined = getName();
```

### ❌ DON'T

```typescript
// Don't use any without justification
const data: any = response;  // ❌ Will fail CI

// Don't cast to any
const user = response as any;  // ❌ Will fail CI

// Don't leave parameters untyped
function getUser(id) {  // ❌ Will fail typecheck
  ...
}

// Don't skip validation
const user = response as User;  // ❌ Unsafe! Could be wrong shape
```

---

## Quick Start: Fixing Type Errors

### When CI Fails

You'll see a comment on your PR like:

```
❌ Type Safety Check Failed

- Explicit 'any' found in src/api/users.ts:42
- Pattern: "const data: any = apiResponse"
- Fix: Use 'unknown' type and validate with schema

See: https://docs.zidney.com/type-safety
```

### Top 5 Fixes (in order of frequency)

#### 1. "Parameter implicitly has type 'any'"

**Problem**:

```typescript
function getUser(id) {
  // ❌ ERROR: id has implicit any
  return db.find(id);
}
```

**Solution**:

```typescript
function getUser(id: UserId): Promise<User> {
  // ✅ Fix: Add explicit types
  return db.find(id);
}
```

---

#### 2. "Variable implicitly has type 'any'"

**Problem**:

```typescript
const data = await response.json(); // ❌ data is unknown/any
```

**Solution**:

```typescript
const raw: unknown = await response.json();
const data = UserSchema.parse(raw); // ✅ Fix: Validate unknown → typed
```

---

#### 3. "Explicit 'any' without justification"

**Problem**:

```typescript
const sdk: any = window.ExternalSDK; // ❌ Will fail CI
```

**Solution A** (Fix the root cause):

```typescript
const sdk: typeof window.ExternalSDK = window.ExternalSDK; // ✅ Type properly
```

**Solution B** (If library truly lacks types, add comment):

```typescript
// biome-ignore lint/suspicious/noExplicitAny -- ExternalLib v2.1.0 lacks types; issue: https://github.com/external/issues/456
const sdk: any = window.ExternalSDK; // ✅ Documented exception
```

---

#### 4. "'as any' casting"

**Problem**:

```typescript
const user = response as any; // ❌ Will fail CI
```

**Solution**:

```typescript
// Don't cast; validate instead
const raw: unknown = response;
const user = UserSchema.parse(raw); // ✅ Fix: Validation not casting
```

---

#### 5. "@ts-ignore without reason"

**Problem**:

```typescript
// @ts-ignore
const x = unsafeOperation(); // ❌ Will fail CI
```

**Solution A** (Fix the type error):

```typescript
const x: SafeType = unsafeOperation(); // ✅ Fix: Type properly
```

**Solution B** (If ignoring is justified, add comment):

```typescript
// biome-ignore lint/suspicious/noImplicitAny -- Type system bug in TS 5.0; https://github.com/microsoft/typescript/issues/XXXX
const x = unsafeOperation(); // ✅ Documented exception
```

---

## How to Validate External Data

This is the most common pattern you'll write:

### Pattern: API Response

```typescript
// Step 1: Define schema (in packages/validation/)
import { z } from "zod";

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

// Step 2: Use in API handler
import { UserResponseSchema } from "@zidney/validation";

export async function getUser(id: UserId): Promise<User> {
  // Fetch from external source (type as unknown)
  const raw: unknown = await fetch(`/api/users/${id}`).then((r) => r.json());

  // Validate (unknown → validated type)
  const validated = UserResponseSchema.parse(raw);

  // Now safe to use
  return mapToUser(validated);
}
```

### Pattern: Database Query

```typescript
// Step 1: Define row schema
export const UserRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  created_at: z.coerce.date(),
});

export type UserRow = z.infer<typeof UserRowSchema>;

// Step 2: Use in repository
export async function getUserById(id: UserId): Promise<User | null> {
  // Query returns unknown rows
  const raw: unknown = await db.query<unknown>("SELECT * FROM users WHERE id = ?", [id]);

  if (!raw) return null;

  // Validate
  const row = UserRowSchema.parse(raw);

  // Safe to map to domain model
  return toDomainUser(row);
}
```

### Pattern: Form Input

```typescript
// Step 1: Define schema
export const LoginFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginForm = z.infer<typeof LoginFormSchema>;

// Step 2: Use in handler
export function handleLogin(formData: unknown) {
  try {
    const form = LoginFormSchema.parse(formData);
    return authenticate(form.email, form.password);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: "Invalid input", violations: error.errors };
    }
    throw error;
  }
}
```

---

## Local Development Setup

### 1. Install Dependencies

```bash
cd /path/to/zidney
bun install
```

### 2. Understand Your tsconfig.json

You're now in **strict mode**. This means:

```json
{
  "compilerOptions": {
    "strict": true, // All strict checks on
    "noImplicitAny": true, // No implicit any
    "strictNullChecks": true, // Null/undefined explicit
    "noUncheckedIndexedAccess": true // Array/object access safe
  }
}
```

### 3. Type-Check Locally (Before You Commit)

```bash
# Check types
bun typecheck

# Check for unsafe patterns
bun type-safety-guard

# Both should pass before you push
```

### 4. If Local Check Fails

```bash
# See what's wrong
bun typecheck

# Read the error message
# Go to the line in your editor
# Fix the type issue

# Common fixes:
# - Add type annotation
# - Add validation
# - Use optional chaining (?.)
# - Handle null/undefined case
```

---

## Common Questions

### Q: Can I use `any`?

**A**: Only in these cases:

1. **External SDK lacks types** (rare):

   ```typescript
   // biome-ignore lint/suspicious/noExplicitAny -- ExternalLib@2.1.0 lacks types
   const sdk: any = window.ExternalLibrary;
   ```

2. **It's in an allow-listed exception** (architecture team only)

**Otherwise**: No. Use `unknown` and validate, or use proper types.

---

### Q: What's the difference between `any` and `unknown`?

**A**: Think of it this way:

```typescript
// any = "I don't know what this is, and TypeScript shouldn't check"
const data: any = something;
data.toUpperCase(); // ✅ Allowed (no runtime safety check)

// unknown = "I don't know, but I must prove it's safe before using it"
const data: unknown = something;
data.toUpperCase(); // ❌ Error (must check type first)

// Fix: Use type guard or validation
if (typeof data === "string") {
  data.toUpperCase(); // ✅ Now safe (proven to compiler)
}
```

**Key difference**: `any` skips type safety; `unknown` enforces it.

---

### Q: Why can't I assert with `as User`?

**A**: Because the data might not actually be a User:

```typescript
// ❌ NOT SAFE
const user = apiResponse as User;
// If apiResponse is wrong shape, silent bug at runtime

// ✅ SAFE
const raw: unknown = apiResponse;
const user = UserSchema.parse(raw);
// If wrong shape, error raised immediately
// If correct, type is proven safe
```

**The validation layer converts untrusted data to trusted types.**

---

### Q: Can I make an exception?

**A**: Yes, but only for legitimate reasons.

**Process**:

1. You find code that truly needs `any` (rare)
2. Open GitHub issue with business justification
3. Architecture team reviews
4. Exception added to `ALLOWED_ANY_EXCEPTIONS.json`
5. Guard script learns to ignore this exception

**Common examples**:

- Third-party SDK without types (tracked in `#issue-123`)
- Temporary workaround pending architecture review
- Legacy code planned for refactor

**NOT exceptions**:

- "I don't want to type this" (no, type it)
- "It's faster" (no, write it correctly)
- "I don't know what type it is" (yes, we can help; ask the team)

---

### Q: How do I know what type something should be?

**A**: Decision tree:

1. **Does it come from outside your application?**
   - YES → Type as `unknown`, validate with schema
   - NO → Continue...

2. **Can TypeScript infer it from context?**
   - YES → Let TypeScript infer (omit type annotation)
   - NO → Continue...

3. **Is it a function parameter?**
   - YES → Must specify explicit type
   - NO → Continue...

4. **Search the repository for similar code**
   - Found → Use same type
   - Not found → Continue...

5. **Check `packages/types`**
   - Found → Use existing type definition
   - Not found → Continue...

6. **Check `packages/domain-core`**
   - Found → Use domain model
   - Not found → Use generic placeholder with TODO comment

---

### Q: Can AI agents contribute code?

**A**: Yes! But they must follow type safety rules.

**AI agents must**:

- ✅ Pass `bun typecheck`
- ✅ Pass `biome lint`
- ✅ Pass `bun type-safety-guard`
- ✅ Validate external data
- ✅ Type all boundaries

**No special treatment for AI code.** Same rules, same CI checks, same standard.

---

## Running Type Safety Checks

```bash
# Check TypeScript compilation
bun typecheck

# Check for unsafe patterns
bun type-safety-guard

# Lint for type safety violations
biome lint --only=suspicious

# Run all checks (what CI runs)
bun run validate:types

# Watch mode (for development)
bun typecheck --watch
```

**Interpretation**:

```bash
$ bun typecheck
# Output: (nothing) = SUCCESS
# Exit code: 0 = PASS

$ bun typecheck
# Output: error TS2339: Property 'xyz' does not exist...
# Exit code: 1 = FAIL
# → Fix the error and run again
```

---

## Integration with Your IDE

### VS Code (TypeScript Extension)

**You should see**:

- Squiggly underlines for type errors (red)
- Type hints on hover
- Auto-complete suggestions with types
- `Quick Fix` suggestions (lightbulb icon)

**If you don't**:

1. Open Command Palette: `Cmd/Ctrl + Shift + P`
2. Type: "TypeScript: Restart TS Server"
3. Press Enter
4. Wait ~2 seconds for language server to restart

### WebStorm / IntelliJ

**Types should already work**. If not:

1. Settings → Languages & Frameworks → TypeScript
2. Check "TypeScript Language Service" is enabled
3. Restart IDE

---

## Testing Your Changes Locally

Before pushing, run the full validation:

```bash
#!/bin/bash
# Put this in a file, e.g., ./validate-before-push.sh

echo "Step 1: TypeScript type check..."
bun typecheck || exit 1

echo "Step 2: Guard script..."
bun type-safety-guard || exit 1

echo "Step 3: Biome linting..."
biome lint --only=suspicious || exit 1

echo "✅ All type safety checks passed!"
```

Then run it:

```bash
chmod +x ./validate-before-push.sh
./validate-before-push.sh
```

---

## What CI Will Check

When you push a PR, GitHub Actions will run:

1. **TypeScript Compiler** (`bun typecheck`)
   - Must pass; no errors
   - Tests: Does code compile?

2. **Guard Script** (`bun type-safety-guard`)
   - Must detect no violations
   - Tests: Are there unsafe patterns?

3. **Biome Linter** (`biome lint`)
   - Must pass type rules
   - Tests: Are `any` uses justified?

**If any fails**: Merge button is disabled. You must fix and re-push.

**If all pass**: Merge button enabled. You can merge.

---

## Getting Help

### I don't know how to type this

1. Search the repo for similar patterns:

   ```bash
   grep -r "type MyThing" packages/
   ```

2. Ask your team (Slack: #type-safety-help)

3. Check [Type Safety Rules Handbook](../docs/type-safety/type-safety-rules-handbook.md)

4. Check [Validation Pattern Guide](../docs/type-safety/runbook-validate-external-data.md)

---

### My code is correct but CI says it's wrong

1. Check CI output for specific error
2. Run locally to reproduce: `bun typecheck`
3. If it works locally but fails CI:
   - Clear node_modules: `rm -rf node_modules && bun install`
   - Rebuild: `bun run build`
   - Check if stale cache: `bun run infra:cache:clean`

---

### I want an exception

1. Open GitHub issue with:
   - File path + line number
   - Business justification (1-2 sentences)
   - Proposed expiration date (if temporary)
   - Issue reference (if depends on external work)

2. Request review from @team-architecture

3. Once approved, exception is added to `ALLOWED_ANY_EXCEPTIONS.json`

4. Re-run CI; it should pass

---

## Next Steps

1. **Read about your specific use case**:
   - Typing new API endpoints: [Runbook](../docs/type-safety/runbook-type-new-api-endpoint.md)
   - Validating external data: [Runbook](../docs/type-safety/runbook-validate-external-data.md)
   - Fixing type errors: [Runbook](../docs/type-safety/runbook-fix-type-errors.md)

2. **Run local type-check before each commit**:

   ```bash
   bun typecheck && bun type-safety-guard
   ```

3. **Ask questions in #type-safety-help**

4. **Contribute**: Improve these docs if something's unclear

---

## Key Takeaway

**Type Safety Governance isn't about rules—it's about confidence.**

When you write code that passes type safety checks, you can be confident that:

- ✅ Basic mistakes are caught at compile time
- ✅ External data is validated before use
- ✅ Refactoring is safe across boundaries
- ✅ Your teammates can trust the types they see

**This is especially important in AI-assisted development**, where code is generated quickly and must still be correct.

**Welcome to type-safe Zidney!** 🎉
