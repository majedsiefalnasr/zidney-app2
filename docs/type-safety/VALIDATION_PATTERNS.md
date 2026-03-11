# Validation Patterns Guide

Comprehensive guide to runtime validation patterns for external data.

## Overview

Layer 4 of Type Safety Governance requires validation of all external data at entry points. This converts `unknown` data into strictly typed models.

## The Pattern

### Step 1: External Data is `unknown`

```typescript
// External data from API, DB, queue, env vars
const externalData: unknown = await fetchFromExternalSource();
```

### Step 2: Validate with Schema

```typescript
import { UserSchema } from "@packages/validation/schemas/domain-models";

const user = UserSchema.parse(externalData);
// If invalid: throws ZodError
// If valid: user is strictly typed as User
```

### Step 3: Use Safe Typed Value

```typescript
// Now safe to use in domain logic
await updateUserRole(user.id, "admin");
```

## Entry Points Requiring Validation

### 1. API Route Handlers

```typescript
// apps/api/src/routes/users.ts
import { Router } from "hono";
import { UpdateUserSchema } from "@packages/validation/schemas";

export const router = new Router();

router.post("/users/:id", async (c) => {
  // ✅ Validate request body
  const bodyData: unknown = await c.req.json();
  const updateData = UpdateUserSchema.parse(bodyData);

  // ✅ Validate URL params
  const paramData = { id: c.req.param("id") };
  const params = z.object({ id: z.string().uuid() }).parse(paramData);

  // ✅ Validate query params
  const queryData = Object.fromEntries(c.req.query());
  const query = QueryParamsSchema.parse(queryData);

  // Now use validated: updateData, params, query
  const updated = await updateUser(params.id, updateData);
  return c.json(updated);
});
```

### 2. Database Results

```typescript
// apps/api/src/db/users.ts
import { UserSchema } from "@packages/validation/schemas/domain-models";

export async function getUserById(id: string): Promise<User> {
  // Raw DB result is unknown
  const dbResult = await db.query("SELECT * FROM users WHERE id = ?", [id]);

  // ✅ Validate before returning
  const user = UserSchema.parse(dbResult[0]);
  return user;
}
```

### 3. Queue Messages

```typescript
// apps/worker/src/handlers/process-attempt.ts
import { AttemptEventSchema } from "@packages/validation/schemas";

export async function handleAttemptEvent(message: unknown) {
  // ✅ Validate message payload
  const event = AttemptEventSchema.parse(message);

  // Now use typed event
  await processAttempt(event.attemptId, event.answers);
}
```

### 4. Environment Variables

```typescript
// packages/config/src/env.ts
import { z } from "zod";

// ✅ Validate env vars at startup
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production"]),
});

export const env = EnvSchema.parse(process.env);
// If any validation fails: app doesn't start
// If valid: env is strictly typed
```

### 5. Third-Party API Responses

```typescript
// apps/api/src/external/stripe-client.ts
import { StripeWebhookSchema } from "@packages/validation/schemas";

export async function handleStripeWebhook(body: unknown) {
  // ✅ Validate webhook payload
  const webhook = StripeWebhookSchema.parse(body);

  // Now safe to use webhook
  await handlePaymentUpdate(webhook.id, webhook.amount);
}
```

## Creating Validation Schemas

### Basic Schema (Zod)

```typescript
import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["student", "instructor", "admin"]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof UserSchema>;
```

### Union Types

```typescript
export const AttemptEventSchema = z.union([
  z.object({
    type: z.literal("started"),
    attemptId: z.string().uuid(),
    studentId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("submitted"),
    attemptId: z.string().uuid(),
    answers: z.array(
      z.object({
        questionId: z.string().uuid(),
        answer: z.string(),
      }),
    ),
  }),
]);

export type AttemptEvent = z.infer<typeof AttemptEventSchema>;
```

### Nested Schemas

```typescript
const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  zipCode: z.string(),
});

const CompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  headquarters: AddressSchema, // Nested
  employees: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
    }),
  ),
});
```

### With Coercion

```typescript
// Coerce string to number, date, etc.
export const AttemptScoreSchema = z.object({
  attemptId: z.string().uuid(),
  score: z.coerce.number().int().min(0).max(100), // "85" → 85
  submittedAt: z.coerce.date(), // ISO string → Date
});
```

### With Defaults

```typescript
export const CreateWorkspaceSchema = z.object({
  name: z.string(),
  slug: z.string().optional(),
  description: z.string().default(""),
  isPublic: z.boolean().default(false),
});
```

## Error Handling

### Zod Parse Errors

```typescript
try {
  const user = UserSchema.parse(data);
} catch (error) {
  if (error instanceof z.ZodError) {
    // Schema validation failed
    return c.json(
      {
        error: "Invalid request",
        details: error.issues,
      },
      { status: 422 },
    );
  }
  throw error;
}
```

### Safe Parse (Non-Throwing)

```typescript
const result = UserSchema.safeParse(data);
if (!result.success) {
  return c.json(
    {
      error: "Validation failed",
      issues: result.error.issues,
    },
    { status: 422 },
  );
}
// result.data is strictly typed
const user = result.data;
```

## Performance Considerations

### Validation Latency Target

✅ **Goal**: <100ms per validation at p95

### Optimize Schemas

```typescript
// ❌ SLOW: Complex regex every validation
const EmailSchema = z
  .string()
  .email()
  .refine(
    (email) => checkEmailExists(email), // Database lookup!
    { message: "Email not found" },
  );

// ✅ FAST: Simple coercive validation
const EmailSchema = z.string().email();
// Check existence separately if needed:
const email = EmailSchema.parse(data);
const exists = await checkEmailExists(email);
```

### Cache Schema Parsing

```typescript
// Zod schemas are lightweight, safe to reuse
const userSchema = z.object({
  /* ... */
});

app.post("/users", async (c) => {
  const data = userSchema.parse(await c.req.json());
  // Schema parsing is fast
});
```

## Testing Validation

```typescript
// tests/validation/user.schema.test.ts
import { test, expect } from "vitest";
import { UserSchema } from "@packages/validation/schemas";

test("valid user passes validation", () => {
  const data = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    email: "user@example.com",
    name: "John Doe",
    role: "student",
    createdAt: "2026-03-11T00:00:00Z",
    updatedAt: "2026-03-11T00:00:00Z",
  };

  const result = UserSchema.safeParse(data);
  expect(result.success).toBe(true);
  expect(result.data.role).toBe("student");
});

test("invalid email throws", () => {
  expect(() =>
    UserSchema.parse({
      ...validData,
      email: "invalid-email",
    }),
  ).toThrow();
});
```

---

See also: [Type Safety Handbook](./TYPE_SAFETY_HANDBOOK.md)
