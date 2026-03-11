# AI Governance Handbook - Type Safety Rules for AI Agents

Comprehensive guide for AI agents contributing code to Zidney with type safety requirements.

## Your Responsibility as an AI Agent

You are an AI code-generation agent trusted to contribute to Zidney's codebase. Every line of code you generate must meet identical type safety standards as human-written code.

**No Special Paths**. No Exemptions. Same CI Gates.

---

## The 4 Core Rules

### Rule 1: Never Use `any`

✅ **Why**: `any` disables TypeScript's type checking, enabling runtime bugs to slip into production.

**What You Must Do**:

- ❌ Never write: `function foo(x: any) { }`
- ❌ Never write: `const x = data as any`
- ❌ Never write: `const x = <any>data`
- ✅ Always write: `function foo(x: unknown) { const validated = schema.parse(x); ... }`

**The Pattern**:

```typescript
// External data is unknown
const externalData: unknown = await fetch("/api").then((r) => r.json());

// Validate immediately with schema
const validated = MySchema.parse(externalData);

// Use validated data safely
await processData(validated);
```

If you don't know the schema, **stop and ask** before proceeding.

---

### Rule 2: Validate All External Data at Boundaries

✅ **Why**: External data (API, DB, queue, env) can be any shape, and we must validate before using it.

**External Data Sources**:

- API request bodies
- URL/query parameters
- Database query results
- Queue message payloads
- Environment variables
- Third-party API responses
- File uploads

**Pattern for Each**:

**API Request Body**:

```typescript
router.post("/users", async (c) => {
  const bodyData: unknown = await c.req.json();
  const request = CreateUserSchema.parse(bodyData);
  await createUser(request);
});
```

**Database Results**:

```typescript
async function getUser(id: string): Promise<User> {
  const result = await db.query("SELECT * FROM users WHERE id = ?", [id]);
  return UserSchema.parse(result[0]); // Validate before returning
}
```

**Queue Messages**:

```typescript
async function handleMessage(message: unknown) {
  const event = MyEventSchema.parse(message);
  await processEvent(event);
}
```

**Environment Variables** (at app startup):

```typescript
const env = EnvSchema.parse(process.env);
export const DATABASE_URL = env.DATABASE_URL; // Now typed
```

**Always validate, every time, no exceptions.**

---

### Rule 3: Use Generics Instead of Dynamic Types

✅ **Why**: Generics preserve type information, `any` destroys it.

**When You Need Flexibility**:

❌ **WRONG**: Use `any` (loses type info)

```typescript
function transform(input: any): any {
  return JSON.parse(JSON.stringify(input));
}
const result = transform(user); // result is any, lost type!
```

✅ **CORRECT**: Use generics (preserves type)

```typescript
function transform<T>(input: T): T {
  return JSON.parse(JSON.stringify(input));
}
const result = transform(user); // result is User ✅
```

**Generic Patterns**:

```typescript
// Generic function
export function getById<T>(id: string, schema: z.ZodSchema<T>): Promise<T>;

// Generic class
export class Repository<T> {
  async findById(id: string): Promise<T> {}
}

// Generic utility
export type Paginated<T> = {
  items: T[];
  total: number;
};
```

Use generics everywhere you need flexibility.

---

### Rule 4: Justify All `@ts-ignore` Comments

✅ **Why**: `@ts-ignore` bypasses type checking. We need to know why and track expirations.

**Format Required**:

```typescript
// @ts-ignore - <library>: <version> - <issue URL or ticket>
// Brief explanation of why this is necessary
const value = someProperty;
```

**Example**:

```typescript
// @ts-ignore - zod: v3.21 - https://github.com/colinhacks/zod/issues/1821
// TypeScript 5.0 doesn't infer return type correctly with this zod syntax
const parsed = schema.parse(data);
```

**When `@ts-ignore` is OK** (rare):

- [ ] Working around temporary library version bug
- [ ] Compatibility shim for deprecated API
- [ ] Code has sunset date in exception registry
- [ ] Approved by architecture team

**Don't Use `@ts-ignore` When**:

- [ ] Just because you don't want to fix the type
- [ ] You could use `unknown` + validation instead
- [ ] You could use a generic instead
- [ ] No one else knows why it's there

If you feel the urge to use `@ts-ignore`, **stop and ask first**.

---

## Decision Trees

### "I Have Unknown External Data"

```
External data (API, DB, queue, env)?
│
├─ Yes → Declare as unknown
│        ↓
│        Create schema with z.object()
│        ↓
│        Call schema.parse(data)
│        ↓
│        Use validated data ✅
│
└─ No → Data already typed? Use it ✅
```

### "TypeScript Complains About Type Mismatch"

```
Is the mismatch real?
(Could data actually be different type at runtime?)
│
├─ Yes → FIX THE BUG ✅
│        (The type checker caught a real error)
│
└─ No → Too strict?
         │
         ├─ Can I use more specific type? → YES ✅
         │  (e.g., string | number instead of unknown)
         │
         ├─ Can I add validation? → YES ✅
         │  (validate, preserve types)
         │
         └─ Blocked by external library?
            ├─ Temporary bug? → Request exception ✅
            └─ Design limitation? → Stop & ask ⚠️
```

