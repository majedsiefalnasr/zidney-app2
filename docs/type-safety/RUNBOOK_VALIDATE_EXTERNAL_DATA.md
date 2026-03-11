# Type Safety - Runbook: Validate External Data

Practical guide to validating external data at API boundaries.

## Overview

External data (from API requests, databases, queues, files, etc.) has type `unknown` until validated. This runbook shows how to validate data safely.

## Pattern Overview

```
External Data (unknown)
      ↓
   Validate (with schema)
      ↓
   Typed Value (safe to use)
      ↓
Domain Logic
```

## API Request Body Validation

### Basic Example

```typescript
import { Router } from "hono";
import { z } from "zod";

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["student", "instructor", "admin"]),
});

const router = new Router();

router.post("/users", async (c) => {
  try {
    // Step 1: Get request body (unknown type)
    const bodyData: unknown = await c.req.json();

    // Step 2: Validate with schema
    const validated = CreateUserSchema.parse(bodyData);

    // Step 3: Use validated data (safely typed)
    const user = await createUserInDb(validated);

    return c.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: "Validation failed",
          details: error.issues,
        },
        { status: 422 },
      );
    }
    throw error;
  }
});
```

### Safe Parse (Non-Throwing)

```typescript
router.post("/users", async (c) => {
  const bodyData: unknown = await c.req.json();

  // safeParse returns { success, data } or { success, error }
  const result = CreateUserSchema.safeParse(bodyData);

  if (!result.success) {
    return c.json(
      {
        error: "Invalid request format",
        issues: result.error.issues,
      },
      { status: 400 },
    );
  }

  // result.data is validated and typed
  const user = await createUserInDb(result.data);
  return c.json(user);
});
```

## URL Parameters Validation

### Single Parameter

```typescript
router.get("/users/:id", async (c) => {
  const id = c.req.param("id");

  // Validate it's a UUID
  const idSchema = z.string().uuid();
  const validatedId = idSchema.parse(id); // Throws if invalid

  const user = await getUserById(validatedId);
  return c.json(user);
});
```

### Multiple Parameters

```typescript
router.get("/workspaces/:workspaceId/exams/:examId", async (c) => {
  const params = {
    workspaceId: c.req.param("workspaceId"),
    examId: c.req.param("examId"),
  };

  const ParamsSchema = z.object({
    workspaceId: z.string().uuid(),
    examId: z.string().uuid(),
  });

  const validated = ParamsSchema.parse(params);

  const exam = await getExam(validated.examId, validated.workspaceId);
  return c.json(exam);
});
```

## Query Parameters Validation

```typescript
router.get("/exams", async (c) => {
  // Query params come as Record<string, string>
  const queryParams = Object.fromEntries(c.req.query());

  const QuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    sort: z.enum(["date", "title"]).optional(),
    archived: z.coerce.boolean().default(false),
  });

  const validated = QuerySchema.parse(queryParams);

  const exams = await listExams({
    page: validated.page,
    limit: validated.limit,
    sort: validated.sort,
    archived: validated.archived,
  });

  return c.json(exams);
});
```

## Database Query Results Validation

### Single Result

```typescript
async function getUserById(id: string): Promise<User> {
  // Raw DB result is unknown
  const result = await db.query("SELECT * FROM users WHERE id = ?", [id]).first(); // Gets first result

  if (!result) {
    throw new Error("User not found");
  }

  // Validate result before using
  const user = UserSchema.parse(result);
  return user;
}
```

### Multiple Results

```typescript
async function listUsers(limit: number): Promise<User[]> {
  // Raw DB results are unknown
  const results = await db.query("SELECT * FROM users LIMIT ?", [limit]).all(); // Gets all results

  // Validate each result
  const users = results.map((row) => UserSchema.parse(row));
  return users;
}
```

### Optional Result

```typescript
async function findUserByEmail(email: string): Promise<User | null> {
  const result = await db.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]).first(); // Returns null if no rows

  if (!result) {
    return null;
  }

  const user = UserSchema.parse(result);
  return user;
}
```

## Queue Message Validation

```typescript
// Message handler
async function handleAttemptSubmitted(message: unknown) {
  try {
    // Validate message structure
    const event = AttemptSubmittedSchema.parse(message);

    // Now use typed event
    await processSubmission(event.attemptId, event.answers);

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Log validation error for monitoring
      logger.error("Invalid attempt submission message", {
        error: error.issues,
      });
      // Typically re-queue for retry or send to DLQ
      throw error;
    }
    throw error;
  }
}
```

Queue message schema example:

