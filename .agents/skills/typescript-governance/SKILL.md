---
name: typescript-governance
description: TypeScript governance rules for the Zidney monorepo
---

# TypeScript Governance Skill

## Purpose

This skill defines the **TypeScript safety rules for the Zidney monorepo**. Its goal is to prevent AI-generated code from weakening the type system, especially through unsafe constructs like `any`, `as any`, or unchecked external data.

Zidney uses **strict TypeScript as a core architectural boundary**. Any code that bypasses the type system is considered a potential architecture violation.

This skill ensures that:

- Type safety is preserved across the entire monorepo
- AI-generated code follows strict typing patterns
- Runtime data is validated before use
- `any` does not spread through the codebase

---

# Core Principles

## 1. `any` Is Forbidden

The `any` type disables TypeScript’s type checking and is therefore **not allowed** in normal code.

Forbidden patterns:

```
const value: any
let data: any
function parse(input: any)
```

Also forbidden:

```
as any
<any>
```

The only allowed use of `any` is when **explicitly justified with a comment**.

Example:

```ts
// biome-ignore lint/suspicious/noExplicitAny -- third-party SDK lacks type definitions
const sdk: any = window.ExternalSDK
```

If a safe alternative exists, the AI **must not use `any`.**

---

## 2. Use `unknown` for External Data

External data sources must never be typed as `any`.

External sources include:

- API responses
- Database drivers
- message queues
- environment variables
- third‑party SDK responses

Correct pattern:

```ts
const data: unknown = await fetch(...)
```

Then validate before use.

---

## 3. Validate Unknown Data

Unknown data must be validated before being treated as a domain type.

Zidney standardizes validation in:

```
packages/validation
```

Example using schema validation:

```ts
const user = UserSchema.parse(data)
```

Never assume external data structure.

Forbidden:

```
const user = data as User
```

---

## 4. Prefer Generics Over `any`

When writing reusable functions, prefer generics.

Incorrect:

```
function parse(input: any) { }
```

Correct:

```
function parse<T>(input: unknown): T
```

This preserves type safety across call sites.

---

## 5. Domain Logic Must Be Fully Typed

Core domain modules must never contain `any`.

Critical packages:

```
packages/domain-core
packages/types
packages/validation
```

All exported functions must declare explicit return types.

Example:

```ts
export function calculateScore(user: User): Score
```

Never rely on implicit return inference for public APIs.

---

## 6. Use Safe Dynamic Types

Instead of `any`, use structured dynamic types.

Preferred alternatives:

Dynamic object:

```
Record<string, unknown>
```

JSON-like structure:

```
unknown
```

Dictionary with typed values:

```
Record<string, string>
```

---

## 7. Never Silence Type Errors

The following are forbidden:

```
@ts-ignore
@ts-nocheck
```

Allowed only if absolutely necessary and documented:

```
@ts-expect-error -- explanation
```

---

# AI Coding Rules

When the AI writes TypeScript code it must:

1. Avoid `any`
2. Prefer `unknown` for external data
3. Use explicit function return types
4. Validate external data before use
5. Prefer generics to dynamic typing
6. Avoid unsafe type assertions

If the AI cannot determine a type, it must:

```
1. search the repo for the correct type
2. inspect packages/types
3. inspect domain-core models
4. infer the correct interface
```

Only after exhausting those options may it introduce a temporary placeholder type.

---

# Type Safety Enforcement

Type safety is enforced through multiple layers.

Compiler layer:

```
tsconfig strict mode
noImplicitAny
noUncheckedIndexedAccess
```

Lint layer:

```
Biome noExplicitAny
```

Architecture guard:

```
scripts/ai-guard.ts
```

CI validation:

```
bun run typecheck
```

AI governance:

```
.agents/skills/typescript-governance
```

Together these ensure that unsafe typing cannot silently enter the codebase.

---

# Summary

Zidney treats TypeScript as an **architectural safety system**, not just a developer convenience.

Unsafe types introduce hidden runtime risks, weaken IDE tooling, and make AI-generated code harder to maintain.

This skill ensures that every contributor—human or AI—maintains strict type discipline across the repository.

```ts
Good TypeScript is architecture.
Bad TypeScript is technical debt.
```