### "Should I Use `any` or `unknown`?"

```
Do I know the type?
│
├─ Yes → Use specific type ✅
│        interface User { ... }
│        function process(user: User) { }
│
└─ No → Use unknown + validate ✅
         function process(data: unknown) {
           const validated = schema.parse(data);
         }
```

**Never choose `any` as a shortcut.**

---

## Pre-Submission Checklist

Before committing code, verify:

- [ ] **No `any` usage** (check entire commit)

  ```bash
  git diff | grep -E ":\s*any|as any|<any>"  # Should be empty
  ```

- [ ] **All external data validated**
  - [ ] API request bodies parsed with schema
  - [ ] Database results parsed with schema
  - [ ] Queue messages parsed with schema
  - [ ] Env vars parsed at startup
- [ ] **Generics preferred over dynamic types**
  - [ ] No `any` in generics
  - [ ] Functions have explicit return types
  - [ ] Classes use `<T>` for flexibility

- [ ] **All `@ts-ignore` justified**
  - [ ] Every `@ts-ignore` has library + version + URL
  - [ ] Comments explain the blocking issue

- [ ] **TypeScript passes**

  ```bash
  bun typecheck  # No errors
  ```

- [ ] **Full validation passes**

  ```bash
  bun validate:types  # typecheck + guard + biome
  ```

- [ ] **Tests pass**

  ```bash
  bun test
  ```

- [ ] **No secrets exposed**
  - [ ] No passwords in code
  - [ ] No API keys hardcoded
  - [ ] No internal URLs

If ANY check fails, stop and fix before submitting.

---

## When You're Unsure

If you encounter a situation where the type safety rules are unclear:

**STOP. Ask for clarification.**

Examples:

- "I need `any` for this third-party library — what should I do?"
- "The schema validation seems complex — can you review?"
- "Should I use `as unknown` or `unknown`?"
- "Is this exception case legitimate?"

Post in: #ai-governance Slack or GitHub discussion

Do NOT:

- ❌ Guess at the type-safe solution
- ❌ Use `any` as a placeholder
- ❌ Skip validation because it's complex
- ❌ Leave `@ts-ignore` comments without explanation

---

## Code Review Standards

Your code will be reviewed by humans who will verify:

1. ✅ No `any` usage (except approved exceptions)
2. ✅ All external data validated
3. ✅ Generics preferred over `any`
4. ✅ `@ts-ignore` comments justified
5. ✅ `bun typecheck` passes
6. ✅ `bun validate:types` passes (full suite)
7. ✅ Tests comprehensive
8. ✅ No security issues

**You are held to identical standards as human code.**

If violations are found, your PR will be rejected with explanation.

---

## Examples of Good & Bad

### Example 1: API Endpoint

❌ **BAD** (violates Rule 1 & 2):

```typescript
router.post("/users", async (c) => {
  const data: any = await c.req.json();
  const user = await createUser(data); // No validation!
});
```

✅ **GOOD** (follows all rules):

```typescript
router.post("/users", async (c) => {
  const body: unknown = await c.req.json();
  const request = CreateUserSchema.parse(body);
  const user = await createUser(request);
  return c.json(user);
});
```

### Example 2: Database Query

❌ **BAD** (violates Rule 2):

```typescript
async function getUser(id: string): Promise<User> {
  const result = await db.query("SELECT * FROM users WHERE id = ?", [id]);
  return result[0]; // Unvalidated!
}
```

✅ **GOOD** (follows all rules):

```typescript
async function getUser(id: string): Promise<User> {
  const result = await db.query("SELECT * FROM users WHERE id = ?", [id]);
  // Validate before returning
  return UserSchema.parse(result[0]);
}
```

### Example 3: Flexible Utility

❌ **BAD** (violates Rule 3):

```typescript
function clone(input: any): any {
  return JSON.parse(JSON.stringify(input));
}
```

✅ **GOOD** (follows all rules):

```typescript
function clone<T>(input: T): T {
  return JSON.parse(JSON.stringify(input));
}
```

### Example 4: Justified @ts-ignore

❌ **BAD** (violates Rule 4):

```typescript
// @ts-ignore
const value = something;
```

✅ **GOOD** (follows all rules):

```typescript
// @ts-ignore - zod: v3.21 - https://github.com/colinhacks/zod/issues/1821
// TypeScript 5.0 has issues with this zod pattern
const value = schema.parse(data);
```

---

## References

- [Type Safety Handbook](./TYPE_SAFETY_HANDBOOK.md) — Full system overview
- [Validation Patterns](./VALIDATION_PATTERNS.md) — How to validate data
- [Fix Type Errors](./RUNBOOK_FIX_TYPE_ERRORS.md) — Troubleshooting
- [TypeScript Governance Skill](../../.agents/skills/typescript-governance/SKILL.md) — More examples

---

**Remember**: You are not given special treatment in type safety. All code — AI or human — passes the same CI gates.

**Your responsibility**: Generate code that is type-safe, maintainable, and production-ready.

**When in doubt**: Ask for clarification rather than guessing.

---

Last Updated: 2026-03-11