```typescript
const AttemptSubmittedSchema = z.object({
  type: z.literal("attempt.submitted"),
  attemptId: z.string().uuid(),
  studentId: z.string().uuid(),
  examId: z.string().uuid(),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      answer: z.string(),
      options: z.array(z.string()).optional(),
    }),
  ),
  submittedAt: z.coerce.date(),
});

type AttemptSubmittedEvent = z.infer<typeof AttemptSubmittedSchema>;
```

## Environment Variable Validation

```typescript
// At application startup, validate ALL env vars
import { z } from "zod";

const EnvSchema = z.object({
  // Required
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  API_SECRET: z.string().min(32),

  // Optional with defaults
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  PORT: z.coerce.number().positive().default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Boolean
  DEBUG: z.coerce.boolean().default(false),
});

// Validate and export
export const env = EnvSchema.parse(process.env);

// Usage in code
console.log(env.DATABASE_URL); // Definitely a valid URL
const port = env.PORT; // Definitely a positive number
```

If validation fails at startup:

```
Error: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": ["DATABASE_URL"],
    "message": "Required"
  }
]
```

Application exits immediately. ✅ Fail fast!

## Third-Party API Responses

### HTTP Request Response

```typescript
import { z } from "zod";
import axios from "axios";

const StripeChargeSchema = z.object({
  id: z.string(),
  object: z.literal("charge"),
  amount: z.number().positive(),
  currency: z.string().length(3),
  status: z.enum(["succeeded", "failed", "pending", "refunded"]),
  description: z.string().optional(),
});

async function createStripeCharge(data: unknown): Promise<StripeCharge> {
  const response = await axios.post("https://api.stripe.com/v1/charges", data);

  // Validate response data
  const validated = StripeChargeSchema.parse(response.data);
  return validated;
}

type StripeCharge = z.infer<typeof StripeChargeSchema>;
```

### Webhook Payload

```typescript
const StripeWebhookSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("charge.succeeded"),
    data: z.object({
      object: StripeChargeSchema,
    }),
  }),
  z.object({
    type: z.literal("charge.failed"),
    data: z.object({
      object: StripeChargeSchema,
    }),
  }),
]);

app.post("/stripe-webhook", async (c) => {
  const body: unknown = await c.req.json();

  try {
    const event = StripeWebhookSchema.parse(body);

    switch (event.type) {
      case "charge.succeeded":
        await handleChargeSucceeded(event.data.object);
        break;
      case "charge.failed":
        await handleChargeFailed(event.data.object);
        break;
    }

    return c.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid webhook payload", { error });
      return c.json({ error: "Invalid payload" }, { status: 400 });
    }
    throw error;
  }
});
```

## File Upload Validation

```typescript
const FileUploadSchema = z.object({
  filename: z.string(),
  mimetype: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  size: z.number().max(5 * 1024 * 1024), // 5MB max
  buffer: z.instanceof(Buffer),
});

app.post("/upload", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const validated = FileUploadSchema.parse({
      filename: file.name,
      mimetype: file.type,
      size: file.size,
      buffer: await file.arrayBuffer(),
    });

    const stored = await storeFile(validated);
    return c.json(stored);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: "Invalid file",
          details: error.issues,
        },
        { status: 422 },
      );
    }
    throw error;
  }
});
```

## Error Handling Patterns

### Pattern 1: Throw on Invalid (Fails Fast)

```typescript
const user = UserSchema.parse(data); // Throws if invalid
// Only reached if valid
await saveUser(user);
```

### Pattern 2: Handle Gracefully

```typescript
const result = UserSchema.safeParse(data);
if (!result.success) {
  logger.warn("Invalid user data", { error: result.error });
  return null; // Or provide default
}
return result.data;
```

### Pattern 3: Custom Error Messages

```typescript
const schema = UserSchema.superRefine((data, ctx) => {
  if (data.age < 13) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Must be at least 13 years old",
      path: ["age"],
    });
  }
});

const result = schema.safeParse(data);
```

## Performance Optimization

### Cache Schemas

```typescript
// Create schemas once at module level
const UserSchema = z.object({
  /* ... */
});
const ListSchema = z.array(UserSchema);

// Reuse in handlers
app.get("/users", async (c) => {
  const dbUsers = await db.findAll();
  const validated = ListSchema.parse(dbUsers); // Fast (schema cached)
  return c.json(validated);
});
```

### Avoid Nested Revalidation

```typescript
// ❌ SLOW - Revalidates multiple times
const user = UserSchema.parse(data);
const id = z.string().uuid().parse(user.id); // Don't revalidate

// ✅ FAST - Single validation
const user = UserSchema.parse(data);
const id = user.id; // Already validated
```

---

Last Updated: 2026-03-11
